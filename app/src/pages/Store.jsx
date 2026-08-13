import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';
import StudentCheckout from './StudentCheckout';
import ActivationModal from './ActivationModal';
import { demoStoreCats } from '../lib/demoData';

/**
 * STORE — storefront over /api/student/purchasable-courses, checking out through
 * the Razorpay StudentCheckout modal.
 *
 * When the gateway is off or nothing is purchasable it shows an honest empty
 * state — the same message the app gives — that points at activation codes and
 * lets the student redeem one in place. It does NOT show a fake product grid:
 * a store that lists things it cannot sell is worse than an empty one.
 */
function formatRupees(paise) {
  if (paise === null || paise === undefined) return 'Free';
  return (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export default function Store({ user }) {
  const { t } = useTranslation();
  const { tint } = useTheme();
  const [courses, setCourses] = useState([]);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutBatch, setCheckoutBatch] = useState(null);
  const [showActivation, setShowActivation] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/api/settings/public')
      .then((res) => {
        const on = res.data.settings?.payment_gateway_enabled === 'true' || res.data.settings?.payment_gateway_enabled === true;
        setPaymentEnabled(on);
        if (on) return api.get('/api/student/purchasable-courses').then((r) => setCourses(r.data || []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const hasProducts = paymentEnabled && courses.length > 0;

  return (
    <div style={{ padding: '16px 18px 24px', animation: 'fade-in .35s ease both' }}>
      <h1 style={{ margin: '0 0 4px', font: '800 24px var(--font-display)', color: 'var(--tx)', letterSpacing: '-.02em' }}>{t('store.title')}</h1>
      <p style={{ margin: '0 0 16px', font: '500 13px var(--font-body)', color: 'var(--muted)' }}>Books, modules &amp; PYQ papers</p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}><div className="spinner" /></div>
      ) : hasProducts ? (
        <>
          {/* Category tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
            {demoStoreCats.map((s) => {
              const tc = tint(s.hue);
              return (
                <div key={s.k} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
                  <span style={{ width: '52px', height: '52px', borderRadius: '16px', background: tc.bg, display: 'grid', placeItems: 'center', color: tc.c }}>
                    <Icon name={s.icon} size={22} />
                  </span>
                  <span style={{ font: '600 10.5px/1.1 var(--font-body)', color: 'var(--tx2)', textAlign: 'center' }}>{s.k}</span>
                </div>
              );
            })}
          </div>

          {/* Hero */}
          <div style={{ position: 'relative', height: '150px', borderRadius: '20px', overflow: 'hidden', background: 'linear-gradient(120deg,#14532D,#0B3320)', marginBottom: '20px', border: '1px solid var(--line)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(11,51,32,.95) 0%,rgba(11,51,32,.9) 52%,transparent 100%)' }} />
            <div style={{ position: 'absolute', inset: '0 44% 0 0', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ alignSelf: 'flex-start', font: '800 9px var(--font-body)', letterSpacing: '.12em', color: '#0B3320', background: '#7BE0A6', padding: '3px 8px', borderRadius: '999px' }}>STORE</span>
              <div style={{ font: '800 19px/1.15 var(--font-display)', color: '#fff', letterSpacing: '-.02em', marginTop: '8px' }}>SSC 2026 Module Set</div>
              <div style={{ font: '600 12px var(--font-body)', color: 'rgba(255,255,255,.82)', marginTop: '4px' }}>Flat 40% off · free shipping</div>
            </div>
          </div>

          <h2 style={{ margin: '0 0 12px', font: '700 16px var(--font-display)', color: 'var(--tx)' }}>Available passes</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {courses.map((course) => (
              <div key={course.id} className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span className="chip">{course.exam_category}</span>
                    <span style={{ font: '600 11px var(--font-body)', color: 'var(--muted)', textTransform: 'capitalize' }}>{course.mode}</span>
                  </div>
                  <h3 style={{ margin: '0 0 6px', font: '700 15px var(--font-body)', color: 'var(--tx)' }}>{course.title}</h3>
                  <p style={{ margin: 0, font: '500 12px/1.5 var(--font-body)', color: 'var(--muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{course.short_description || course.description}</p>
                </div>
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(course.batches || []).map((batch) => (
                    <div key={batch.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: 'var(--surf)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ font: '600 13px var(--font-body)', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{batch.name}</div>
                        {batch.starts_at && <div style={{ font: '600 10.5px var(--font-body)', color: 'var(--muted)' }}>Starts {new Date(batch.starts_at).toLocaleDateString()}</div>}
                      </div>
                      <button onClick={() => setCheckoutBatch({ ...batch, course: { title: course.title, exam_category: course.exam_category } })} className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem', flex: 'none' }}>{formatRupees(batch.price_paise)}</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Honest empty state — no fake products, a real way in via activation. */
        <div className="glass-panel" style={{ padding: '34px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          <span style={{ width: '56px', height: '56px', borderRadius: '16px', background: tint('gold').bg, color: tint('gold').c, display: 'grid', placeItems: 'center' }}>
            <Icon name="shopping-bag" size={24} />
          </span>
          <div style={{ font: '700 16px var(--font-display)', color: 'var(--tx)' }}>Course purchases are coming soon</div>
          <p style={{ margin: 0, maxWidth: '44ch', font: '500 13px/1.6 var(--font-body)', color: 'var(--muted)' }}>
            Your institute can open access now with an activation code. Redeem one here and your courses, lectures and papers show up across the app.
          </p>
          <button onClick={() => setShowActivation(true)} className="btn-primary" style={{ marginTop: '4px', padding: '10px 18px', fontSize: '0.85rem' }}>Redeem an activation code</button>
        </div>
      )}

      {checkoutBatch && (
        <StudentCheckout batch={checkoutBatch} onClose={() => setCheckoutBatch(null)} onEnrolled={() => { setCheckoutBatch(null); load(); }} />
      )}
      {showActivation && (
        <ActivationModal user={user} onClose={() => setShowActivation(false)} onSuccess={() => { setShowActivation(false); load(); }} />
      )}
    </div>
  );
}
