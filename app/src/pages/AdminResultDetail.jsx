import React, { useState, useEffect } from 'react';
import katex from 'katex';
import api from '../api';
import Icon from '../components/Icon';
import {
  TableCard, Table, Row, Cell, StatGrid, StatCard, EmptyState, SkeletonRows,
  Notice, Num, Badge, StatusDot,
} from '../components/admin/ui';
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
  const [meritRank, setMeritRank] = useState(null);
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
        setMeritRank(res.data.merit_rank ?? null);
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="skeleton" style={{ height: '96px', borderRadius: '18px' }} />
        <TableCard><SkeletonRows rows={4} /></TableCard>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px' }}>
        <Notice tone="danger" icon="alert">{error}</Notice>
        <div>
          <button type="button" onClick={onBack} className="btn-primary">
            <Icon name="arrow-left" size={16} />
            Back to results
          </button>
        </div>
      </div>
    );
  }

  const totalAttempted = (analytic?.correct_count || 0) + (analytic?.incorrect_count || 0);

  const SECTION_COLUMNS = [
    { key: 'sec', label: 'Section', width: 'minmax(0,1.4fr)' },
    { key: 'score', label: 'Score', width: '140px', align: 'right' },
    { key: 'cut', label: 'Cut-off', width: '100px', align: 'right', hideBelow: 'tablet' },
    { key: 'cwb', label: 'C / W / Blank', width: '130px', align: 'right', hideBelow: 'tablet' },
    { key: 'res', label: 'Result', width: '110px', align: 'right' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>

      <div>
        <button
          type="button"
          onClick={onBack}
          className="btn-secondary"
          style={{ padding: '8px 14px', minHeight: '40px', fontSize: '12.5px', marginBottom: '14px' }}
        >
          <Icon name="arrow-left" size={16} />
          Back to results
        </button>
        <h1 className="t-title" style={{ margin: 0, color: 'var(--tx)' }}>Attempt scorecard</h1>
        <p style={{ margin: '6px 0 0', font: '400 13.5px/1.55 var(--font-body)', color: 'var(--muted)', maxWidth: '70ch' }}>
          The full answer key for this session, with the cohort rank it earned.
        </p>
      </div>

      {analytic && (
        <StatGrid>
          <StatCard
            icon="chart"
            tone="primary"
            value={parseFloat(analytic.total_score || 0).toFixed(2)}
            label="SCORE"
            note={`out of ${parseFloat(analytic.max_score || 0).toFixed(2)}`}
          />
          <StatCard
            icon="trophy"
            tone="ai"
            value={`${parseFloat(percentile).toFixed(1)}%`}
            label="PERCENTILE"
            note={`Cohort rank #${rank}${meritRank !== null ? ` · merit #${meritRank}` : ''}`}
          />
          <StatCard
            icon="target"
            tone="success"
            value={`${parseFloat(analytic.accuracy_percentage || 0).toFixed(1)}%`}
            label="ACCURACY"
            note={`${totalAttempted} questions attempted`}
          />
          <StatCard
            icon="check-circle"
            tone={
              analytic.is_qualified === null || analytic.is_qualified === undefined
                ? 'neutral'
                : analytic.is_qualified
                  ? 'success'
                  : 'danger'
            }
            value={analytic.correct_count}
            label="CORRECT"
            note={`${analytic.incorrect_count} wrong · ${analytic.unanswered_count} blank`}
          />
        </StatGrid>
      )}

      {/* the cut-off verdict deserves a line of its own, not a stat tile */}
      {analytic && analytic.is_qualified !== null && analytic.is_qualified !== undefined && (
        <Notice tone={analytic.is_qualified ? 'success' : 'danger'} icon={analytic.is_qualified ? 'check-circle' : 'alert'}>
          {analytic.is_qualified ? 'Cleared every cut-off on this paper.' : 'Missed at least one cut-off on this paper.'}
          {analytic.normalized_score != null && (
            <> Normalised score <Num style={{ color: 'inherit' }}>{parseFloat(analytic.normalized_score).toFixed(2)}</Num>.</>
          )}
        </Notice>
      )}

      {/* Sectional result: which bars this candidate cleared */}
      {analytic?.section_breakdown?.length > 0 && (
        <TableCard>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <h2 className="t-heading" style={{ margin: 0, color: 'var(--tx)' }}>Section-wise result</h2>
            <p style={{ margin: '5px 0 0', font: '400 12.5px/1.55 var(--font-body)', color: 'var(--muted)', maxWidth: '70ch' }}>
              A qualifying section must be cleared, but its marks are excluded from the merit score.
            </p>
          </div>
          <Table columns={SECTION_COLUMNS}>
            {analytic.section_breakdown.map((sec) => (
              <Row key={sec.section_id}>
                <Cell label="Section">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ font: '600 13px var(--font-body)', color: 'var(--tx)' }}>{sec.title}</span>
                    {sec.is_qualifying && <Badge tone="neutral">Qualifying</Badge>}
                  </span>
                </Cell>
                <Cell label="Score" align="right">
                  <Num style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>
                    {Number(sec.score).toFixed(2)}
                  </Num>
                  <span style={{ font: '500 12px var(--font-mono)', color: 'var(--muted)' }}> / {Number(sec.max_score).toFixed(2)}</span>
                </Cell>
                <Cell label="Cut-off" align="right" hideBelow="tablet">
                  {sec.cutoff_marks == null ? (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  ) : (
                    <Num style={{ fontSize: '12.5px', color: 'var(--tx2)' }}>{Number(sec.cutoff_marks).toFixed(2)}</Num>
                  )}
                </Cell>
                <Cell label="C / W / Blank" align="right" hideBelow="tablet">
                  <Num style={{ fontSize: '12.5px', color: 'var(--tx2)' }}>
                    {sec.correct} / {sec.incorrect} / {sec.unanswered}
                  </Num>
                </Cell>
                <Cell label="Result" align="right">
                  {sec.cutoff_marks == null ? (
                    <StatusDot tone="neutral">No bar</StatusDot>
                  ) : (
                    <StatusDot tone={sec.cleared ? 'success' : 'danger'}>{sec.cleared ? 'Cleared' : 'Missed'}</StatusDot>
                  )}
                </Cell>
              </Row>
            ))}
          </Table>
        </TableCard>
      )}

      {/* Question-by-question review */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '20px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <h2 className="t-heading" style={{ margin: 0, color: 'var(--tx)' }}>Question-by-question review</h2>
        </div>

        {answers.length === 0 ? (
          <EmptyState icon="file-text" message="No question attempts were logged for this session." />
        ) : (
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {answers.map((ans, idx) => {
              const isCorrect = ans.is_correct;
              const isSkipped = ans.selected_option_id === null;

              return (
                <div
                  key={ans.question_id}
                  style={{
                    padding: '20px',
                    border: `1px solid ${isSkipped ? 'var(--line)' : isCorrect ? 'var(--success-border)' : 'var(--danger-border)'}`,
                    background: 'var(--card)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ font: '700 15px var(--font-display)', letterSpacing: '-.02em', color: 'var(--tx)' }}>
                      Question {idx + 1}
                    </span>
                    <StatusDot tone={isSkipped ? 'neutral' : isCorrect ? 'success' : 'danger'}>
                      {isSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Incorrect'}
                    </StatusDot>
                  </div>

                  <div style={{ font: '400 15px/1.62 var(--font-body)', color: 'var(--tx)', maxWidth: '70ch' }}>
                    <MathRenderer text={ans.question_text} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    {ans.options?.map((opt) => {
                      const isOptionSelected = opt.id === ans.selected_option_id;
                      const isOptionCorrect = opt.is_correct;

                      const border = isOptionCorrect
                        ? '1.5px solid var(--success)'
                        : isOptionSelected
                          ? '1.5px solid var(--danger)'
                          : '1.5px solid var(--line)';
                      const bg = isOptionCorrect
                        ? 'var(--success-bg)'
                        : isOptionSelected
                          ? 'var(--danger-bg)'
                          : 'var(--card)';
                      const badgeBg = isOptionCorrect
                        ? 'var(--success)'
                        : isOptionSelected
                          ? 'var(--danger)'
                          : 'transparent';

                      return (
                        <div
                          key={opt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '13px',
                            width: '100%',
                            padding: '13px 15px',
                            background: bg,
                            border,
                            borderRadius: '14px',
                            font: '400 14px var(--font-body)',
                            color: 'var(--tx)',
                          }}
                        >
                          <span
                            style={{
                              display: 'grid',
                              placeItems: 'center',
                              width: '28px',
                              height: '28px',
                              flex: 'none',
                              borderRadius: '50%',
                              background: badgeBg,
                              border: badgeBg === 'transparent' ? '1.5px solid var(--line2)' : 'none',
                              color: badgeBg === 'transparent' ? 'var(--muted)' : '#fff',
                              font: '600 12.5px var(--font-body)',
                            }}
                          >
                            {opt.label}
                          </span>
                          <MathRenderer text={opt.option_text} />
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap',
                      borderTop: '1px solid var(--line)',
                      paddingTop: '12px',
                    }}
                  >
                    <Badge tone="success" mono>+{Number(ans.marks).toFixed(2)}</Badge>
                    <Badge tone="danger" mono>−{Number(ans.negative_marks).toFixed(2)}</Badge>
                    <Badge tone="neutral" mono>{ans.time_spent_seconds}s</Badge>
                  </div>

                  {ans.explanation && (
                    <div
                      style={{
                        padding: '14px 16px',
                        background: 'var(--primary-soft)',
                        borderLeft: '3px solid var(--primary)',
                        borderRadius: '0 12px 12px 0',
                      }}
                    >
                      <div className="t-overline" style={{ color: 'var(--primary)', marginBottom: '7px' }}>EXPLANATION</div>
                      <div style={{ font: '400 13.5px/1.6 var(--font-body)', color: 'var(--tx2)' }}>
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
