import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';

/**
 * Profile / menu. Real user info (from the `user` prop) + a menu that
 * links to existing surfaces, plus the real logout action. Menu rows
 * without a backing feature are marked TODO and do not navigate.
 */
export default function Profile({ user, onLogout }) {
  const navigate = useNavigate();
  const { tint } = useTheme();
  const { t } = useTranslation();
  const initial = (user?.name || 'S').trim().charAt(0).toUpperCase();

  const menu = [
    { label: t('profile.results'), hue: 'green', icon: 'chart', to: '/results' },
    { label: t('profile.testSeries'), hue: 'gold', icon: 'target', to: '/student/test-series' },
    { label: t('profile.redeem'), hue: 'blue', icon: 'key', to: '/dashboard' },
    { label: t('profile.study'), hue: 'violet', icon: 'book-open', to: '/study' },
    { label: t('profile.help'), hue: 'sky', icon: 'help-circle', todo: true },
    { label: t('profile.settings'), hue: 'neutral', icon: 'settings', todo: true },
  ];

  return (
    <div style={{ padding: '18px 18px 8px', animation: 'fade-in .35s ease both' }}>
      {/* identity card */}
      <div className="glass-panel card-2" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', borderRadius: '20px' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: 'var(--grad-primary)', display: 'grid', placeItems: 'center', font: '800 24px var(--font-display)', color: 'var(--brand-ink)', flex: 'none' }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '800 18px var(--font-display)', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Student'}</div>
          <div style={{ font: '600 12px var(--font-body)', color: 'var(--muted)', marginTop: '2px' }}>
            {user?.phone ? `+91 ${user.phone}` : user?.email || t('profile.aspirant')}
          </div>
        </div>
      </div>

      {/* menu */}
      <div className="glass-panel" style={{ marginTop: '16px', borderRadius: '18px', overflow: 'hidden', padding: 0 }}>
        {menu.map((m, i) => {
          const tc = tint(m.hue);
          return (
            <button
              key={m.label}
              onClick={() => (m.todo ? null : navigate(m.to))}
              disabled={m.todo}
              style={{
                display: 'flex', alignItems: 'center', gap: '13px', width: '100%', padding: '15px 16px',
                background: 'none', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none',
                cursor: m.todo ? 'default' : 'pointer', textAlign: 'left', opacity: m.todo ? 0.6 : 1,
              }}
            >
              <span className="tile" style={{ width: '34px', height: '34px', borderRadius: '10px', background: tc.bg, color: tc.c }}>
                <Icon name={m.icon} size={17} />
              </span>
              <span style={{ flex: 1, font: '600 14px var(--font-body)', color: 'var(--tx)' }}>{m.label}</span>
              {m.todo && <span className="chip" style={{ fontSize: '0.6rem', padding: '3px 8px' }}>{t('common.soon')}</span>}
              <Icon name="chevron-right" size={17} style={{ color: 'var(--muted)' }} />
            </button>
          );
        })}
      </div>

      <button
        onClick={onLogout}
        style={{
          width: '100%', marginTop: '16px', padding: '14px', borderRadius: '14px',
          border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger-text)',
          font: '700 14px var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
      >
        <Icon name="log-out" size={18} /> {t('common.logout')}
      </button>
    </div>
  );
}
