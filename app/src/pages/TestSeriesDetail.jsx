import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';
import ActivationModal from './ActivationModal';
import { useTheme } from '../lib/theme';
import { demoCourses, demoDetailFeatures } from '../lib/demoData';

/* ------------------------------------------------------------------
   Reference "course detail" — a pre-enrollment sales page (hero + tags +
   rating + price card + What's inside + How to get access + sticky enroll
   bar). Shown for demo / browse courses (ids that aren't a real enrolled
   series). Real enrolled series render the study-path view below instead.
   ------------------------------------------------------------------ */
function SalesDetail({ course }) {
  const navigate = useNavigate();
  const { tint } = useTheme();
  const [showActivation, setShowActivation] = useState(false);

  return (
    <div style={{ paddingBottom: '92px', animation: 'fade-in .35s ease both' }}>
      {/* Hero — a card on the app's own ground, not a dark plate */}
      <div style={{ padding: '14px 18px 0' }}>
        <button
          onClick={() => navigate('/student/test-series')}
          aria-label="Back"
          className="chrome-btn"
          style={{ marginBottom: '14px' }}
        >
          <Icon name="arrow-left" size={19} />
        </button>

        <div
          style={{
            display: 'flex',
            gap: '14px',
            alignItems: 'center',
            padding: '16px',
            borderRadius: '20px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
          }}
        >
          <span
            style={{
              width: '72px',
              height: '72px',
              flex: 'none',
              borderRadius: '18px',
              background: course.grad,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--primary)',
            }}
          >
            <Icon name="target" size={30} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '7px', flexWrap: 'wrap' }}>
              <span style={{ font: '600 10px var(--font-body)', letterSpacing: '.06em', color: 'var(--primary)', background: 'var(--primary-soft)', padding: '4px 9px', borderRadius: '999px' }}>{course.exam}</span>
              <span style={{ font: '600 10px var(--font-hindi)', color: 'var(--tx2)', background: 'var(--surf)', border: '1px solid var(--line)', padding: '4px 9px', borderRadius: '999px' }}>{course.lang}</span>
              <span style={{ font: '600 10px var(--font-body)', color: 'var(--ai)', background: 'var(--ai-bg)', padding: '4px 9px', borderRadius: '999px' }}>{course.tag}</span>
            </div>
            <h1 className="t-title" style={{ margin: 0, color: 'var(--tx)' }}>{course.title}</h1>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 18px 24px' }}>
        {/* Rating row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', font: '600 12px var(--font-body)', color: 'var(--muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--reward-text)' }}>
            <Icon name="star" size={15} /><span className="t-num" style={{ fontSize: '12.5px', color: 'var(--tx)' }}>{course.rating || 4.8}</span>
          </span>
          <span>· <span className="t-num" style={{ fontSize: '12px', fontWeight: 500 }}>{course.ratingCount || '12.4k'}</span> enrolled</span>
          <span>· Updated Aug 2026</span>
        </div>

        {/* Price card */}
        <div style={{ marginTop: '16px', padding: '16px', borderRadius: '20px', background: 'var(--card)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span className="t-num" style={{ fontSize: '24px', color: 'var(--tx)' }}>{course.price}</span>
            <span className="t-num" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)', textDecoration: 'line-through' }}>{course.mrp}</span>
            <span style={{ font: '600 12px var(--font-body)', color: 'var(--success)', background: 'var(--success-bg)', padding: '4px 10px', borderRadius: '999px', marginLeft: 'auto' }}>{course.off}</span>
          </div>
          <div style={{ font: '600 12px var(--font-body)', color: 'var(--muted)', marginTop: '8px' }}>or 3 × ₹500 · no-cost EMI · 1-year access</div>
        </div>

        {/* What's inside */}
        <h2 className="t-heading" style={{ margin: '22px 0 12px', color: 'var(--tx)' }}>What's inside</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          {demoDetailFeatures.map((f) => {
            const t = tint(f.hue);
            return (
              <div key={f.k} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '36px', height: '36px', borderRadius: '11px', background: t.bg, display: 'grid', placeItems: 'center', flex: 'none', color: t.c }}>
                  <Icon name={f.icon} size={18} />
                </span>
                <span style={{ font: '400 13.5px var(--font-body)', color: 'var(--tx2)' }}>{f.k}</span>
              </div>
            );
          })}
        </div>

        {/* How to get access */}
        <h2 style={{ margin: '24px 0 12px', font: '700 16px var(--font-display)', color: 'var(--tx)' }}>How to get access</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ padding: '14px 15px', borderRadius: '14px', background: 'var(--card)', border: '1px solid var(--line)' }}>
            <div style={{ font: '700 13px var(--font-body)', color: 'var(--tx)' }}>Redeem an activation code</div>
            <div style={{ font: '600 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '3px' }}>Got a code from your institute? Enter it to unlock instantly.</div>
          </div>
          <div style={{ padding: '14px 15px', borderRadius: '14px', background: 'var(--card)', border: '1px solid var(--line)' }}>
            <div style={{ font: '700 13px var(--font-body)', color: 'var(--tx)' }}>Pay online</div>
            <div style={{ font: '600 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '3px' }}>Instant activation on successful payment.</div>
          </div>
        </div>
      </div>

      {/* Sticky enroll bar */}
      <div style={{ position: 'sticky', bottom: 0, display: 'flex', gap: '10px', padding: '12px 16px', background: 'var(--nav)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--line)' }}>
        <button onClick={() => navigate('/tests/demo')} style={{ flex: 'none', padding: '14px 16px', border: '1px solid var(--line2)', borderRadius: '14px', background: 'var(--surf)', color: 'var(--tx2)', font: '700 13px var(--font-body)', cursor: 'pointer' }}>Free test</button>
        <button onClick={() => setShowActivation(true)} className="btn-primary" style={{ flex: 1, padding: '14px', borderRadius: '14px', fontSize: '15px' }}>Enroll {course.price}</button>
      </div>

      {showActivation && <ActivationModal onClose={() => setShowActivation(false)} onSuccess={() => setShowActivation(false)} />}
    </div>
  );
}

export default function TestSeriesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [series, setSeries] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState('all');
  const [activeTab, setActiveTab] = useState('path');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Demo/browse course? (id from demo cards) — show the sales page.
  const demoCourse = demoCourses.find((c) => c.id === id) || (String(id).startsWith('demo') ? demoCourses[0] : null);

  useEffect(() => {
    if (demoCourse) { setLoading(false); return; }
    let alive = true;
    Promise.all([
      api.get(`/api/student/test-series/${id}`),
      api.get(`/api/student/test-series/${id}/leaderboard`).catch(() => ({ data: null })),
    ])
      .then(([detailRes, lbRes]) => { if (!alive) return; setSeries(detailRes.data); setLeaderboardData(lbRes.data); })
      .catch(() => { if (alive) setNotFound(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const getCategoryLabel = (catKey) => ({
    full_mock: 'Full Mock', sectional: 'Sectional', pyp: 'Previous Year (PYP)',
    topic: 'Topic Test', current_affairs: 'Current Affairs',
  })[catKey] || 'Mock Test';

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--muted)' }}><div className="spinner" /></div>;
  }

  // Demo course, or real series missing → reference sales page.
  if (demoCourse || (notFound && !series)) {
    return <SalesDetail course={demoCourse || demoCourses[0]} />;
  }

  const filteredTests = activeCategoryTab === 'all'
    ? series.tests
    : series.tests.filter((t) => t.category === activeCategoryTab);

  const tabBtn = (key, label, isActive) => (
    <button onClick={() => setActiveTab(key)} style={{ background: 'none', border: 'none', borderBottom: isActive ? '3px solid var(--brand)' : '3px solid transparent', padding: '12px 4px', font: '700 14px var(--font-body)', color: isActive ? 'var(--accent-color)' : 'var(--muted)', cursor: 'pointer' }}>{label}</button>
  );

  return (
    <div style={{ padding: '16px 18px 24px', animation: 'fade-in .35s ease both' }}>
      <button onClick={() => navigate('/student/test-series')} className="btn-secondary" style={{ marginBottom: '16px', padding: '7px 14px', fontSize: '0.85rem' }}>← Back</button>

      {/* Hero */}
      <div style={{ padding: '20px', borderRadius: '20px', background: 'var(--card2)', border: '1px solid var(--line)', boxShadow: 'var(--cardsh)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="chip">{series.exam_category}</span>
            <h1 className="t-title" style={{ margin: '12px 0 8px', color: 'var(--tx)' }}>{series.title}</h1>
            <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>{series.description || 'Guided study path tailored for your exam preparation.'}</p>
          </div>
          <div style={{ background: 'var(--surf)', padding: '16px 24px', borderRadius: '14px', textAlign: 'center', minWidth: '130px' }}>
            <div style={{ font: '700 28px var(--font-display)', letterSpacing: '-.02em', color: 'var(--accent-color)' }}>{series.total_tests}</div>
            <div style={{ font: '600 12px var(--font-body)', color: 'var(--muted)' }}>Total Tests</div>
          </div>
        </div>
        {series.next_test_id && (
          <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <span style={{ font: '700 11px var(--font-body)', color: 'var(--success-text)', letterSpacing: '.04em' }}>NEXT STEP IN STUDY PATH</span>
              <div style={{ font: '700 15px var(--font-body)', color: 'var(--tx)', marginTop: '2px' }}>{series.tests.find((t) => t.id === series.next_test_id)?.title}</div>
            </div>
            <button onClick={() => navigate(`/student/test/${series.next_test_id}`)} className="btn-primary" style={{ padding: '11px 20px' }}>Continue →</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', marginBottom: '20px', gap: '24px' }}>
        {tabBtn('path', 'Study Path', activeTab === 'path')}
        {tabBtn('leaderboard', 'Leaderboard', activeTab === 'leaderboard')}
      </div>

      {activeTab === 'path' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '18px' }}>
            {['all', 'full_mock', 'sectional', 'pyp', 'topic', 'current_affairs'].map((catKey) => {
              const count = catKey === 'all' ? series.tests.length : (series.categories[catKey]?.length || 0);
              if (catKey !== 'all' && count === 0) return null;
              return (
                <button key={catKey} onClick={() => setActiveCategoryTab(catKey)} className={`chip-filter${activeCategoryTab === catKey ? ' active' : ''}`}>
                  {catKey === 'all' ? 'All Tests' : getCategoryLabel(catKey)} ({count})
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredTests.map((test, index) => (
              <div key={test.id} className="glass-panel" style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderLeft: test.id === series.next_test_id ? '4px solid var(--brand)' : undefined, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: test.status === 'completed' ? 'var(--success-bg)' : 'var(--surf)', color: test.status === 'completed' ? 'var(--success-text)' : 'var(--muted)', display: 'grid', placeItems: 'center', fontWeight: 700, flex: 'none' }}>
                    {test.status === 'completed' ? <Icon name="check" size={14} /> : index + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, font: '700 15px var(--font-body)', color: 'var(--tx)' }}>{test.title}</h4>
                      <span style={{ font: '600 11px var(--font-body)', padding: '2px 8px', borderRadius: '6px', background: 'var(--surf)', color: 'var(--muted)' }}>{getCategoryLabel(test.category)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', font: '600 12px var(--font-body)', color: 'var(--muted)', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span>{Math.round(test.duration_seconds / 60)} mins</span>
                      <span>{test.total_marks} Marks</span>
                      {test.status === 'completed' && <span style={{ color: 'var(--success-text)', fontWeight: 700 }}>Score: {test.score}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => navigate(`/student/test/${test.id}`)} className={test.id === series.next_test_id ? 'btn-primary' : 'btn-secondary'} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  {test.status === 'completed' ? 'Analysis' : 'Start'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ margin: 0, font: '700 17px var(--font-display)', color: 'var(--tx)' }}>Batch Leaderboard</h3>
            {leaderboardData?.user_rank && <span className="chip">Your Rank #{leaderboardData.user_rank}</span>}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--surf)', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                <th style={{ padding: '12px', width: '70px' }}>Rank</th><th style={{ padding: '12px' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Done</th><th style={{ padding: '12px', textAlign: 'right' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {!leaderboardData?.leaderboard?.length ? (
                <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No submissions recorded yet.</td></tr>
              ) : leaderboardData.leaderboard.map((item) => (
                <tr key={item.user_id} style={{ borderBottom: '1px solid var(--line)', background: item.is_current_user ? 'var(--accent-soft)' : 'transparent', fontWeight: item.is_current_user ? 700 : 400 }}>
                  <td style={{ padding: '12px', fontWeight: 700 }}>#{item.rank}</td>
                  <td style={{ padding: '12px', color: 'var(--tx)' }}>{item.name} {item.is_current_user && '(You)'}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{item.tests_completed}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-color)' }}>{item.total_score} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
