import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import katex from 'katex';
import api from '../api';
import { useTheme } from '../lib/theme';
import { demoResultSummary, demoResultBars } from '../lib/demoData';

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
  const navigate = useNavigate();
  const { tint } = useTheme();
  const isDemo = sessionId === 'demo';

  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState('');
  const [analytic, setAnalytic] = useState(null);
  const [rank, setRank] = useState(1);
  const [percentile, setPercentile] = useState(100.0);
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    if (isDemo) return;
    api.get(`/api/student/tests/sessions/${sessionId}/result`)
      .then((res) => {
        setAnalytic(res.data.analytic || {});
        setRank(res.data.rank || 1);
        setPercentile(res.data.percentile !== undefined ? res.data.percentile : 100.0);
        setAnswers(res.data.answers || []);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to fetch test results.'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', height: '60vh' }}><div className="spinner" /></div>;
  }
  if (error) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--danger-text)', marginBottom: '16px' }}>{error}</div>
        <Link to="/dashboard" className="btn-primary">Back to Dashboard</Link>
      </div>
    );
  }

  // ---- normalize real vs demo into one view model ----
  const score = isDemo ? demoResultSummary.score : parseFloat(analytic.total_score || 0);
  const maxScore = isDemo ? demoResultSummary.total : parseFloat(analytic.max_score || 0);
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const vm = isDemo
    ? { rank: demoResultSummary.rank, percentile: demoResultSummary.percentile, accuracy: demoResultSummary.accuracy, correct: demoResultSummary.correct, wrong: demoResultSummary.wrong, skipped: demoResultSummary.skipped, time: demoResultSummary.timeSpent, title: demoResultSummary.title }
    : {
        rank: `${rank}`, percentile: parseFloat(percentile).toFixed(1), accuracy: `${parseFloat(analytic.accuracy_percentage || 0).toFixed(0)}%`,
        correct: analytic.correct_count || 0, wrong: analytic.incorrect_count || 0, skipped: analytic.unanswered_count || 0,
        time: analytic.time_spent_formatted || '—', title: analytic.test_title || 'Your scorecard',
      };
  const bars = demoResultBars; // representative subject breakdown (see RESTYLE_NOTES)

  const R = 56, C = 2 * Math.PI * R;
  const verdict = pct >= 80 ? 'Excellent — top 4%! 🎯' : pct >= 60 ? 'Good effort — keep pushing 💪' : 'Keep practising 📚';

  const statCard = (value, label, hue) => (
    <div style={{ padding: '14px 10px', borderRadius: '16px', background: 'var(--card)', border: '1px solid var(--line)', textAlign: 'center' }}>
      <div style={{ font: '800 19px var(--font-display)', color: tint(hue).c }}>{value}</div>
      <div style={{ font: '600 10.5px var(--font-body)', color: 'var(--muted)', marginTop: '2px' }}>{label}</div>
    </div>
  );
  const countCell = (value, label, color, mono) => (
    <div style={{ flex: 1 }}>
      <div style={{ font: `800 16px ${mono ? 'var(--font-mono)' : 'var(--font-display)'}`, color }}>{value}</div>
      <div style={{ font: '600 11px var(--font-body)', color: 'var(--muted)' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ padding: '10px 18px 30px', animation: 'fade-in .35s ease both' }}>
      <h1 style={{ margin: '0 0 14px', font: '800 19px var(--font-display)', color: 'var(--tx)' }}>Result &amp; analysis</h1>

      {/* Score hero */}
      <div style={{ padding: '24px', borderRadius: '22px', background: 'var(--card2)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-30px', left: '50%', transform: 'translateX(-50%)', width: '180px', height: '120px', background: 'radial-gradient(circle,rgba(245,166,35,.28),transparent 70%)' }} />
        <div style={{ position: 'relative', width: '130px', height: '130px' }}>
          <svg width="130" height="130" viewBox="0 0 130 130">
            <circle cx="65" cy="65" r={R} fill="none" stroke="var(--line2)" strokeWidth="10" />
            <circle cx="65" cy="65" r={R} fill="none" stroke="#F5A623" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 65 65)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ font: '800 30px var(--font-display)', color: 'var(--tx)', lineHeight: 1 }}>{score}</span>
            <span style={{ font: '600 12px var(--font-body)', color: 'var(--muted)' }}>out of {maxScore}</span>
          </div>
        </div>
        <div style={{ font: '800 18px var(--font-display)', color: '#FFC968', marginTop: '14px' }}>{verdict}</div>
        <div style={{ font: '600 12px var(--font-body)', color: 'var(--muted)', marginTop: '3px' }}>{vm.title}</div>
      </div>

      {/* Rank / percentile / accuracy */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginTop: '14px' }}>
        {statCard(vm.rank, 'All-India rank', 'gold')}
        {statCard(vm.percentile, 'Percentile', 'blue')}
        {statCard(vm.accuracy, 'Accuracy', 'green')}
      </div>

      {/* Correct / wrong / skipped / time */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '14px', padding: '15px 16px', borderRadius: '16px', background: 'var(--card)', border: '1px solid var(--line)' }}>
        {countCell(vm.correct, 'Correct', tint('green').c)}
        {countCell(vm.wrong, 'Wrong', tint('red').c)}
        {countCell(vm.skipped, 'Skipped', 'var(--tx2)')}
        {countCell(vm.time, 'Time', 'var(--tx2)', true)}
      </div>

      {/* Subject-wise accuracy */}
      <h2 style={{ margin: '22px 0 12px', font: '700 16px var(--font-display)', color: 'var(--tx)' }}>Subject-wise accuracy</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {bars.map((b) => {
          const c = tint(b.hue).c;
          return (
            <div key={b.k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ font: '600 12.5px var(--font-body)', color: 'var(--tx2)' }}>{b.k}</span>
                <span style={{ font: '800 12px var(--font-mono)', color: c }}>{b.pct}%</span>
              </div>
              <div style={{ height: '8px', borderRadius: '999px', background: 'var(--surf)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '999px', width: `${b.pct}%`, background: c }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button onClick={() => navigate('/student/test-series')} className="btn-secondary" style={{ flex: 1 }}>Retake</button>
        <button onClick={() => { const el = document.getElementById('answer-review'); el ? el.scrollIntoView({ behavior: 'smooth' }) : navigate('/results'); }} className="btn-primary" style={{ flex: 1 }}>Review answers</button>
      </div>

      {/* Question-by-question review (real sessions only) */}
      {answers.length > 0 && (
        <div id="answer-review" style={{ marginTop: '30px' }}>
          <h2 style={{ font: '800 18px var(--font-display)', marginBottom: '16px', color: 'var(--tx)' }}>Answer review</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {answers.map((ans, idx) => {
              const isCorrect = ans.selected_option_id !== null && ans.is_correct;
              const isUnanswered = ans.selected_option_id === null;
              return (
                <div key={ans.question_id} className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid', borderLeftColor: isCorrect ? 'var(--success)' : isUnanswered ? 'var(--muted)' : 'var(--danger)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--tx)' }}>Question {idx + 1}</span>
                    <span style={{ color: isCorrect ? 'var(--success-text)' : isUnanswered ? 'var(--muted)' : 'var(--danger-text)', fontWeight: 700, textTransform: 'uppercase' }}>{isCorrect ? 'Correct' : isUnanswered ? 'Skipped' : 'Incorrect'}</span>
                  </div>
                  <div style={{ fontSize: '1.02rem', lineHeight: 1.6, marginBottom: '16px', color: 'var(--tx)' }}><MathRenderer text={ans.question_text} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                    {ans.options.map((opt) => {
                      const wasSelected = ans.selected_option_id === opt.id;
                      const isRight = opt.is_correct;
                      let bg = 'var(--surf)', border = 'var(--line)';
                      if (isRight) { bg = 'var(--success-bg)'; border = 'var(--success-border)'; }
                      else if (wasSelected) { bg = 'var(--danger-bg)'; border = 'var(--danger-border)'; }
                      return (
                        <div key={opt.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: bg, border: `1px solid ${border}`, fontSize: '0.95rem', color: 'var(--tx)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: isRight ? 'var(--success)' : wasSelected ? 'var(--danger)' : 'var(--surf)', color: '#fff', marginRight: '12px', fontWeight: 'bold', fontSize: '0.8rem' }}>{opt.label}</span>
                          <span><MathRenderer text={opt.option_text} /></span>
                        </div>
                      );
                    })}
                  </div>
                  {ans.explanation && (
                    <div style={{ background: 'var(--surf)', border: '1px dashed var(--line2)', padding: '14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: '6px' }}>Explanation</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--tx2)', lineHeight: 1.5 }}><MathRenderer text={ans.explanation} /></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
