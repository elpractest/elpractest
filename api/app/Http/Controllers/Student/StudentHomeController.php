<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Test;
use App\Models\TestAnswer;
use App\Models\TestSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Everything the Home tab draws, in one round trip.
 *
 * Home used to open with the words "Student Dashboard" and a list of courses.
 * It now opens with the one thing a returning student came back for — where
 * they stopped — then a verdict, then the catalogue. Each of those needs data
 * the existing student endpoints do not carry, and fetching them separately
 * would mean five requests on a phone that may be on 3G.
 *
 * The governing rule of this response, and the reason the window is computed
 * once at the top: **every figure on the screen comes from one source and one
 * window.** A dashboard whose headline disagrees with its own body loses the
 * credibility of every number on it, so `week.accuracy` and
 * `weakest_topic.average_accuracy` are the same number by construction, not by
 * coincidence.
 */
class StudentHomeController extends Controller
{
    /** The window every figure on Home is computed over. */
    private const WINDOW_DAYS = 7;

    /**
     * A topic needs at least this many questions in the window before it can be
     * called anyone's weakest. Below it the accuracy is noise, and naming a
     * topic off two questions is worse than naming none.
     */
    private const MIN_TOPIC_QUESTIONS = 3;

    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $since = now()->subDays(self::WINDOW_DAYS);

        $window = TestSession::where('user_id', $user->id)
            ->whereNotNull('submitted_at')
            ->where('submitted_at', '>=', $since)
            ->with('analytic')
            ->get();

        $weekAccuracy = $this->weekAccuracy($window);

        return response()->json([
            'window_days' => self::WINDOW_DAYS,
            'active_session' => $this->activeSession($user->id),
            'week' => [
                'tests' => $window->count(),
                'accuracy' => $weekAccuracy,
                'time_seconds' => (int) $window->sum(
                    fn ($s) => $s->analytic->total_time_seconds ?? 0
                ),
            ],
            'weakest_topic' => $this->weakestTopic($window, $weekAccuracy),
            'courses' => $this->courses($user->id),
            'entitlement' => $this->entitlement($user->id),
            'board_categories' => $this->boardCategories($user->id),
        ]);
    }

    /**
     * The unfinished paper, if there is one.
     *
     * Timing is reconciled first: a session the student abandoned days ago may
     * already be over, and offering to "resume" a paper whose clock ran out is
     * the one thing this card must never do.
     */
    private function activeSession(int $userId): ?array
    {
        $session = TestSession::where('user_id', $userId)
            ->whereNull('submitted_at')
            ->latest('started_at')
            ->first();

        if (!$session) {
            return null;
        }

        $session->reconcileSectionTiming();
        $session->refresh();

        // reconcileSectionTiming auto-submits an expired paper. If it did,
        // there is nothing to resume.
        if ($session->submitted_at !== null) {
            return null;
        }

        $test = $session->test;
        $sections = $test ? $test->sections()->orderBy('sort_order')->get() : collect();
        $current = $sections->get($session->current_section_index);

        $questionCount = TestAnswer::where('test_session_id', $session->id)->count();
        $answeredCount = TestAnswer::where('test_session_id', $session->id)
            ->whereNotNull('selected_option_id')
            ->count();

        return [
            'id' => $session->id,
            'test_id' => $session->test_id,
            'test_title' => $test?->title,
            'category' => $test?->category ?? $test?->course?->exam_category,
            'time_remaining_seconds' => $session->timeRemainingSeconds(),
            'section_time_remaining_seconds' => $session->sectionTimeRemainingSeconds(),
            'current_section_index' => $session->current_section_index,
            'section_count' => $sections->count(),
            'section_title' => $current?->title,
            'answered_count' => $answeredCount,
            'question_count' => $questionCount,
        ];
    }

    /**
     * Accuracy across the window, weighted by questions attempted rather than
     * averaged per session — otherwise a 5-question sectional counts as much as
     * a 100-question full mock and the figure stops describing the student.
     */
    private function weekAccuracy($window): ?float
    {
        $correct = 0;
        $attempted = 0;
        foreach ($window as $session) {
            $a = $session->analytic;
            if (!$a) {
                continue;
            }
            $correct += (int) $a->correct_count;
            $attempted += (int) $a->correct_count + (int) $a->incorrect_count;
        }
        return $attempted > 0 ? round(($correct / $attempted) * 100, 1) : null;
    }

    /**
     * The opinion. One topic, its accuracy, and what that costs against the
     * student's own average — never a number without a verdict attached.
     *
     * Built from the `topic_breakdown` the analytics job already stores, so
     * this costs one query and no recomputation.
     */
    private function weakestTopic($window, ?float $weekAccuracy): ?array
    {
        if ($weekAccuracy === null) {
            return null;
        }

        $topics = [];
        foreach ($window as $session) {
            $breakdown = $session->analytic?->topic_breakdown;
            if (!is_array($breakdown)) {
                continue;
            }
            foreach ($breakdown as $topic => $row) {
                if ($topic === '' || strtolower((string) $topic) === 'uncategorized') {
                    continue;
                }
                $topics[$topic] ??= ['correct' => 0, 'incorrect' => 0, 'time' => 0, 'questions' => 0];
                $topics[$topic]['correct'] += (int) ($row['correct'] ?? 0);
                $topics[$topic]['incorrect'] += (int) ($row['incorrect'] ?? 0);
                $topics[$topic]['time'] += (int) ($row['time_spent'] ?? 0);
                $topics[$topic]['questions'] += (int) ($row['correct'] ?? 0)
                    + (int) ($row['incorrect'] ?? 0)
                    + (int) ($row['unanswered'] ?? 0);
            }
        }

        $worst = null;
        foreach ($topics as $topic => $row) {
            $attempted = $row['correct'] + $row['incorrect'];
            if ($row['questions'] < self::MIN_TOPIC_QUESTIONS || $attempted === 0) {
                continue;
            }
            $accuracy = round(($row['correct'] / $attempted) * 100, 1);
            // Only a topic the student is actually below their own average on
            // is worth naming. Their best topic is not a weakness.
            if ($accuracy >= $weekAccuracy) {
                continue;
            }
            if ($worst === null || $accuracy < $worst['accuracy']) {
                $worst = [
                    'topic' => (string) $topic,
                    'accuracy' => $accuracy,
                    'average_accuracy' => $weekAccuracy,
                    'question_count' => $row['questions'],
                    'time_seconds' => $row['time'],
                ];
            }
        }

        return $worst;
    }

    /**
     * Enrolled courses with the lesson progress the card draws, and the cover
     * the catalogue reads by.
     */
    private function courses(int $userId): array
    {
        $courses = Course::whereHas('enrollments', function ($q) use ($userId) {
            $q->where('user_id', $userId)->active();
        })->get();

        $out = [];
        foreach ($courses as $course) {
            $lessonIds = Lesson::whereHas(
                'module',
                fn ($q) => $q->where('course_id', $course->id)
            )->pluck('id');

            $completed = $lessonIds->isEmpty() ? 0 : LessonProgress::where('user_id', $userId)
                ->whereIn('lesson_id', $lessonIds)
                ->where('completed', true)
                ->count();

            $total = $lessonIds->count();

            $out[] = [
                'id' => $course->id,
                'title' => $course->title,
                'exam_category' => $course->exam_category,
                'mode' => $course->mode,
                'short_description' => $course->short_description,
                'thumbnail_url' => $course->thumbnail_url,
                'lessons_total' => $total,
                'lessons_completed' => $completed,
                'progress_percent' => $total > 0 ? (int) round(($completed / $total) * 100) : 0,
            ];
        }

        return $out;
    }

    /**
     * The nearest expiry across active enrollments, which is what a student
     * actually needs to know — not the furthest, and not a list.
     *
     * A null `expires_at` means the enrollment does not lapse; those are
     * excluded rather than reported as an unknown number of days.
     */
    private function entitlement(int $userId): ?array
    {
        $enrollment = Enrollment::where('user_id', $userId)
            ->active()
            ->whereNotNull('expires_at')
            ->with('batch')
            ->orderBy('expires_at')
            ->first();

        if (!$enrollment) {
            return null;
        }

        return [
            'batch_name' => $enrollment->batch?->name,
            'expires_at' => $enrollment->expires_at,
            'days_remaining' => max(0, (int) now()->startOfDay()
                ->diffInDays($enrollment->expires_at->startOfDay(), false)),
        ];
    }

    /**
     * The exam categories a board rail may draw, and only those.
     *
     * Taken from tests the student can actually open, never from a static list:
     * a board tile with an empty catalogue behind it is the fastest way to lose
     * an aspirant's trust, and they check.
     */
    private function boardCategories(int $userId): array
    {
        $enrollments = Enrollment::where('user_id', $userId)->active()->get();
        $courseIds = $enrollments->pluck('course_id')->filter()->unique()->all();
        $batchIds = $enrollments->pluck('batch_id')->filter()->unique()->all();

        return Test::published()
            ->available()
            ->where(function ($q) use ($courseIds, $batchIds) {
                $q->whereIn('course_id', $courseIds)
                    ->orWhereIn('batch_id', $batchIds)
                    ->orWhere(fn ($sq) => $sq->whereNull('course_id')->whereNull('batch_id'));
            })
            ->with('course:id,exam_category')
            ->get()
            ->map(fn ($t) => $t->category ?: $t->course?->exam_category)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }
}
