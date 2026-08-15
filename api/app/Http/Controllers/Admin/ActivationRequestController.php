<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivationRequest;
use App\Models\ActivationCode;
use App\Models\Enrollment;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Exception;

class ActivationRequestController extends Controller
{
    /**
     * List all activation requests.
     */
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        
        $query = ActivationRequest::with(['user', 'batch.course', 'reviewer']);

        if ($status) {
            $query->where('status', $status);
        }

        $requests = $query->latest()->paginate(15);
        return response()->json($requests);
    }

    /**
     * Serve the uploaded proof document securely.
     */
    public function showProof(ActivationRequest $activationRequest)
    {
        if (!$activationRequest->proof_document_path || !Storage::disk('local')->exists($activationRequest->proof_document_path)) {
            abort(404, 'Proof document not found.');
        }

        return Storage::disk('local')->response($activationRequest->proof_document_path);
    }

    /**
     * Approve the activation request.
     */
    public function approve(ActivationRequest $activationRequest): JsonResponse
    {
        if ($activationRequest->status !== 'pending') {
            return response()->json([
                'message' => 'This request has already been ' . $activationRequest->status . '.',
            ], 422);
        }

        $batch = $activationRequest->batch;

        try {
            DB::transaction(function () use ($activationRequest, $batch) {
                // Check batch capacity
                if ($batch->max_students) {
                    $activeCount = Enrollment::where('batch_id', $batch->id)->active()->lockForUpdate()->count();
                    if ($activeCount >= $batch->max_students) {
                        throw new Exception('The batch has reached its maximum capacity.', 422);
                    }
                }

                // Generate a one-time code for tracking
                $code = ActivationCode::create([
                    'code' => ActivationCode::generateUniqueCode(),
                    'course_id' => $batch->course_id,
                    'batch_id' => $batch->id,
                    'max_uses' => 1,
                    'times_used' => 1, // mark as used
                    'expires_at' => now()->addDays(7),
                    'generated_by' => auth()->id(),
                ]);

                // Create Enrollment
                $enrollment = Enrollment::updateOrCreate(
                    [
                        'user_id' => $activationRequest->user_id,
                        'course_id' => $batch->course_id,
                        'batch_id' => $batch->id,
                    ],
                    [
                        'activation_code_id' => $code->id,
                        'is_active' => true,
                        'enrolled_at' => now(),
                    ]
                );

                // Update request
                $activationRequest->update([
                    'status' => 'approved',
                    'reviewed_by' => auth()->id(),
                    'reviewed_at' => now(),
                ]);

                AuditService::log('activation_request.approved', $activationRequest, null, $activationRequest->toArray());
                AuditService::log('enrollment.created_via_request', $enrollment, null, $enrollment->toArray());
            });
        } catch (Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], $e->getCode() ?: 422);
        }

        // Notify the student (in-app feed + push) after the enrollment commits.
        $activationRequest->user?->notify(new \App\Notifications\ActivationApproved(
            $batch->course->title,
            $batch->name,
            $batch->course_id,
        ));

        return response()->json([
            'message' => 'Request approved and student enrolled successfully.',
        ]);
    }

    /**
     * Reject the activation request.
     */
    public function reject(Request $request, ActivationRequest $activationRequest): JsonResponse
    {
        if ($activationRequest->status !== 'pending') {
            return response()->json([
                'message' => 'This request has already been ' . $activationRequest->status . '.',
            ], 422);
        }

        $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $oldValue = $activationRequest->toArray();

        $activationRequest->update([
            'status' => 'rejected',
            'admin_notes' => $request->reason,
            'reviewed_by' => auth()->id(),
            'reviewed_at' => now(),
        ]);

        AuditService::log('activation_request.rejected', $activationRequest, $oldValue, $activationRequest->toArray());

        $activationRequest->user?->notify(new \App\Notifications\ActivationRejected(
            $activationRequest->batch->course->title,
            $activationRequest->batch->name,
            $request->reason,
        ));

        return response()->json([
            'message' => 'Request rejected successfully.',
        ]);
    }
}
