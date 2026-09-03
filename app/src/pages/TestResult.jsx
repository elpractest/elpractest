import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import katex from 'katex';
import api from '../api';
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
  const { t } = useTranslation();
  const isDemo = sessionId === 'demo';

  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState('');
  const [analytic, setAnalytic] = useState(null);
  const [rank, setRank] = useState(1);
  const [percentile, setPercentile] = useState(100.0);
  // Strict published ordering, tie-broken on accuracy then time. Different from
  // `rank`, which is standard competition ranking and lets equal scores tie.
  const [meritRank, setMeritRank] = useState(null);
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    if (isDemo) return;
    api.get(`/api/student/tests/sessions/${sessionId}/result`)
      .then((res) => {
        setAnalytic(res.data.analytic || {});
        setRank(res.data.rank || 1);
        setPercentile(res.data.percentile !== undefined ? res.data.percentile : 100.0);
        setMeritRank(res.data.merit_rank ?? null);
        setAnswers(res.data.answers || []);
      })
      .catch((err) => setError(err.response?.data?.message || t('result.fetchFailed')))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', height: '60vh' }}><div className="spinner" /></div>;
  }
  if (error) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--danger-text)', marginBottom: '16px' }}>{error}</div>
        <Link to="/dashboard" className="btn-primary">{t('result.backToDashboard')}</Link>
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
        time: analytic.time_spent_formatted || '—', title: analytic.test_title || t('result.scorecard'),
      };
  // Subject bars from the REAL analytics. This used to render demoResultBars on
  // every scorecard, including real sessions, so a student saw a breakdown of a
  // paper they never sat. Demo mode still gets the sample.
  const realBars = (() => {
    const breakdown = analytic?.subject_breakdown;
    if (!breakdown || typeof breakdown !== 'object') return [];
    const hues = ['blue', 'green', 'gold', 'red', 'violet'];
    return Object.entries(breakdown).map(([k, v], i) => {
      const attempted = (v.correct || 0) + (v.incorrect || 0);
      return {
        k,
        pct: attempted > 0 ? Math.round((v.correct / attempted) * 100) : 0,
        hue: hues[i % hues.length],
        detail: `${v.correct || 0}/${attempted} · ${v.unanswered || 0} ${t('result.blank')}`,
      };
    });
  })();
  const bars = isDemo ? demoResultBars : realBars;

  // Exam-pattern results. Null qualified means the paper set no bar at all,
  // which must not render as a failure.
  const sectionBreakdown = isDemo ? [] : (analytic?.section_breakdown || []);
  const isQualified = isDemo ? null : (analytic?.is_qualified ?? null);
  const meritScore = isDemo ? null : (analytic?.merit_score != null ? parseFloat(analytic.merit_score) : null);
  const normalizedScore = isDemo ? null : (analytic?.normalized_score != null ? parseFloat(analytic.normalized_score) : null);
  const hasQualifyingSection = sectionBreakdown.some((sec) => sec.is_qualifying);
  const fmt = (n) => (Math.round(Number(n) * 100) / 100);
  // Numeric answers come back from a decimal:4 cast ("1920.0000"); show them the
  // way a candidate wrote them, without the trailing zeros.
  const num = (v) => (v === null || v === undefined || v === '' ? '—' : String(Number(v)));

  const R = 56, C = 2 * Math.PI * R;
  const barPeak = bars.length ? Math.max(...bars.map((b) => Number(b.pct) || 0)) : null;
  const verdict = pct >= 80 ? t('result.verdictHigh') : pct >= 60 ? t('result.verdictMid') : t('result.verdictLow');

  /* Every figure a candidate reads is mono and tabular, so digits do not
     jitter between one paper and the next. */
  const statCard = (value, label) => (
    <div style={{ padding: '14px 10px', borderRadius: '16px', background: 'var(--card)', border: '1px solid var(--line)', textAlign: 'center' }}>
      <div className="t-num" style={{ fontSize: '19px', lineHeight: 1, color: 'var(--tx)' }}>{value}</div>
      <div className="t-overline" style={{ marginTop: '7px', letterSpacing: '.12em', color: 'var(--muted)' }}>{label}</div>
    </div>
  );
  const countCell = (value, label, color) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="t-num" style={{ fontSize: '17px', lineHeight: 1, color: color || 'var(--tx)' }}>{value}</div>
      <div style={{ marginTop: '5px', font: '400 11px var(--font-body)', color: 'var(--muted)' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ padding: '10px 18px 30px', animation: 'fade-in .35s ease both' }}>
      <h1 className="t-title" style={{ margin: '0 0 14px', color: 'var(--tx)' }}>{t('result.title')}</h1>

      {/* Score hero */}
      <div style={{ padding: '24px', borderRadius: '20px', background: 'var(--card)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', width: '130px', height: '130px' }}>
          <svg width="130" height="130" viewBox="0 0 130 130">
            <circle cx="65" cy="65" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
            <circle cx="65" cy="65" r={R} fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 65 65)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="t-num" style={{ fontSize: '30px', color: 'var(--tx)', lineHeight: 1 }}>{score}</span>
            <span style={{ marginTop: '4px', font: '400 12px var(--font-body)', color: 'var(--muted)' }}>{t('result.outOf')} <span className="t-num" style={{ fontSize: '12px', fontWeight: 500 }}>{maxScore}</span></span>
          </div>
        </div>
        <div style={{ font: '700 18px var(--font-display)', letterSpacing: '-.02em', color: 'var(--tx)', marginTop: '14px' }}>{verdict}</div>
        <div style={{ font: '600 12px var(--font-body)', color: 'var(--muted)', marginTop: '3px' }}>{vm.title}</div>

        {isQualified !== null && (
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              marginTop: '12px', padding: '6px 14px', borderRadius: '999px',
              font: '600 12px var(--font-body)',
              background: isQualified ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: isQualified ? 'var(--success)' : 'var(--danger)',
            }}
          >
            <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
            {isQualified ? t('result.qualified') : t('result.notQualified')}
          </div>
        )}

        {normalizedScore !== null && (
          <div style={{ font: '600 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '8px' }}>
            {t('result.normalised')}: <strong style={{ color: 'var(--tx)' }}>{fmt(normalizedScore)}</strong>
          </div>
        )}
      </div>

      {/* Rank / percentile / accuracy */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginTop: '14px' }}>
        {/* Merit rank is the strict published order; `rank` lets equal scores
            share a place, which is what a percentile is computed against. */}
        {statCard(meritRank !== null ? `${meritRank}` : vm.rank, meritRank !== null ? t('result.meritRank') : t('result.batchRank'))}
        {statCard(vm.percentile, t('result.percentile'))}
        {statCard(vm.accuracy, t('result.accuracy'))}
      </div>

      {hasQualifyingSection && meritScore !== null && (
        <div style={{ marginTop: '10px', padding: '11px 14px', borderRadius: '14px', background: 'var(--card)', border: '1px solid var(--line)', font: '600 12px var(--font-body)', color: 'var(--muted)' }}>
          {t('result.meritScore')} <strong style={{ color: 'var(--tx)' }}>{fmt(meritScore)}</strong> — {t('result.meritNote')}
        </div>
      )}

      {/* Correct / wrong / skipped / time */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '14px', padding: '15px 16px', borderRadius: '16px', background: 'var(--card)', border: '1px solid var(--line)' }}>
        {countCell(vm.correct, t('result.correct'), 'var(--success)')}
        {countCell(vm.wrong, t('result.wrong'), 'var(--danger)')}
        {countCell(vm.skipped, t('result.skipped'))}
        {countCell(vm.time, t('result.time'))}
      </div>

      {/* Sectional performance against each cut-off */}
      {sectionBreakdown.length > 0 && (
        <>
          <h2 className="t-heading" style={{ margin: '22px 0 12px', color: 'var(--tx)' }}>{t('result.sectionWise')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sectionBreakdown.map((sec) => {
              const pctOf = sec.max_score > 0 ? Math.max(0, Math.min(100, (sec.score / sec.max_score) * 100)) : 0;
              const barred = sec.cutoff_marks != null;
              return (
                <div
                  key={sec.section_id}
                  style={{
                    padding: '14px 16px', borderRadius: '16px', background: 'var(--card)',
                    border: `1px solid ${barred ? (sec.cleared ? 'var(--success)' : 'var(--danger)') : 'var(--line)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span className="t-heading" style={{ fontSize: '13.5px', color: 'var(--tx)' }}>
                      {sec.title}
                      {sec.is_qualifying && (
                        <span className="t-overline" style={{ marginLeft: '8px', fontSize: '9px', color: 'var(--muted)' }}>{t('result.qualifyingOnly')}</span>
                      )}
                    </span>
                    <span className="t-num" style={{ fontSize: '13px', color: 'var(--tx)' }}>
                      {fmt(sec.score)} / {fmt(sec.max_score)}
                    </span>
                  </div>

                  <div style={{ position: 'relative', height: '8px', borderRadius: '999px', background: 'var(--line)', overflow: 'visible', marginTop: '9px' }}>
                    <div style={{ height: '100%', borderRadius: '999px', width: `${pctOf}%`, background: barred ? (sec.cleared ? 'var(--success)' : 'var(--danger)') : 'var(--primary)' }} />
                    {/* The bar the candidate had to clear, drawn where it falls. */}
                    {barred && sec.max_score > 0 && (
                      <span
                        title={`Cut-off ${sec.cutoff_marks}`}
                        style={{
                          position: 'absolute', top: '-3px', bottom: '-3px', width: '2px', background: 'var(--tx)',
                          left: `${Math.max(0, Math.min(100, (sec.cutoff_marks / sec.max_score) * 100))}%`,
                        }}
                      />
                    )}
                  </div>

                  <div style={{ marginTop: '8px', font: '600 11px var(--font-body)', color: 'var(--muted)' }}>
                    {t('result.breakdown', { correct: sec.correct, wrong: sec.incorrect, blank: sec.unanswered })}
                    {barred && (
                      <strong style={{ marginLeft: '8px', color: sec.cleared ? 'var(--success)' : 'var(--danger)' }}>
                        {sec.cleared ? t('result.cleared') : t('result.missed')} {t('result.cutoff')} {fmt(sec.cutoff_marks)}
                      </strong>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Subject-wise accuracy */}
      <h2 className="t-heading" style={{ margin: '22px 0 12px', color: 'var(--tx)' }}>{t('result.subjectWise')}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {bars.length === 0 && (
          <p style={{ font: '600 12px var(--font-body)', color: 'var(--muted)', margin: 0 }}>
            No subject breakdown recorded for this attempt.
          </p>
        )}
        {bars.map((b) => {
          /* One bar carries the primary — the strongest subject. The rest sit in
             the soft tint, so the eye lands on the comparison, not the rainbow. */
          const isPeak = barPeak !== null && b.pct === barPeak;
          return (
            <div key={b.k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--tx2)', minWidth: 0 }}>
                  {b.k}
                  {b.detail && <span style={{ font: '400 11px var(--font-body)', color: 'var(--muted)', marginLeft: '7px' }}>{b.detail}</span>}
                </span>
                <span className="t-num" style={{ fontSize: '12.5px', color: 'var(--tx)', flex: 'none' }}>{b.pct}%</span>
              </div>
              <div style={{ height: '8px', borderRadius: '999px', background: 'var(--line)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: '999px',
                    width: `${b.pct}%`,
                    background: isPeak ? 'var(--primary)' : 'var(--primary-soft)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button onClick={() => navigate('/student/test-series')} className="btn-secondary" style={{ flex: 1 }}>{t('result.retake')}</button>
        <button onClick={() => { const el = document.getElementById('answer-review'); el ? el.scrollIntoView({ behavior: 'smooth' }) : navigate('/results'); }} className="btn-primary" style={{ flex: 1 }}>{t('result.reviewAnswers')}</button>
      </div>

      {/* Question-by-question review (real sessions only) */}
      {answers.length > 0 && (
        <div id="answer-review" style={{ marginTop: '30px' }}>
          <h2 className="t-heading" style={{ marginBottom: '16px', color: 'var(--tx)' }}>{t('result.answerReview')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {answers.map((ans, idx) => {
              const isNumeric = ans.question_type === 'numeric';
              const isMulti = ans.question_type === 'multi_select';
              const isUnanswered = isNumeric
                ? ans.numeric_response === null || ans.numeric_response === undefined
                : isMulti
                  ? !ans.selected_option_ids || ans.selected_option_ids.length === 0
                  : ans.selected_option_id === null;
              const isCorrect = !isUnanswered && ans.is_correct;
              return (
                <div key={ans.question_id} className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid', borderLeftColor: isCorrect ? 'var(--success)' : isUnanswered ? 'var(--muted)' : 'var(--danger)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--tx)' }}>{t('exam.question')} {idx + 1}</span>
                    <span style={{ color: isCorrect ? 'var(--success-text)' : isUnanswered ? 'var(--muted)' : 'var(--danger-text)', fontWeight: 700, textTransform: 'uppercase' }}>{isCorrect ? t('result.correct') : isUnanswered ? t('result.skipped') : t('result.incorrect')}</span>
                  </div>

                  {ans.passage && (
                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--surf)', border: '1px solid var(--line)', marginBottom: '14px', maxHeight: '160px', overflowY: 'auto' }}>
                      {ans.passage.title && <div style={{ font: '700 12px var(--font-display)', letterSpacing: '-.02em', color: 'var(--tx)', marginBottom: '4px' }}>{ans.passage.title}</div>}
                      <div style={{ font: '500 12.5px/1.6 var(--font-body)', color: 'var(--tx2)', whiteSpace: 'pre-wrap' }}>{ans.passage.body}</div>
                    </div>
                  )}

                  <div style={{ fontSize: '1.02rem', lineHeight: 1.6, marginBottom: '16px', color: 'var(--tx)' }}><MathRenderer text={ans.question_text} /></div>

                  {isNumeric ? (
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                      <div style={{ padding: '10px 14px', borderRadius: '10px', background: isUnanswered ? 'var(--surf)' : isCorrect ? 'var(--success-bg)' : 'var(--danger-bg)', border: `1px solid ${isUnanswered ? 'var(--line)' : isCorrect ? 'var(--success-border)' : 'var(--danger-border)'}`, fontSize: '0.9rem', color: 'var(--tx)' }}>
                        <span style={{ color: 'var(--muted)', marginRight: '6px' }}>{t('result.yourAnswer')}</span>
                        <strong>{isUnanswered ? '—' : num(ans.numeric_response)}</strong>
                      </div>
                      <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', fontSize: '0.9rem', color: 'var(--tx)' }}>
                        <span style={{ color: 'var(--muted)', marginRight: '6px' }}>{t('result.accepted')}</span>
                        <strong>{num(ans.numeric_answer)}{Number(ans.numeric_tolerance) > 0 ? ` ± ${num(ans.numeric_tolerance)}` : ''}</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                      {isMulti && (
                        <div style={{ font: '700 11px var(--font-body)', color: '#8B5CF6', marginBottom: '2px' }}>{t('exam.selectAll')}</div>
                      )}
                      {ans.options.map((opt) => {
                        const wasSelected = isMulti
                          ? Array.isArray(ans.selected_option_ids) && ans.selected_option_ids.includes(opt.id)
                          : ans.selected_option_id === opt.id;
                        const isRight = opt.is_correct;
                        let bg = 'var(--surf)', border = 'var(--line)';
                        if (isRight) { bg = 'var(--success-bg)'; border = 'var(--success-border)'; }
                        else if (wasSelected) { bg = 'var(--danger-bg)'; border = 'var(--danger-border)'; }
                        return (
                          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: bg, border: `1px solid ${border}`, fontSize: '0.95rem', color: 'var(--tx)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: isMulti ? '6px' : '50%', background: isRight ? 'var(--success)' : wasSelected ? 'var(--danger)' : 'var(--surf)', color: '#fff', marginRight: '12px', fontWeight: 700, fontSize: '0.8rem' }}>{isMulti ? (wasSelected || isRight ? '✓' : opt.label) : opt.label}</span>
                            <span><MathRenderer text={opt.option_text} /></span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {ans.explanation && (
                    <div style={{ background: 'var(--surf)', border: '1px dashed var(--line2)', padding: '14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: '6px' }}>{t('result.explanation')}</div>
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
