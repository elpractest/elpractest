import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';

export default function ResultsHistory() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get('/api/student/results')
      .then(res => {
        setResults(res.data.results || []);
      })
      .catch(err => {
        setError('Failed to fetch test results history.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading test results history...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', padding: '0 24px 40px 24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '1.8rem', fontWeight: 800 }}>Test Results & Performance</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Review your past mock attempts, score breakdown, accuracy, and batch percentile rank.
          </p>
        </div>
        <Link to="/dashboard" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {results.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><span style={{ display: 'inline-flex', padding: '15px', borderRadius: '18px', background: 'var(--accent-soft)', color: 'var(--accent-color)', border: '1px solid var(--accent-border)' }}><Icon name="chart" size={34} /></span></div>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>No Tests Attempted Yet</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px' }}>
            Once you attempt and submit practice or mock test series, your detailed analytics and rank breakdown will appear here.
          </p>
          <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none', marginTop: '8px' }}>
            Go to Dashboard & Start Test
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {results.map((r) => (
            <div key={r.session_id} className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 300px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{r.test_title}</span>
                  {r.course_title && (
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--accent-soft)', color: 'var(--accent-color)', fontWeight: 600 }}>
                      {r.course_title}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Submitted: {new Date(r.submitted_at).toLocaleString()}
                  {r.is_auto_submitted && <span style={{ color: 'var(--warning)', marginLeft: '6px' }}>(Auto-Submitted at Expiry)</span>}
                </div>
                {/* null means the paper set no cut-off, which is not a failure
                    and must not be rendered as one. */}
                {r.is_qualified !== null && r.is_qualified !== undefined && (
                  <div>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 800, padding: '2px 9px', borderRadius: '999px',
                      background: r.is_qualified ? 'var(--success-bg)' : 'var(--danger-bg)',
                      color: r.is_qualified ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {r.is_qualified ? 'QUALIFIED' : 'NOT QUALIFIED'}
                    </span>
                  </div>
                )}
              </div>

              {/* Analytics Badges */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SCORE</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                    {r.score} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/ {r.total_marks}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ACCURACY</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success-text)' }}>
                    {r.accuracy_percentage}%
                  </div>
                </div>

                {r.merit_rank != null && (
                  <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MERIT RANK</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--warning)' }}>#{r.merit_rank}</div>
                  </div>
                )}

                <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PERCENTILE</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--violet)' }}>
                    {r.percentile}%
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/tests/${r.session_id}/result`)}
                  className="btn-primary"
                  style={{ padding: '10px 18px', fontSize: '0.85rem' }}
                >
                  View Full Analysis →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
