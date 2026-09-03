<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Requests\Student\SaveAnswerRequest;
use App\Jobs\ComputeTestAnalytics;
use App\Models\Enrollment;
use App\Models\Question;
use App\Models\Test;
use App\Models\User;
use App\Services\EntitlementService;
use App\Models\TestAnswer;
use App\Models\TestSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TestTakingController extends Controller
{
    public function __construct(
        private readonly EntitlementService $entitlements,
    ) {}

    /**
     * List every published test this student is entitled to sit.
     */
    public function availableTests(Request $request): JsonResponse
    {
        $user = $request->user();

        // The listing and the action now read the same rule from one place.
        // Their disagreeing is exactly what let any student start any test by
        // id: the entitlement filter lived only here, in the listing.
        $accessibleIds = $this->entitlements->accessibleTestIds($user);

        $query = Test::published()
            ->available()
            ->catalogue()
            ->whereIn('id', $accessibleIds)
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
     * What a candidate needs to see BEFORE the clock starts: duration, marks,
     * marking scheme, section structure, and the instructions text an admin
     * wrote for this specific paper.
     *
     * Read-only — it must never create a session. `instructions` has been a
     * real, admin-editable column since the schema shipped, but nothing
     * between here and the student ever read it back: `start()` and `resume()`
     * hand the candidate straight into the live paper, so a field built to
     * warn about negative marking or a sectional cutoff was never actually
     * seen by anyone it was written for.
     *
     * Same access rule as start() — a student who is not entitled to sit the
     * test should not see what is behind that wall either — but it deliberately
     * does NOT create the pre-created answer rows start() does; a student who
     * previews and never presses Start should leave no trace of an attempt.
     */
    public function preview(Request $request, Test $test): JsonResponse
    {
        $user = $request->user();

        if (!$this->entitlements->mayStartTest($user, $test)) {
            return response()->json([
                'message' => 'This test is not available to you.',
            ], 403);
        }

        // A session already in progress means the gate has already been
        // cleared once this attempt — the frontend uses this to skip straight
        // to resume rather than showing instructions a second time mid-paper.
        $resumableSessionId = TestSession::where('user_id', $user->id)
            ->where('test_id', $test->id)
            ->whereNull('submitted_at')
            ->value('id');

        $completedAttempts = TestSession::where('user_id', $user->id)
            ->where('test_id', $test->id)
            ->whereNotNull('submitted_at')
            ->count();

        $sections = $test->sections()->withCount('questions')->orderBy('sort_order')->get();
        $questionCount = $sections->sum('questions_count');

        // "Does a wrong answer cost you here?" is the one fact about marking
        // worth stating up front. Whether it is the SAME penalty on every
        // question is a second, smaller fact — real papers occasionally vary
        // it by section (e.g. no negative marking on the general-awareness
        // section) — so this reports both rather than collapsing to one
        // possibly-misleading number.
        $negativeValues = DB::table('test_section_questions')
            ->join('test_sections', 'test_sections.id', '=', 'test_section_questions.test_section_id')
            ->join('questions', 'questions.id', '=', 'test_section_questions.question_id')
            ->where('test_sections.test_id', $test->id)
            ->pluck('questions.negative_marks')
            ->map(fn ($v) => (float) $v)
            ->unique();

        return response()->json([
            'test' => [
                'id' => $test->id,
                'title' => $test->title,
                'category' => $test->category,
                'type' => $test->type,
                'is_free' => $test->is_free,
                'duration_seconds' => $test->duration_seconds,
                'total_marks' => $test->total_marks,
                'question_count' => $questionCount,
                'max_attempts' => $test->max_attempts,
                'attempts_used' => $completedAttempts,
                'instructions' => $test->instructions,
                'has_negative_marking' => $negativeValues->contains(fn ($v) => $v > 0),
                'negative_marking_uniform' => $negativeValues->count() <= 1,
                'uniform_negative_marks' => $negativeValues->count() === 1 ? $negativeValues->first() : null,
                'sections' => $sections->map(fn ($s) => [
                    'id' => $s->id,
                    'title' => $s->title,
                    'question_count' => $s->questions_count,
                    'duration_seconds' => $s->duration_seconds,
                    'is_qualifying' => (bool) $s->is_qualifying,
                    'cutoff_marks' => $s->cutoff_marks,
                ]),
            ],
            'resumable_session_id' => $resumableSessionId,
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

        // 2. Entitlement. This endpoint used to check only the concurrent
        // session and the attempt cap, so ANY authenticated student could start
        // ANY test by id — an unpublished draft, a paper outside its window, or
        // a paid mock from a batch they never bought. The filter lived solely in
        // availableTests(), i.e. in the *listing*: it shaped what the app showed
        // and gated nothing at all. Both now ask EntitlementService, so they
        // cannot drift apart again.
        //
        // Checked AFTER the resume branch above: a candidate already sitting a
        // paper must always be able to resume it, even if the window closed or
        // their entitlement lapsed mid-exam.
        if (!$this->entitlements->mayStartTest($user, $test)) {
            return response()->json([
                'message' => 'This test is not available to you.',
            ], 403);
        }

        // 3. Check attempt limits
        $completedAttempts = TestSession::where('user_id', $user->id)
            ->where('test_id', $test->id)
            ->whereNotNull('submitted_at')
            ->count();

        if ($test->max_attempts !== null && $completedAttempts >= $test->max_attempts) {
            return response()->json([
                'message' => 'You have reached the maximum number of attempts allowed for this test.',
            ], 403);
        }

        // 4. Start new session
        $sections = null;
        $session = DB::transaction(function () use ($user, $test, &$sections) {
            // `questions.passage` is eager-loaded here as well as options: the
            // response below renders passages, and without it each question
            // would lazy-load its own — trading 4 queries for one per question.
            $sections = $test->sections()->with(['questions.options', 'questions.passage'])->orderBy('sort_order')->get();

            // Draw THIS candidate's paper order once, and persist it. It has to be
            // stored rather than recomputed per request: the palette, a resume
            // after a crash and the results review all have to show the same
            // order the candidate actually sat.
            [$questionOrder, $optionOrder] = $this->drawCandidatePaper($test, $sections);

            $session = TestSession::create([
                'user_id' => $user->id,
                'test_id' => $test->id,
                'started_at' => now(),
                'duration_seconds' => $test->duration_seconds,
                'current_section_index' => 0,
                'section_started_at' => now(),
                'question_order' => $questionOrder,
                'option_order' => $optionOrder,
            ]);

            // Pre-create every answer row up front, so saving an answer is always
            // an UPDATE and the palette can report "not visited" from row one.
            //
            // ONE batched insert, not one per question. A scheduled mock is a
            // synchronised spike — every candidate presses Start within the same
            // couple of minutes — and per-row creates made this endpoint cost
            // ~1 query per question (112 for a 100-question paper, i.e. 224,000
            // queries for a 2,000-candidate mock). Batched it is ~13 regardless
            // of paper length. Timestamps are set explicitly because a plain
            // insert() bypasses the model's automatic ones.
            $now = now();
            $rows = [];
            foreach ($sections as $section) {
                foreach ($section->questions as $question) {
                    $rows[] = [
                        'test_session_id' => $session->id,
                        'question_id' => $question->id,
                        'is_marked_for_review' => false,
                        'is_visited' => false,
                        'time_spent_seconds' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            if ($rows !== []) {
                // Chunked so a very long paper cannot exceed max_allowed_packet.
                foreach (array_chunk($rows, 500) as $chunk) {
                    TestAnswer::insert($chunk);
                }
            }

            return $session;
        });

        // Hand the paper we just loaded straight to the response instead of
        // letting it re-query tests + sections + questions + options a second
        // time — on a synchronised mock start that doubled the heaviest reads
        // in the whole request for no new information.
        $test->setRelation('sections', $sections);
        $session->setRelation('test', $test);

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
    public function saveAnswer(SaveAnswerRequest $request, TestSession $session, int $questionId): JsonResponse
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

        // Only the field matching the question's type is written — the other
        // two answer columns stay untouched (they're never used for this
        // question anyway). `selected_option_id(s)` are validated by
        // SaveAnswerRequest to belong to THIS question, so a foreign option id
        // can never be stored.
        $responseField = match ($question->question_type) {
            Question::TYPE_MULTI_SELECT => 'selected_option_ids',
            Question::TYPE_NUMERIC => 'numeric_response',
            default => 'selected_option_id',
        };

        $answer->update([
            $responseField => $request->input($responseField),
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
        $meritRank = $rankAndPercentile['merit_rank'];

        // Fetch question-by-question review key
        $answers = TestAnswer::where('test_session_id', $session->id)
            ->with(['question.options', 'question.passage'])
            ->get()
            ->map(function ($ans) {
                $q = $ans->question;
                return [
                    'question_id' => $ans->question_id,
                    'question_text' => $q->question_text,
                    'image_url' => $q->image_url,
                    'question_type' => $q->question_type,
                    'explanation' => $q->explanation,
                    'marks' => $q->marks,
                    'negative_marks' => $q->negative_marks,
                    'selected_option_id' => $ans->selected_option_id,
                    'selected_option_ids' => $ans->selected_option_ids,
                    'numeric_response' => $ans->numeric_response,
                    'numeric_answer' => $q->numeric_answer,
                    'numeric_tolerance' => $q->numeric_tolerance,
                    'is_correct' => $ans->isCorrect(),
                    'is_visited' => $ans->is_visited,
                    'time_spent_seconds' => $ans->time_spent_seconds,
                    'passage' => $q->passage ? [
                        'id' => $q->passage->id,
                        'title' => $q->passage->title,
                        'body' => $q->passage->body,
                        'image_url' => $q->passage->image_url,
                        'table' => $q->passage->table_data,
                    ] : null,
                    'options' => $q->options->map(fn($o) => [
                        'id' => $o->id,
                        'label' => $o->label,
                        'option_text' => $o->option_text,
                        'image_url' => $o->image_url,
                        'is_correct' => $o->is_correct,
                    ]),
                ];
            });

        return response()->json([
            'analytic' => $analytic,
            'rank' => $rank,
            'percentile' => $percentile,
            'merit_rank' => $meritRank,
            'answers' => $answers,
        ]);
    }

    /**
     * Fetch student's own completed test sessions history.
     */
    public function resultsHistory(Request $request): JsonResponse
    {
        $user = $request->user();

        $sessions = TestSession::where('user_id', $user->id)
            ->whereNotNull('submitted_at')
            ->with(['test:id,title,total_marks,duration_seconds,course_id', 'test.course:id,title', 'analytic'])
            ->latest('submitted_at')
            ->get()
            ->map(function ($session) {
                $analytic = $session->analytic;
                $rankAndPercentile = $session->getRankAndPercentile();

                return [
                    'session_id' => $session->id,
                    'test_id' => $session->test_id,
                    'test_title' => $session->test ? $session->test->title : 'Unknown Test',
                    'course_title' => $session->test && $session->test->course ? $session->test->course->title : null,
                    'submitted_at' => $session->submitted_at,
                    'is_auto_submitted' => $session->is_auto_submitted,
                    'score' => $analytic ? $analytic->total_score : 0,
                    'total_marks' => $session->test ? $session->test->total_marks : 0,
                    'accuracy_percentage' => $analytic ? $analytic->accuracy_percentage : 0,
                    'rank' => $rankAndPercentile['rank'],
                    'percentile' => $rankAndPercentile['percentile'],
                    'merit_rank' => $rankAndPercentile['merit_rank'],
                    'is_qualified' => $analytic ? $analytic->is_qualified : null,
                    'time_taken_seconds' => $analytic ? $analytic->total_time_seconds : 0,
                ];
            });

        return response()->json([
            'results' => $sessions,
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

        $answers = $this->inCandidateOrder(
            $session,
            // question:id,question_type only — this is polled frequently during a
            // live exam, and isAttempted() needs the type, nothing else.
            TestAnswer::where('test_session_id', $session->id)->with('question:id,question_type')->get()
        );

        $palette = $answers->map(function ($ans) {
            $status = 'not_visited';
            if ($ans->is_visited) {
                // isAttempted() is type-aware (single_choice/multi_select/numeric),
                // so a multi-select or numeric response shows as answered here too.
                if ($ans->isAttempted()) {
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
        // loadMissing, not load: `start()` has already loaded the whole paper
        // and hands it over, so this re-queries nothing there. `resume()` passes
        // nothing, so it still loads everything it needs.
        $session->loadMissing('test.sections.questions.options', 'test.sections.questions.passage');

        $questionOrder = $session->question_order ?? [];
        $optionOrder = $session->option_order ?? [];

        $sections = $session->test->sections->map(function ($section) use ($questionOrder, $optionOrder) {
            $questions = $this->applyOrder(
                $section->questions,
                $questionOrder[(string) $section->id] ?? null
            );

            return [
                'id' => $section->id,
                'title' => $section->title,
                'duration_seconds' => $section->duration_seconds,
                'sort_order' => $section->sort_order,
                // Sectional bar is shown to the candidate; a real CBT states it
                // in the instructions, and it changes how you allocate time.
                'cutoff_marks' => $section->cutoff_marks,
                'is_qualifying' => (bool) $section->is_qualifying,
                'questions' => $questions->values()->map(function ($q) use ($optionOrder) {
                    $options = $this->applyOrder($q->options, $optionOrder[(string) $q->id] ?? null);

                    return [
                        'id' => $q->id,
                        'subject' => $q->subject,
                        'topic' => $q->topic,
                        'difficulty' => $q->difficulty,
                        'exam_tags' => $q->exam_tags,
                        'question_text' => $q->question_text,
                        'image_url' => $q->image_url,
                        'question_type' => $q->question_type,
                        'marks' => $q->marks,
                        'negative_marks' => $q->negative_marks,
                        'passage' => $q->passage ? [
                            'id' => $q->passage->id,
                            'title' => $q->passage->title,
                            'body' => $q->passage->body,
                            'image_url' => $q->passage->image_url,
                            'table' => $q->passage->table_data,
                        ] : null,
                        // Options excluding is_correct for cheating prevention.
                        // Numeric questions have none — the array is just empty.
                        'options' => $options->values()->map(fn($o) => [
                            'id' => $o->id,
                            'label' => $o->label,
                            'option_text' => $o->option_text,
                            'image_url' => $o->image_url,
                            'sort_order' => $o->sort_order,
                        ]),
                    ];
                }),
            ];
        });

        $answers = TestAnswer::where('test_session_id', $session->id)
            ->select('question_id', 'selected_option_id', 'selected_option_ids', 'numeric_response', 'is_marked_for_review', 'is_visited')
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

    /**
     * Draw one candidate's paper: the question order within each section and the
     * option order within each question.
     *
     * Questions are only ever shuffled WITHIN a section - sections are the exam
     * structure (English, then Quant), and moving a question across them would
     * change the paper, not just its order.
     *
     * @return array{0: array<string, int[]>, 1: array<string, int[]>}
     */
    private function drawCandidatePaper(Test $test, $sections): array
    {
        $questionOrder = [];
        $optionOrder = [];

        foreach ($sections as $section) {
            $ids = $section->questions->pluck('id')->all();
            if ($test->shuffle_questions) {
                shuffle($ids);
            }
            $questionOrder[(string) $section->id] = $ids;

            if ($test->shuffle_options) {
                foreach ($section->questions as $question) {
                    $optionIds = $question->options->pluck('id')->all();
                    shuffle($optionIds);
                    $optionOrder[(string) $question->id] = $optionIds;
                }
            }
        }

        // Null (not an empty array) when nothing was shuffled, so "author order"
        // stays distinguishable from "shuffled and happened to match".
        return [
            $test->shuffle_questions ? $questionOrder : null,
            $test->shuffle_options && $optionOrder !== [] ? $optionOrder : null,
        ];
    }

    /**
     * Re-order a collection of models to match a stored list of ids.
     *
     * Anything not named in the stored order keeps its natural position at the
     * end, so a question added to a test after a candidate started still appears
     * rather than vanishing from their paper.
     */
    private function applyOrder($models, ?array $orderedIds)
    {
        if (!$orderedIds) {
            return $models;
        }

        $position = array_flip($orderedIds);
        $fallback = count($orderedIds);

        return $models->sortBy(fn($m) => $position[$m->id] ?? $fallback)->values();
    }

    /**
     * Sort answer rows into the candidate's paper order, so the palette indices
     * line up with the questions as that candidate sees them.
     */
    private function inCandidateOrder(TestSession $session, $answers)
    {
        $order = $session->question_order;
        if (!$order) {
            return $answers;
        }

        $flat = [];
        foreach ($session->test->sections()->orderBy('sort_order')->pluck('id') as $sectionId) {
            foreach ($order[(string) $sectionId] ?? [] as $qid) {
                $flat[] = $qid;
            }
        }

        $position = array_flip($flat);
        $fallback = count($flat);

        return $answers->sortBy(fn($a) => $position[$a->question_id] ?? $fallback)->values();
    }
}
