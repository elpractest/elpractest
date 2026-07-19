<?php

namespace App\Services;

use App\Exceptions\BatchCapacityExceededException;
use App\Models\Batch;
use App\Models\Coupon;
use App\Models\Enrollment;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

/**
 * ASSUMPTIONS — verify against your actual schema before using:
 * - payments table has: user_id, batch_id, coupon_id, amount, status,
 *   razorpay_order_id, razorpay_payment_id, razorpay_signature
 * - enrollments table has: user_id, batch_id, payment_id, is_active,
 *   enrolled_at, expires_at
 * - batches table has: max_students (nullable int), ends_at
 *
 * This is deliberately extracted out of both PaymentController::verifyPayment
 * and RazorpayWebhookController so the two call sites can never drift out
 * of sync, and so the idempotency + capacity checks only need to be
 * gotten right once.
 */
class PaymentEnrollmentService
{
    /**
     * Marks a payment as paid and enrolls the student, if this hasn't
     * already happened.
     *
     * Race-safety: both the client-side /checkout/verify call and the
     * payment.captured webhook can reach this method for the same
     * payment at nearly the same time. Locking the Payment row inside
     * the transaction means the second caller blocks until the first
     * one commits, then sees status = 'paid' and returns immediately
     * instead of creating a second enrollment.
     *
     * @return array{payment: Payment, enrollment: ?Enrollment, already_processed: bool}
     *
     * @throws BatchCapacityExceededException
     */
    public function confirmAndEnroll(int $paymentId, ?string $razorpayPaymentId = null, ?string $razorpaySignature = null): array
    {
        return DB::transaction(function () use ($paymentId, $razorpayPaymentId, $razorpaySignature) {
            $payment = Payment::where('id', $paymentId)->lockForUpdate()->firstOrFail();

            if ($payment->status === 'paid') {
                return [
                    'payment' => $payment,
                    'enrollment' => Enrollment::where('payment_id', $payment->id)->first(),
                    'already_processed' => true,
                ];
            }

            $batch = Batch::where('id', $payment->batch_id)->lockForUpdate()->firstOrFail();

            $alreadyActive = Enrollment::where('user_id', $payment->user_id)
                ->where('batch_id', $batch->id)
                ->where('is_active', true)
                ->exists();

            if (!$alreadyActive && $batch->max_students !== null) {
                $activeCount = Enrollment::where('batch_id', $batch->id)
                    ->where('is_active', true)
                    ->count();

                if ($activeCount >= $batch->max_students) {
                    throw new BatchCapacityExceededException();
                }
            }

            $payment->status = 'paid';
            if ($razorpayPaymentId) {
                $payment->razorpay_payment_id = $razorpayPaymentId;
            }
            if ($razorpaySignature) {
                $payment->razorpay_signature = $razorpaySignature;
            }
            $payment->save();

            if ($payment->coupon_id) {
                Coupon::where('id', $payment->coupon_id)->increment('times_used');
            }

            $enrollment = Enrollment::updateOrCreate(
                [
                    'user_id' => $payment->user_id,
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

            \App\Jobs\SendConversionEvents::dispatch($payment);

            return [
                'payment' => $payment,
                'enrollment' => $enrollment,
                'already_processed' => false,
            ];
        });
    }
}
