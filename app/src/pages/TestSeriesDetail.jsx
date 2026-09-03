import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';

export default function TestSeriesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [series, setSeries] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState('all');
  const [activeTab, setActiveTab] = useState('path');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
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

  if (notFound || !series) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '80px 24px', textAlign: 'center' }}>
        <span style={{ display: 'grid', placeItems: 'center', width: '48px', height: '48px', borderRadius: '999px', background: 'var(--surf)', color: 'var(--muted)' }}>
          <Icon name="target" size={24} />
        </span>
        <p style={{ margin: 0, maxWidth: '40ch', font: '400 13.5px/1.6 var(--font-body)', color: 'var(--muted)' }}>
          This test series isn't available.
        </p>
        <button onClick={() => navigate('/student/test-series')} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>← Back to test series</button>
      </div>
    );
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
            {/* This test's own status decides where "Continue" actually goes:
                the instructions gate handles both "not started yet" and
                "already in progress" correctly on its own (it redirects
                straight to resume when a session already exists), so the
                same target is right regardless of which one this is. */}
            <button onClick={() => navigate(`/tests/${series.next_test_id}/instructions`)} className="btn-primary" style={{ padding: '11px 20px' }}>Continue →</button>
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
                <button
                  onClick={() => navigate(
                    test.status === 'completed'
                      // A completed attempt has its own session id now —
                      // this used to point at a route keyed by test id that
                      // did not exist at all, so "Analysis" on every
                      // finished test in a study path was a dead click.
                      ? `/tests/${test.session_id}/result`
                      : `/tests/${test.id}/instructions`
                  )}
                  className={test.id === series.next_test_id ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
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
