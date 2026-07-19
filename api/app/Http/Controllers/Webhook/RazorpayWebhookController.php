<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Services\PaymentEnrollmentService;
use App\Services\RazorpayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Public route — no auth, no CSRF (Razorpay can't authenticate as your
 * app). Authenticity comes entirely from verifyWebhookSignature() below,
 * so that check must run before anything else in this file.
 */
class RazorpayWebhookController extends Controller
{
    public function __construct(
        protected RazorpayService $razorpay,
        protected PaymentEnrollmentService $enrollmentService,
    ) {}

    public function handle(Request $request): JsonResponse
    {
        $rawBody = $request->getContent();
        $signature = $request->header('X-Razorpay-Signature', '');

        if (!$this->razorpay->verifyWebhookSignature($rawBody, $signature)) {
            Log::warning('Razorpay webhook: signature verification failed.');

            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        $payload = json_decode($rawBody, true) ?? [];
        $event = $payload['event'] ?? null;

        return match ($event) {
            'payment.captured' => $this->handleCaptured($payload),
            'payment.failed' => $this->handleFailed($payload),
            'refund.processed' => $this->handleRefund($payload),
            default => response()->json(['message' => 'Event ignored.'], 200),
        };
    }

    /**
     * Backup to PaymentController::verifyPayment. Both can fire for the
     * same payment — confirmAndEnroll() is idempotent (locks the Payment
     * row and no-ops if already status = 'paid'), so whichever arrives
     * second is a safe no-op rather than a duplicate enrollment.
     */
    protected function handleCaptured(array $payload): JsonResponse
    {
        $orderId = $payload['payload']['payment']['entity']['order_id'] ?? null;
        $razorpayPaymentId = $payload['payload']['payment']['entity']['id'] ?? null;

        $payment = Payment::where('razorpay_order_id', $orderId)->first();

        if (!$payment) {
            // Shouldn't normally happen — log it, but still 200 so
            // Razorpay doesn't retry forever on an order we don't own.
            Log::warning("Razorpay webhook: no local payment for order {$orderId}.");

            return response()->json(['message' => 'Payment not found.'], 200);
        }

        try {
            $this->enrollmentService->confirmAndEnroll($payment->id, $razorpayPaymentId);
        } catch (\Throwable $e) {
            report($e);
            // Still 200 — Razorpay retries on non-2xx, and if the failure
            // is a capacity exception it'll never succeed on retry either.
        }

        return response()->json(['message' => 'ok'], 200);
    }

    protected function handleFailed(array $payload): JsonResponse
    {
        $orderId = $payload['payload']['payment']['entity']['order_id'] ?? null;

        Payment::where('razorpay_order_id', $orderId)
            ->where('status', '!=', 'paid')
            ->update(['status' => 'failed']);

        return response()->json(['message' => 'ok'], 200);
    }

    protected function handleRefund(array $payload): JsonResponse
    {
        $razorpayPaymentId = $payload['payload']['refund']['entity']['payment_id'] ?? null;

        $payment = Payment::where('razorpay_payment_id', $razorpayPaymentId)->first();

        if ($payment) {
            $payment->update(['status' => 'refunded']);
            Enrollment::where('payment_id', $payment->id)->update(['is_active' => false]);
        }

        return response()->json(['message' => 'ok'], 200);
    }
}
