<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Enrollment;
use App\Models\Test;
use App\Models\TestSession;

use App\Models\TestSeries;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentTestSeriesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Both routes in: a series bought outright (or inside a bundle), and a
        // series assigned to a batch the student is enrolled in. Before the
        // product rail only the second existed, which is why a series could not
        // be sold on its own.
        $assignedSeriesIds = app(\App\Services\EntitlementService::class)->seriesIds($user);

        // Query published test series
        $seriesList = TestSeries::with(['course:id,title'])
            ->where('is_published', true)
            ->whereIn('id', $assignedSeriesIds)
            ->orderBy('sort_order')
            ->get();

        // Compute student completion progress per series
        $seriesList->transform(function ($series) use ($user) {
            $testIds = Test::where('test_series_id', $series->id)->pluck('id');
            $totalTests = $testIds->count();
            
            // A submitted session is one with a submitted_at timestamp — there is
            // no `status` column on test_sessions (null submitted_at = in progress).
            $submittedTestIds = TestSession::where('user_id', $user->id)
                ->whereIn('test_id', $testIds)
                ->whereNotNull('submitted_at')
                ->pluck('test_id')
                ->unique();

            $attemptedCount = $submittedTestIds->count();

            return [
                'id' => $series->id,
                'title' => $series->title,
                'slug' => $series->slug,
                'description' => $series->description,
                'exam_category' => $series->exam_category,
                'course' => $series->course,
                'total_tests' => $totalTests,
                'free_tests_count' => $series->free_tests_count,
                'attempted_tests_count' => $attemptedCount,
                'is_completed' => $totalTests > 0 && $attemptedCount >= $totalTests,
            ];
        });

        return response()->json($seriesList);
    }

    public function show(Request $request, TestSeries $series): JsonResponse
    {
        $user = $request->user();

        if (!$series->is_published) {
            return response()->json(['message' => 'This test series is not published yet.'], 404);
        }

        // Bought outright, inside a bundle, or assigned to the student's batch.
        $isAssigned = app(\App\Services\EntitlementService::class)->hasSeries($user, $series->id);

        if (!$isAssigned) {
            return response()->json(['message' => 'You do not have active access to this test series.'], 403);
        }

        // Fetch tests in study path order
        $tests = Test::where('test_series_id', $series->id)
            ->where('is_published', true)
            ->orderBy('series_sort_order')
            ->get();

        // Get student sessions map for status
        $userSessions = TestSession::where('user_id', $user->id)
            ->whereIn('test_id', $tests->pluck('id'))
            ->get()
            ->groupBy('test_id');

        $nextTestId = null;
        $testsWithStatus = $tests->map(function ($test) use ($userSessions, &$nextTestId) {
            $sessions = $userSessions->get($test->id);
            // Same here: submitted = has submitted_at, in-progress = does not.
            // `firstWhere('status', …)` silently matched nothing (no such column).
            $submittedSession = $sessions?->first(fn ($s) => $s->submitted_at !== null);
            $inProgressSession = $sessions?->first(fn ($s) => $s->submitted_at === null);

            $status = 'not_started';
            if ($submittedSession) {
                $status = 'completed';
            } elseif ($inProgressSession) {
                $status = 'in_progress';
            }

            if ($status !== 'completed' && $nextTestId === null) {
                $nextTestId = $test->id;
            }

            return [
                'id' => $test->id,
                'title' => $test->title,
                'series_sort_order' => $test->series_sort_order,
                'category' => $test->category ?: 'full_mock',
                'is_free' => $test->is_free,
                'type' => $test->type,
                'duration_seconds' => $test->duration_seconds,
                'total_marks' => $test->total_marks,
                'status' => $status,
                'score' => $submittedSession?->total_score,
                'submitted_at' => $submittedSession?->submitted_at,
                // The completed-attempt's OWN session id — results are keyed
                // by session, not test, so "view analysis" on a finished test
                // needs this to have anywhere real to link to.
                'session_id' => $submittedSession?->id,
            ];
        });

        // Group tests by category tabs
        $groupedByCategory = $testsWithStatus->groupBy('category');

        return response()->json([
            'id' => $series->id,
            'title' => $series->title,
            'slug' => $series->slug,
            'description' => $series->description,
            'exam_category' => $series->exam_category,
            'total_tests' => $tests->count(),
            'next_test_id' => $nextTestId,
            'tests' => $testsWithStatus,
            'categories' => $groupedByCategory,
        ]);
    }

    public function leaderboard(Request $request, TestSeries $series): JsonResponse
    {
        $user = $request->user();

        // Get user's primary active batch
        $batchId = Enrollment::active()
            ->where('user_id', $user->id)
            ->pluck('batch_id')
            ->first();

        if (!$batchId) {
            return response()->json(['leaderboard' => [], 'user_rank' => null]);
        }

        // Get enrolled student IDs in this batch
        $batchUserIds = Enrollment::active()
            ->where('batch_id', $batchId)
            ->pluck('user_id');

        $seriesTestIds = Test::where('test_series_id', $series->id)->pluck('id');

        // Sum max score per test per student
        $rankings = DB::table('test_sessions')
            ->join('users', 'users.id', '=', 'test_sessions.user_id')
            ->select('users.id', 'users.name', DB::raw('SUM(test_sessions.total_score) as total_series_score'), DB::raw('COUNT(DISTINCT test_sessions.test_id) as tests_completed'))
            ->whereIn('test_sessions.user_id', $batchUserIds)
            ->whereIn('test_sessions.test_id', $seriesTestIds)
            ->where('test_sessions.status', 'submitted')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('total_series_score')
            ->get();

        $userRank = null;
        $formatted = $rankings->map(function ($item, $index) use ($user, &$userRank) {
            $rank = $index + 1;
            if ($item->id === $user->id) {
                $userRank = $rank;
            }
            return [
                'rank' => $rank,
                'user_id' => $item->id,
                'name' => $item->name,
                'total_score' => (float) $item->total_series_score,
                'tests_completed' => (int) $item->tests_completed,
                'is_current_user' => $item->id === $user->id,
            ];
        });

        return response()->json([
            'leaderboard' => $formatted,
            'user_rank' => $userRank,
        ]);
    }
}
