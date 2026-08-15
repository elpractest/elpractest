<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\EnrollStudentRequest;
use App\Models\Enrollment;
use App\Models\Batch;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class EnrollmentController extends Controller
{
    /**
     * Enrolls a student in a course and batch.
     */
    public function store(EnrollStudentRequest $request): JsonResponse
    {
        $data = $request->validated();
        
        $batch = Batch::findOrFail($data['batch_id']);

        try {
            $enrollment = DB::transaction(function () use ($data, $batch) {
                // Lock the batch row to serialize enrollment attempts
                $lockedBatch = Batch::where('id', $batch->id)->lockForUpdate()->first();

                // Check if batch is full with row lock on active count
                if ($lockedBatch->max_students) {
                    $activeCount = Enrollment::where('batch_id', $lockedBatch->id)
                        ->active()
                        ->lockForUpdate()
                        ->count();

                    if ($activeCount >= $lockedBatch->max_students) {
                        throw new \Exception('The batch has reached its maximum capacity of ' . $lockedBatch->max_students . ' students.', 422);
                    }
                }

                return Enrollment::updateOrCreate(
                    [
                        'user_id' => $data['user_id'],
                        'course_id' => $data['course_id'],
                        'batch_id' => $data['batch_id'],
                    ],
                    [
                        'is_active' => true,
                        'enrolled_at' => now(),
                        'expires_at' => $data['expires_at'] ?? null,
                    ]
                );
            });
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], $e->getCode() ?: 422);
        }

        AuditService::log('enrollment.created', $enrollment, null, $enrollment->toArray());

        \App\Models\User::find($enrollment->user_id)?->notify(new \App\Notifications\EnrolledInCourse(
            $batch->course->title,
            $batch->name,
            $enrollment->course_id,
        ));

        return response()->json([
            'message' => 'Student enrolled successfully.',
            'enrollment' => $enrollment,
        ], 200);
    }

    /**
     * Display a listing of enrollments.
     */
    public function index(\Illuminate\Http\Request $request): JsonResponse
    {
        $query = Enrollment::with(['user', 'course', 'batch']);

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        if ($request->filled('batch_id')) {
            $query->where('batch_id', $request->batch_id);
        }

        $enrollments = $query->latest('enrolled_at')->paginate(20);
        return response()->json($enrollments);
    }

    /**
     * Toggles an enrollment active/suspended status.
     */
    public function toggleStatus(Enrollment $enrollment): JsonResponse
    {
        $oldValue = $enrollment->toArray();
        $nextActive = !$enrollment->is_active;

        if ($nextActive) {
            // Check batch capacity before reactivating
            $batch = $enrollment->batch;
            if ($batch && $batch->max_students) {
                $activeCount = Enrollment::where('batch_id', $batch->id)
                    ->active()
                    ->count();

                if ($activeCount >= $batch->max_students) {
                    return response()->json([
                        'message' => 'The batch has reached its maximum capacity of ' . $batch->max_students . ' students.',
                    ], 422);
                }
            }
        }

        $enrollment->update(['is_active' => $nextActive]);

        $action = $nextActive ? 'enrollment.activated' : 'enrollment.suspended';
        AuditService::log($action, $enrollment, $oldValue, $enrollment->toArray());

        return response()->json([
            'message' => $nextActive ? 'Enrollment activated successfully.' : 'Enrollment suspended successfully.',
            'enrollment' => $enrollment,
        ]);
    }

    /**
     * Suspends/deactivates an enrollment.
     */
    public function destroy(Enrollment $enrollment): JsonResponse
    {
        $oldValue = $enrollment->toArray();
        $enrollment->update(['is_active' => false]);

        AuditService::log('enrollment.suspended', $enrollment, $oldValue, $enrollment->toArray());

        return response()->json([
            'message' => 'Enrollment suspended successfully.',
        ]);
    }
}
