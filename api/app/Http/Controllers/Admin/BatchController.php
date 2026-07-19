<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Batch;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        ]);

        $data['course_id'] = $course->id;
        $data['is_active'] = true;

        $batch = Batch::create($data);

        AuditService::log('batch.created', $batch, null, $batch->toArray());

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
        ]);

        $batch->update($data);

        AuditService::log('batch.updated', $batch, $oldValue, $batch->toArray());

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

        return response()->json([
            'message' => 'Batch deactivated successfully.',
            'batch' => $batch,
        ]);
    }
}
