<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreAssignmentRequest;
use App\Models\Assignment;
use App\Models\Batch;
use App\Models\Test;
use App\Models\TestSeries;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function store(StoreAssignmentRequest $request): JsonResponse
    {
        $data = $request->validated();
        
        $type = $data['assignable_type'];
        if ($type === 'series' || $type === 'test_series') {
            $assignableClass = TestSeries::class;
            $entity = TestSeries::findOrFail($data['assignable_id']);
        } else {
            $assignableClass = Test::class;
            $entity = Test::findOrFail($data['assignable_id']);
        }

        $createdAssignments = [];

        foreach ($data['batch_ids'] as $batchId) {
            $assignment = Assignment::updateOrCreate(
                [
                    'batch_id' => $batchId,
                    'assignable_type' => $assignableClass,
                    'assignable_id' => $entity->id,
                ],
                [
                    'available_from' => $data['available_from'] ?? null,
                    'due_at' => $data['due_at'] ?? null,
                    'assigned_by' => $request->user()->id,
                    'is_active' => true,
                ]
            );

            $createdAssignments[] = $assignment;
        }

        AuditService::log('assignment.created', null, null, [
            'assignable_type' => $assignableClass,
            'assignable_id' => $entity->id,
            'batch_count' => count($data['batch_ids']),
        ]);

        return response()->json([
            'message' => 'Assignment created successfully.',
            'assignments' => $createdAssignments,
        ], 201);
    }

    public function batchAssignments(Batch $batch): JsonResponse
    {
        $assignments = Assignment::with(['assignable', 'assigner:id,name'])
            ->where('batch_id', $batch->id)
            ->where('is_active', true)
            ->get();

        return response()->json($assignments);
    }

    public function destroy(Assignment $assignment): JsonResponse
    {
        $oldData = $assignment->toArray();
        $assignment->delete();

        AuditService::log('assignment.deleted', $assignment, $oldData, null);

        return response()->json(['message' => 'Assignment removed successfully.']);
    }
}
