<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Services\AuditService;
use App\Services\RazorpayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentHistoryController extends Controller
{
    public function __construct(
        protected RazorpayService $razorpay,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $payments = Payment::with([
                'user:id,name,email',
                'batch:id,name,course_id',
                'batch.course:id,title',
                'coupon:id,code',
                'invoice:id,payment_id,invoice_number,is_tax_invoice',
            ])
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return response()->json($payments);
    }

    /**
     * Refund a captured payment through Razorpay and withdraw access.
     *
     * Order matters: Razorpay is called FIRST, and local state only changes
     * once it accepts. Marking the payment refunded before the gateway agreed
     * would leave a student locked out of a course they are still paying for.
     * The `refund.processed` webhook re-applies the same end state, so this is
     * safe to run alongside a refund raised in the Razorpay dashboard.
     */
    public function refund(Request $request, Payment $payment): JsonResponse
    {
        $validated = $request->validate([
            // Paise. Omit for a full refund; must not exceed what was captured.
            'amount' => ['nullable', 'integer', 'min:1', 'max:' . (int) $payment->amount],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        if ($payment->status === 'refunded') {
            return response()->json(['message' => 'This payment has already been refunded.'], 422);
        }

        if ($payment->status !== 'paid') {
            return response()->json(['message' => 'Only a captured payment can be refunded.'], 422);
        }

        if (empty($payment->razorpay_payment_id)) {
            return response()->json([
                'message' => 'This enrolment was not paid through Razorpay, so it cannot be refunded here.',
            ], 422);
        }

        try {
            $refund = $this->razorpay->refund($payment->razorpay_payment_id, $validated['amount'] ?? null);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Razorpay rejected the refund. Nothing was changed — check the Razorpay dashboard.',
            ], 502);
        }

        $oldValue = $payment->toArray();
        $isFullRefund = ($validated['amount'] ?? (int) $payment->amount) >= (int) $payment->amount;

        if ($isFullRefund) {
            DB::transaction(function () use ($payment) {
                $payment->update(['status' => 'refunded']);
                // A PARTIAL refund keeps access: the student still paid for part
                // of the course, so revoking it would be the wrong outcome.
                Enrollment::where('payment_id', $payment->id)->update(['is_active' => false]);
            });
        }

        AuditService::log('payment.refunded', $payment, $oldValue, [
            'refund_id' => $refund['id'] ?? null,
            'amount' => $validated['amount'] ?? (int) $payment->amount,
            'full_refund' => $isFullRefund,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json([
            'message' => $isFullRefund
                ? 'Refund raised with Razorpay and access withdrawn.'
                : 'Partial refund raised with Razorpay. Access is unchanged.',
            'refund_id' => $refund['id'] ?? null,
            'payment' => $payment->fresh(),
        ]);
    }
}
