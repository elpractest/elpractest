<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\VajiniService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Vajini — the student-facing AI study companion (RAG over course content).
 *
 * One endpoint: POST /api/student/vajini/chat. It retrieves the most relevant
 * course chunks for the student's message, asks OpenAI to answer *from that
 * context*, and returns the reply plus the sources it drew on so the UI can
 * show what grounded the answer.
 *
 * Additive and defensive: if OpenAI is not configured or the upstream call
 * fails, it returns 503 with a friendly message — it never 500s and never
 * leaks the key or the raw provider error to the student.
 */
class VajiniController extends Controller
{
    public function chat(Request $request, VajiniService $vajini): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'history' => ['nullable', 'array', 'max:20'],
            'history.*.role' => ['nullable', 'string', 'in:user,assistant'],
            'history.*.content' => ['nullable', 'string', 'max:4000'],
        ]);

        if (! $vajini->configured()) {
            return response()->json([
                'message' => 'Vajini is not available right now. Please try again later.',
            ], 503);
        }

        $message = trim($validated['message']);
        $history = $validated['history'] ?? [];

        try {
            $topK = (int) config('services.openai.top_k', 5);
            $chunks = $vajini->retrieve($message, $topK);

            $context = $chunks
                ->map(fn ($c) => "[{$c->title}]\n{$c->content}")
                ->implode("\n\n");

            $result = $vajini->chat($message, $context, $history);
        } catch (RuntimeException $e) {
            report($e);

            return response()->json([
                'message' => 'Vajini could not answer just now. Please try again in a moment.',
            ], 503);
        }

        $sources = $chunks->map(fn ($c) => [
            'type' => $c->source_type,
            'id' => $c->source_id,
            'title' => $c->title,
        ])->values();

        AuditService::log('vajini.chat', null, null, [
            'message' => mb_substr($message, 0, 500),
            'sources' => $sources->pluck('title')->all(),
        ]);

        return response()->json([
            'reply' => $result['reply'],
            'sources' => $sources,
        ]);
    }
}
