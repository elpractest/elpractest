<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\PublicCourseController;
use App\Models\Course;
use App\Models\Batch;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class BatchController extends Controller
{
    /**
     * Display a listing of active and suspended batches for a course.
     */
    public function index(Course $course): JsonResponse
    {
        $batches = $course->batches()->latest()->get();
        return response()->json($batches);
    }

    /**
     * Store a newly created batch for a course.
     */
    public function store(Request $request, Course $course): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'max_students' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'price_paise' => ['nullable', 'integer', 'min:0'],
            // The Play Console product id the Android app buys. Unique because
            // GooglePlayController resolves a purchase back to a batch by this
            // value alone — two batches sharing one id would enrol the wrong one.
            'play_product_id' => ['nullable', 'string', 'max:255', 'unique:batches,play_product_id'],
        ]);

        $data['course_id'] = $course->id;
        $data['is_active'] = true;

        $batch = Batch::create($data);

        AuditService::log('batch.created', $batch, null, $batch->toArray());

        // The public catalogue is cached; drop it so this shows up at once.
        Cache::forget(PublicCourseController::CACHE_KEY);

        return response()->json([
            'message' => 'Batch created successfully.',
            'batch' => $batch,
        ], 201);
    }

    /**
     * Update the specified batch.
     */
    public function update(Request $request, Batch $batch): JsonResponse
    {
        $oldValue = $batch->toArray();

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'max_students' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['sometimes', 'boolean'],
            'price_paise' => ['nullable', 'integer', 'min:0'],
            // See store(): unique, because a Play purchase is resolved to a
            // batch by this id alone. Ignore this row in the uniqueness check.
            'play_product_id' => ['nullable', 'string', 'max:255', 'unique:batches,play_product_id,' . $batch->id],
        ]);

        $batch->update($data);

        AuditService::log('batch.updated', $batch, $oldValue, $batch->toArray());

        // The public catalogue is cached; drop it so this shows up at once.
        Cache::forget(PublicCourseController::CACHE_KEY);

        return response()->json([
            'message' => 'Batch updated successfully.',
            'batch' => $batch,
        ]);
    }

    /**
     * Soft-deactivate the batch (set is_active = false) instead of hard deleting.
     */
    public function destroy(Batch $batch): JsonResponse
    {
        $oldValue = $batch->toArray();
        
        $batch->update(['is_active' => false]);

        AuditService::log('batch.deactivated', $batch, $oldValue, $batch->toArray());

        // The public catalogue is cached; drop it so this shows up at once.
        Cache::forget(PublicCourseController::CACHE_KEY);

        return response()->json([
            'message' => 'Batch deactivated successfully.',
            'batch' => $batch,
        ]);
    }
}
