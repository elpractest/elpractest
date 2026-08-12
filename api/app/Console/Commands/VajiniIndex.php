<?php

namespace App\Console\Commands;

use App\Models\Course;
use App\Models\Question;
use App\Models\VajiniChunk;
use App\Services\VajiniService;
use Illuminate\Console\Command;

/**
 * Build (or refresh) Vajini's retrieval corpus.
 *
 * Groundable content in this app is: published courses (title + descriptions +
 * syllabus + faq) and questions (text + options + explanation). Lessons are
 * video-only, so they contribute nothing but a title and are skipped.
 *
 * Idempotent by content hash: a chunk whose source text is unchanged since the
 * last run is left untouched, so re-running only pays the embedding cost for
 * content that actually changed. Deleted/edited sources have their stale chunks
 * removed. Run it after seeding content and on a schedule (e.g. nightly).
 *
 *   php artisan vajini:index          # incremental
 *   php artisan vajini:index --fresh  # wipe the corpus first, then rebuild
 */
class VajiniIndex extends Command
{
    protected $signature = 'vajini:index {--fresh : Wipe the existing corpus before indexing}';

    protected $description = "Embed course content into Vajini's retrieval corpus";

    public function handle(VajiniService $vajini): int
    {
        if (! $vajini->configured()) {
            $this->error('OPENAI_API_KEY is not set — cannot embed. Set it in .env and retry.');
            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            VajiniChunk::query()->delete();
            $this->info('Corpus wiped (--fresh).');
        }

        $desired = collect()
            ->concat($this->courseChunks())
            ->concat($this->questionChunks());

        $this->info("Assembled {$desired->count()} candidate chunk(s) from course content.");

        // Existing corpus keyed by a stable identity so we can diff.
        $existing = VajiniChunk::all()->keyBy(fn ($c) => $this->identity($c->source_type, $c->source_id, $c->content_hash));
        $desiredKeys = $desired->map(fn ($c) => $this->identity($c['source_type'], $c['source_id'], $c['content_hash']));

        // New = desired chunks with no matching row yet.
        $new = $desired->reject(fn ($c) => $existing->has($this->identity($c['source_type'], $c['source_id'], $c['content_hash'])))->values();

        // Stale = existing rows no longer desired (source edited or removed).
        $staleIds = $existing->reject(fn ($c, $key) => $desiredKeys->contains($key))->pluck('id');
        if ($staleIds->isNotEmpty()) {
            VajiniChunk::whereIn('id', $staleIds)->delete();
            $this->info("Removed {$staleIds->count()} stale chunk(s).");
        }

        if ($new->isEmpty()) {
            $this->info('Nothing new to embed — corpus is up to date.');
            return self::SUCCESS;
        }

        $this->info("Embedding {$new->count()} new/changed chunk(s)…");
        $bar = $this->output->createProgressBar($new->count());

        foreach ($new->chunk(100) as $batch) {
            $vectors = $vajini->embed($batch->pluck('content')->all());

            foreach ($batch->values() as $i => $chunk) {
                VajiniChunk::create([
                    'source_type' => $chunk['source_type'],
                    'source_id' => $chunk['source_id'],
                    'title' => $chunk['title'],
                    'content' => $chunk['content'],
                    'content_hash' => $chunk['content_hash'],
                    'embedding' => $vectors[$i] ?? [],
                ]);
                $bar->advance();
            }
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Done. Corpus now holds {$desired->count()} chunk(s).");

        return self::SUCCESS;
    }

    /** One chunk per published course, built from its descriptive text. */
    private function courseChunks(): \Illuminate\Support\Collection
    {
        return Course::where('is_published', true)->get()->map(function (Course $course) {
            $parts = array_filter([
                $course->title,
                $course->short_description,
                $course->description,
                $this->flatten($course->syllabus),
                $this->flatten($course->faq),
            ]);
            $content = trim(implode("\n\n", $parts));

            return $this->chunk('course', $course->id, "Course: {$course->title}", $content);
        })->filter();
    }

    /** One chunk per question: the question, its options, and its explanation. */
    private function questionChunks(): \Illuminate\Support\Collection
    {
        return Question::with('options')->get()->map(function (Question $q) {
            $options = $q->options
                ->sortBy('sort_order')
                ->map(fn ($o) => trim(($o->label ? "{$o->label}) " : '') . $o->option_text . ($o->is_correct ? '  ✓ (correct)' : '')))
                ->implode("\n");

            $parts = array_filter([
                trim(implode(' · ', array_filter([$q->subject, $q->topic]))),
                $q->question_text ? "Q: {$q->question_text}" : null,
                $options !== '' ? "Options:\n{$options}" : null,
                $q->explanation ? "Explanation: {$q->explanation}" : null,
            ]);
            $content = trim(implode("\n", $parts));

            $label = $q->topic ?: ($q->subject ?: 'Question');

            return $this->chunk('question', $q->id, "Question · {$label}", $content);
        })->filter();
    }

    /** Build a chunk descriptor, or null when there is no usable content. */
    private function chunk(string $type, int $id, string $title, string $content): ?array
    {
        $content = trim($content);
        if ($content === '') {
            return null;
        }

        return [
            'source_type' => $type,
            'source_id' => $id,
            'title' => $title,
            'content' => $content,
            'content_hash' => hash('sha256', $content),
        ];
    }

    /** Flatten an arbitrarily-shaped array (syllabus/faq) into readable text. */
    private function flatten($value): string
    {
        if (is_array($value)) {
            return collect($value)
                ->map(fn ($v) => $this->flatten($v))
                ->filter(fn ($s) => trim($s) !== '')
                ->implode("\n");
        }

        return trim((string) $value);
    }

    private function identity(string $type, int|string $id, string $hash): string
    {
        return "{$type}|{$id}|{$hash}";
    }
}
