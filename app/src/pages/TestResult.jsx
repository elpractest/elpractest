import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import katex from 'katex';
import api from '../api';

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

export default function TestResult() {
  const { session: sessionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [analytic, setAnalytic] = useState(null);
  const [rank, setRank] = useState(1);
  const [percentile, setPercentile] = useState(100.00);
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    api.get(`/api/student/tests/sessions/${sessionId}/result`)
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
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Analyzing performance and computing percentiles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--danger-text)', marginBottom: '16px' }}>{error}</div>
        <Link to="/dashboard" className="btn-primary">Back to Dashboard</Link>
      </div>
    );
  }

  // Calculate some friendly helper stats
  const totalAttempted = (analytic.correct_count || 0) + (analytic.incorrect_count || 0);

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '32px', padding: '0 24px 40px 24px' }}>
      
      {/* Top Banner / Hero */}
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '4px 12px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '20px', textTransform: 'uppercase' }}>
          Test Submitted Successfully
        </span>
        <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 800 }}>Your Scorecard</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Here is your detailed performance breakdown relative to your cohort batch.</p>
        <Link to="/dashboard" className="btn-primary" style={{ marginTop: '12px' }}>Back to Dashboard</Link>
      </div>

      {/* Main Score stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        {/* Score Card */}
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Obtained Score</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-color)', margin: '8px 0' }}>
            {parseFloat(analytic.total_score || 0).toFixed(2)}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Max Marks: {parseFloat(analytic.max_score || 0).toFixed(2)}
          </span>
        </div>

        {/* Percentile Rank Card */}
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Percentile Rank</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--violet-text)', margin: '8px 0' }}>
            {parseFloat(percentile).toFixed(1)}%
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Batch Rank: <strong>#{rank}</strong>
          </span>
        </div>

        {/* Accuracy Card */}
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Accuracy Rate</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)', margin: '8px 0' }}>
            {parseFloat(analytic.accuracy_percentage || 0).toFixed(1)}%
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Attempted: {totalAttempted}
          </span>
        </div>

        {/* Correct/Incorrect Counts */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>Correct answers:</span>
            <strong>{analytic.correct_count}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Incorrect answers:</span>
            <strong>{analytic.incorrect_count}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Unanswered:</span>
            <strong>{analytic.unanswered_count}</strong>
          </div>
        </div>

      </div>

      {/* Review Section */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px' }}>Question-by-Question Review</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {answers.map((ans, idx) => {
            const isCorrect = ans.selected_option_id !== null && ans.is_correct;
            const isUnanswered = ans.selected_option_id === null;
            
            // Find selected option text
            const selectedOpt = ans.options.find(o => o.id === ans.selected_option_id);
            const correctOpt = ans.options.find(o => o.is_correct);

            return (
              <div 
                key={ans.question_id} 
                className="glass-panel" 
                style={{ 
                  padding: '24px',
                  borderLeft: '4px solid',
                  borderLeftColor: isCorrect ? 'var(--success)' : isUnanswered ? 'var(--text-secondary)' : 'var(--danger)'
                }}
              >
                {/* Review Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 700 }}>Question {idx + 1}</span>
                  <span style={{ 
                    color: isCorrect ? 'var(--success)' : isUnanswered ? 'var(--text-secondary)' : 'var(--danger)',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}>
                    {isCorrect ? 'Correct' : isUnanswered ? 'Skipped' : 'Incorrect'}
                  </span>
                </div>

                {/* Question text */}
                <div style={{ fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '20px' }}>
                  <MathRenderer text={ans.question_text} />
                </div>

                {/* Options view */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {ans.options.map((opt) => {
                    const wasSelected = ans.selected_option_id === opt.id;
                    const isRight = opt.is_correct;
                    
                    let bg = 'var(--surface-1)';
                    let border = 'var(--border-color)';
                    if (isRight) {
                      bg = 'var(--success-bg)';
                      border = 'var(--success)';
                    } else if (wasSelected && !isRight) {
                      bg = 'var(--danger-bg)';
                      border = 'var(--danger)';
                    }

                    return (
                      <div 
                        key={opt.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '10px 16px', 
                          borderRadius: '6px', 
                          background: bg, 
                          border: '1px solid',
                          borderColor: border,
                          fontSize: '0.95rem'
                        }}
                      >
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          width: '24px', 
                          height: '24px', 
                          borderRadius: '50%',
                          background: isRight ? 'var(--success)' : wasSelected ? 'var(--danger)' : 'var(--surface-2)',
                          color: '#ffffff',
                          marginRight: '12px',
                          fontWeight: 'bold',
                          fontSize: '0.8rem',
                          textTransform: 'uppercase'
                        }}>
                          {opt.label}
                        </span>
                        <span><MathRenderer text={opt.option_text} /></span>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {ans.explanation && (
                  <div style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-color)', padding: '16px', borderRadius: '8px', marginTop: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: '6px' }}>Explanation:</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      <MathRenderer text={ans.explanation} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
