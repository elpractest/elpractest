import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';
import StudentCheckout from './StudentCheckout';
import ActivationModal from './ActivationModal';

/**
 * STORE — the storefront over /api/student/store.
 *
 * A product is a course, a test series, or a bundle of both, and all three are
 * bought the same way. Owned products stay on the shelf, dimmed, rather than
 * disappearing: hiding them makes a bundle look like it vanished the moment a
 * student buys one course inside it.
 *
 * When the gateway is off or nothing is on sale it shows an honest empty state
 * that points at activation codes and lets the student redeem one in place. It
 * does NOT show a fake product grid — a store that lists things it cannot sell
 * is worse than an empty one.
 */
function formatRupees(paise) {
  if (paise === null || paise === undefined || paise === 0) return 'Free';
  return (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

const TYPE_META = {
  course: { label: 'Course', icon: 'book-open', hue: 'blue' },
  test_series: { label: 'Test series', icon: 'target', hue: 'gold' },
  bundle: { label: 'Bundle', icon: 'award', hue: 'green' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'course', label: 'Courses' },
  { key: 'test_series', label: 'Test series' },
  { key: 'bundle', label: 'Bundles' },
];

export default function Store({ user }) {
  const { t } = useTranslation();
  const { tint } = useTheme();
  const [products, setProducts] = useState([]);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [checkoutProduct, setCheckoutProduct] = useState(null);
  const [showActivation, setShowActivation] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/settings/public'),
      api.get('/api/student/store').catch(() => ({ data: { products: [] } })),
    ])
      .then(([settings, store]) => {
        const on = settings.data.settings?.payment_gateway_enabled === 'true'
          || settings.data.settings?.payment_gateway_enabled === true;
        setPaymentEnabled(on);
        setProducts(store.data.products || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const visible = filter === 'all' ? products : products.filter((p) => p.type === filter);
  const hasProducts = paymentEnabled && products.length > 0;

  // Only offer a filter that would actually show something.
  const availableFilters = FILTERS.filter(
    (f) => f.key === 'all' || products.some((p) => p.type === f.key)
  );

  return (
    <div style={{ padding: '16px 18px 24px', animation: 'fade-in .35s ease both' }}>
      <h1 style={{ margin: '0 0 4px', font: '800 24px var(--font-display)', color: 'var(--tx)', letterSpacing: '-.02em' }}>
        {t('store.title')}
      </h1>
      <p style={{ margin: '0 0 16px', font: '500 13px var(--font-body)', color: 'var(--muted)' }}>
        Courses, test series &amp; bundles
      </p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}><div className="spinner" /></div>
      ) : hasProducts ? (
        <>
          {availableFilters.length > 2 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
              {availableFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={filter === f.key ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '7px 14px', fontSize: '0.8rem', borderRadius: '999px' }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
            {visible.map((product) => {
              const meta = TYPE_META[product.type] || TYPE_META.course;
              const tc = tint(meta.hue);

              return (
                <div
                  key={product.id}
                  className="glass-panel"
                  style={{
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    opacity: product.owned ? 0.62 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '34px', height: '34px', borderRadius: '10px', background: tc.bg, color: tc.c, display: 'grid', placeItems: 'center', flex: 'none' }}>
                      <Icon name={meta.icon} size={17} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ font: '700 11px var(--font-body)', color: tc.c, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        {meta.label}
                      </div>
                      <div style={{ font: '600 11px var(--font-body)', color: 'var(--muted)' }}>{product.exam_category}</div>
                    </div>
                    {product.savings_percent ? (
                      <span className="chip" style={{ background: tint('green').bg, color: tint('green').c, flex: 'none' }}>
                        {product.savings_percent}% off
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 6px', font: '700 15px var(--font-body)', color: 'var(--tx)' }}>{product.title}</h3>
                    {product.short_description && (
                      <p style={{ margin: 0, font: '500 12px/1.5 var(--font-body)', color: 'var(--muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {product.short_description}
                      </p>
                    )}
                  </div>

                  {/* What you actually get — the part that makes a bundle worth
                      its price rather than an opaque label. */}
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {product.items.map((item) => (
                      <li key={`${item.kind}-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '500 12px var(--font-body)', color: 'var(--tx2)' }}>
                        <span style={{ display: 'grid', placeItems: 'center', flex: 'none', color: item.owned ? tint('green').c : 'var(--muted)' }}>
                          <Icon name={item.owned ? 'check' : item.kind === 'course' ? 'book-open' : 'target'} size={13} />
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                        {item.owned && <span style={{ font: '600 10px var(--font-body)', color: tint('green').c, flex: 'none' }}>owned</span>}
                      </li>
                    ))}
                  </ul>

                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
                        <span style={{ font: '800 17px var(--font-display)', color: 'var(--tx)' }}>{formatRupees(product.price_paise)}</span>
                        {product.list_price_paise > product.price_paise && (
                          <span style={{ font: '500 12px var(--font-body)', color: 'var(--muted)', textDecoration: 'line-through' }}>
                            {formatRupees(product.list_price_paise)}
                          </span>
                        )}
                      </div>
                      <div style={{ font: '500 10.5px var(--font-body)', color: 'var(--muted)' }}>
                        {product.access_days ? `${product.access_days} days access` : 'Lifetime access'}
                      </div>
                    </div>

                    {product.owned ? (
                      <span style={{ font: '600 12px var(--font-body)', color: tint('green').c, flex: 'none' }}>In your library</span>
                    ) : (
                      <button
                        onClick={() => setCheckoutProduct(product)}
                        className="btn-primary"
                        style={{ padding: '9px 16px', fontSize: '0.82rem', flex: 'none' }}
                      >
                        Buy
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Honest empty state — no fake products, a real way in via activation. */
        <div className="glass-panel" style={{ padding: '34px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          <span style={{ width: '56px', height: '56px', borderRadius: '16px', background: tint('gold').bg, color: tint('gold').c, display: 'grid', placeItems: 'center' }}>
            <Icon name="shopping-bag" size={24} />
          </span>
          <div style={{ font: '700 16px var(--font-display)', color: 'var(--tx)' }}>Nothing on sale just yet</div>
          <p style={{ margin: 0, maxWidth: '44ch', font: '500 13px/1.6 var(--font-body)', color: 'var(--muted)' }}>
            Your institute can open access now with an activation code. Redeem one here and your courses, lectures and papers show up across the app.
          </p>
          <button onClick={() => setShowActivation(true)} className="btn-primary" style={{ marginTop: '4px', padding: '10px 18px', fontSize: '0.85rem' }}>
            Redeem an activation code
          </button>
        </div>
      )}

      {checkoutProduct && (
        <StudentCheckout
          product={checkoutProduct}
          user={user}
          onClose={() => setCheckoutProduct(null)}
          onEnrolled={() => { setCheckoutProduct(null); load(); }}
        />
      )}
      {showActivation && (
        <ActivationModal user={user} onClose={() => setShowActivation(false)} onSuccess={() => { setShowActivation(false); load(); }} />
      )}
    </div>
  );
}
