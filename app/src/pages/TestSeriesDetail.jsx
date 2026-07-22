import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

export default function TestSeriesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [series, setSeries] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState('all');
  const [activeTab, setActiveTab] = useState('path'); // 'path' or 'leaderboard'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSeriesDetail();
  }, [id]);

  const fetchSeriesDetail = async () => {
    setLoading(true);
    try {
      const [detailRes, lbRes] = await Promise.all([
        api.get(`/api/student/test-series/${id}`),
        api.get(`/api/student/test-series/${id}/leaderboard`),
      ]);
      setSeries(detailRes.data);
      setLeaderboardData(lbRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load test series.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (catKey) => {
    switch (catKey) {
      case 'full_mock': return 'Full Mock';
      case 'sectional': return 'Sectional';
      case 'pyp': return 'Previous Year (PYP)';
      case 'topic': return 'Topic Test';
      case 'current_affairs': return 'Current Affairs';
      default: return 'Mock Test';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-secondary)' }}>
        <span>⏳ Loading Study Path...</span>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px', textAlign: 'center' }}>
        <div style={{ background: 'var(--danger-bg)', padding: '20px', borderRadius: '12px', color: 'var(--danger-text)', marginBottom: '16px' }}>
          ⚠️ {error || 'Test Series not found.'}
        </div>
        <button onClick={() => navigate('/student/test-series')} className="btn-secondary">
          ← Back to My Series
        </button>
      </div>
    );
  }

  const filteredTests = activeCategoryTab === 'all'
    ? series.tests
    : series.tests.filter((t) => t.category === activeCategoryTab);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      
      {/* Top Navigation */}
      <button
        onClick={() => navigate('/student/test-series')}
        className="btn-secondary"
        style={{ marginBottom: '20px', padding: '6px 14px', fontSize: '0.85rem' }}
      >
        ← Back to All Series
      </button>

      {/* Series Hero Banner */}
      <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px', marginBottom: '28px', background: 'var(--surface-1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: 'var(--accent-soft)', color: 'var(--accent-color)', textTransform: 'uppercase' }}>
              {series.exam_category}
            </span>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '12px 0 8px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {series.title}
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '650px', lineHeight: 1.6 }}>
              {series.description || 'Guided Study Path tailored for your exam preparation schedule.'}
            </p>
          </div>

          {/* Quick Stats Box */}
          <div style={{ background: 'var(--surface-2)', padding: '16px 24px', borderRadius: '12px', textAlign: 'center', minWidth: '160px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-color)' }}>
              {series.total_tests}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Tests</div>
          </div>
        </div>

        {/* Continue Next Test Banner */}
        {series.next_test_id && (
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)' }}>⚡ NEXT STEP IN STUDY PATH:</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {series.tests.find((t) => t.id === series.next_test_id)?.title}
              </div>
            </div>
            <button
              onClick={() => navigate(`/student/test/${series.next_test_id}`)}
              className="btn-primary"
              style={{ padding: '12px 24px', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span>Continue → Next Test</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Navigation (Study Path vs Leaderboard) */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', gap: '24px' }}>
        <button
          onClick={() => setActiveTab('path')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'path' ? '3px solid var(--accent-color)' : '3px solid transparent',
            padding: '12px 4px',
            fontSize: '1rem',
            fontWeight: 700,
            color: activeTab === 'path' ? 'var(--accent-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          🗺️ Guided Study Path
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'leaderboard' ? '3px solid var(--accent-color)' : '3px solid transparent',
            padding: '12px 4px',
            fontSize: '1rem',
            fontWeight: 700,
            color: activeTab === 'leaderboard' ? 'var(--accent-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          🏆 Batch Leaderboard
        </button>
      </div>

      {/* STUDY PATH TAB CONTENT */}
      {activeTab === 'path' && (
        <div>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px' }}>
            {['all', 'full_mock', 'sectional', 'pyp', 'topic', 'current_affairs'].map((catKey) => {
              const count = catKey === 'all' ? series.tests.length : (series.categories[catKey]?.length || 0);
              if (catKey !== 'all' && count === 0) return null;

              return (
                <button
                  key={catKey}
                  onClick={() => setActiveCategoryTab(catKey)}
                  className={activeCategoryTab === catKey ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '20px', whiteSpace: 'nowrap' }}
                >
                  {catKey === 'all' ? 'All Tests' : getCategoryLabel(catKey)} ({count})
                </button>
              );
            })}
          </div>

          {/* Test List Sequence */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredTests.map((test, index) => (
              <div
                key={test.id}
                className="glass-panel"
                style={{
                  padding: '20px 24px',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  borderRadius: '12px',
                  borderLeft: test.id === series.next_test_id ? '4px solid var(--accent-color)' : '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: test.status === 'completed' ? 'var(--success-bg)' : 'var(--surface-2)',
                      color: test.status === 'completed' ? 'var(--success)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'center',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                    }}
                  >
                    {test.status === 'completed' ? '✓' : index + 1}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {test.title}
                      </h4>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                        {getCategoryLabel(test.category)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <span>⏱️ {Math.round(test.duration_seconds / 60)} mins</span>
                      <span>💯 {test.total_marks} Marks</span>
                      {test.status === 'completed' && (
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>Score: {test.score} Marks</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {test.status === 'completed' ? (
                    <button
                      onClick={() => navigate(`/student/test/${test.id}`)}
                      className="btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      Re-attempt / Analysis
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/student/test/${test.id}`)}
                      className={test.id === series.next_test_id ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      Start Test →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LEADERBOARD TAB CONTENT */}
      {activeTab === 'leaderboard' && (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Batch Peer Leaderboard
            </h3>
            {leaderboardData?.user_rank && (
              <span style={{ padding: '6px 14px', background: 'var(--accent-soft)', color: 'var(--accent-color)', borderRadius: '20px', fontWeight: 700, fontSize: '0.88rem' }}>
                Your Rank: #{leaderboardData.user_rank}
              </span>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px', width: '70px' }}>Rank</th>
                <th style={{ padding: '12px' }}>Student Name</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Tests Completed</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Total Series Score</th>
              </tr>
            </thead>
            <tbody>
              {!leaderboardData?.leaderboard?.length ? (
                <tr>
                  <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No student submissions recorded for this series yet.
                  </td>
                </tr>
              ) : (
                leaderboardData.leaderboard.map((item) => (
                  <tr
                    key={item.user_id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: item.is_current_user ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      fontWeight: item.is_current_user ? 700 : 400,
                    }}
                  >
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>
                      {item.rank === 1 ? '🥇 #1' : item.rank === 2 ? '🥈 #2' : item.rank === 3 ? '🥉 #3' : `#${item.rank}`}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-primary)' }}>
                      {item.name} {item.is_current_user && '(You)'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {item.tests_completed}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                      {item.total_score} pts
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
