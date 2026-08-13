<?php

namespace App\Http\Controllers\Student;

use App\Exceptions\BatchCapacityExceededException;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Services\GooglePlayVerifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The Google Play Billing rail for the in-app store.
 *
 * The app buys a managed product through Play, then sends the purchase token
 * here. Nothing is trusted until this endpoint has validated that token
 * server-to-server against the Play Developer API — a client-reported "success"
 * is never enough to grant access. On a valid, purchased token it grants the
 * same enrolment the Razorpay path grants (see PaymentController::enrollForFree),
 * then acknowledges the purchase so Google does not auto-refund it.
 */
class GooglePlayController extends Controller
{
    public function __construct(protected GooglePlayVerifier $verifier) {}

    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'string', 'max:255'],
            'purchase_token' => ['required', 'string', 'max:4096'],
        ]);

        if (!$this->verifier->isConfigured()) {
            // No service account yet: the store is not live. Honest 503 rather
            // than a fake success — the app shows "not available", not "bought".
            return response()->json(['message' => 'In-app purchases are not available yet.'], 503);
        }

        $user = $request->user();
        $token = $validated['purchase_token'];
        $productId = $validated['product_id'];

        // Idempotent on the token: a retried verify (app resend, or Play
        // redelivering an unacknowledged purchase on next launch) must return
        // the existing grant, never enrol twice or 4xx a paid student.
        $existing = Payment::where('google_play_purchase_token', $token)
            ->where('status', 'paid')
            ->first();
        if ($existing) {
            $enrollment = Enrollment::where('user_id', $existing->user_id)
                ->where('batch_id', $existing->batch_id)
                ->first();

            return response()->json([
                'enrolled' => true,
                'enrollment_id' => $enrollment?->id,
                'already' => true,
            ]);
        }

        $batch = Batch::with('course')->where('play_product_id', $productId)->first();
        if (!$batch) {
            return response()->json(['message' => 'This product is not sold here.'], 422);
        }

        try {
            $purchase = $this->verifier->getProductPurchase($productId, $token);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'We could not verify this purchase.'], 400);
        }

        // purchaseState: 0 = purchased, 1 = canceled, 2 = pending.
        if ((int) ($purchase['purchaseState'] ?? 1) !== 0) {
            return response()->json(['message' => 'This purchase is not complete yet.'], 409);
        }

        try {
            $enrollment = DB::transaction(function () use ($user, $batch, $token, $productId, $purchase) {
                $payment = Payment::create([
                    'user_id' => $user->id,
                    'course_id' => $batch->course_id,
                    'batch_id' => $batch->id,
                    'amount' => $batch->price_paise ?? 0,
                    'currency' => 'INR',
                    'status' => 'paid',
                    'google_play_purchase_token' => $token,
                    'google_play_order_id' => $purchase['orderId'] ?? null,
                    'google_play_product_id' => $productId,
                ]);

                $enrollment = Enrollment::updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'course_id' => $batch->course_id,
                        'batch_id' => $batch->id,
                    ],
                    [
                        'payment_id' => $payment->id,
                        'is_active' => true,
                        'enrolled_at' => now(),
                        'expires_at' => $batch->ends_at,
                    ]
                );

                if (class_exists(\App\Services\AuditService::class)) {
                    \App\Services\AuditService::log('payment.captured', $payment, null, $payment->toArray());
                }

                return $enrollment;
            });
        } catch (BatchCapacityExceededException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        // Acknowledge AFTER the grant is committed. If acknowledge throws, the
        // student is already enrolled and the token is stored, so the next
        // verify short-circuits on the idempotency check above — we log and move
        // on rather than failing a purchase that actually succeeded.
        try {
            $this->verifier->acknowledgeProduct($productId, $token);
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'enrolled' => true,
            'enrollment_id' => $enrollment->id,
        ]);
    }
}
