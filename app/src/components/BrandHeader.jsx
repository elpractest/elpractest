import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { useTheme } from '../lib/theme';
import { useNotifications } from '../lib/notifications';
import { useActivity } from '../lib/activity';

/**
 * Student header — a plain card surface with a hairline, not a dark plate.
 *
 * Left: the 34px primary brand tile, a greeting line and the student's first
 * name. Right: the streak pill (gold, because a streak IS a reward), the Store
 * entry point (moved out of the tab bar so AI Guru can take the centre slot),
 * the theme toggle, the EN/हिं switch and the notification bell. The header
 * owns the theme toggle now; the floating one is gone from student surfaces.
 *
 * The streak is real: `useActivity` derives it from the student's own
 * submitted-session history, and the pill is simply not rendered at zero.
 */
export default function BrandHeader({ user, hideSearch = false }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { unread } = useNotifications();
  const { streak } = useActivity();
  const isHindi = i18n.language.startsWith('hi');
  const toggleLang = () => i18n.changeLanguage(isHindi ? 'en' : 'hi');
  const firstName = (user?.name || 'there').split(' ')[0];

  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const iconBtn = {
    width: '38px',
    height: '38px',
    flex: 'none',
    borderRadius: '12px',
    background: 'var(--surf)',
    border: '1px solid var(--line)',
    color: 'var(--tx2)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  };

  return (
    <header
      className="student-header"
      style={{
        padding: 'max(env(safe-area-inset-top), 14px) 16px 12px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'var(--card)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <Link
          to="/dashboard"
          className="student-brand"
          aria-label="Practest home"
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
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '400 11px var(--font-body)', color: 'var(--muted)' }}>
            {t(`header.good_${partOfDay}`)}
          </div>
          <div
            style={{
              marginTop: '1px',
              font: '700 15px/1 var(--font-display)',
              letterSpacing: '-.025em',
              color: 'var(--tx)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {firstName}
          </div>
        </div>

        {/* streak — gold, the one family of states gold is still allowed in */}
        {streak > 0 && (
          <span
            title={`${streak}-day streak`}
            aria-label={`${streak} day streak`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '999px',
              background: 'var(--reward-bg)',
              color: 'var(--reward-text)',
              font: '700 12px var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              flex: 'none',
            }}
          >
            <Icon name="flame" size={14} />
            {streak}
          </span>
        )}

        <button
          type="button"
          className="student-header-btn"
          onClick={() => navigate('/store')}
          style={iconBtn}
          aria-label={t('nav.store')}
          title={t('nav.store')}
        >
          <Icon name="shopping-bag" size={18} />
        </button>

        <button
          type="button"
          className="student-header-btn"
          onClick={toggleTheme}
          style={iconBtn}
          aria-label={`Switch to ${isDark ? 'day' : 'night'} mode`}
          title={`Switch to ${isDark ? 'day' : 'night'} mode`}
        >
          <Icon name={isDark ? 'sun' : 'moon'} size={18} />
        </button>

        {/* EN / हिं — live i18next language switch */}
        <button className="lang-pill" onClick={toggleLang} aria-label="Toggle language" title="Language">
          <span className={!isHindi ? 'on' : ''}>EN</span>
          <span className={`hi ${isHindi ? 'on' : ''}`}>हिं</span>
        </button>

        <button
          type="button"
          className="student-header-btn"
          onClick={() => navigate('/notifications')}
          aria-label={t('header.notifications')}
          style={{ ...iconBtn, position: 'relative' }}
        >
          <Icon name="bell" size={18} />
          {unread > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '8px',
                right: '9px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: 'var(--danger)',
                border: '1.5px solid var(--card)',
              }}
            />
          )}
        </button>
      </div>

      {!hideSearch && (
        <button
          onClick={() => navigate('/search')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            marginTop: '12px',
            minHeight: '48px',
            padding: '13px 15px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surf)',
            border: '1px solid var(--line)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <Icon name="search" size={18} style={{ color: 'var(--muted)' }} />
          <span style={{ font: '400 13.5px var(--font-body)', color: 'var(--muted)' }}>{t('header.search')}</span>
        </button>
      )}
    </header>
  );
}
