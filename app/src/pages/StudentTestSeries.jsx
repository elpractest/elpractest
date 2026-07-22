import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function StudentTestSeries() {
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudentSeries();
  }, []);

  const fetchStudentSeries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/student/test-series');
      setSeriesList(res.data || []);
    } catch (err) {
      setError('Failed to load your assigned Test Series.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px', color: 'var(--text-secondary)' }}>
        <span>⏳ Loading your assigned Test Series...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          🎯 My Test Series &amp; Study Paths
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Follow guided test series, track completion status, and compare your batch ranks.
        </p>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', marginBottom: '24px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Series Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        {seriesList.length === 0 ? (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            📚 No active test series assigned to your enrolled batches yet.
          </div>
        ) : (
          seriesList.map((series) => (
            <div key={series.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.2s ease' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: 'var(--accent-soft)', color: 'var(--accent-color)', textTransform: 'uppercase' }}>
                    {series.exam_category}
                  </span>
                  {series.is_completed && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: 'var(--success-bg)', color: 'var(--success)' }}>
                      Completed ✓
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                  {series.title}
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  {series.description || 'Guided study path for targeted exam preparation.'}
                </p>

                {/* Progress bar */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Progress: {series.attempted_tests_count} / {series.total_tests} Tests</span>
                    <span>{series.total_tests > 0 ? Math.round((series.attempted_tests_count / series.total_tests) * 100) : 0}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${series.total_tests > 0 ? (series.attempted_tests_count / series.total_tests) * 100 : 0}%`,
                        background: 'var(--grad-primary)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate(`/student/test-series/${series.id}`)}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                <span>View Study Path</span>
                <span>→</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
