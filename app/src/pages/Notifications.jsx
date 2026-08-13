import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';
import { useNotifications } from '../lib/notifications';
import { USE_DEMO_DATA, demoNotifs } from '../lib/demoData';

/**
 * NOTIFICATIONS — a real feed derived from the student's results and
 * activation requests (see lib/notifications.js). Opening the screen marks
 * everything as seen, which clears the header bell's unread dot.
 */
function relative(t) {
  if (!t) return '';
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function Notifications() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { tint } = useTheme();
  const { items, loading, markSeen } = useNotifications();

  useEffect(() => { markSeen(); }, [markSeen]);

  const n = tint('neutral');

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: 'max(env(safe-area-inset-top),18px) 18px 14px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 5 }}>
        <button onClick={() => navigate(-1)} aria-label={t('common.back')} className="chrome-btn" style={{ background: 'var(--surf)', border: '1px solid var(--line2)', color: 'var(--tx2)' }}>
          <Icon name="arrow-left" size={20} />
        </button>
        <h1 style={{ margin: 0, font: '800 19px var(--font-display)', color: 'var(--tx)' }}>{t('notif.title')}</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><div className="spinner" /></div>
      ) : items.length === 0 && USE_DEMO_DATA ? (
        <div style={{ padding: '12px 18px 30px' }}>
          {demoNotifs.map((it, idx) => {
            const tc = tint(it.hue);
            return (
              <div key={idx} className="glass-panel" style={{ display: 'flex', gap: '13px', width: '100%', padding: '14px', borderRadius: '16px', marginBottom: '10px', textAlign: 'left' }}>
                <span className="tile" style={{ width: '40px', height: '40px', borderRadius: '12px', background: tc.bg, color: tc.c }}>
                  <Icon name={it.icon} size={19} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ font: '700 13.5px var(--font-body)', color: 'var(--tx)' }}>{it.title}</span>
                    <span style={{ font: '500 10.5px var(--font-body)', color: 'var(--muted)', flex: 'none' }}>{it.time}</span>
                  </span>
                  <span style={{ display: 'block', font: '500 12.5px/1.45 var(--font-body)', color: 'var(--muted)', marginTop: '3px' }}>{it.body}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px 24px', textAlign: 'center' }}>
          <span className="tile" style={{ width: '64px', height: '64px', borderRadius: '20px', background: n.bg, color: n.c }}>
            <Icon name="bell" size={30} />
          </span>
          <div>
            <div style={{ font: '700 17px var(--font-display)', color: 'var(--tx)' }}>{t('notif.emptyTitle')}</div>
            <div style={{ font: '500 13px var(--font-body)', color: 'var(--muted)', marginTop: '6px', maxWidth: '300px' }}>{t('notif.emptyBody')}</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 18px 30px' }}>
          {items.map((it) => {
            const tc = tint(it.hue);
            return (
              <button
                key={it.id}
                onClick={() => it.link && navigate(it.link)}
                className="glass-panel"
                style={{ display: 'flex', gap: '13px', width: '100%', padding: '14px', borderRadius: '16px', marginBottom: '10px', textAlign: 'left', cursor: it.link ? 'pointer' : 'default' }}
              >
                <span className="tile" style={{ width: '40px', height: '40px', borderRadius: '12px', background: tc.bg, color: tc.c }}>
                  <Icon name={it.icon} size={19} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ font: '700 13.5px var(--font-body)', color: 'var(--tx)' }}>{it.title}</span>
                    {it.time > 0 && <span style={{ font: '500 10.5px var(--font-body)', color: 'var(--muted)', flex: 'none' }}>{relative(it.time)}</span>}
                  </span>
                  <span style={{ display: 'block', font: '500 12.5px/1.45 var(--font-body)', color: 'var(--muted)', marginTop: '3px' }}>{it.body}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
