<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\PublicCourseController;
use App\Http\Requests\Admin\StoreCourseRequest;
use App\Http\Requests\Admin\UpdateCourseRequest;
use App\Http\Requests\Admin\StoreCourseModuleRequest;
use App\Http\Requests\Admin\StoreLessonRequest;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Lesson;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class CourseCRUDController extends Controller
{
    /**
     * Display a listing of courses.
     */
    public function index(): JsonResponse
    {
        $courses = Course::withCount(['modules', 'lessons'])->orderBy('sort_order')->get();
        return response()->json($courses);
    }

    /**
     * Store a newly created course.
     */
    public function store(StoreCourseRequest $request): JsonResponse
    {
        $data = $request->validated();

        // A slug typed by the editor wins; the field is validated unique, so it
        // cannot collide. Otherwise derive one from the title and de-duplicate.
        // (This used to discard whatever was typed, contradicting the form's own
        // "auto-generated if left blank" hint.)
        if (empty($data['slug'])) {
            $slug = Str::slug($data['title']);
            $originalSlug = $slug;
            $count = 1;
            while (Course::where('slug', $slug)->exists()) {
                $slug = "{$originalSlug}-" . $count++;
            }
            $data['slug'] = $slug;
        }

        // Handle thumbnail upload
        if ($request->hasFile('thumbnail')) {
            $data['thumbnail_path'] = $request->file('thumbnail')->store('course_thumbnails', 'public');
        }
        unset($data['thumbnail']);

        $course = Course::create($data);

        AuditService::log('course.created', $course, null, $course->toArray());

        // The public catalogue is cached; drop it so this shows up at once.
        Cache::forget(PublicCourseController::CACHE_KEY);

        return response()->json([
            'message' => 'Course created successfully.',
            'course' => $course,
        ], 201);
    }

    /**
     * Display the specified course.
     */
    public function show(Course $course): JsonResponse
    {
        $course->load(['modules.lessons']);
        return response()->json($course);
    }

    /**
     * Update the specified course.
     */
    public function update(UpdateCourseRequest $request, Course $course): JsonResponse
    {
        $oldValue = $course->toArray();
        $data = $request->validated();

        // Lock slug unless manually provided in the request
        if (!isset($data['slug'])) {
            unset($data['slug']); // keep existing slug
        }

        // Handle thumbnail
        if ($request->hasFile('thumbnail')) {
            if ($course->thumbnail_path) {
                Storage::disk('public')->delete($course->thumbnail_path);
            }
            $data['thumbnail_path'] = $request->file('thumbnail')->store('course_thumbnails', 'public');
        }
        unset($data['thumbnail']);

        $course->update($data);

        AuditService::log('course.updated', $course, $oldValue, $course->toArray());

        // The public catalogue is cached; drop it so this shows up at once.
        Cache::forget(PublicCourseController::CACHE_KEY);

        return response()->json([
            'message' => 'Course updated successfully.',
            'course' => $course,
        ]);
    }

    /**
     * Remove the specified course.
     */
    public function destroy(Course $course): JsonResponse
    {
        $oldValue = $course->toArray();
        
        // Delete thumbnail
        if ($course->thumbnail_path) {
            Storage::disk('public')->delete($course->thumbnail_path);
        }

        $course->delete();

        AuditService::log('course.deleted', null, $oldValue, null);

        // The public catalogue is cached; drop it so this shows up at once.
        Cache::forget(PublicCourseController::CACHE_KEY);

        return response()->json([
            'message' => 'Course deleted successfully.',
        ]);
    }

    // ── Module CRUD ──────────────────────────────────────────────────

    /**
     * Store a new module for the course.
     */
    public function storeModule(StoreCourseModuleRequest $request, Course $course): JsonResponse
    {
        $data = $request->validated();
        $data['course_id'] = $course->id;

        $module = CourseModule::create($data);

        AuditService::log('course_module.created', $module, null, $module->toArray());

        return response()->json([
            'message' => 'Module created successfully.',
            'module' => $module,
        ], 201);
    }

    /**
     * Update the module.
     */
    public function updateModule(StoreCourseModuleRequest $request, CourseModule $module): JsonResponse
    {
        $oldValue = $module->toArray();
        $module->update($request->validated());

        AuditService::log('course_module.updated', $module, $oldValue, $module->toArray());

        return response()->json([
            'message' => 'Module updated successfully.',
            'module' => $module,
        ]);
    }

    /**
     * Delete the module.
     */
    public function destroyModule(CourseModule $module): JsonResponse
    {
        $oldValue = $module->toArray();
        $module->delete();

        AuditService::log('course_module.deleted', null, $oldValue, null);

        return response()->json([
            'message' => 'Module deleted successfully.',
        ]);
    }

    // ── Lesson CRUD ──────────────────────────────────────────────────

    /**
     * Store a new lesson for the module.
     */
    public function storeLesson(StoreLessonRequest $request, CourseModule $module): JsonResponse
    {
        $data = $request->validated();
        $data['module_id'] = $module->id;

        $lesson = Lesson::create($data);

        AuditService::log('lesson.created', $lesson, null, $lesson->toArray());

        return response()->json([
            'message' => 'Lesson created successfully.',
            'lesson' => $lesson,
        ], 201);
    }

    /**
     * Update the lesson.
     */
    public function updateLesson(StoreLessonRequest $request, Lesson $lesson): JsonResponse
    {
        $oldValue = $lesson->toArray();
        $lesson->update($request->validated());

        AuditService::log('lesson.updated', $lesson, $oldValue, $lesson->toArray());

        return response()->json([
            'message' => 'Lesson updated successfully.',
            'lesson' => $lesson,
        ]);
    }

    /**
     * Delete the lesson.
     */
    public function destroyLesson(Lesson $lesson): JsonResponse
    {
        $oldValue = $lesson->toArray();
        $lesson->delete();

        AuditService::log('lesson.deleted', null, $oldValue, null);

        return response()->json([
            'message' => 'Lesson deleted successfully.',
        ]);
    }

    /**
     * Upload a banner image for the course.
     */
    public function uploadBanner(Request $request, Course $course): JsonResponse
    {
        $request->validate([
            'banner' => ['required', 'image', 'max:2048', 'mimes:jpeg,png,webp,gif'],
        ]);

        $oldValue = $course->toArray();

        if ($request->hasFile('banner')) {
            if ($course->banner_image_path) {
                Storage::disk('public')->delete($course->banner_image_path);
            }
            $path = $request->file('banner')->store('course_banners', 'public');
            $course->update(['banner_image_path' => $path]);
        }

        AuditService::log('course.updated', $course, $oldValue, $course->toArray());

        // The public catalogue is cached; drop it so this shows up at once.
        Cache::forget(PublicCourseController::CACHE_KEY);

        return response()->json([
            'message' => 'Banner uploaded successfully.',
            'banner_url' => $course->banner_url,
        ]);
    }
}
