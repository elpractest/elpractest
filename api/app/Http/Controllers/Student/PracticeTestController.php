<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Models\Test;
use App\Models\TestSession;
use App\Services\PracticeTestBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The custom practice console: a student builds their own paper.
 *
 * Everything it produces is a normal Test owned by that student, so it runs on
 * the same exam engine as a scheduled mock and shows the same scorecard.
 */
class PracticeTestController extends Controller
{
    /**
     * A student is allowed this many stored practice papers. Past it, the
     * oldest never-attempted one is recycled rather than refused: a cap that
     * blocks generation reads as a broken feature, while silently dropping a
     * paper someone actually sat would lose their result history.
     */
    private const KEEP_PER_STUDENT = 30;

    public function __construct(
        private readonly PracticeTestBuilder $builder,
    ) {}

    /**
     * What this student can build from — subjects, topics and counts, all
     * measured against their own entitled pool.
     */
    public function options(Request $request): JsonResponse
    {
        $facets = $this->builder->facets($request->user());

        return response()->json($facets + [
            'limits' => [
                'min_questions' => PracticeTestBuilder::MIN_QUESTIONS,
                'max_questions' => PracticeTestBuilder::MAX_QUESTIONS,
                'min_minutes' => PracticeTestBuilder::MIN_MINUTES,
                'max_minutes' => PracticeTestBuilder::MAX_MINUTES,
            ],
        ]);
    }

    /**
     * How many questions match a spec, before committing to it.
     */
    public function preview(Request $request): JsonResponse
    {
        $spec = $this->validateSpec($request, requireSize: false);

        return response()->json([
            'available' => $this->builder->countMatching($request->user(), $spec),
        ]);
    }

    /**
     * The student's own practice papers, newest first.
     */
    public function index(Request $request): JsonResponse
    {
        $tests = Test::where('owner_id', $request->user()->id)
            ->withCount(['sessions' => fn ($q) => $q->whereNotNull('submitted_at')])
            ->latest()
            ->paginate(20);

        return response()->json($tests);
    }

    /**
     * Build a paper to spec.
     */
    public function store(Request $request): JsonResponse
    {
        $spec = $this->validateSpec($request, requireSize: true);
        $user = $request->user();

        $available = $this->builder->countMatching($user, $spec);

        if ($available < $spec['question_count']) {
            return response()->json([
                'message' => $available === 0
                    ? 'No questions match those filters in the content you have access to.'
                    : "Only {$available} question(s) match those filters. Reduce the length or widen the filters.",
                'available' => $available,
            ], 422);
        }

        $this->recycleOldest($user->id);

        $test = $this->builder->build($user, $spec);

        if (!$test) {
            // The pool shrank between the count and the draw — a question was
            // deactivated or un-approved mid-request. Rare, but a 500 here would
            // be a confusing way to say "try again".
            return response()->json([
                'message' => 'Could not assemble that paper just now. Please try again.',
            ], 422);
        }

        return response()->json([
            'message' => 'Practice paper ready.',
            'test' => $test->loadCount('sections'),
        ], 201);
    }

    /**
     * Discard one of the student's own papers.
     */
    public function destroy(Request $request, Test $test): JsonResponse
    {
        if ($test->owner_id !== $request->user()->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $test->delete();

        return response()->json(['message' => 'Practice paper deleted.']);
    }

    /**
     * @return array{subject:?string, topics:?array, difficulty:?string, question_count:int, duration_minutes:int, title:?string}
     */
    private function validateSpec(Request $request, bool $requireSize): array
    {
        $sizeRules = $requireSize
            ? ['required', 'integer', 'min:' . PracticeTestBuilder::MIN_QUESTIONS, 'max:' . PracticeTestBuilder::MAX_QUESTIONS]
            : ['nullable', 'integer'];

        $durationRules = $requireSize
            ? ['required', 'integer', 'min:' . PracticeTestBuilder::MIN_MINUTES, 'max:' . PracticeTestBuilder::MAX_MINUTES]
            : ['nullable', 'integer'];

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
            'topics' => ['nullable', 'array', 'max:50'],
            'topics.*' => ['string', 'max:255'],
            'difficulty' => ['nullable', 'string', Rule::in(['easy', 'medium', 'hard'])],
            'question_count' => $sizeRules,
            'duration_minutes' => $durationRules,
        ]);

        return [
            'title' => $validated['title'] ?? null,
            'subject' => $validated['subject'] ?? null,
            'topics' => $validated['topics'] ?? null,
            'difficulty' => $validated['difficulty'] ?? null,
            'question_count' => (int) ($validated['question_count'] ?? 0),
            'duration_minutes' => (int) ($validated['duration_minutes'] ?? 0),
        ];
    }

    /**
     * Keep the stored set bounded by dropping the oldest papers this student
     * never actually sat. Anything with a submitted session is left alone — its
     * result is in their history and deleting the test would orphan it.
     */
    private function recycleOldest(int $userId): void
    {
        $owned = Test::where('owner_id', $userId)->count();

        if ($owned < self::KEEP_PER_STUDENT) {
            return;
        }

        $attemptedIds = TestSession::whereIn('test_id', Test::where('owner_id', $userId)->select('id'))
            ->pluck('test_id')
            ->unique();

        Test::where('owner_id', $userId)
            ->whereNotIn('id', $attemptedIds)
            ->oldest()
            ->limit(max($owned - self::KEEP_PER_STUDENT + 1, 1))
            ->get()
            ->each->delete();
    }
}
