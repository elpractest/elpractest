import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';
import { demoStudyStats } from '../lib/demoData';

/**
 * Study zone hub — stat header + tile grid. Tiles that map to a real
 * route navigate there; the rest are clearly-marked TODO stubs (no
 * backend exists for notes / PYQ bank / bookmarks / downloads yet).
 */
export default function StudyZone() {
  const navigate = useNavigate();
  const { tint } = useTheme();
  const { t } = useTranslation();

  const tiles = [
    { label: 'My library', sub: 'Courses & series you own', hue: 'blue', icon: 'book-open', to: '/library' },
    { label: 'Build a practice paper', sub: 'Your subjects, your clock', hue: 'gold', icon: 'edit', to: '/practice' },
    { label: t('study.attempts'), sub: t('study.attemptsSub'), hue: 'sky', icon: 'clock', to: '/results' },
    { label: t('study.analytics'), sub: t('study.analyticsSub'), hue: 'green', icon: 'chart', to: '/results' },
    { label: t('study.testSeries'), sub: t('study.testSeriesSub'), hue: 'violet', icon: 'target', to: '/student/test-series' },
    { label: t('study.notes'), sub: t('common.comingSoon'), hue: 'sky', icon: 'file', todo: true },
    { label: t('study.pyq'), sub: t('common.comingSoon'), hue: 'green', icon: 'book-open', todo: true },
    { label: t('study.bookmarks'), sub: t('common.comingSoon'), hue: 'red', icon: 'bookmark', todo: true },
  ];

  return (
    <div style={{ padding: '18px 18px 8px', animation: 'fade-in .35s ease both' }}>
      <style>{`
        .study-tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 640px) { .study-tiles { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1024px) { .study-tiles { grid-template-columns: repeat(4, 1fr); } }
      `}</style>
      <h1 className="t-title" style={{ margin: '0 0 4px', color: 'var(--tx)' }}>{t('study.title')}</h1>
      <p style={{ margin: '0 0 18px', font: '400 13.5px var(--font-body)', color: 'var(--muted)' }}>{t('study.subtitle')}</p>

      {/* Stat header — a figure is mono and tabular; the label is the overline */}
      <div style={{ padding: '16px', borderRadius: '20px', background: 'var(--card)', border: '1px solid var(--line)', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        {demoStudyStats.map((s) => (
          <div key={s.label}>
            <div className="t-num" style={{ fontSize: '24px', lineHeight: 1, color: 'var(--tx)' }}>{s.value}</div>
            <div className="t-overline" style={{ marginTop: '7px', letterSpacing: '.14em', color: 'var(--muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="study-tiles">
        {tiles.map((t) => {
          const tc = tint(t.hue);
          return (
            <button
              key={t.label}
              onClick={() => (t.todo ? null : navigate(t.to))}
              className="glass-panel"
              style={{
                textAlign: 'left', cursor: t.todo ? 'default' : 'pointer', padding: '16px', minHeight: '48px',
                borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '11px',
                opacity: t.todo ? 0.72 : 1,
              }}
              disabled={t.todo}
            >
              <span className="tile" style={{ width: '42px', height: '42px', background: tc.bg, color: tc.c }}>
                <Icon name={t.icon} size={20} />
              </span>
              <span>
                <span style={{ display: 'block', font: '600 13.5px var(--font-body)', color: 'var(--tx)' }}>{t.label}</span>
                <span style={{ display: 'block', font: '400 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '3px' }}>{t.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
