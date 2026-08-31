import React, { useState, useEffect } from 'react';
import api from '../api';

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 800 }}>Cohort Analytics</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            How a batch is actually performing — participation, averages, the topics they are
            worst at, and every student&apos;s progress through what you assigned them.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="form-input"
            style={{ padding: '8px 12px', fontSize: '0.9rem', minWidth: '200px' }}
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
            style={{ padding: '8px 12px', fontSize: '0.9rem', minWidth: '200px' }}
          >
            {batches.length === 0 && <option value="">No batches</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '16px', color: 'var(--danger)' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        {[
          { id: 'summary', label: 'Batch summary' },
          { id: 'students', label: `Students (${students.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={tab === t.id ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '7px 16px', fontSize: '0.85rem' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading cohort analytics…
        </div>
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
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Pick a batch to see its analytics.
      </div>
    );
  }

  const stats = [
    { label: 'Enrolled', value: summary.enrolled_students },
    { label: 'Attempted', value: summary.students_who_attempted, hint: 'students with at least one submitted paper' },
    { label: 'Total attempts', value: summary.total_attempts },
    { label: 'Average score', value: Number(summary.average_score ?? 0).toFixed(2) },
    { label: 'Average accuracy', value: pct(summary.average_accuracy) },
    { label: 'Qualified attempts', value: summary.qualified_attempts, hint: 'cleared every cut-off' },
  ];

  return (
    <>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '14px' }}>
          {stats.map((s) => (
            <div key={s.label} style={{ padding: '14px', borderRadius: '10px', background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{s.label.toUpperCase()}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '2px' }}>{s.value}</div>
              {s.hint && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{s.hint}</div>}
            </div>
          ))}
        </div>
        {summary.students_who_attempted === 0 && summary.enrolled_students > 0 && (
          <p style={{ margin: '16px 0 0', fontSize: '0.82rem', color: 'var(--warning)' }}>
            Nobody in this batch has submitted a paper yet — the averages below will stay empty
            until they do.
          </p>
        )}
      </div>

      <WeakList title="Weakest topics" rows={summary.weak_topics} pct={pct} />
      <WeakList title="Weakest subjects" rows={summary.weak_subjects} pct={pct} />
    </>
  );
}

/**
 * Worst accuracy first. Only keys with real attempts appear, so a topic nobody
 * reached is not reported as one the cohort is bad at.
 */
function WeakList({ title, rows, pct }) {
  const list = rows || [];
  return (
    <div className="glass-panel" style={{ padding: '24px', marginBottom: '18px' }}>
      <h3 style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '1rem' }}>{title}</h3>
      <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        Ranked by accuracy over attempted questions — skipped questions are excluded, since
        skipping is a strategy under negative marking rather than a wrong answer.
      </p>
      {list.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>No attempt data yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          {list.map((r) => (
            <div key={r.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>{r.key}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {r.correct}/{r.attempted} · <strong style={{ color: r.accuracy < 40 ? 'var(--danger)' : r.accuracy < 70 ? 'var(--warning)' : 'var(--success)' }}>{pct(r.accuracy)}</strong>
                </span>
              </div>
              <div style={{ height: '7px', borderRadius: '999px', background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '999px', width: `${r.accuracy}%`,
                  background: r.accuracy < 40 ? 'var(--danger)' : r.accuracy < 70 ? 'var(--warning)' : 'var(--success)',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentsTab({ students, pct }) {
  if (students.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No active enrolments in this batch.
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <th style={{ padding: '12px 16px' }}>Student</th>
            <th style={{ padding: '12px 16px' }}>Progress</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Avg score</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Avg accuracy</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Last active</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.user_id} style={{ borderBottom: '1px solid var(--surface-2)', fontSize: '0.88rem' }}>
              <td style={{ padding: '14px 16px' }}>
                <div style={{ fontWeight: 600 }}>{s.name || '—'}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.email}</div>
              </td>
              <td style={{ padding: '14px 16px', minWidth: '180px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>{s.tests_completed} / {s.tests_assigned}</span>
                  <span>{pct(s.completion_percentage)}</span>
                </div>
                <div style={{ height: '6px', borderRadius: '999px', background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '999px', width: `${s.completion_percentage}%`, background: 'var(--accent-color)' }} />
                </div>
              </td>
              {/* null, not 0: a student who has attempted nothing has no average,
                  and printing 0 would read as "scored zero". */}
              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700 }}>
                {s.average_score == null ? <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>—</span> : Number(s.average_score).toFixed(2)}
              </td>
              <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                {s.average_accuracy == null ? <span style={{ color: 'var(--text-secondary)' }}>—</span> : pct(s.average_accuracy)}
              </td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {s.last_active_at ? new Date(s.last_active_at).toLocaleDateString() : 'never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
