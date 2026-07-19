import { useCallback, useState } from "react";

/**
 * StudentCheckout
 *
 * Modal checkout flow for a single batch. Render conditionally from
 * Dashboard.jsx when a batch is selected for enrollment.
 *
 * Props:
 *   batch      { id, name, price_paise, course: { title } }
 *   onClose    () => void
 *   onEnrolled (result) => void   // called after a successful enrollment
 *
 * ASSUMPTIONS — adjust to match your app's real conventions:
 * - Swap `apiFetch` below for your existing authenticated fetch helper
 *   (Sanctum cookie/header attachment), if one already exists.
 * - The Razorpay Checkout script (checkout.razorpay.com/v1/checkout.js)
 *   is loaded globally in index.html, exposing window.Razorpay.
 */

async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || "Something went wrong.");
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

function formatRupees(paise) {
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default function StudentCheckout({ batch, onClose, onEnrolled }) {
  const [couponCode, setCouponCode] = useState("");
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [couponState, setCouponState] = useState(null); // { valid, discounted_price, message }
  const [couponLoading, setCouponLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | success

  const originalPrice = batch.price_paise;
  const finalPrice = couponState?.valid ? couponState.discounted_price : originalPrice;

  const applyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/student/checkout/validate-coupon", {
        method: "POST",
        body: { code: couponCode.trim(), batch_id: batch.id },
      });
      setCouponState(data);
    } catch (err) {
      setCouponState({ valid: false, message: err.data?.message || "Invalid coupon." });
    } finally {
      setCouponLoading(false);
    }
  }, [couponCode, batch.id]);

  const handlePay = useCallback(async () => {
    setError(null);
    setPayLoading(true);
    try {
      const order = await apiFetch("/student/checkout/create-order", {
        method: "POST",
        body: {
          batch_id: batch.id,
          coupon_code: couponState?.valid ? couponCode.trim() : undefined,
        },
      });

      // A 100%-off coupon enrolls directly and skips Razorpay entirely.
      if (order.enrolled) {
        setStatus("success");
        onEnrolled?.(order);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.razorpay_key,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: batch.course?.title || batch.name,
        description: `Enrollment — ${batch.name}`,
        handler: async (response) => {
          try {
            const verifyResult = await apiFetch("/student/checkout/verify", {
              method: "POST",
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            setStatus("success");
            onEnrolled?.(verifyResult);
          } catch (err) {
            setError(
              err.message ||
                "We couldn't confirm your payment. If money was deducted, it will be reconciled automatically — contact support if it isn't within a few minutes."
            );
          }
        },
        modal: {
          ondismiss: () => setPayLoading(false),
        },
        theme: { color: "#1d4ed8" },
      });

      rzp.on("payment.failed", () => {
        setError("Payment failed. No amount was deducted — you can try again.");
        setPayLoading(false);
      });

      rzp.open();
    } catch (err) {
      setError(err.message || "Could not start checkout. Please try again.");
      setPayLoading(false);
    }
  }, [batch, couponState, couponCode, onEnrolled]);

  if (status === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">
            🎉
          </div>
          <h2 className="text-lg font-semibold text-gray-900">You&rsquo;re enrolled</h2>
          <p className="mt-1 text-sm text-gray-500">{batch.name} is now in your dashboard.</p>
          <button
            onClick={onClose}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to my courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{batch.course?.title || batch.name}</h2>
            <p className="text-sm text-gray-500">{batch.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          {!couponState?.valid && (
            <button
              type="button"
              onClick={() => setShowCouponInput((s) => !s)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Have a coupon?
            </button>
          )}
          {couponState?.valid && (
            <p className="text-sm font-medium text-green-700">
              Coupon &ldquo;{couponCode.trim()}&rdquo; applied
            </p>
          )}

          {showCouponInput && !couponState?.valid && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Coupon code"
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponLoading || !couponCode.trim()}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {couponLoading ? "Checking…" : "Apply"}
              </button>
            </div>
          )}

          {couponState?.valid === false && couponState?.message && (
            <p className="mt-1.5 text-xs text-red-600">{couponState.message}</p>
          )}
        </div>

        <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Price</span>
            <span>{formatRupees(originalPrice)}</span>
          </div>
          {couponState?.valid && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-{formatRupees(originalPrice - couponState.discounted_price)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-1.5 text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatRupees(finalPrice)}</span>
          </div>
        </div>

        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <button
          onClick={handlePay}
          disabled={payLoading}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {payLoading ? "Starting checkout…" : finalPrice === 0 ? "Enroll for free" : `Pay ${formatRupees(finalPrice)}`}
        </button>
      </div>
    </div>
  );
}
