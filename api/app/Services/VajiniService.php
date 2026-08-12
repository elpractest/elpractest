<?php

namespace App\Services;

use App\Models\VajiniChunk;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Vajini — the OpenAI-backed study companion, grounded on Practest course
 * content (RAG).
 *
 * Three responsibilities, deliberately in one class because they share the same
 * client/config and are never used apart:
 *   - embed()     turn text into vectors (indexing time AND query time)
 *   - retrieve()  cosine-rank the stored chunks against a question
 *   - chat()      ask the model to answer *from the retrieved context only*
 *
 * The OpenAI key is read from config('services.openai') and never logged. If it
 * is absent, configured() returns false and callers degrade to a 503 rather
 * than throwing an uncaught error — Vajini being down must never take a student
 * route with it.
 */
class VajiniService
{
    private ?string $key;
    private string $baseUrl;
    private string $chatModel;
    private string $embedModel;
    private int $timeout;

    public function __construct()
    {
        $cfg = config('services.openai');
        $this->key = $cfg['key'] ?? null;
        $this->baseUrl = rtrim($cfg['base_url'] ?? 'https://api.openai.com/v1', '/');
        $this->chatModel = $cfg['chat_model'] ?? 'gpt-4o-mini';
        $this->embedModel = $cfg['embed_model'] ?? 'text-embedding-3-small';
        $this->timeout = (int) ($cfg['timeout'] ?? 30);
    }

    /** Whether an API key is present. Callers should 503 when this is false. */
    public function configured(): bool
    {
        return ! empty($this->key);
    }

    /**
     * Embed a batch of texts. Returns one float[] per input, in input order.
     * OpenAI's embeddings endpoint accepts an array input and returns the
     * vectors with an `index`, which we re-sort by to be safe.
     *
     * @param  string[]  $texts
     * @return array<int, float[]>
     */
    public function embed(array $texts): array
    {
        if (empty($texts)) {
            return [];
        }
        $this->assertConfigured();

        $response = Http::withToken($this->key)
            ->timeout($this->timeout)
            ->acceptJson()
            ->post("{$this->baseUrl}/embeddings", [
                'model' => $this->embedModel,
                'input' => array_values($texts),
            ]);

        if ($response->failed()) {
            Log::error('Vajini embeddings request failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new RuntimeException('Embedding request failed.');
        }

        $data = $response->json('data') ?? [];
        usort($data, fn ($a, $b) => ($a['index'] ?? 0) <=> ($b['index'] ?? 0));

        return array_map(fn ($row) => $row['embedding'] ?? [], $data);
    }

    /**
     * Retrieve the top-k stored chunks most similar to $query. Each returned
     * chunk carries a transient `score` (cosine similarity, -1..1).
     *
     * Cosine is computed in PHP over every row. That is O(n·d) per query, which
     * is fine at this corpus size; if the corpus ever grows past a few thousand
     * chunks, move the vectors into pgvector/Qdrant and this method is the only
     * thing that changes.
     */
    public function retrieve(string $query, int $k = 5): Collection
    {
        // Rank on lightweight rows — the `content` blob is skipped for the
        // full-corpus scan and loaded only for the k winners below, so a large
        // question bank does not pull every explanation into memory per query.
        $candidates = VajiniChunk::select('id', 'source_type', 'source_id', 'title', 'embedding')->get();
        if ($candidates->isEmpty()) {
            return collect();
        }

        [$queryVector] = $this->embed([$query]) + [[]];
        if (empty($queryVector)) {
            return collect();
        }

        $topIds = $candidates
            ->map(fn (VajiniChunk $c) => ['id' => $c->id, 'score' => $this->cosine($queryVector, $c->embedding ?? [])])
            ->sortByDesc('score')
            ->take($k)
            ->pluck('id');

        // Hydrate the winners (with content), preserving the ranked order.
        $byId = VajiniChunk::whereIn('id', $topIds)->get()->keyBy('id');

        return $topIds->map(fn ($id) => $byId[$id] ?? null)->filter()->values();
    }

    /**
     * Ask the model a question answered strictly from $context. $history is the
     * prior turns of this conversation ([{role,content}, …]); it is trimmed and
     * role-sanitised before being sent.
     *
     * @param  array<int, array{role?:string, content?:string}>  $history
     * @return array{reply: string}
     */
    public function chat(string $question, string $context, array $history = []): array
    {
        $this->assertConfigured();

        $messages = [[
            'role' => 'system',
            'content' => $this->systemPrompt($context),
        ]];

        // Keep only the last few turns to bound token cost, and never trust the
        // client's role field beyond the two we expect.
        foreach (array_slice($history, -6) as $turn) {
            $role = ($turn['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
            $content = trim((string) ($turn['content'] ?? ''));
            if ($content !== '') {
                $messages[] = ['role' => $role, 'content' => mb_substr($content, 0, 4000)];
            }
        }

        $messages[] = ['role' => 'user', 'content' => $question];

        $response = Http::withToken($this->key)
            ->timeout($this->timeout)
            ->acceptJson()
            ->post("{$this->baseUrl}/chat/completions", [
                'model' => $this->chatModel,
                'messages' => $messages,
                'temperature' => 0.3,
                'max_tokens' => 700,
            ]);

        if ($response->failed()) {
            Log::error('Vajini chat request failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new RuntimeException('Chat request failed.');
        }

        $reply = trim((string) $response->json('choices.0.message.content', ''));

        return [
            'reply' => $reply !== '' ? $reply : "I couldn't come up with an answer just now — please try rephrasing.",
        ];
    }

    /**
     * The grounding contract. Vajini answers from the supplied context; when the
     * context does not cover the question it says so rather than inventing, and
     * it matches the student's language (the app ships English + Hindi).
     */
    private function systemPrompt(string $context): string
    {
        $context = trim($context) !== '' ? $context : '(no relevant course material was found for this question)';

        return <<<PROMPT
You are Vajini, the friendly AI study companion inside the Practest exam-prep app.
You help students understand concepts, solve doubts, and plan their study.

Answer using the COURSE MATERIAL below as your primary source of truth. When the
material covers the question, ground your answer in it. When it does not, say so
briefly and then give correct, careful general guidance — never fabricate a fact
and attribute it to the course. Keep answers concise and encouraging. Reply in
the same language the student uses (English or Hindi/Hinglish).

── COURSE MATERIAL ──
{$context}
── END COURSE MATERIAL ──
PROMPT;
    }

    /** Cosine similarity of two equal-length vectors; 0 when either is empty. */
    private function cosine(array $a, array $b): float
    {
        $n = min(count($a), count($b));
        if ($n === 0) {
            return 0.0;
        }

        $dot = $magA = $magB = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $dot += $a[$i] * $b[$i];
            $magA += $a[$i] * $a[$i];
            $magB += $b[$i] * $b[$i];
        }

        if ($magA <= 0.0 || $magB <= 0.0) {
            return 0.0;
        }

        return $dot / (sqrt($magA) * sqrt($magB));
    }

    private function assertConfigured(): void
    {
        if (! $this->configured()) {
            throw new RuntimeException('OpenAI is not configured (OPENAI_API_KEY missing).');
        }
    }
}
