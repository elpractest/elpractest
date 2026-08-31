<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreTestRequest;
use App\Http\Requests\Admin\UpdateTestRequest;
use App\Models\Question;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TestController extends Controller
{
    /**
     * Display a paginated list of tests.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Test::withCount('sections');

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        if ($request->filled('batch_id')) {
            $query->where('batch_id', $request->batch_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('is_published')) {
            $query->where('is_published', $request->boolean('is_published'));
        }

        $tests = $query->latest()->paginate(20);

        return response()->json($tests);
    }

    /**
     * Store a new test with its sections and questions.
     */
    public function store(StoreTestRequest $request): JsonResponse
    {
        $test = DB::transaction(function () use ($request) {
            // Compute total marks from question list
            $questionIds = [];
            foreach ($request->sections as $sectionData) {
                $questionIds = array_merge($questionIds, $sectionData['question_ids']);
            }
            $totalMarks = Question::whereIn('id', $questionIds)->sum('marks');

            $test = Test::create([
                'title' => $request->title,
                'course_id' => $request->course_id,
                'batch_id' => $request->batch_id,
                'type' => $request->type,
                'duration_seconds' => $request->duration_seconds,
                'max_attempts' => $request->max_attempts ?? ($request->type === 'mock' ? 1 : null),
                'total_marks' => $totalMarks,
                'instructions' => $request->instructions,
                'is_published' => false, // starts draft
                'available_from' => $request->available_from,
                'available_until' => $request->available_until,
                'created_by' => $request->user()->id,
                // Exam pattern. Null / false throughout = today's behaviour.
                'cutoff_marks' => $request->cutoff_marks,
                'cutoff_percentage' => $request->cutoff_percentage,
                'shuffle_questions' => $request->boolean('shuffle_questions'),
                'shuffle_options' => $request->boolean('shuffle_options'),
                'shift_group' => $request->shift_group,
                'shift_label' => $request->shift_label,
                'normalization_method' => $request->normalization_method ?? 'none',
            ]);

            foreach ($request->sections as $sIndex => $sectionData) {
                $section = TestSection::create([
                    'test_id' => $test->id,
                    'title' => $sectionData['title'],
                    'sort_order' => $sIndex,
                    'duration_seconds' => $sectionData['duration_seconds'] ?? null,
                    // A qualifying section must be cleared but its marks stay OUT of
                    // the merit score (the UPSC CSAT model).
                    'cutoff_marks' => $sectionData['cutoff_marks'] ?? null,
                    'cutoff_percentage' => $sectionData['cutoff_percentage'] ?? null,
                    'is_qualifying' => (bool) ($sectionData['is_qualifying'] ?? false),
                ]);

                foreach ($sectionData['question_ids'] as $qIndex => $qId) {
                    TestSectionQuestion::create([
                        'test_section_id' => $section->id,
                        'question_id' => $qId,
                        'sort_order' => $qIndex,
                    ]);
                }
            }

            return $test;
        });

        $test->load('sections.questions');

        AuditService::log('test.created', $test, null, $test->toArray());

        return response()->json([
            'message' => 'Test created successfully.',
            'test' => $test,
        ], 201);
    }

    /**
     * Display the specified test.
     */
    public function show(Test $test): JsonResponse
    {
        return response()->json($test->load(['sections.questions.options', 'course', 'batch', 'createdBy']));
    }

    /**
     * Update the specified test and its structure.
     */
    public function update(UpdateTestRequest $request, Test $test): JsonResponse
    {
        $oldValue = $test->load('sections.questions')->toArray();

        $updatedTest = DB::transaction(function () use ($request, $test) {
            $test->update($request->only([
                'title',
                'course_id',
                'batch_id',
                'type',
                'duration_seconds',
                'max_attempts',
                'instructions',
                'available_from',
                'available_until',
                'cutoff_marks',
                'cutoff_percentage',
                'shuffle_questions',
                'shuffle_options',
                'shift_group',
                'shift_label',
                'normalization_method',
            ]));

            if ($request->has('sections')) {
                // Delete old sections and their relations
                $test->sections()->each(function ($section) {
                    $section->sectionQuestions()->delete();
                    $section->delete();
                });

                // Compute new total marks
                $questionIds = [];
                foreach ($request->sections as $sectionData) {
                    $questionIds = array_merge($questionIds, $sectionData['question_ids']);
                }
                $totalMarks = Question::whereIn('id', $questionIds)->sum('marks');
                $test->update(['total_marks' => $totalMarks]);

                // Create new sections and relations
                foreach ($request->sections as $sIndex => $sectionData) {
                    $section = TestSection::create([
                        'test_id' => $test->id,
                        'title' => $sectionData['title'],
                        'sort_order' => $sIndex,
                        'duration_seconds' => $sectionData['duration_seconds'] ?? null,
                        // A qualifying section must be cleared but its marks stay OUT of
                        // the merit score (the UPSC CSAT model).
                        'cutoff_marks' => $sectionData['cutoff_marks'] ?? null,
                        'cutoff_percentage' => $sectionData['cutoff_percentage'] ?? null,
                        'is_qualifying' => (bool) ($sectionData['is_qualifying'] ?? false),
                    ]);

                    foreach ($sectionData['question_ids'] as $qIndex => $qId) {
                        TestSectionQuestion::create([
                            'test_section_id' => $section->id,
                            'question_id' => $qId,
                            'sort_order' => $qIndex,
                        ]);
                    }
                }
            }

            return $test;
        });

        $updatedTest->load('sections.questions');

        AuditService::log('test.updated', $updatedTest, $oldValue, $updatedTest->toArray());

        return response()->json([
            'message' => 'Test updated successfully.',
            'test' => $updatedTest,
        ]);
    }

    /**
     * Unpublish the test (soft delete/hide).
     */
    public function destroy(Test $test): JsonResponse
    {
        $oldValue = $test->toArray();
        $test->update(['is_published' => false]);

        AuditService::log('test.unpublished', $test, $oldValue, $test->toArray());

        return response()->json([
            'message' => 'Test unpublished and archived successfully.',
        ]);
    }

    /**
     * Publish the test.
     */
    public function publish(Test $test): JsonResponse
    {
        $test->load('sections.questions');

        if ($test->sections->isEmpty()) {
            return response()->json([
                'message' => 'Cannot publish a test with no sections.',
            ], 422);
        }

        $totalQuestions = $test->sections->sum(fn($s) => $s->questions->count());
        if ($totalQuestions === 0) {
            return response()->json([
                'message' => 'Cannot publish a test with no questions.',
            ], 422);
        }

        // Review gate. A question that has not cleared review must not reach a
        // candidate: a wrong answer key discovered after the fact cannot be
        // un-marked, it can only be re-scored, and by then the candidate has
        // already made decisions on a false premise.
        $unreviewed = [];
        foreach ($test->sections as $section) {
            foreach ($section->questions as $question) {
                if ($question->status !== Question::STATUS_APPROVED || !$question->is_active) {
                    $unreviewed[] = [
                        'question_id' => $question->id,
                        'status' => $question->status,
                        'is_active' => (bool) $question->is_active,
                    ];
                }
            }
        }

        if ($unreviewed !== []) {
            return response()->json([
                'message' => count($unreviewed) . ' question(s) in this test have not been approved.',
                'unapproved_questions' => $unreviewed,
            ], 422);
        }

        $oldValue = $test->toArray();
        $test->update(['is_published' => true]);

        AuditService::log('test.published', $test, $oldValue, $test->toArray());

        // Fan a "new mock added" notification out to enrolled students. Course
        // comes from the test or, failing that, its series. No course → no
        // audience, so skip silently.
        $courseId = $test->course_id ?? $test->testSeries?->course_id;
        if ($courseId) {
            \App\Jobs\FanOutContentNotification::dispatch(
                'test',
                $test->id,
                $test->title,
                $courseId,
                $test->batch_id,
                $test->test_series_id,
            );
        }

        return response()->json([
            'message' => 'Test published successfully.',
            'test' => $test,
        ]);
    }

    /**
     * Unpublish the test.
     */
    public function unpublish(Test $test): JsonResponse
    {
        $oldValue = $test->toArray();
        $test->update(['is_published' => false]);

        AuditService::log('test.unpublished', $test, $oldValue, $test->toArray());

        return response()->json([
            'message' => 'Test unpublished successfully.',
            'test' => $test,
        ]);
    }
}
