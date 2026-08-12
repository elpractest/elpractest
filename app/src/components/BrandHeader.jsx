import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { useTheme } from '../lib/theme';
import { useNotifications } from '../lib/notifications';
import logoMark from '../assets/logo-mark.png';

/**
 * Deep, branded header — stays coloured in BOTH themes (colored-header
 * pattern from the design system). Logo mark on a white tile, greeting,
 * theme toggle (moon/sun), EN/हिं language pill, notification bell, and
 * a search launcher. Purely presentational chrome; no data fetching.
 */
export default function BrandHeader({ user, hideSearch = false }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { unread } = useNotifications();
  const isHindi = i18n.language.startsWith('hi');
  const toggleLang = () => i18n.changeLanguage(isHindi ? 'en' : 'hi');
  const firstName = (user?.name || 'there').split(' ')[0];

  return (
    <header
      className="branded-header"
      style={{
        padding: 'max(env(safe-area-inset-top), 14px) 16px 12px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
        <Link to="/dashboard" className="brand-mark" style={{ width: '38px', height: '38px' }} aria-label="Practest home">
          <img src={logoMark} alt="Practest" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "800 16px var(--font-display)", color: '#f3f6ff', letterSpacing: '-.02em', lineHeight: 1 }}>
            Practest
          </div>
          <div style={{ font: "600 11px var(--font-body)", color: '#8a96b4', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('header.greeting', { name: firstName })}
          </div>
        </div>

        <button className="chrome-btn" onClick={toggleTheme} aria-label={`Switch to ${isDark ? 'day' : 'night'} mode`} title={`Switch to ${isDark ? 'day' : 'night'} mode`} style={{ color: '#ffd98a' }}>
          <Icon name={isDark ? 'moon' : 'sun'} size={19} />
        </button>

        {/* EN / हिं — live i18next language switch */}
        <button className="lang-pill" onClick={toggleLang} aria-label="Toggle language" title="Language">
          <span className={!isHindi ? 'on' : ''}>EN</span>
          <span className={`hi ${isHindi ? 'on' : ''}`}>हिं</span>
        </button>

        <button className="chrome-btn" onClick={() => navigate('/notifications')} aria-label={t('header.notifications')} style={{ position: 'relative' }}>
          <Icon name="bell" size={19} />
          {unread > 0 && (
            <span style={{ position: 'absolute', top: '7px', right: '8px', width: '8px', height: '8px', borderRadius: '50%', background: '#e5484d', border: '2px solid #0b0f1a' }} />
          )}
        </button>
      </div>

      {!hideSearch && (
        <button
          onClick={() => navigate('/search')}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', width: '100%', marginTop: '14px',
            padding: '13px 15px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.1)', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <Icon name="search" size={19} style={{ color: '#8a96b4' }} />
          <span style={{ font: "500 14px var(--font-body)", color: '#8a96b4' }}>{t('header.search')}</span>
        </button>
      )}
    </header>
  );
}
