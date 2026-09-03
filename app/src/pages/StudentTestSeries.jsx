import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';

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
    grad: 'var(--primary-soft)',
    real: true,
  };
}

export default function StudentTestSeries() {
  const navigate = useNavigate();
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get('/api/student/test-series')
      .then((res) => { if (alive) setSeriesList(res.data || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = seriesList.map(toCard);

  const open = (c) => navigate(`/student/test-series/${c.id}`);

  return (
    <div style={{ padding: '16px 18px 24px', animation: 'fade-in .35s ease both' }}>
      <style>{`
        .sts-list { display: flex; flex-direction: column; gap: 14px; }
        @media (min-width: 640px) {
          .sts-list { display: grid; grid-template-columns: repeat(2, 1fr); align-items: start; }
        }
        @media (min-width: 1024px) {
          .sts-list { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
      <h1 className="t-title" style={{ margin: '0 0 4px', color: 'var(--tx)' }}>Test series</h1>
      <p style={{ margin: '0 0 16px', font: '400 13.5px var(--font-body)', color: 'var(--muted)' }}>Pick your exam, then a pack</p>

      {/* Course list */}
      {loading ? (
        <div className="skeleton" style={{ height: '110px', borderRadius: '20px' }} />
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '46px 24px', textAlign: 'center' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: '48px', height: '48px', borderRadius: '999px', background: 'var(--surf)', color: 'var(--muted)' }}>
            <Icon name="target" size={24} />
          </span>
          <p style={{ margin: 0, maxWidth: '40ch', font: '400 13.5px/1.6 var(--font-body)', color: 'var(--muted)' }}>
            No test series assigned yet.
          </p>
        </div>
      ) : (
        <div className="sts-list">
          {filtered.map((c, i) => (
            <div key={c.id || i} onClick={() => open(c)} style={{ cursor: 'pointer', borderRadius: '20px', background: 'var(--card)', border: '1px solid var(--line)', boxShadow: 'var(--cardsh)', overflow: 'hidden' }}>
              <div style={{ display: 'flex' }}>
                <div
                  style={{
                    position: 'relative',
                    width: '110px',
                    flex: 'none',
                    background: c.grad,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--primary)',
                  }}
                >
                  <Icon name="target" size={26} />
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: '13px 14px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ font: '700 9.5px var(--font-body)', letterSpacing: '.06em', color: 'var(--primary)' }}>{c.exam}</span>
                    <span style={{ font: '600 9px var(--font-hindi)', color: 'var(--tx2)', background: 'var(--card)', border: '1px solid var(--line2)', padding: '2px 7px', borderRadius: '999px' }}>{c.lang}</span>
                  </div>
                  <div style={{ font: '600 14px/1.25 var(--font-body)', color: 'var(--tx)', margin: '5px 0 0' }}>{c.title}</div>
                  <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '5px' }}>{c.meta}</div>
                  <div style={{ marginTop: '9px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 10.5px var(--font-body)', color: 'var(--muted)', marginBottom: '5px' }}>
                      <span><span className="t-num" style={{ fontSize: '10.5px' }}>{c.progress.done} / {c.progress.total}</span> tests</span>
                      <span className="t-num" style={{ fontSize: '10.5px' }}>{c.progress.pct}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--surf)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.progress.pct}%`, background: 'var(--primary)' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
