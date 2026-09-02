import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import Icon from '../components/Icon';

/**
 * A student's payment receipts. Each row opens the server-rendered invoice in
 * a new tab, where the browser's own print dialog saves it as a PDF — so there
 * is no PDF engine in the API image for something opened a few times per
 * enrolment.
 */
export default function Receipts() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/student/invoices')
      .then((res) => setInvoices(res.data.invoices || []))
      .catch(() => setError('Could not load your receipts.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ padding: '18px 18px 30px', animation: 'fade-in .35s ease both' }}>
      <h1 style={{ margin: '0 0 4px', font: '800 19px var(--font-display)', color: 'var(--tx)' }}>
        {t('receipts.title')}
      </h1>
      <p style={{ margin: '0 0 18px', font: '600 12.5px var(--font-body)', color: 'var(--muted)' }}>
        {t('receipts.subtitle')}
      </p>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: '0.85rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {invoices.length === 0 && !error ? (
        <div style={{ padding: '36px 20px', borderRadius: '18px', background: 'var(--card)', border: '1px solid var(--line)', textAlign: 'center' }}>
          <div style={{ font: '800 15px var(--font-display)', color: 'var(--tx)' }}>{t('receipts.emptyTitle')}</div>
          <div style={{ font: '600 12.5px var(--font-body)', color: 'var(--muted)', marginTop: '6px' }}>{t('receipts.emptyBody')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {invoices.map((inv) => (
            <a
              key={inv.id}
              href={`/api/student/invoices/${inv.id}`}
              target="_blank"
              // `noopener` only — deliberately NOT `noreferrer`. Sanctum treats
              // a request as session-authenticated based on its Referer/Origin,
              // so stripping the referrer makes this open a login page instead
              // of the student's own receipt. Verified: no-referrer -> 401.
              rel="noopener"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                borderRadius: '16px', background: 'var(--card)', border: '1px solid var(--line)',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <span className="tile" style={{ width: '36px', height: '36px', borderRadius: '11px', background: 'var(--surf)', color: 'var(--tx2)', flex: 'none' }}>
                <Icon name="file" size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 13.5px var(--font-body)', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.description}
                </div>
                <div style={{ font: '600 11.5px var(--font-mono)', color: 'var(--muted)', marginTop: '3px' }}>
                  {inv.invoice_number} · {new Date(inv.issued_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {inv.is_tax_invoice && ` · ${t('receipts.taxInvoice')}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div style={{ font: '800 14px var(--font-mono)', color: 'var(--tx)' }}>₹{inv.total}</div>
                <div style={{ font: '600 10.5px var(--font-body)', color: 'var(--accent-color)', marginTop: '2px' }}>{t('receipts.view')}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
