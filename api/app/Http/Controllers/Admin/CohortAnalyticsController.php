<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\LessonProgress;
use App\Models\Test;
use App\Models\TestSeries;
use App\Models\TestSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Owner-facing cohort analytics (TEST-SERIES-SPEC.md 4.5).
 *
 * Read-only queries over existing `test_sessions` + `test_analytics` joined to
 * `enrollments`. No new analytics tables: every number here is derived, so a
 * re-scored session changes these views on the next request rather than leaving
 * a stale aggregate behind.
 */
class CohortAnalyticsController extends Controller
{
    /** Batch summary: participation, averages and the topics the cohort is worst at. */
    public function batchAnalytics(Batch $batch): JsonResponse
    {
        $enrolledUserIds = Enrollment::where('batch_id', $batch->id)
            ->active()
            ->pluck('user_id')
            ->unique();

        $sessions = TestSession::whereIn('user_id', $enrolledUserIds)
            ->whereNotNull('submitted_at')
            ->with('analytic')
            ->get();

        $withAnalytics = $sessions->filter(fn ($s) => $s->analytic !== null);

        $scores = $withAnalytics->map(fn ($s) => (float) $s->analytic->total_score);
        $accuracies = $withAnalytics->map(fn ($s) => (float) $s->analytic->accuracy_percentage);

        return response()->json([
            'batch' => ['id' => $batch->id, 'name' => $batch->name],
            'enrolled_students' => $enrolledUserIds->count(),
            'students_who_attempted' => $withAnalytics->pluck('user_id')->unique()->count(),
            'total_attempts' => $withAnalytics->count(),
            'average_score' => $scores->isEmpty() ? 0.0 : round($scores->avg(), 2),
            'average_accuracy' => $accuracies->isEmpty() ? 0.0 : round($accuracies->avg(), 2),
            'qualified_attempts' => $withAnalytics->filter(fn ($s) => $s->analytic->is_qualified === true)->count(),
            'weak_topics' => $this->aggregateBreakdown($withAnalytics, 'topic_breakdown'),
            'weak_subjects' => $this->aggregateBreakdown($withAnalytics, 'subject_breakdown'),
        ]);
    }

    /** One row per enrolled student: how far through, how accurate, last seen. */
    public function studentsProgress(Batch $batch): JsonResponse
    {
        $enrollments = Enrollment::where('batch_id', $batch->id)
            ->active()
            ->with('user:id,name,email')
            ->get();

        // Everything assigned to this batch, so "3 of 12" means something.
        $assignedTestIds = $this->assignedTestIds($batch);

        $rows = $enrollments->map(function ($enrollment) use ($assignedTestIds) {
            $sessions = TestSession::where('user_id', $enrollment->user_id)
                ->whereIn('test_id', $assignedTestIds)
                ->whereNotNull('submitted_at')
                ->with('analytic')
                ->get();

            $done = $sessions->pluck('test_id')->unique();
            $analytics = $sessions->filter(fn ($s) => $s->analytic !== null);

            return [
                'user_id' => $enrollment->user_id,
                'name' => $enrollment->user?->name,
                'email' => $enrollment->user?->email,
                'tests_completed' => $done->count(),
                'tests_assigned' => count($assignedTestIds),
                'completion_percentage' => count($assignedTestIds) > 0
                    ? round($done->count() / count($assignedTestIds) * 100, 2)
                    : 0.0,
                'average_score' => $analytics->isEmpty()
                    ? null
                    : round($analytics->avg(fn ($s) => (float) $s->analytic->total_score), 2),
                'average_accuracy' => $analytics->isEmpty()
                    ? null
                    : round($analytics->avg(fn ($s) => (float) $s->analytic->accuracy_percentage), 2),
                'last_active_at' => $sessions->max('submitted_at'),
            ];
        })->sortByDesc('average_score')->values();

        return response()->json(['students' => $rows]);
    }

    /** Merit list for one test, optionally narrowed to a batch. */
    public function testLeaderboard(Request $request, Test $test): JsonResponse
    {
        $query = TestSession::where('test_id', $test->id)
            ->whereNotNull('submitted_at')
            ->with(['analytic', 'user:id,name']);

        if ($request->filled('batch_id')) {
            $userIds = Enrollment::where('batch_id', $request->batch_id)->active()->pluck('user_id');
            $query->whereIn('user_id', $userIds);
        }

        $sessions = $query->get()->filter(fn ($s) => $s->analytic !== null);

        // Same tie-break chain as the published merit list: score, then fewer
        // wrong, then faster. Sorting here rather than in SQL keeps it identical
        // to TestSession::getRankAndPercentile without duplicating window SQL.
        $ranked = $sessions->sortBy([
            fn ($a, $b) => (float) ($b->analytic->merit_score ?? $b->analytic->total_score)
                <=> (float) ($a->analytic->merit_score ?? $a->analytic->total_score),
            fn ($a, $b) => $a->analytic->incorrect_count <=> $b->analytic->incorrect_count,
            fn ($a, $b) => $a->analytic->total_time_seconds <=> $b->analytic->total_time_seconds,
        ])->values();

        return response()->json([
            'test' => ['id' => $test->id, 'title' => $test->title, 'total_marks' => $test->total_marks],
            'leaderboard' => $ranked->map(fn ($s, $i) => [
                'merit_rank' => $i + 1,
                'user_id' => $s->user_id,
                'name' => $s->user?->name,
                'score' => (float) $s->analytic->total_score,
                'merit_score' => $s->analytic->merit_score !== null ? (float) $s->analytic->merit_score : null,
                'normalized_score' => $s->analytic->normalized_score !== null ? (float) $s->analytic->normalized_score : null,
                'accuracy_percentage' => (float) $s->analytic->accuracy_percentage,
                'is_qualified' => $s->analytic->is_qualified,
                'time_taken_seconds' => $s->analytic->total_time_seconds,
                'submitted_at' => $s->submitted_at,
            ])->values(),
        ]);
    }

    /** Aggregate merit list across every test in a series. */
    public function seriesLeaderboard(Request $request, TestSeries $series): JsonResponse
    {
        $testIds = Test::where('test_series_id', $series->id)->pluck('id');

        $query = TestSession::whereIn('test_id', $testIds)
            ->whereNotNull('submitted_at')
            ->with(['analytic', 'user:id,name']);

        if ($request->filled('batch_id')) {
            $userIds = Enrollment::where('batch_id', $request->batch_id)->active()->pluck('user_id');
            $query->whereIn('user_id', $userIds);
        }

        $byUser = $query->get()
            ->filter(fn ($s) => $s->analytic !== null)
            ->groupBy('user_id');

        $rows = $byUser->map(function ($sessions, $userId) {
            // Best attempt per test, so a retake improves a candidate rather
            // than dragging their series average down twice.
            $best = $sessions->groupBy('test_id')->map(
                fn ($perTest) => $perTest->sortByDesc(fn ($s) => (float) $s->analytic->total_score)->first()
            );

            return [
                'user_id' => (int) $userId,
                'name' => $sessions->first()->user?->name,
                'tests_attempted' => $best->count(),
                'total_score' => round($best->sum(fn ($s) => (float) $s->analytic->total_score), 2),
                'average_accuracy' => round($best->avg(fn ($s) => (float) $s->analytic->accuracy_percentage), 2),
                'total_time_seconds' => $best->sum(fn ($s) => (int) $s->analytic->total_time_seconds),
            ];
        })->sortByDesc('total_score')->values();

        return response()->json([
            'series' => ['id' => $series->id, 'title' => $series->title],
            'leaderboard' => $rows->map(fn ($r, $i) => $r + ['merit_rank' => $i + 1])->values(),
        ]);
    }

    /**
     * Video engagement for a course: who is actually watching the lessons, and
     * where they stop.
     *
     * `lesson_progress` has been written on every lesson view since the LMS
     * shipped, but nothing ever read it back in aggregate — an admin could see
     * ONE student's watched_seconds on the outline page, never the cohort's.
     * This is the same derive-on-request shape as `batchAnalytics`: no new
     * table, so a corrected duration or a re-enrolled student is reflected on
     * the next load rather than leaving a stale number behind.
     *
     * Scoped to the COURSE, not a batch, because lessons belong to a course and
     * `LmsController::lessonDetails` gates on course enrollment — matching that
     * grain is what makes "enrolled" mean the same thing here as it does to a
     * student opening the lesson. `batch_id` narrows it further for an owner
     * who runs several batches of the same course and wants to compare them.
     */
    public function videoEngagement(Request $request, Course $course): JsonResponse
    {
        $lessons = $course->lessons()
            ->with('module:id,title')
            ->orderBy('course_modules.sort_order')
            ->orderBy('lessons.sort_order')
            ->get();

        $enrollmentQuery = Enrollment::where('course_id', $course->id)->active();
        if ($request->filled('batch_id')) {
            $enrollmentQuery->where('batch_id', $request->integer('batch_id'));
        }
        $enrolledUserIds = $enrollmentQuery->pluck('user_id')->unique();

        if ($lessons->isEmpty() || $enrolledUserIds->isEmpty()) {
            return response()->json([
                'course' => ['id' => $course->id, 'title' => $course->title],
                'enrolled_students' => $enrolledUserIds->count(),
                'total_lessons' => $lessons->count(),
                'students_who_watched_anything' => 0,
                'average_course_completion' => 0.0,
                'lessons' => [],
                'weakest_lessons' => [],
            ]);
        }

        $progress = LessonProgress::whereIn('lesson_id', $lessons->pluck('id'))
            ->whereIn('user_id', $enrolledUserIds)
            ->get()
            ->groupBy('lesson_id');

        $studentsWhoWatchedAnything = $progress->flatten()->pluck('user_id')->unique()->count();

        $rows = $lessons->map(function ($lesson) use ($progress, $enrolledUserIds) {
            $rows = $progress->get($lesson->id, collect());
            $viewers = $rows->count();
            $completers = $rows->where('completed', true)->count();
            $duration = (int) $lesson->duration_seconds;

            // Percent of the lesson's own length, not a raw second count, so a
            // 3-minute and a 40-minute lesson compare on the same axis. A
            // lesson with no stored duration cannot compute this — its watch
            // seconds are still real, they just cannot be turned into a
            // percentage of an unknown length.
            $avgPercent = ($duration > 0 && $viewers > 0)
                ? round($rows->avg(fn ($r) => min(100, ($r->watched_seconds / $duration) * 100)), 1)
                : null;

            return [
                'lesson_id' => $lesson->id,
                'title' => $lesson->title,
                'module' => $lesson->module?->title,
                'duration_seconds' => $duration,
                'enrolled_students' => $enrolledUserIds->count(),
                'students_started' => $viewers,
                'students_completed' => $completers,
                // Against everyone ENROLLED, not just those who clicked play —
                // "never opened it" is exactly the drop-off a course owner
                // needs to see, and hiding those students behind a rate
                // computed only over viewers would erase them.
                'start_rate' => $enrolledUserIds->count() > 0
                    ? round($viewers / $enrolledUserIds->count() * 100, 1)
                    : 0.0,
                'completion_rate' => $enrolledUserIds->count() > 0
                    ? round($completers / $enrolledUserIds->count() * 100, 1)
                    : 0.0,
                'average_watched_seconds' => $viewers > 0 ? (int) round($rows->avg('watched_seconds')) : 0,
                'average_watched_percentage' => $avgPercent,
            ];
        })->values();

        // Worst completion first — where the cohort is actually giving up,
        // not just which lesson happens to be last in the syllabus.
        $weakest = $rows->sortBy('completion_rate')->take(10)->values();

        return response()->json([
            'course' => ['id' => $course->id, 'title' => $course->title],
            'enrolled_students' => $enrolledUserIds->count(),
            'total_lessons' => $lessons->count(),
            'students_who_watched_anything' => $studentsWhoWatchedAnything,
            'average_course_completion' => round($rows->avg('completion_rate'), 1),
            'lessons' => $rows,
            'weakest_lessons' => $weakest,
        ]);
    }

    /** Test ids reachable by this batch, whether assigned directly or via a series. */
    private function assignedTestIds(Batch $batch): array
    {
        $assignments = DB::table('assignments')
            ->where('batch_id', $batch->id)
            ->where('is_active', true)
            ->get(['assignable_type', 'assignable_id']);

        $seriesIds = $assignments->where('assignable_type', TestSeries::class)->pluck('assignable_id');
        $directIds = $assignments->where('assignable_type', Test::class)->pluck('assignable_id');

        $fromSeries = Test::whereIn('test_series_id', $seriesIds)->pluck('id');

        return $directIds->merge($fromSeries)
            ->merge(Test::where('batch_id', $batch->id)->pluck('id'))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Roll per-session topic/subject breakdowns into a cohort weakness list,
     * worst accuracy first. Only keys with real attempts are reported, so a
     * topic nobody reached is not shown as 0% mastered.
     *
     * @return array<int, array<string, mixed>>
     */
    private function aggregateBreakdown($sessions, string $field): array
    {
        $totals = [];

        foreach ($sessions as $session) {
            foreach (($session->analytic->{$field} ?? []) as $key => $stats) {
                if (!isset($totals[$key])) {
                    $totals[$key] = ['correct' => 0, 'incorrect' => 0, 'unanswered' => 0];
                }
                $totals[$key]['correct'] += $stats['correct'] ?? 0;
                $totals[$key]['incorrect'] += $stats['incorrect'] ?? 0;
                $totals[$key]['unanswered'] += $stats['unanswered'] ?? 0;
            }
        }

        $rows = [];
        foreach ($totals as $key => $t) {
            $attempted = $t['correct'] + $t['incorrect'];
            if ($attempted === 0) {
                continue;
            }
            $rows[] = [
                'key' => $key,
                'attempted' => $attempted,
                'correct' => $t['correct'],
                'unanswered' => $t['unanswered'],
                'accuracy' => round($t['correct'] / $attempted * 100, 2),
            ];
        }

        usort($rows, fn ($a, $b) => $a['accuracy'] <=> $b['accuracy']);

        return array_slice($rows, 0, 15);
    }
}
