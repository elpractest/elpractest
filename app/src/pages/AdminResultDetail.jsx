import React, { useState, useEffect } from 'react';
import katex from 'katex';
import api from '../api';
import 'katex/dist/katex.min.css';

// Math Renderer helper
const MathRenderer = ({ text }) => {
  if (!text) return null;
  const partsRegex = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  return (
    <span>
      {partsRegex.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2);
          try {
            const html = katex.renderToString(math, { displayMode: true, throwOnError: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch (e) {
            return <span key={index}>{math}</span>;
          }
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          try {
            const html = katex.renderToString(math, { displayMode: false, throwOnError: false });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch (e) {
            return <span key={index}>{math}</span>;
          }
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default function AdminResultDetail({ sessionId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytic, setAnalytic] = useState(null);
  const [rank, setRank] = useState(1);
  const [percentile, setPercentile] = useState(100.00);
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    setError('');

    api.get(`/api/admin/results/${sessionId}`)
      .then((res) => {
        setAnalytic(res.data.analytic || {});
        setRank(res.data.rank || 1);
        setPercentile(res.data.percentile !== undefined ? res.data.percentile : 100.00);
        setAnswers(res.data.answers || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to fetch test results.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading scorecard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</div>
        <button onClick={onBack} className="btn-primary">Back to Results</button>
      </div>
    );
  }

  const totalAttempted = (analytic?.correct_count || 0) + (analytic?.incorrect_count || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button onClick={onBack} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem', marginBottom: '12px' }}>
            ⬅️ Back to Results
          </button>
          <h1 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800 }}>Student Attempt Scorecard</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Reviewing detailed results, question review key, and cohort rankings.</p>
        </div>
      </div>

      {/* Main Stats Card Grid */}
      {analytic && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          
          <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Obtained Score</span>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--accent-color)', margin: '6px 0' }}>
              {parseFloat(analytic.total_score || 0).toFixed(2)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Max Marks: {parseFloat(analytic.max_score || 0).toFixed(2)}
            </span>
          </div>

          <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Percentile Rank</span>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#a78bfa', margin: '6px 0' }}>
              {parseFloat(percentile).toFixed(1)}%
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Cohort Rank: <strong>#{rank}</strong>
            </span>
          </div>

          <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Accuracy Rate</span>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10b981', margin: '6px 0' }}>
              {parseFloat(analytic.accuracy_percentage || 0).toFixed(1)}%
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Attempted: {totalAttempted}
            </span>
          </div>

          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Correct:</span>
              <strong>{analytic.correct_count}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>Incorrect:</span>
              <strong>{analytic.incorrect_count}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Unanswered:</span>
              <strong>{analytic.unanswered_count}</strong>
            </div>
          </div>

        </div>
      )}

      {/* Review Section */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>Question-by-Question Review</h2>
        
        {answers.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No question attempts logged for this session.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {answers.map((ans, idx) => {
              const selectedOpt = ans.options?.find(o => o.id === ans.selected_option_id);
              const correctOpt = ans.options?.find(o => o.is_correct);
              const isCorrect = ans.is_correct;
              const isSkipped = ans.selected_option_id === null;

              return (
                <div 
                  key={ans.question_id}
                  style={{
                    padding: '24px',
                    border: '1px solid ' + (isSkipped ? 'var(--border-color)' : isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'),
                    background: isSkipped ? 'rgba(255,255,255,0.01)' : isCorrect ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}
                >
                  {/* Question header status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-color)' }}>
                      Question {idx + 1}
                    </span>
                    <span 
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        textTransform: 'uppercase',
                        background: isSkipped ? '#4b5563' : isCorrect ? '#10b981' : '#ef4444',
                        color: '#ffffff'
                      }}
                    >
                      {isSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  {/* Question text */}
                  <div style={{ fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                    <MathRenderer text={ans.question_text} />
                  </div>

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {ans.options?.map((opt) => {
                      const isOptionSelected = opt.id === ans.selected_option_id;
                      const isOptionCorrect = opt.is_correct;
                      
                      let borderStyle = '1px solid var(--border-color)';
                      let bgStyle = 'rgba(255,255,255,0.02)';
                      
                      if (isOptionCorrect) {
                        borderStyle = '1px solid #10b981';
                        bgStyle = 'rgba(16, 185, 129, 0.1)';
                      } else if (isOptionSelected && !isOptionCorrect) {
                        borderStyle = '1px solid #ef4444';
                        bgStyle = 'rgba(239, 68, 68, 0.1)';
                      }

                      return (
                        <div 
                          key={opt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            padding: '12px 16px',
                            background: bgStyle,
                            border: borderStyle,
                            borderRadius: '8px',
                            fontSize: '0.95rem'
                          }}
                        >
                          <span 
                            className="option-badge"
                            style={{
                              background: isOptionSelected ? (isOptionCorrect ? '#10b981' : '#ef4444') : isOptionCorrect ? '#10b981' : 'transparent',
                              borderColor: isOptionSelected || isOptionCorrect ? 'transparent' : 'var(--border-color)',
                              color: isOptionSelected || isOptionCorrect ? '#ffffff' : 'inherit'
                            }}
                          >
                            {opt.label}
                          </span>
                          <MathRenderer text={opt.option_text} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary info */}
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
                    <span>Marks: <strong>{ans.marks}</strong></span>
                    <span>Negative: <strong>-{ans.negative_marks}</strong></span>
                    <span>Time Spent: <strong>{ans.time_spent_seconds}s</strong></span>
                  </div>

                  {/* Solution Explanation */}
                  {ans.explanation && (
                    <div style={{ marginTop: '8px', padding: '16px', background: 'rgba(99, 102, 241, 0.05)', borderLeft: '3px solid var(--accent-color)', borderRadius: '4px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '6px', color: 'var(--text-primary)' }}>Solution / Explanation:</div>
                      <div style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                        <MathRenderer text={ans.explanation} />
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
