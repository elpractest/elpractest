import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { withDemo, demoCourses, demoFilterChips } from '../lib/demoData';

/* Map a real assigned test-series into the reference card shape. */
function toCard(s) {
  const total = s.total_tests || 0;
  const done = s.attempted_tests_count || 0;
  return {
    id: s.id,
    exam: s.exam_category || 'Test Series',
    lang: 'EN',
    tag: s.is_completed ? 'Completed' : 'Assigned',
    title: s.title,
    meta: s.description || 'Guided study path',
    progress: { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 },
    grad: 'linear-gradient(120deg,#3A2A08,#1A1206)',
    real: true,
  };
}

export default function StudentTestSeries() {
  const navigate = useNavigate();
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChip, setActiveChip] = useState('All exams');

  useEffect(() => {
    let alive = true;
    api.get('/api/student/test-series')
      .then((res) => { if (alive) setSeriesList(res.data || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const cards = withDemo(seriesList.map(toCard), demoCourses);
  const filtered = activeChip === 'All exams'
    ? cards
    : cards.filter((c) => (c.exam || '').toLowerCase().includes(activeChip.toLowerCase()));

  const open = (c) => (c.real && c.id ? navigate(`/student/test-series/${c.id}`) : navigate(`/student/test-series/${c.id || 'demo'}`));

  return (
    <div style={{ padding: '16px 18px 24px', animation: 'fade-in .35s ease both' }}>
      <h1 style={{ margin: '0 0 4px', font: '800 24px var(--font-display)', color: 'var(--tx)', letterSpacing: '-.02em' }}>Test series</h1>
      <p style={{ margin: '0 0 16px', font: '500 13px var(--font-body)', color: 'var(--muted)' }}>Pick your exam, then a pack</p>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '9px', overflowX: 'auto', paddingBottom: '14px' }}>
        {demoFilterChips.map((k) => (
          <button key={k} className={`chip-filter${activeChip === k ? ' active' : ''}`} onClick={() => setActiveChip(k)}>{k}</button>
        ))}
      </div>

      {/* Course list */}
      {loading ? (
        <div style={{ color: 'var(--muted)', padding: '24px 0' }}>Loading test series…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map((c, i) => (
            <div key={c.id || i} onClick={() => open(c)} style={{ cursor: 'pointer', borderRadius: '20px', background: 'var(--card)', border: '1px solid var(--line)', boxShadow: 'var(--cardsh)', overflow: 'hidden' }}>
              <div style={{ display: 'flex' }}>
                <div style={{ position: 'relative', width: '118px', flex: 'none', background: c.grad }} />
                <div style={{ flex: 1, minWidth: 0, padding: '13px 14px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ font: '700 9.5px var(--font-body)', letterSpacing: '.06em', color: '#F5A623' }}>{c.exam}</span>
                    <span style={{ font: '700 9px var(--font-hindi)', color: '#0B0F1A', background: '#FFC968', padding: '2px 7px', borderRadius: '999px' }}>{c.lang}</span>
                  </div>
                  <div style={{ font: '700 14px/1.2 var(--font-body)', color: 'var(--tx)', margin: '5px 0 0' }}>{c.title}</div>
                  <div style={{ font: '600 11px var(--font-body)', color: 'var(--muted)', marginTop: '5px' }}>{c.meta}</div>
                  {c.progress ? (
                    <div style={{ marginTop: '9px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 10.5px var(--font-body)', color: 'var(--muted)', marginBottom: '5px' }}>
                        <span>{c.progress.done} / {c.progress.total} tests</span>
                        <span>{c.progress.pct}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--surf)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${c.progress.pct}%`, background: 'var(--grad-primary)' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '9px' }}>
                      <span style={{ font: '800 15px var(--font-display)', color: 'var(--tx)' }}>{c.price}</span>
                      <span style={{ font: '600 11px var(--font-body)', color: '#748099', textDecoration: 'line-through' }}>{c.mrp}</span>
                      <span style={{ font: '800 10px var(--font-body)', color: '#12B981', marginLeft: 'auto' }}>{c.off}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
