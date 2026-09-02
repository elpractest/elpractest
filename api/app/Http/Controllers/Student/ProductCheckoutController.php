<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Setting;
use App\Services\EntitlementService;
use App\Services\PaymentEnrollmentService;
use App\Services\RazorpayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Checkout for a product — a course, a test series, or a bundle.
 *
 * Deliberately a sibling of PaymentController rather than a rewrite of it. The
 * batch rail carries live production traffic, so it is left exactly as it was;
 * this adds a second entry point that produces the same `Payment` row and hands
 * it to the same PaymentEnrollmentService. Verification, the Razorpay webhook,
 * invoicing, coupon claiming and refunds are therefore shared, not duplicated —
 * the two rails cannot drift apart on the parts that matter.
 */
class ProductCheckoutController extends Controller
{
    public function __construct(
        protected RazorpayService $razorpay,
        protected PaymentEnrollmentService $enrollmentService,
        protected EntitlementService $entitlements,
    ) {}

    /**
     * Start a purchase. Returns the Razorpay order the app opens, or — when a
     * coupon takes the price to zero — grants immediately and says so.
     */
    public function createOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'coupon_code' => ['nullable', 'string', 'max:64'],
            'event_id' => ['nullable', 'string', 'max:255'],
        ]);

        if (!$this->paymentGatewayEnabled()) {
            return response()->json([
                'message' => 'Online payment is not available right now.',
            ], 403);
        }

        $user = $request->user();
        $product = Product::with('items')->findOrFail($validated['product_id']);

        if (!$product->is_published) {
            return response()->json([
                'message' => 'This item is not available for purchase.',
            ], 422);
        }

        if ($product->items->isEmpty()) {
            // An empty product would take money and grant nothing. Better a 422
            // than a silent no-op purchase.
            return response()->json([
                'message' => 'This item is not ready for purchase yet.',
            ], 422);
        }

        if ($this->alreadyOwnsEverything($user, $product)) {
            return response()->json([
                'message' => 'You already have access to everything in this item.',
            ], 409);
        }

        $price = $product->price_paise;
        $discount = 0;
        $coupon = null;

        if (!empty($validated['coupon_code'])) {
            $coupon = Coupon::where('code', $validated['coupon_code'])->first();

            if (!$coupon || !$coupon->isValid()) {
                return response()->json(['message' => 'This coupon is no longer valid.'], 422);
            }

            if (!$coupon->isValidForUser($user->id)) {
                return response()->json(['message' => 'You have already used this coupon.'], 422);
            }

            $discount = $coupon->calculateDiscount($price);
        }

        $finalAmount = max($price - $discount, 0);

        if ($finalAmount === 0) {
            return $this->grantForFree($request, $product, $coupon, $validated['event_id'] ?? null);
        }

        try {
            $order = $this->razorpay->createOrder([
                'amount' => $finalAmount,
                'currency' => 'INR',
                'receipt' => "prd_{$user->id}_{$product->id}_" . now()->timestamp,
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
            'product_id' => $product->id,
            // Null for a series or bundle. Both columns were made nullable for
            // exactly this: a purchase that is not a batch.
            'course_id' => $this->soleCourseId($product),
            'batch_id' => null,
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
            'product' => [
                'id' => $product->id,
                'title' => $product->title,
                'type' => $product->type,
            ],
        ]);
    }

    /**
     * Price a coupon against a product without starting a purchase.
     */
    public function validateCoupon(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string'],
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ]);

        $product = Product::findOrFail($validated['product_id']);
        $coupon = Coupon::where('code', $validated['code'])->first();

        if (!$coupon || !$coupon->isValid()) {
            return response()->json([
                'valid' => false,
                'message' => 'This coupon is no longer valid.',
            ], 422);
        }

        if (!$coupon->isValidForUser($request->user()->id)) {
            return response()->json([
                'valid' => false,
                'message' => 'You have already used this coupon.',
            ], 422);
        }

        $discount = $coupon->calculateDiscount($product->price_paise);

        // Same keys the batch rail returns, so the checkout modal reads one
        // shape whichever rail it is driving.
        return response()->json([
            'valid' => true,
            'discount_type' => $coupon->discount_type,
            'discount_value' => $coupon->discount_value,
            'original_price' => $product->price_paise,
            'discounted_price' => max($product->price_paise - $discount, 0),
        ]);
    }

    /**
     * A 100%-off coupon still has to record the redemption and issue a receipt,
     * so it goes through a zero-amount Payment rather than skipping the rail.
     */
    private function grantForFree(Request $request, Product $product, ?Coupon $coupon, ?string $eventId): JsonResponse
    {
        $payment = Payment::create([
            'user_id' => $request->user()->id,
            'product_id' => $product->id,
            'course_id' => $this->soleCourseId($product),
            'batch_id' => null,
            'coupon_id' => $coupon?->id,
            'amount' => 0,
            'status' => 'created',
            'event_id' => $eventId,
        ]);

        $this->enrollmentService->confirmAndEnroll($payment->id);

        return response()->json([
            'granted' => true,
            'amount' => 0,
            'payment_id' => $payment->id,
            'message' => 'Access granted.',
        ]);
    }

    /**
     * Populate `course_id` when the product resolves to exactly one course, so
     * existing reporting that groups payments by course keeps working. A series
     * or a mixed bundle legitimately has none.
     */
    private function soleCourseId(Product $product): ?int
    {
        $courses = $product->items->where('grantable_type', \App\Models\Course::class);

        return $courses->count() === 1 ? (int) $courses->first()->grantable_id : null;
    }

    private function alreadyOwnsEverything($user, Product $product): bool
    {
        $courseIds = $this->entitlements->courseIds($user);
        $seriesIds = $this->entitlements->seriesIds($user);

        foreach ($product->items as $item) {
            $owned = $item->grantable_type === \App\Models\Course::class
                ? in_array((int) $item->grantable_id, $courseIds, true)
                : in_array((int) $item->grantable_id, $seriesIds, true);

            if (!$owned) {
                return false;
            }
        }

        return true;
    }

    private function paymentGatewayEnabled(): bool
    {
        $setting = Setting::where('key', 'payment_gateway_enabled')->first();

        return $setting ? (bool) $setting->typed_value : false;
    }
}
