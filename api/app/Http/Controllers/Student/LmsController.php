<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Enrollment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LmsController extends Controller
{
    /**
     * List all courses the student is active in.
     */
    public function myCourses(): JsonResponse
    {
        // Reads entitlements, not enrolments. A course bought as part of a
        // bundle still creates an enrolment when the course has an active batch,
        // but a course with no batch yet would otherwise be paid for and
        // invisible.
        $courses = Course::whereIn('id', app(\App\Services\EntitlementService::class)->courseIds(auth()->user()))
            ->get();

        return response()->json($courses);
    }

    /**
     * Get outline of modules/lessons + student progress.
     */
    public function courseOutline(Course $course): JsonResponse
    {
        $hasAccess = app(\App\Services\EntitlementService::class)
            ->hasCourse(auth()->user(), $course->id);

        if (!$hasAccess) {
            return response()->json([
                'message' => 'You are not enrolled in this course or your access has expired.',
            ], 403);
        }

        $modules = CourseModule::where('course_id', $course->id)
            ->with(['lessons' => function ($query) {
                $query->orderBy('sort_order');
            }])
            ->orderBy('sort_order')
            ->get();

        $userId = auth()->id();
        $modules->each(function ($module) use ($userId) {
            $module->lessons->each(function ($lesson) use ($userId) {
                $progress = $lesson->progress()->where('user_id', $userId)->first();
                $lesson->setAttribute('student_progress', $progress ? [
                    'watched_seconds' => $progress->watched_seconds,
                    'is_completed' => $progress->completed,
                    'completed_at' => $progress->completed_at,
                ] : null);
            });
        });

        return response()->json([
            'course' => $course,
            'modules' => $modules,
        ]);
    }

    /**
     * Get lesson details (gated by enrollment or free preview).
     */
    public function lessonDetails(Lesson $lesson): JsonResponse
    {
        $courseId = $lesson->module->course_id;

        $isEnrolled = Enrollment::where('user_id', auth()->id())
            ->where('course_id', $courseId)
            ->active()
            ->exists();

        if (!$isEnrolled && !$lesson->is_free_preview) {
            return response()->json([
                'message' => 'You do not have access to this lesson.',
            ], 403);
        }

        $progress = $lesson->progress()->where('user_id', auth()->id())->first();

        return response()->json([
            'lesson' => $lesson,
            'progress' => $progress ? [
                'watched_seconds' => $progress->watched_seconds,
                'is_completed' => $progress->completed,
                'completed_at' => $progress->completed_at,
            ] : null,
        ]);
    }

    /**
     * Update progress of a lesson.
     */
    public function updateProgress(Request $request, Lesson $lesson): JsonResponse
    {
        $request->validate([
            'watched_seconds' => ['required', 'integer', 'min:0'],
        ]);

        $courseId = $lesson->module->course_id;

        $isEnrolled = Enrollment::where('user_id', auth()->id())
            ->where('course_id', $courseId)
            ->active()
            ->exists();

        if (!$isEnrolled) {
            return response()->json([
                'message' => 'You do not have access to this lesson.',
            ], 403);
        }

        $watchedSeconds = $request->watched_seconds;
        
        // Auto-complete if student watched 90% of the video duration
        $isCompleted = false;
        if ($lesson->duration_seconds > 0) {
            $isCompleted = $watchedSeconds >= ($lesson->duration_seconds * 0.9);
        }

        $progress = LessonProgress::where('user_id', auth()->id())
            ->where('lesson_id', $lesson->id)
            ->first();

        if ($progress) {
            $updateData = [
                'watched_seconds' => max($progress->watched_seconds, $watchedSeconds),
            ];

            // Only mark completed if not already completed, or if new status is true
            if (!$progress->completed && $isCompleted) {
                $updateData['completed'] = true;
                $updateData['completed_at'] = now();
            }

            $progress->update($updateData);
        } else {
            $progress = LessonProgress::create([
                'user_id' => auth()->id(),
                'lesson_id' => $lesson->id,
                'watched_seconds' => $watchedSeconds,
                'completed' => $isCompleted,
                'completed_at' => $isCompleted ? now() : null,
            ]);
        }

        return response()->json([
            'message' => 'Lesson progress updated successfully.',
            'progress' => [
                'watched_seconds' => $progress->watched_seconds,
                'is_completed' => $progress->completed,
                'completed_at' => $progress->completed_at,
            ],
        ]);
    }

    /**
     * List all published courses with their active batches and prices,
     * excluding courses the student is already enrolled in.
     */
    public function purchasableCourses(): JsonResponse
    {
        $enrolledCourseIds = Enrollment::where('user_id', auth()->id())
            ->where('is_active', true)
            ->pluck('course_id');

        $courses = Course::where('is_published', true)
            ->whereNotIn('id', $enrolledCourseIds)
            ->with(['batches' => function ($query) {
                $query->where('is_active', true)->whereNotNull('price_paise');
            }])
            ->get();

        // Filter out courses that have no active priced batches
        $courses = $courses->filter(function ($course) {
            return $course->batches->count() > 0;
        })->values();

        return response()->json($courses);
    }
}
