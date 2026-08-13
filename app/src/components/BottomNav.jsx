import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import logoMark from '../assets/logo-mark.png';

/**
 * Primary student navigation. Mobile: fixed bottom tab bar. ≥1024px: the
 * same element becomes a fixed left sidebar (see .bottom-nav in index.css).
 * Active tab = gold, idle = muted.
 *
 * Home & Tests map to real routes; Study/Store/Profile are new student
 * surfaces. Store is a real storefront — it lists /student/purchasable-courses
 * and checks out through the Razorpay StudentCheckout modal; it falls back to a
 * demo layout only when the payment gateway is off or nothing is purchasable.
 */
const TABS = [
  { key: 'home', icon: 'home', to: '/dashboard', match: ['/dashboard'] },
  { key: 'tests', icon: 'target', to: '/student/test-series', match: ['/student/test-series'] },
  { key: 'study', icon: 'book-open', to: '/study', match: ['/study', '/results', '/courses', '/lessons'] },
  { key: 'store', icon: 'shopping-bag', to: '/store', match: ['/store'] },
  { key: 'profile', icon: 'user', to: '/profile', match: ['/profile'] },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const isActive = (tab) => tab.match.some((p) => pathname === p || pathname.startsWith(p + '/'));

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        <div
          className="nav-sidebar-brand"
          style={{ alignItems: 'center', gap: '10px', padding: '4px 12px 18px', cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          <span className="brand-mark" style={{ width: '34px', height: '34px' }}>
            <img src={logoMark} alt="" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
          </span>
          <span style={{ font: '800 17px var(--font-display)', color: 'var(--tx)', letterSpacing: '-.02em' }}>Practest</span>
        </div>

        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`nav-item${isActive(tab) ? ' active' : ''}`}
            onClick={() => navigate(tab.to)}
            aria-current={isActive(tab) ? 'page' : undefined}
          >
            <Icon name={tab.icon} size={23} />
            <span>{t(`nav.${tab.key}`)}</span>
          </button>
        ))}
      </nav>

      {/* floating Vajini action — violet→blue, distinct bot glyph */}
      <button className="fab-ai" onClick={() => navigate('/vajini')} aria-label="Ask Vajini" title="Vajini">
        <Icon name="bot" size={27} strokeWidth={2} />
      </button>
    </>
  );
}
