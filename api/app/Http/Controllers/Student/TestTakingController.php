<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Jobs\ComputeTestAnalytics;
use App\Models\Enrollment;
use App\Models\Question;
use App\Models\Test;
use App\Models\TestAnswer;
use App\Models\TestSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TestTakingController extends Controller
{
    /**
     * List all published tests available to the student based on their course/batch enrollments.
     */
    public function availableTests(Request $request): JsonResponse
    {
        $user = $request->user();

        // Get active enrollments
        $enrollments = Enrollment::where('user_id', $user->id)->active()->get();
        $courseIds = $enrollments->pluck('course_id')->filter()->unique()->toArray();
        $batchIds = $enrollments->pluck('batch_id')->filter()->unique()->toArray();

        $query = Test::published()
            ->available()
            ->where(function ($q) use ($courseIds, $batchIds) {
                $q->whereIn('course_id', $courseIds)
                  ->orWhereIn('batch_id', $batchIds)
                  ->orWhere(function ($sq) {
                      $sq->whereNull('course_id')->whereNull('batch_id');
                  });
            })
            ->withCount(['sessions' => function ($q) use ($user) {
                $q->where('user_id', $user->id)->whereNotNull('submitted_at');
            }]);

        $tests = $query->latest()->get()->filter(function ($test) {
            if ($test->max_attempts === null) {
                return true;
            }
            return $test->sessions_count < $test->max_attempts;
        })->values();

        return response()->json([
            'tests' => $tests
        ]);
    }

    /**
     * Start a new test session (or resume if there's an in-progress one).
     */
    public function start(Request $request, Test $test): JsonResponse
    {
        $user = $request->user();

        // 1. Concurrent Session check: Look for existing in-progress session
        $existingSession = TestSession::where('user_id', $user->id)
            ->where('test_id', $test->id)
            ->whereNull('submitted_at')
            ->first();

        if ($existingSession) {
            $existingSession->reconcileSectionTiming();
            
            if ($existingSession->submitted_at === null) {
                // Still in progress after reconciliation, return it (resume)
                return $this->sessionStateResponse($existingSession, 'Session resumed.');
            }
        }

        // 2. Check attempt limits
        $completedAttempts = TestSession::where('user_id', $user->id)
            ->where('test_id', $test->id)
            ->whereNotNull('submitted_at')
            ->count();

        if ($test->max_attempts !== null && $completedAttempts >= $test->max_attempts) {
            return response()->json([
                'message' => 'You have reached the maximum number of attempts allowed for this test.',
            ], 403);
        }

        // 3. Start new session
        $session = DB::transaction(function () use ($user, $test) {
            $session = TestSession::create([
                'user_id' => $user->id,
                'test_id' => $test->id,
                'started_at' => now(),
                'duration_seconds' => $test->duration_seconds,
                'current_section_index' => 0,
                'section_started_at' => now(),
            ]);

            // Pre-create all test answers in order across sections
            $sections = $test->sections()->orderBy('sort_order')->get();
            $sortOrder = 0;

            foreach ($sections as $section) {
                // Get section questions ordered by pivot sort_order
                $questions = $section->questions;
                foreach ($questions as $question) {
                    TestAnswer::create([
                        'test_session_id' => $session->id,
                        'question_id' => $question->id,
                        'is_marked_for_review' => false,
                        'is_visited' => false,
                        'time_spent_seconds' => 0,
                    ]);
                }
            }

            return $session;
        });

        return $this->sessionStateResponse($session, 'Test started successfully.');
    }

    /**
     * Resume an in-progress session (e.g. after crash / refresh).
     */
    public function resume(Request $request, TestSession $session): JsonResponse
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Eager self-healing: reconcile timing first
        $session->reconcileSectionTiming();

        if ($session->submitted_at !== null) {
            return response()->json([
                'message' => 'Session has expired or already submitted.',
                'submitted' => true,
            ], 409);
        }

        return $this->sessionStateResponse($session, 'Session resumed.');
    }

    /**
     * Save/autosave answer response.
     */
    public function saveAnswer(Request $request, TestSession $session, int $questionId): JsonResponse
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // 1. Expiry check on every write
        if ($session->isExpiredForWrite()) {
            return response()->json([
                'message' => 'Time has expired for this test session.',
                'time_expired' => true,
            ], 409);
        }

        $test = $session->test;
        $sections = $test->sections;

        // Find the question's section
        $question = Question::find($questionId);
        if (!$question) {
            return response()->json(['message' => 'Question not found.'], 404);
        }

        $sectionQuestion = DB::table('test_section_questions as tsq')
            ->join('test_sections as ts', 'tsq.test_section_id', '=', 'ts.id')
            ->where('ts.test_id', $test->id)
            ->where('tsq.question_id', $questionId)
            ->select('ts.id as section_id', 'ts.sort_order')
            ->first();

        if (!$sectionQuestion) {
            return response()->json(['message' => 'Question is not part of this test.'], 404);
        }

        // 2. Section boundary checks (sectional mode)
        $hasSectionalTiming = $sections->contains(fn($s) => $s->hasSectionalTiming());
        if ($hasSectionalTiming) {
            if ($sectionQuestion->sort_order !== $session->current_section_index) {
                return response()->json([
                    'message' => 'You cannot save answers for a different section in sectional timing mode.',
                ], 403);
            }
        }

        $answer = TestAnswer::where('test_session_id', $session->id)
            ->where('question_id', $questionId)
            ->first();

        if (!$answer) {
            return response()->json(['message' => 'Answer row not initialized.'], 404);
        }

        $answer->update([
            'selected_option_id' => $request->selected_option_id,
            'is_visited' => true,
            'answered_at' => now(),
            'time_spent_seconds' => $request->input('time_spent_seconds', $answer->time_spent_seconds),
        ]);

        return response()->json([
            'message' => 'Answer saved.',
            'answer' => $answer,
        ]);
    }

    /**
     * Toggle marked for review status.
     */
    public function toggleReview(Request $request, TestSession $session, int $questionId): JsonResponse
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($session->isExpiredForWrite()) {
            return response()->json([
                'message' => 'Time has expired for this test session.',
                'time_expired' => true,
            ], 409);
        }

        $answer = TestAnswer::where('test_session_id', $session->id)
            ->where('question_id', $questionId)
            ->first();

        if (!$answer) {
            return response()->json(['message' => 'Answer row not initialized.'], 404);
        }

        $answer->update([
            'is_marked_for_review' => !$answer->is_marked_for_review,
            'is_visited' => true,
        ]);

        return response()->json([
            'message' => $answer->is_marked_for_review ? 'Marked for review.' : 'Unmarked from review.',
            'is_marked_for_review' => $answer->is_marked_for_review,
        ]);
    }

    /**
     * Mark a question as visited.
     */
    public function markVisited(Request $request, TestSession $session, int $questionId): JsonResponse
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($session->isExpiredForWrite()) {
            return response()->json([
                'message' => 'Time has expired for this test session.',
                'time_expired' => true,
            ], 409);
        }

        $answer = TestAnswer::where('test_session_id', $session->id)
            ->where('question_id', $questionId)
            ->first();

        if (!$answer) {
            return response()->json(['message' => 'Answer row not initialized.'], 404);
        }

        if (!$answer->is_visited) {
            $answer->update(['is_visited' => true]);
        }

        return response()->json(['message' => 'Visited.']);
    }

    /**
     * Manually advance to the next section or submit if it's the last section.
     */
    public function advanceSection(Request $request, TestSession $session): JsonResponse
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $session->reconcileSectionTiming();

        if ($session->submitted_at !== null) {
            return response()->json([
                'message' => 'Session has expired or already submitted.',
                'submitted' => true,
            ], 409);
        }

        $sections = $session->test->sections;
        if ($session->current_section_index >= $sections->count() - 1) {
            // Already on last section, submit
            return $this->submit($request, $session);
        }

        $session->update([
            'current_section_index' => $session->current_section_index + 1,
            'section_started_at' => now(),
        ]);

        return $this->sessionStateResponse($session, 'Advanced to next section.');
    }

    /**
     * Formally submit the test session.
     */
    public function submit(Request $request, TestSession $session): JsonResponse
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($session->submitted_at === null) {
            $session->update([
                'submitted_at' => now(),
                'is_auto_submitted' => false,
            ]);

            ComputeTestAnalytics::dispatch($session);
        }

        return response()->json([
            'message' => 'Test submitted successfully.',
            'session_id' => $session->id,
            'submitted_at' => $session->submitted_at,
        ]);
    }

    /**
     * Fetch test results, question key, and batch-scoped rankings.
     */
    public function result(Request $request, TestSession $session): JsonResponse
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($session->submitted_at === null) {
            return response()->json(['message' => 'Test has not been submitted yet.'], 403);
        }

        $analytic = $session->analytic;
        if (!$analytic) {
            // If the queued job has not finished, compute it inline for responsiveness
            $job = new ComputeTestAnalytics($session);
            $job->handle();
            $analytic = $session->fresh()->analytic;
        }

        $test = $session->test;

        $rankAndPercentile = $session->getRankAndPercentile();
        $rank = $rankAndPercentile['rank'];
        $percentile = $rankAndPercentile['percentile'];

        // Fetch question-by-question review key
        $answers = TestAnswer::where('test_session_id', $session->id)
            ->with(['question.options'])
            ->get()
            ->map(function ($ans) {
                $q = $ans->question;
                return [
                    'question_id' => $ans->question_id,
                    'question_text' => $q->question_text,
                    'explanation' => $q->explanation,
                    'marks' => $q->marks,
                    'negative_marks' => $q->negative_marks,
                    'selected_option_id' => $ans->selected_option_id,
                    'is_correct' => $ans->isCorrect(),
                    'is_visited' => $ans->is_visited,
                    'time_spent_seconds' => $ans->time_spent_seconds,
                    'options' => $q->options->map(fn($o) => [
                        'id' => $o->id,
                        'label' => $o->label,
                        'option_text' => $o->option_text,
                        'is_correct' => $o->is_correct,
                    ]),
                ];
            });

        return response()->json([
            'analytic' => $analytic,
            'rank' => $rank,
            'percentile' => $percentile,
            'answers' => $answers,
        ]);
    }

    /**
     * Get the current question palette state.
     */
    public function palette(Request $request, TestSession $session): JsonResponse
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $session->reconcileSectionTiming();

        $answers = TestAnswer::where('test_session_id', $session->id)->get();

        $palette = $answers->map(function ($ans) {
            $status = 'not_visited';
            if ($ans->is_visited) {
                if ($ans->selected_option_id !== null) {
                    $status = $ans->is_marked_for_review ? 'answered_and_marked' : 'answered';
                } else {
                    $status = $ans->is_marked_for_review ? 'marked_for_review' : 'not_answered';
                }
            }
            return [
                'question_id' => $ans->question_id,
                'status' => $status,
            ];
        });

        return response()->json([
            'palette' => $palette,
        ]);
    }

    /**
     * Format session response with questions, excluding options' is_correct fields.
     */
    private function sessionStateResponse(TestSession $session, string $message): JsonResponse
    {
        $session->load('test.sections.questions.options');
        
        $sections = $session->test->sections->map(function ($section) {
            return [
                'id' => $section->id,
                'title' => $section->title,
                'duration_seconds' => $section->duration_seconds,
                'sort_order' => $section->sort_order,
                'questions' => $section->questions->map(function ($q) {
                    return [
                        'id' => $q->id,
                        'subject' => $q->subject,
                        'topic' => $q->topic,
                        'difficulty' => $q->difficulty,
                        'exam_tags' => $q->exam_tags,
                        'question_text' => $q->question_text,
                        'marks' => $q->marks,
                        'negative_marks' => $q->negative_marks,
                        // Options excluding is_correct for cheating prevention
                        'options' => $q->options->map(fn($o) => [
                            'id' => $o->id,
                            'label' => $o->label,
                            'option_text' => $o->option_text,
                            'sort_order' => $o->sort_order,
                        ]),
                    ];
                }),
            ];
        });

        $answers = TestAnswer::where('test_session_id', $session->id)
            ->select('question_id', 'selected_option_id', 'is_marked_for_review', 'is_visited')
            ->get();

        return response()->json([
            'message' => $message,
            'session' => [
                'id' => $session->id,
                'test_id' => $session->test_id,
                'current_section_index' => $session->current_section_index,
                'time_remaining_seconds' => $session->timeRemainingSeconds(),
                'section_time_remaining_seconds' => $session->sectionTimeRemainingSeconds(),
            ],
            'sections' => $sections,
            'answers' => $answers,
        ]);
    }
}
