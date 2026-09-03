import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

/**
 * Primary student navigation. Phone: fixed bottom tab bar with AI Guru as the
 * CENTRE item — a 52px round violet button, not a floating FAB that overlapped
 * the content beneath it. Tablet: a 72px left icon rail. ≥1024px: a 232px left
 * sidebar. All three are the same element; see .bottom-nav in index.css.
 *
 * Five destinations, unchanged: Home · Tests · Study · Store · Profile, plus
 * the AI Guru action. Store moved into the header (a CreditCard icon-button)
 * so the bar reads Home · Tests · [AI] · Study · Profile and nothing floats.
 *
 * The practice console lives under Study rather than as a sixth tab: five is
 * already the most a phone bottom-bar carries without crowding.
 */
const TABS = [
  { key: 'home', icon: 'home', to: '/dashboard', match: ['/dashboard'] },
  { key: 'tests', icon: 'award', to: '/student/test-series', match: ['/student/test-series'] },
  { key: 'study', icon: 'book-open', to: '/study', match: ['/study', '/results', '/courses', '/lessons', '/practice', '/library'] },
  { key: 'profile', icon: 'user-round', to: '/profile', match: ['/profile'] },
];

/* Store keeps its sidebar row on tablet and desktop, where there is room for
   it; on the phone it lives in the header instead of taking a tab slot. */
const STORE_TAB = { key: 'store', icon: 'shopping-bag', to: '/store', match: ['/store'] };

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const isActive = (tab) => tab.match.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const aiActive = pathname.startsWith('/vajini');

  const item = (tab) => (
    <button
      key={tab.key}
      className={`nav-item${isActive(tab) ? ' active' : ''}`}
      onClick={() => navigate(tab.to)}
      aria-current={isActive(tab) ? 'page' : undefined}
    >
      <span className="nav-item-glyph">
        <Icon name={tab.icon} size={21} />
      </span>
      <span>{t(`nav.${tab.key}`)}</span>
    </button>
  );

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div
        className="nav-sidebar-brand"
        style={{ alignItems: 'center', gap: '10px', padding: '4px 12px 18px', cursor: 'pointer' }}
        onClick={() => navigate('/dashboard')}
      >
        <span
          style={{
            width: '34px',
            height: '34px',
            flex: 'none',
            borderRadius: '11px',
            background: 'var(--primary)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
          }}
        >
          <Icon name="graduation-cap" size={19} />
        </span>
        <span style={{ font: '700 17px var(--font-display)', color: 'var(--tx)', letterSpacing: '-.025em' }}>Practest</span>
      </div>

      {item(TABS[0])}
      {item(TABS[1])}

      {/* AI Guru — the centre of the bar on a phone, a normal row elsewhere */}
      <div className="nav-ai-slot">
        <button
          className={`nav-ai${aiActive ? ' active' : ''}`}
          onClick={() => navigate('/vajini')}
          aria-label="Ask Vajini"
          aria-current={aiActive ? 'page' : undefined}
          title="Vajini"
        >
          <span className="nav-ai-glyph">
            <Icon name="bot" size={24} strokeWidth={1.9} />
          </span>
          <span className="nav-ai-label">Vajini</span>
        </button>
      </div>

      {item(TABS[2])}
      {/* Store is a header button on the phone; a full row from 640px up */}
      <div className="nav-store-slot">{item(STORE_TAB)}</div>
      {item(TABS[3])}
    </nav>
  );
}
