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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '18px 18px 8px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="t-title" style={{ margin: 0, color: 'var(--tx)' }}>Your results</h1>
          <p style={{ margin: '6px 0 0', font: '400 13.5px/1.55 var(--font-body)', color: 'var(--muted)', maxWidth: '62ch' }}>
            Every attempt you have submitted, with its score, accuracy and rank.
          </p>
        </div>
        <Link to="/dashboard" className="btn-secondary" style={{ textDecoration: 'none', flex: 'none' }}>
          <Icon name="arrow-left" size={16} />
          Dashboard
        </Link>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            padding: '11px 14px',
            borderRadius: '13px',
            color: 'var(--danger)',
            font: '500 12.5px var(--font-body)',
          }}
        >
          <Icon name="alert" size={15} />
          {error}
        </div>
      )}

      {results.length === 0 ? (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '20px',
            padding: '46px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '999px',
              background: 'var(--surf)',
              color: 'var(--muted)',
            }}
          >
            <Icon name="chart" size={24} />
          </span>
          <p style={{ margin: 0, maxWidth: '44ch', font: '400 13.5px/1.6 var(--font-body)', color: 'var(--muted)' }}>
            Nothing submitted yet — your score, rank and per-topic breakdown appear here after your first paper.
          </p>
          <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none', marginTop: '4px' }}>
            Start a test
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {results.map((r) => (
            <div
              key={r.session_id}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '20px',
                padding: '18px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="t-heading" style={{ color: 'var(--tx)' }}>{r.test_title}</span>
                  {r.course_title && (
                    <span
                      style={{
                        font: '600 11px var(--font-body)',
                        padding: '3px 9px',
                        borderRadius: '7px',
                        background: 'var(--primary-soft)',
                        color: 'var(--primary)',
                      }}
                    >
                      {r.course_title}
                    </span>
                  )}
                </div>
                <div style={{ font: '400 12px var(--font-body)', color: 'var(--muted)' }}>
                  {new Date(r.submitted_at).toLocaleString()}
                  {r.is_auto_submitted && (
                    <span style={{ color: 'var(--reward-text)', marginLeft: '6px' }}>auto-submitted at expiry</span>
                  )}
                </div>
                {/* null means the paper set no cut-off, which is not a failure
                    and must not be rendered as one. */}
                {r.is_qualified !== null && r.is_qualified !== undefined && (
                  <div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        font: '600 11.5px var(--font-body)',
                        color: r.is_qualified ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: r.is_qualified ? 'var(--success)' : 'var(--danger)',
                        }}
                      />
                      {r.is_qualified ? 'Qualified' : 'Not qualified'}
                    </span>
                  </div>
                )}
              </div>

              {/* the figures — mono, tabular, one tier of colour */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: 'SCORE', value: r.score, suffix: ` / ${r.total_marks}` },
                  { label: 'ACCURACY', value: `${r.accuracy_percentage}%` },
                  ...(r.merit_rank != null ? [{ label: 'MERIT RANK', value: `#${r.merit_rank}` }] : []),
                  { label: 'PERCENTILE', value: `${r.percentile}%` },
                ].map((f) => (
                  <div
                    key={f.label}
                    style={{
                      minWidth: '84px',
                      padding: '9px 12px',
                      background: 'var(--card2)',
                      border: '1px solid var(--line)',
                      borderRadius: '12px',
                    }}
                  >
                    <div className="t-overline" style={{ fontSize: '9px', color: 'var(--muted)' }}>{f.label}</div>
                    <div className="t-num" style={{ marginTop: '5px', fontSize: '16px', color: 'var(--tx)' }}>
                      {f.value}
                      {f.suffix && (
                        <span style={{ font: '500 11.5px var(--font-mono)', color: 'var(--muted)' }}>{f.suffix}</span>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => navigate(`/tests/${r.session_id}/result`)}
                  className="btn-secondary"
                  style={{ flex: 'none' }}
                >
                  Full analysis
                  <Icon name="arrow-right" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
