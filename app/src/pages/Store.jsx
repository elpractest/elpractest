import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';
import StudentCheckout from './StudentCheckout';

/**
 * STORE — functional storefront of purchasable test-series / course passes.
 * Reuses the EXISTING payment stack: /api/settings/public (gateway flag),
 * /api/student/purchasable-courses, and the StudentCheckout (Razorpay) modal
 * that Dashboard already uses. No new backend.
 *
 * When the payment gateway is off, or nothing is purchasable, it shows a
 * graceful empty state instead of inventing products.
 */
function formatRupees(paise) {
  if (paise === null || paise === undefined) return 'Free';
  return (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export default function Store() {
  const { t } = useTranslation();
  const { tint } = useTheme();
  const [courses, setCourses] = useState([]);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutBatch, setCheckoutBatch] = useState(null);

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

  const g = tint('gold');
  const hasProducts = paymentEnabled && courses.length > 0;

  return (
    <div style={{ padding: '18px 18px 8px', animation: 'fade-in .35s ease both' }}>
      <h1 style={{ margin: '0 0 4px', font: '800 24px var(--font-display)', color: 'var(--tx)', letterSpacing: '-.02em' }}>{t('store.title')}</h1>
      <p style={{ margin: '0 0 20px', font: '500 13px var(--font-body)', color: 'var(--muted)' }}>{t('store.subtitle')}</p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><div className="spinner" /></div>
      ) : !hasProducts ? (
        <div className="glass-panel" style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <span className="tile" style={{ width: '64px', height: '64px', borderRadius: '20px', background: g.bg, color: g.c }}>
            <Icon name="shopping-bag" size={30} />
          </span>
          <div>
            <div style={{ font: '700 17px var(--font-display)', color: 'var(--tx)' }}>{t('store.comingTitle')}</div>
            <div style={{ font: '500 13px var(--font-body)', color: 'var(--muted)', marginTop: '6px', maxWidth: '320px' }}>{t('store.comingBody')}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {courses.map((course) => (
            <div key={course.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span className="chip">{course.exam_category}</span>
                  <span style={{ font: '600 11px var(--font-body)', color: 'var(--muted)', textTransform: 'capitalize' }}>{course.mode}</span>
                </div>
                <h3 style={{ margin: '0 0 6px', font: '700 16px var(--font-display)', color: 'var(--tx)' }}>{course.title}</h3>
                <p style={{ margin: 0, font: '500 12.5px/1.5 var(--font-body)', color: 'var(--muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {course.short_description || course.description}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(course.batches || []).map((batch) => (
                  <div key={batch.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: 'var(--surf)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: '600 13px var(--font-body)', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{batch.name}</div>
                      {batch.starts_at && (
                        <div style={{ font: '600 10.5px var(--font-body)', color: 'var(--muted)' }}>Starts {new Date(batch.starts_at).toLocaleDateString()}</div>
                      )}
                    </div>
                    <button onClick={() => setCheckoutBatch({ ...batch, course: { title: course.title, exam_category: course.exam_category } })} className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem', flex: 'none' }}>
                      {formatRupees(batch.price_paise)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {checkoutBatch && (
        <StudentCheckout batch={checkoutBatch} onClose={() => setCheckoutBatch(null)} onEnrolled={() => { setCheckoutBatch(null); load(); }} />
      )}
    </div>
  );
}
