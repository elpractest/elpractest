<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Requests\Student\StoreActivationRequest;
use App\Http\Requests\Student\RedeemActivationCodeRequest;
use App\Models\ActivationRequest;
use App\Models\ActivationCode;
use App\Models\Enrollment;
use App\Models\Batch;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Exception;

class StudentActivationController extends Controller
{
    /**
     * Request access by uploading receipt proof.
     */
    public function requestActivation(StoreActivationRequest $request): JsonResponse
    {
        $data = $request->validated();
        
        // Save file to private local disk
        $path = $request->file('proof_document')->store('proofs', 'local');

        $activationRequest = ActivationRequest::create([
            'user_id' => $request->user()->id,
            'batch_id' => $data['batch_id'],
            'payment_reference' => $data['payment_reference'],
            'proof_document_path' => $path,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Your activation request has been submitted. An admin will review it shortly.',
            'request' => $activationRequest,
        ], 201);
    }

    /**
     * Redeem an activation code to enroll instantly.
     */
    public function redeemCode(RedeemActivationCodeRequest $request): JsonResponse
    {
        $codeStr = $request->code;
        $user = $request->user();

        try {
            DB::transaction(function () use ($codeStr, $user) {
                // Fetch code with row lock
                $code = ActivationCode::where('code', $codeStr)
                    ->lockForUpdate()
                    ->first();

                if (!$code) {
                    throw new Exception('Invalid activation code.', 422);
                }

                if (!$code->isRedeemable()) {
                    throw new Exception('This activation code has expired or reached its maximum uses.', 422);
                }

                // Enforce batch capacity limit if defined
                $batch = $code->batch;
                if ($batch->max_students) {
                    $activeCount = Enrollment::where('batch_id', $batch->id)
                        ->active()
                        ->lockForUpdate()
                        ->count();

                    if ($activeCount >= $batch->max_students) {
                        throw new Exception('This batch has reached its maximum student capacity.', 422);
                    }
                }

                // Increment times_used
                $code->increment('times_used');

                // Create or reactivate enrollment
                Enrollment::updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'course_id' => $code->course_id,
                        'batch_id' => $code->batch_id,
                    ],
                    [
                        'activation_code_id' => $code->id,
                        'is_active' => true,
                        'enrolled_at' => now(),
                        'expires_at' => null, // reset/no expiry for activation code redemption unless custom logic added
                    ]
                );
            });
        } catch (Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], $e->getCode() ?: 422);
        }

        return response()->json([
            'message' => 'Activation code redeemed successfully. You are now enrolled in the course.',
        ]);
    }
}
