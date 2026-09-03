import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  PageHead, TableCard, Toolbar, Chip, Table, Row, Cell, CellTitle, CellSub,
  EmptyState, SkeletonRows, Notice, Num, StatGrid, StatCard,
} from '../components/admin/ui';

/**
 * Cohort analytics — the owner view of a batch (TEST-SERIES-SPEC.md 4.5).
 *
 * Every number here is DERIVED on request from test_sessions + test_analytics.
 * There is no aggregate table, so a re-scored session (a corrected answer key,
 * a deleted attempt) is reflected the next time this page loads rather than
 * leaving a stale total behind.
 */
export default function AdminCohortAnalytics() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [tab, setTab] = useState('summary');

  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/admin/courses')
      .then((res) => {
        const rows = res.data.data || res.data || [];
        setCourses(rows);
        if (rows.length) setCourseId(String(rows[0].id));
      })
      .catch(() => setError('Failed to load courses.'));
  }, []);

  // Batches are nested under a course in this API, so the course has to be
  // chosen first.
  useEffect(() => {
    if (!courseId) {
      setBatches([]);
      setBatchId('');
      return;
    }
    api.get(`/api/admin/courses/${courseId}/batches`)
      .then((res) => {
        const rows = res.data.data || res.data || [];
        setBatches(rows);
        setBatchId(rows.length ? String(rows[0].id) : '');
      })
      .catch(() => setError('Failed to load batches.'));
  }, [courseId]);

  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    setError('');

    Promise.all([
      api.get(`/api/admin/batches/${batchId}/analytics`),
      api.get(`/api/admin/batches/${batchId}/students-progress`),
    ])
      .then(([a, p]) => {
        setSummary(a.data);
        setStudents(p.data.students || []);
      })
      .catch((e) => setError(e.response?.data?.message || 'Failed to load cohort analytics.'))
      .finally(() => setLoading(false));
  }, [batchId]);

  const pct = (n) => `${Number(n ?? 0).toFixed(1)}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <PageHead
        title="Cohort analytics"
        subtitle="How a batch is actually performing — participation, averages, the topics they are worst at, and every student’s progress through what you assigned them."
      >
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="form-input"
          aria-label="Course"
          style={{ minWidth: '190px', width: 'auto' }}
        >
          {courses.length === 0 && <option value="">No courses</option>}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <select
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          className="form-input"
          aria-label="Batch"
          style={{ minWidth: '190px', width: 'auto' }}
        >
          {batches.length === 0 && <option value="">No batches</option>}
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </PageHead>

      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Chip active={tab === 'summary'} onClick={() => setTab('summary')}>Batch summary</Chip>
        <Chip active={tab === 'students'} onClick={() => setTab('students')}>
          Students <Num style={{ color: 'inherit', fontSize: '11.5px' }}>{students.length}</Num>
        </Chip>
      </div>

      {loading ? (
        <TableCard><SkeletonRows rows={4} /></TableCard>
      ) : tab === 'summary' ? (
        <SummaryTab summary={summary} pct={pct} />
      ) : (
        <StudentsTab students={students} pct={pct} />
      )}
    </div>
  );
}

function SummaryTab({ summary, pct }) {
  if (!summary) {
    return (
      <TableCard>
        <EmptyState icon="chart" message="Pick a course and a batch to see how that cohort is doing." />
      </TableCard>
    );
  }

  const attemptRate =
    summary.enrolled_students > 0
      ? Math.round((summary.students_who_attempted / summary.enrolled_students) * 100)
      : null;

  return (
    <>
      <StatGrid>
        <StatCard
          icon="users"
          tone="primary"
          value={summary.enrolled_students}
          label="ENROLLED"
          note={attemptRate === null ? 'Nobody enrolled yet' : `${attemptRate}% have attempted something`}
        />
        <StatCard
          icon="activity"
          tone="success"
          value={summary.total_attempts}
          label="TOTAL ATTEMPTS"
          note={`${summary.students_who_attempted} students submitted at least one paper`}
        />
        <StatCard
          icon="chart"
          tone="ai"
          value={Number(summary.average_score ?? 0).toFixed(2)}
          label="AVERAGE SCORE"
          note={`${pct(summary.average_accuracy)} average accuracy`}
        />
        <StatCard
          icon="check-circle"
          tone={summary.qualified_attempts > 0 ? 'success' : 'reward'}
          value={summary.qualified_attempts}
          label="QUALIFIED ATTEMPTS"
          note="Attempts that cleared every cut-off"
        />
      </StatGrid>

      {summary.students_who_attempted === 0 && summary.enrolled_students > 0 && (
        <div style={{ marginTop: '16px' }}>
          <Notice tone="reward" icon="alert">
            Nobody in this batch has submitted a paper yet — every average below stays empty until they do.
          </Notice>
        </div>
      )}

      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <WeakList title="Weakest topics" rows={summary.weak_topics} pct={pct} />
        <WeakList title="Weakest subjects" rows={summary.weak_subjects} pct={pct} />
      </div>
    </>
  );
}

/**
 * Worst accuracy first. Only keys with real attempts appear, so a topic nobody
 * reached is not reported as one the cohort is bad at.
 */
function WeakList({ title, rows, pct }) {
  const list = rows || [];
  // Exactly one bar is highlighted: the worst one, which is the point of the list.
  const worst = list.length ? Math.min(...list.map((r) => Number(r.accuracy ?? 0))) : null;

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '20px', padding: '20px 22px' }}>
      <h3 className="t-heading" style={{ margin: 0, color: 'var(--tx)' }}>{title}</h3>
      <p style={{ margin: '5px 0 16px', font: '400 12.5px/1.55 var(--font-body)', color: 'var(--muted)', maxWidth: '70ch' }}>
        Ranked by accuracy over attempted questions — skipped questions are excluded, since skipping is a strategy
        under negative marking rather than a wrong answer.
      </p>

      {list.length === 0 ? (
        <p style={{ margin: 0, font: '400 13px var(--font-body)', color: 'var(--muted)' }}>No attempt data yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
          {list.map((r) => {
            const acc = Number(r.accuracy ?? 0);
            const isWorst = worst !== null && acc === worst;
            return (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    width: '34%',
                    minWidth: 0,
                    font: '500 12.5px var(--font-body)',
                    color: 'var(--tx2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.key}
                </span>
                <span style={{ flex: 1, height: '8px', borderRadius: '99px', background: 'var(--line)', overflow: 'hidden' }}>
                  <span
                    style={{
                      display: 'block',
                      width: `${Math.max(0, Math.min(100, acc))}%`,
                      height: '100%',
                      borderRadius: '99px',
                      background: isWorst ? 'var(--primary)' : 'var(--primary-soft)',
                    }}
                  />
                </span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flex: 'none' }}>
                  <Num style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--muted)' }}>
                    {r.correct}/{r.attempted}
                  </Num>
                  <Num style={{ width: '52px', textAlign: 'right', fontSize: '12.5px', color: 'var(--tx)' }}>
                    {pct(r.accuracy)}
                  </Num>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudentsTab({ students, pct }) {
  const COLUMNS = [
    { key: 'student', label: 'Student', width: 'minmax(0,1.5fr)' },
    { key: 'progress', label: 'Progress', width: 'minmax(160px,1.2fr)' },
    { key: 'score', label: 'Avg score', width: '110px', align: 'right' },
    { key: 'acc', label: 'Avg accuracy', width: '120px', align: 'right', hideBelow: 'tablet' },
    { key: 'last', label: 'Last active', width: '120px', align: 'right', hideBelow: 'tablet' },
  ];

  return (
    <TableCard>
      <Toolbar
        trailing={
          students.length > 0 && (
            <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
              <Num>{students.length}</Num> enrolled
            </span>
          )
        }
      >
        <span style={{ font: '600 12.5px var(--font-body)', color: 'var(--tx2)' }}>Active enrolments</span>
      </Toolbar>

      {students.length === 0 ? (
        <EmptyState icon="users" message="No active enrolments in this batch yet." />
      ) : (
        <Table columns={COLUMNS}>
          {students.map((s) => (
            <Row key={s.user_id}>
              <Cell label="Student">
                <CellTitle>{s.name || '—'}</CellTitle>
                <CellSub>{s.email}</CellSub>
              </Cell>
              <Cell label="Progress">
                <span style={{ display: 'block', width: '100%' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <Num style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--muted)' }}>
                      {s.tests_completed} / {s.tests_assigned}
                    </Num>
                    <Num style={{ fontSize: '11.5px', color: 'var(--tx2)' }}>{pct(s.completion_percentage)}</Num>
                  </span>
                  <span style={{ display: 'block', height: '6px', borderRadius: '99px', background: 'var(--line)', overflow: 'hidden' }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        borderRadius: '99px',
                        width: `${Math.max(0, Math.min(100, Number(s.completion_percentage ?? 0)))}%`,
                        background: 'var(--primary)',
                      }}
                    />
                  </span>
                </span>
              </Cell>
              {/* null, not 0: a student who has attempted nothing has no average,
                  and printing 0 would read as "scored zero". */}
              <Cell label="Avg score" align="right">
                {s.average_score == null ? (
                  <span style={{ color: 'var(--muted)' }}>—</span>
                ) : (
                  <Num style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>
                    {Number(s.average_score).toFixed(2)}
                  </Num>
                )}
              </Cell>
              <Cell label="Avg accuracy" align="right" hideBelow="tablet">
                {s.average_accuracy == null ? (
                  <span style={{ color: 'var(--muted)' }}>—</span>
                ) : (
                  <Num style={{ fontSize: '13px' }}>{pct(s.average_accuracy)}</Num>
                )}
              </Cell>
              <Cell label="Last active" align="right" hideBelow="tablet">
                <span style={{ font: '500 12px var(--font-body)', color: 'var(--muted)' }}>
                  {s.last_active_at ? new Date(s.last_active_at).toLocaleDateString() : 'Never'}
                </span>
              </Cell>
            </Row>
          ))}
        </Table>
      )}
    </TableCard>
  );
}
