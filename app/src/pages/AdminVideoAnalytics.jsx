import React, { useEffect, useState } from 'react';
import api from '../api';
import {
  PageHead, TableCard, Toolbar, Chip, Table, Row, Cell, CellTitle, CellSub,
  EmptyState, SkeletonRows, Notice, Num, StatGrid, StatCard, MeterRow,
} from '../components/admin/ui';

/**
 * Video engagement — the owner view of a course's lessons.
 *
 * `lesson_progress` has been written on every lesson view since the LMS
 * shipped (LessonPlayer posts watched_seconds every 15s), but nothing on the
 * admin side ever read it back in aggregate. This is the first view of it:
 * per-lesson start rate, completion rate and average watched percentage,
 * derived on request from the same table CourseOutline reads one row of at a
 * time for a single student.
 *
 * Same shape as AdminCohortAnalytics: no aggregate table, so a corrected
 * lesson duration or a new enrollment shows up on the next load rather than
 * behind a stale number.
 */
export default function AdminVideoAnalytics() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [tab, setTab] = useState('lessons');

  const [data, setData] = useState(null);
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

  // "All batches" is a real option here — a course-wide view is usually what
  // an owner wants first, unlike cohort analytics which is batch-first.
  useEffect(() => {
    if (!courseId) {
      setBatches([]);
      setBatchId('');
      return;
    }
    api.get(`/api/admin/courses/${courseId}/batches`)
      .then((res) => setBatches(res.data.data || res.data || []))
      .catch(() => setError('Failed to load batches.'));
    setBatchId('');
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    setError('');

    const url = `/api/admin/courses/${courseId}/video-analytics${batchId ? `?batch_id=${batchId}` : ''}`;
    api.get(url)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load video analytics.'))
      .finally(() => setLoading(false));
  }, [courseId, batchId]);

  const pct = (n) => `${Number(n ?? 0).toFixed(1)}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <PageHead
        title="Video engagement"
        subtitle="Which lessons students actually finish, and which ones they open and abandon — derived live from every watch session, not a separate report that can drift out of date."
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
          style={{ minWidth: '170px', width: 'auto' }}
        >
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </PageHead>

      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Chip active={tab === 'lessons'} onClick={() => setTab('lessons')}>
          By lesson <Num style={{ color: 'inherit', fontSize: '11.5px' }}>{data?.lessons?.length ?? 0}</Num>
        </Chip>
        <Chip active={tab === 'dropoff'} onClick={() => setTab('dropoff')}>Where students drop off</Chip>
      </div>

      {loading ? (
        <TableCard><SkeletonRows rows={4} /></TableCard>
      ) : !data || data.total_lessons === 0 ? (
        <TableCard>
          <EmptyState
            icon="activity"
            message={!courseId ? 'Pick a course to see how its lessons are being watched.' : 'This course has no lessons yet.'}
          />
        </TableCard>
      ) : (
        <>
          <StatGrid>
            <StatCard
              icon="users"
              tone="primary"
              value={data.enrolled_students}
              label="ENROLLED"
              note={`${data.students_who_watched_anything} have opened at least one lesson`}
            />
            <StatCard
              icon="play"
              tone="ai"
              value={data.total_lessons}
              label="LESSONS"
              note="in this course"
            />
            <StatCard
              icon="chart"
              tone="success"
              value={pct(data.average_course_completion)}
              label="AVG. COMPLETION"
              note="mean completion rate across all lessons"
              noteTone={data.average_course_completion >= 50 ? 'success' : 'reward'}
            />
          </StatGrid>

          {data.enrolled_students > 0 && data.students_who_watched_anything === 0 && (
            <div style={{ marginTop: '16px' }}>
              <Notice tone="reward" icon="alert">
                Nobody enrolled in this {batchId ? 'batch' : 'course'} has opened a lesson yet — every rate below stays at 0% until they do.
              </Notice>
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            {tab === 'lessons' ? (
              <LessonTable lessons={data.lessons} pct={pct} />
            ) : (
              <DropoffList lessons={data.weakest_lessons} pct={pct} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LessonTable({ lessons, pct }) {
  const COLUMNS = [
    { key: 'lesson', label: 'Lesson', width: 'minmax(0,1.6fr)' },
    { key: 'duration', label: 'Length', width: '90px', align: 'right', hideBelow: 'tablet' },
    { key: 'started', label: 'Started', width: '110px', align: 'right' },
    { key: 'completed', label: 'Completed', width: '150px' },
    { key: 'avgwatch', label: 'Avg. watched', width: '110px', align: 'right', hideBelow: 'tablet' },
  ];

  const formatDuration = (s) => {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  return (
    <TableCard>
      <Toolbar>
        <span style={{ font: '600 12.5px var(--font-body)', color: 'var(--tx2)' }}>Every lesson, in syllabus order</span>
      </Toolbar>

      {lessons.length === 0 ? (
        <EmptyState icon="play" message="No lessons in this course yet." />
      ) : (
        <Table columns={COLUMNS}>
          {lessons.map((l) => (
            <Row key={l.lesson_id}>
              <Cell label="Lesson">
                <CellTitle>{l.title}</CellTitle>
                {l.module && <CellSub>{l.module}</CellSub>}
              </Cell>
              <Cell label="Length" align="right" hideBelow="tablet">
                <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                  {formatDuration(l.duration_seconds)}
                </span>
              </Cell>
              <Cell label="Started" align="right">
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                  <Num style={{ fontSize: '13px', color: 'var(--tx)' }}>{pct(l.start_rate)}</Num>
                  <span style={{ font: '500 11px var(--font-body)', color: 'var(--muted)' }}>
                    {l.students_started}/{l.enrolled_students}
                  </span>
                </span>
              </Cell>
              <Cell label="Completed">
                <MeterRow
                  label=""
                  value={l.completion_rate}
                  highlight={l.completion_rate >= 50}
                />
              </Cell>
              <Cell label="Avg. watched" align="right" hideBelow="tablet">
                {l.average_watched_percentage == null ? (
                  <span style={{ color: 'var(--muted)' }}>—</span>
                ) : (
                  <Num style={{ fontSize: '12.5px' }}>{pct(l.average_watched_percentage)}</Num>
                )}
              </Cell>
            </Row>
          ))}
        </Table>
      )}
    </TableCard>
  );
}

/**
 * The single most actionable view here: which lesson the cohort is actually
 * giving up on, worst first. A start rate near 100% next to a completion
 * rate near 0% is a specific, fixable signal ("they open it and bail") that a
 * flat table full of every lesson makes easy to scroll past.
 */
function DropoffList({ lessons, pct }) {
  if (!lessons || lessons.length === 0) {
    return (
      <TableCard>
        <EmptyState icon="chart" message="Not enough watch data yet to tell where students drop off." />
      </TableCard>
    );
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '20px', padding: '20px 22px' }}>
      <h3 className="t-heading" style={{ margin: 0, color: 'var(--tx)' }}>Lowest completion, worst first</h3>
      <p style={{ margin: '5px 0 16px', font: '400 12.5px/1.55 var(--font-body)', color: 'var(--muted)', maxWidth: '70ch' }}>
        Completion is measured against everyone ENROLLED, not just students who pressed play — a lesson nobody
        opens at all is exactly the drop-off this list exists to surface.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {lessons.map((l) => {
          const gap = Math.max(0, l.start_rate - l.completion_rate);
          return (
            <div key={l.lesson_id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ font: '600 13px var(--font-body)', color: 'var(--tx)' }}>{l.title}</span>
                {gap >= 20 && (
                  <span style={{ font: '600 11px var(--font-body)', color: 'var(--danger)' }}>
                    {pct(gap)} start-to-finish gap
                  </span>
                )}
              </div>
              <MeterRow label="Started" value={l.start_rate} />
              <MeterRow label="Completed" value={l.completion_rate} highlight />
            </div>
          );
        })}
      </div>
    </div>
  );
}
