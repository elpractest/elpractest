import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';
import { demoTrending, demoRecent } from '../lib/demoData';

/**
 * SEARCH — functional. Pulls the student's assigned test-series and enrolled
 * courses from the existing endpoints and filters them client-side across
 * title / exam category / description. Results link to the real routes. When
 * the query is empty it shows popular-exam chips that seed the query.
 *
 * No new backend: it reuses /api/student/test-series and /api/student/courses
 * (the same shapes StudentTestSeries.jsx and Dashboard.jsx already consume).
 * When the query is empty it shows trending chips + recent-search demo rows.
 */
export default function SearchPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { tint } = useTheme();
  const [query, setQuery] = useState('');
  const [series, setSeries] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.get('/api/student/test-series'),
      api.get('/api/student/courses'),
    ]).then(([s, c]) => {
      if (!alive) return;
      if (s.status === 'fulfilled') setSeries(s.value.data || []);
      if (c.status === 'fulfilled') setCourses(c.value.data.courses || c.value.data || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const q = query.trim().toLowerCase();
  const match = (obj, fields) =>
    !q || fields.some((f) => (obj[f] || '').toString().toLowerCase().includes(q));

  const seriesHits = useMemo(
    () => series.filter((s) => match(s, ['title', 'exam_category', 'description'])),
    [series, q],
  );
  const courseHits = useMemo(
    () => courses.filter((c) => match(c, ['title', 'exam_category', 'short_description', 'description'])),
    [courses, q],
  );
  const total = seriesHits.length + courseHits.length;

  const ResultRow = ({ hue, icon, title, sub, onClick }) => {
    const tc = tint(hue);
    return (
      <button
        onClick={onClick}
        className="glass-panel"
        style={{ display: 'flex', alignItems: 'center', gap: '13px', width: '100%', padding: '13px 14px', borderRadius: '16px', cursor: 'pointer', textAlign: 'left', marginBottom: '10px' }}
      >
        <span className="tile" style={{ width: '40px', height: '40px', borderRadius: '12px', background: tc.bg, color: tc.c }}>
          <Icon name={icon} size={19} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', font: '700 14px var(--font-body)', color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          {sub && <span style={{ display: 'block', font: '600 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '2px' }}>{sub}</span>}
        </span>
        <Icon name="chevron-right" size={18} style={{ color: 'var(--muted)' }} />
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'max(env(safe-area-inset-top),18px) 18px 14px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 5 }}>
        <button onClick={() => navigate(-1)} aria-label={t('common.back')} className="chrome-btn" style={{ background: 'var(--surf)', border: '1px solid var(--line2)', color: 'var(--tx2)' }}>
          <Icon name="arrow-left" size={20} />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', minHeight: '48px', padding: '12px 15px', borderRadius: '14px', background: 'var(--card)', border: '1px solid var(--line2)' }}>
          <Icon name="search" size={18} style={{ color: 'var(--muted)' }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', font: '400 14px var(--font-body)', color: 'var(--tx)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear" className="adm-rowaction">
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: '6px 18px 30px' }}>
        {!q ? (
          <>
            <div className="t-overline" style={{ color: 'var(--muted)', margin: '8px 0 12px' }}>{t('search.popular')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '9px' }}>
              {demoTrending.map((p) => (
                <button key={p} className="chip-filter" onClick={() => setQuery(p)}>{p}</button>
              ))}
            </div>
            <div className="t-overline" style={{ color: 'var(--muted)', margin: '22px 0 10px' }}>RECENT</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {demoRecent.map((r) => (
                <button key={r} onClick={() => setQuery(r)} style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '48px', padding: '12px 4px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}>
                  <Icon name="clock" size={17} style={{ color: 'var(--muted)' }} />
                  <span style={{ flex: 1, font: '600 13.5px var(--font-body)', color: 'var(--tx2)' }}>{r}</span>
                  <Icon name="arrow-right" size={15} style={{ color: 'var(--muted)' }} />
                </button>
              ))}
            </div>
          </>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '14px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: '58px', borderRadius: '16px' }} />
            ))}
          </div>
        ) : total === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '46px 24px', textAlign: 'center' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: '48px', height: '48px', borderRadius: '999px', background: 'var(--surf)', color: 'var(--muted)' }}>
              <Icon name="search" size={24} />
            </span>
            <p style={{ margin: 0, maxWidth: '40ch', font: '400 13.5px/1.6 var(--font-body)', color: 'var(--muted)' }}>
              Nothing matches “{query}”. Try a shorter phrase, or the exam name on its own.
            </p>
          </div>
        ) : (
          <>
            {seriesHits.length > 0 && (
              <>
                <div className="t-overline" style={{ color: 'var(--muted)', margin: '10px 0 12px' }}>{t('nav.tests').toUpperCase()}</div>
                {seriesHits.map((s) => (
                  <ResultRow key={`s-${s.id}`} hue="gold" icon="target" title={s.title} sub={s.exam_category} onClick={() => navigate(`/student/test-series/${s.id}`)} />
                ))}
              </>
            )}
            {courseHits.length > 0 && (
              <>
                <div className="t-overline" style={{ color: 'var(--muted)', margin: '18px 0 12px' }}>{t('nav.study').toUpperCase()}</div>
                {courseHits.map((c) => (
                  <ResultRow key={`c-${c.id}`} hue="blue" icon="book-open" title={c.title} sub={c.exam_category || c.short_description} onClick={() => navigate(`/courses/${c.id}/outline`)} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
