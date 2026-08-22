<?php

namespace App\Http\Controllers;

use App\Models\Course;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class PublicCourseController extends Controller
{
    /**
     * The admin side forgets this key whenever a course or batch changes, so a
     * publish is visible at once instead of up to five minutes later. Referenced
     * there rather than re-typed, so the two cannot drift apart.
     */
    public const CACHE_KEY = 'public_courses_catalog';

    /**
     * Display a listing of published courses with active priced batches.
     */
    public function index(): JsonResponse
    {
        $courses = Cache::remember(self::CACHE_KEY, 300, function () {
            return Course::where('is_published', true)
                ->with(['batches' => function ($query) {
                    $query->where('is_active', true)->whereNotNull('price_paise');
                }])
                ->orderBy('sort_order')
                ->get()
                ->map(function ($course) {
                    return [
                        'id' => $course->id,
                        'title' => $course->title,
                        'slug' => $course->slug,
                        'description' => $course->description,
                        'short_description' => $course->short_description,
                        'exam_category' => $course->exam_category,
                        'mode' => $course->mode,
                        'syllabus' => $course->syllabus,
                        'faq' => $course->faq,
                        'thumbnail_url' => $course->thumbnail_url,
                        'banner_url' => $course->banner_url,
                        'batches' => $course->batches->map(function ($batch) {
                            return [
                                'id' => $batch->id,
                                'name' => $batch->name,
                                'price_paise' => $batch->price_paise,
                                'price_in_rupees' => $batch->price_in_rupees,
                                'starts_at' => $batch->starts_at,
                                'ends_at' => $batch->ends_at,
                            ];
                        }),
                    ];
                });
        });

        return response()->json($courses);
    }
}
