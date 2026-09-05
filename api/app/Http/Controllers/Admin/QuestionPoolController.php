<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuestionPool;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Named slices of the question bank — the thing that makes the bank sellable.
 *
 * A pool is a saved filter, so the counts here are always computed live rather
 * than cached: an operator sizing "UGC NET Paper 1 PYQ" before putting it on
 * sale needs the number that is true right now, not at creation time.
 */
class QuestionPoolController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $pools = QuestionPool::query()
            ->when($request->filled('exam_code'), fn ($q) => $q->where('exam_code', strtoupper($request->exam_code)))
            ->when($request->boolean('active_only'), fn ($q) => $q->active())
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get()
            ->map(fn (QuestionPool $pool) => $pool->toArray() + [
                'question_count' => $pool->questions()->count(),
            ]);

        return response()->json($pools);
    }

    public function show(QuestionPool $questionPool): JsonResponse
    {
        return response()->json($questionPool->toArray() + [
            'question_count' => $questionPool->questions()->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $pool = QuestionPool::create($data + [
            'slug' => $this->uniqueSlug($data['title']),
            'created_by' => $request->user()->id,
        ]);

        AuditService::log('question_pool.created', $pool, null, $pool->toArray());

        return response()->json([
            'message' => 'Pool created.',
            'pool' => $pool->toArray() + ['question_count' => $pool->questions()->count()],
        ], 201);
    }

    public function update(Request $request, QuestionPool $questionPool): JsonResponse
    {
        $old = $questionPool->toArray();
        $questionPool->update($this->validated($request));

        AuditService::log('question_pool.updated', $questionPool, $old, $questionPool->toArray());

        return response()->json([
            'message' => 'Pool updated.',
            'pool' => $questionPool->fresh()->toArray()
                + ['question_count' => $questionPool->questions()->count()],
        ]);
    }

    public function destroy(QuestionPool $questionPool): JsonResponse
    {
        // Soft delete: entitlements already granted point at this row, and a
        // hard delete would silently revoke practice access someone paid for.
        $questionPool->delete();

        AuditService::log('question_pool.deleted', $questionPool, $questionPool->toArray(), null);

        return response()->json(['message' => 'Pool deleted.']);
    }

    /**
     * How many questions a facet set would cover, before saving it — the same
     * "tell me before I commit" shape the paper importer's dry run has.
     */
    public function preview(Request $request): JsonResponse
    {
        $facets = array_filter(
            $request->only(['exam_code', 'paper', 'source', 'year', 'shift', 'medium']),
            fn ($v) => $v !== null && $v !== '',
        );

        if ($facets === []) {
            return response()->json([
                'message' => 'Set at least one filter — an unbounded pool would contain the whole bank.',
                'count' => 0,
            ], 422);
        }

        return response()->json([
            'count' => \App\Models\Question::query()->usable()->matchingFacets($facets)->count(),
        ]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'exam_category' => ['required', 'string', Rule::in(config('exams.categories'))],
            'exam_code' => ['nullable', Rule::in(array_keys(config('exams.registry')))],
            'paper' => ['nullable', 'string', 'max:16'],
            'source' => ['nullable', Rule::in(array_keys(config('exams.sources')))],
            'year' => ['nullable', 'integer', 'min:1950', 'max:' . ((int) date('Y') + 1)],
            'shift' => ['nullable', 'string', 'max:16'],
            'medium' => ['nullable', Rule::in(array_keys(config('exams.mediums')))],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        // A pool with no facets matches every question in the bank. That is
        // never what anyone meant to put on sale, so it is refused rather than
        // saved and discovered later by a student who bought everything.
        $facets = array_filter(
            array_intersect_key($data, array_flip(['exam_code', 'paper', 'source', 'year', 'shift', 'medium'])),
            fn ($v) => $v !== null && $v !== '',
        );

        if ($facets === []) {
            abort(422, 'Set at least one filter — an unbounded pool would contain the whole question bank.');
        }

        return $data;
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'pool';
        $slug = $base;
        $n = 2;

        while (QuestionPool::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$n}";
            $n++;
        }

        return $slug;
    }
}
