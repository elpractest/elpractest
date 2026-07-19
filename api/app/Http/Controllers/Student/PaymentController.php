<?php

namespace App\Http\Controllers\Student;

use App\Exceptions\BatchCapacityExceededException;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Coupon;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\Setting;
use App\Services\PaymentEnrollmentService;
use App\Services\RazorpayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * ASSUMPTIONS — verify against your actual app before shipping:
 * - `payment_gateway_enabled` (Phase 4C) is read via a Setting model with
 *   key/value string columns.
 * - Coupon model exposes ->isValid(): bool and ->calculateDiscount(int $price): int
 * - Payment model is mass-assignable for: user_id, batch_id, coupon_id,
 *   amount, status, razorpay_order_id
 */
class PaymentController extends Controller
{
    public function __construct(
        protected RazorpayService $razorpay,
        protected PaymentEnrollmentService $enrollmentService,
    ) {}

    public function createOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'batch_id' => ['required', 'integer', 'exists:batches,id'],
            'coupon_code' => ['nullable', 'string', 'max:64'],
            'event_id' => ['nullable', 'string', 'max:255'],
        ]);

        if (!$this->paymentGatewayEnabled()) {
            return response()->json([
                'message' => 'Online payment is not available right now.',
            ], 403);
        }

        $user = $request->user();
        $batch = Batch::with('course')->findOrFail($validated['batch_id']);

        if ($batch->price_paise === null || !$batch->is_active) {
            return response()->json([
                'message' => 'This batch is not available for online purchase.',
            ], 422);
        }

        $alreadyEnrolled = Enrollment::where('user_id', $user->id)
            ->where('batch_id', $batch->id)
            ->where('is_active', true)
            ->exists();

        if ($alreadyEnrolled) {
            return response()->json([
                'message' => 'You are already enrolled in this course.',
            ], 409);
        }

        $price = $batch->price_paise;
        $discount = 0;
        $coupon = null;

        if (!empty($validated['coupon_code'])) {
            $coupon = Coupon::where('code', $validated['coupon_code'])->first();

            if (!$coupon || !$coupon->isValid()) {
                return response()->json([
                    'message' => 'This coupon is no longer valid.',
                ], 422);
            }

            $discount = $coupon->calculateDiscount($price);
        }

        $finalAmount = max($price - $discount, 0);

        if ($finalAmount === 0) {
            return $this->enrollForFree($user, $batch, $coupon, $validated['event_id'] ?? null);
        }

        try {
            $order = $this->razorpay->createOrder([
                'amount' => $finalAmount,
                'currency' => 'INR',
                'receipt' => "pmt_{$user->id}_{$batch->id}_" . now()->timestamp,
                'payment_capture' => 1,
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Could not start checkout. Please try again.',
            ], 502);
        }

        $payment = Payment::create([
            'user_id' => $user->id,
            'course_id' => $batch->course_id,
            'batch_id' => $batch->id,
            'coupon_id' => $coupon?->id,
            'amount' => $finalAmount,
            'status' => 'created',
            'razorpay_order_id' => $order['id'],
            'event_id' => $validated['event_id'] ?? null,
        ]);

        return response()->json([
            'order_id' => $order['id'],
            'razorpay_key' => config('razorpay.key_id'),
            'amount' => $finalAmount,
            'currency' => 'INR',
            'payment_id' => $payment->id,
        ]);
    }

    public function verifyPayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'razorpay_order_id' => ['required', 'string'],
            'razorpay_payment_id' => ['required', 'string'],
            'razorpay_signature' => ['required', 'string'],
        ]);

        $payment = Payment::where('razorpay_order_id', $validated['razorpay_order_id'])
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$payment) {
            return response()->json(['message' => 'Payment record not found.'], 404);
        }

        try {
            $this->razorpay->verifyPaymentSignature([
                'razorpay_order_id' => $validated['razorpay_order_id'],
                'razorpay_payment_id' => $validated['razorpay_payment_id'],
                'razorpay_signature' => $validated['razorpay_signature'],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Payment verification failed.'], 400);
        }

        try {
            $result = $this->enrollmentService->confirmAndEnroll(
                $payment->id,
                $validated['razorpay_payment_id'],
                $validated['razorpay_signature'],
            );
        } catch (BatchCapacityExceededException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'enrolled' => true,
            'enrollment_id' => $result['enrollment']->id,
        ]);
    }

    public function validateCoupon(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string'],
            'batch_id' => ['required', 'integer', 'exists:batches,id'],
        ]);

        $batch = Batch::findOrFail($validated['batch_id']);

        if ($batch->price_paise === null) {
            return response()->json([
                'message' => 'This batch is not available for online purchase.',
            ], 422);
        }

        $coupon = Coupon::where('code', $validated['code'])->first();

        if (!$coupon || !$coupon->isValid()) {
            return response()->json([
                'valid' => false,
                'message' => 'This coupon is no longer valid.',
            ], 422);
        }

        $discount = $coupon->calculateDiscount($batch->price_paise);
        $discountedPrice = max($batch->price_paise - $discount, 0);

        return response()->json([
            'valid' => true,
            'discount_type' => $coupon->discount_type,
            'discount_value' => $coupon->discount_value,
            'original_price' => $batch->price_paise,
            'discounted_price' => $discountedPrice,
        ]);
    }

    protected function enrollForFree($user, Batch $batch, ?Coupon $coupon, ?string $eventId = null): JsonResponse
    {
        return DB::transaction(function () use ($user, $batch, $coupon, $eventId) {
            $payment = Payment::create([
                'user_id' => $user->id,
                'course_id' => $batch->course_id,
                'batch_id' => $batch->id,
                'coupon_id' => $coupon?->id,
                'amount' => 0,
                'status' => 'paid',
                'event_id' => $eventId,
            ]);

            if ($coupon) {
                $coupon->increment('times_used');
            }

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

            return response()->json([
                'enrolled' => true,
                'enrollment_id' => $enrollment->id,
            ]);
        });
    }

    protected function paymentGatewayEnabled(): bool
    {
        return optional(Setting::where('key', 'payment_gateway_enabled')->first())->value === 'true';
    }
}
