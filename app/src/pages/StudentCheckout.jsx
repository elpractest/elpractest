import { useCallback, useState, useEffect } from "react";
import api from "../api";
import { trackEvent } from "../lib/analytics";

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
 *   user       optional { name, email, phone } — prefills Razorpay checkout.
 *              Omitted is fine; Razorpay just asks for the details itself.
 */

function formatRupees(paise) {
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default function StudentCheckout({ batch, onClose, onEnrolled, user }) {
  const [couponCode, setCouponCode] = useState("");

  // Fire GTM InitiateCheckout on modal mount
  useEffect(() => {
    trackEvent("InitiateCheckout", {
      content_name: batch.course?.title || batch.name,
      content_category: batch.course?.exam_category || "General",
      content_ids: [batch.id],
      content_type: "product",
      value: batch.price_paise / 100,
      currency: "INR"
    });
  }, [batch]);
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
      const res = await api.post("/api/student/checkout/validate-coupon", {
        code: couponCode.trim(),
        batch_id: batch.id,
      });
      setCouponState(res.data);
    } catch (err) {
      setCouponState({
        valid: false,
        message: err.response?.data?.message || "Invalid coupon.",
      });
    } finally {
      setCouponLoading(false);
    }
  }, [couponCode, batch.id]);

  const handlePay = useCallback(async () => {
    setError(null);
    setPayLoading(true);
    const eventId = "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
    try {
      const res = await api.post("/api/student/checkout/create-order", {
        batch_id: batch.id,
        coupon_code: couponState?.valid ? couponCode.trim() : undefined,
        event_id: eventId,
      });

      const order = res.data;

      // A 100%-off coupon enrolls directly and skips Razorpay entirely.
      if (order.enrolled) {
        trackEvent("Purchase", {
          event_id: eventId,
          transaction_id: "free_" + Date.now(),
          value: 0,
          currency: "INR",
          content_name: batch.course?.title || batch.name,
          content_ids: [batch.id],
          content_type: "product"
        });
        setStatus("success");
        onEnrolled?.(order);
        return;
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay SDK not loaded. Please try again.");
      }

      const rzp = new window.Razorpay({
        key: order.razorpay_key,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: batch.course?.title || batch.name,
        description: `Enrollment — ${batch.name}`,
        // UPI is the default rail in India — most students expect to scan and
        // pay, not type a card number. Surfacing it as the first block (rather
        // than behind "Other payment methods") measurably shortens checkout.
        // Cards/netbanking/wallets still appear underneath via show_default_blocks.
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay by UPI",
                instruments: [{ method: "upi" }],
              },
            },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: true },
          },
        },
        prefill: {
          name: user?.name || undefined,
          email: user?.email || undefined,
          contact: user?.phone || undefined,
        },
        handler: async (response) => {
          try {
            const verifyRes = await api.post("/api/student/checkout/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // Push GTM Purchase event on successful payment confirmation
            trackEvent("Purchase", {
              event_id: eventId,
              transaction_id: response.razorpay_payment_id,
              value: finalPrice / 100,
              currency: "INR",
              content_name: batch.course?.title || batch.name,
              content_ids: [batch.id],
              content_type: "product"
            });

            setStatus("success");
            onEnrolled?.(verifyRes.data);
          } catch (err) {
            setError(
              err.response?.data?.message ||
                err.message ||
                "We couldn't confirm your payment. If money was deducted, it will be reconciled automatically — contact support if it isn't within a few minutes."
            );
          }
        },
        modal: {
          ondismiss: () => setPayLoading(false),
        },
        theme: { color: "var(--accent-color)" }, // Matches --accent-color
      });

      rzp.on("payment.failed", () => {
        setError("Payment failed. No amount was deducted — you can try again.");
        setPayLoading(false);
      });

      rzp.open();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not start checkout. Please try again.");
      setPayLoading(false);
    }
  }, [batch, couponState, couponCode, onEnrolled, user]);

  if (status === "success") {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '3rem', margin: '0 auto 8px auto' }}>🎉</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>You're enrolled</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            {batch.course?.title || batch.name} ({batch.name}) is now in your dashboard.
          </p>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
          >
            Go to my courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px 0' }}>{batch.course?.title || batch.name}</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>{batch.name}</p>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--surface-1)' }}>
          {!couponState?.valid && (
            <button
              type="button"
              onClick={() => setShowCouponInput((s) => !s)}
              style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0, textAlign: 'left', width: 'fit-content' }}
            >
              Have a coupon?
            </button>
          )}
          {couponState?.valid && (
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--success)', margin: 0 }}>
              Coupon "{couponCode.trim()}" applied!
            </p>
          )}

          {showCouponInput && !couponState?.valid && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                className="form-input"
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponLoading || !couponCode.trim()}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                {couponLoading ? "Checking…" : "Apply"}
              </button>
            </div>
          )}

          {couponState?.valid === false && couponState?.message && (
            <p style={{ fontSize: '0.75rem', color: 'var(--danger)', margin: '4px 0 0 0' }}>{couponState.message}</p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <span>Price</span>
            <span>{formatRupees(originalPrice)}</span>
          </div>
          {couponState?.valid && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--success)' }}>
              <span>Discount</span>
              <span>-{formatRupees(originalPrice - couponState.discounted_price)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
            <span>Total</span>
            <span>{formatRupees(finalPrice)}</span>
          </div>
        </div>

        {error && (
          <p style={{ margin: 0, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px', borderRadius: '8px', color: 'var(--danger-text)', fontSize: '0.8rem' }}>
            {error}
          </p>
        )}

        <button
          onClick={handlePay}
          disabled={payLoading}
          className="btn-primary"
          style={{ width: '100%', marginTop: '8px' }}
        >
          {payLoading ? "Starting checkout…" : finalPrice === 0 ? "Enroll for free" : `Pay ${formatRupees(finalPrice)}`}
        </button>
      </div>
    </div>
  );
}
