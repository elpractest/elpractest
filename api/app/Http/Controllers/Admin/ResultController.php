<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TestSession;
use App\Models\TestAnswer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResultController extends Controller
{
    /**
     * Display a listing of completed test sessions (results).
     */
    public function index(Request $request): JsonResponse
    {
        $query = TestSession::with(['user', 'test.course', 'analytic'])
            ->whereNotNull('submitted_at');

        if ($request->filled('course_id')) {
            $courseId = $request->course_id;
            $query->whereHas('test', function ($q) use ($courseId) {
                $q->where('course_id', $courseId);
            });
        }

        if ($request->filled('batch_id')) {
            $batchId = $request->batch_id;
            // Test sessions can have an explicit batch_id, or we check the student's active enrollment batch
            $query->where(function ($q) use ($batchId) {
                $q->whereHas('user.enrollments', function ($eq) use ($batchId) {
                    $eq->where('batch_id', $batchId)->active();
                });
            });
        }

        if ($request->filled('test_id')) {
            $query->where('test_id', $request->test_id);
        }

        $sessions = $query->latest('submitted_at')->paginate(20);

        // Map rank and percentile for each session in the current page
        $sessions->getCollection()->transform(function ($session) {
            $rankAndPercent = $session->getRankAndPercentile();
            $session->rank = $rankAndPercent['rank'];
            $session->percentile = $rankAndPercent['percentile'];
            // Strict published ordering; `rank` lets equal scores tie.
            $session->merit_rank = $rankAndPercent['merit_rank'];
            return $session;
        });

        return response()->json($sessions);
    }

    /**
     * Display the detailed scorecard for a student's test session.
     * Matches the response structure of TestTakingController::result() to facilitate UI reuse.
     */
    public function show(TestSession $session): JsonResponse
    {
        if ($session->submitted_at === null) {
            return response()->json(['message' => 'Test session has not been submitted yet.'], 400);
        }

        $analytic = $session->analytic;
        $rankAndPercent = $session->getRankAndPercentile();
        
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
            'rank' => $rankAndPercent['rank'],
            'percentile' => $rankAndPercent['percentile'],
            'merit_rank' => $rankAndPercent['merit_rank'],
            'answers' => $answers,
        ]);
    }
}
