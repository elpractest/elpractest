import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  PageHead, TableCard, Toolbar, Table, Row, Cell, CellTitle, CellSub, RowChevron,
  EmptyState, SkeletonRows, Pagination, Field, Notice, Num,
} from '../components/admin/ui';

export default function AdminResults({ onViewDetail }) {
  const [results, setResults] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [tests, setTests] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination & Filters State
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterTestId, setFilterTestId] = useState('');

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        course_id: filterCourseId,
        batch_id: filterBatchId,
        test_id: filterTestId
      };
      const res = await api.get('/api/admin/results', { params });
      setResults(res.data.data || res.data);
      setLastPage(res.data.last_page || 1);
    } catch (e) {
      setError('Failed to fetch test results.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiltersOptions = async () => {
    try {
      const cRes = await api.get('/api/admin/courses');
      setCourses(cRes.data);

      const tRes = await api.get('/api/admin/tests');
      setTests(tRes.data.data || tRes.data);
    } catch (e) {}
  };

  const fetchBatchesForCourse = async (courseId) => {
    if (!courseId) {
      setBatches([]);
      return;
    }
    try {
      const res = await api.get(`/api/admin/courses/${courseId}/batches`);
      setBatches(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchFiltersOptions();
  }, []);

  useEffect(() => {
    fetchResults();
  }, [page, filterCourseId, filterBatchId, filterTestId]);

  useEffect(() => {
    fetchBatchesForCourse(filterCourseId);
    setFilterBatchId('');
  }, [filterCourseId]);

  const COLUMNS = [
    { key: 'student', label: 'Student', width: 'minmax(0,1.4fr)' },
    { key: 'test', label: 'Test', width: 'minmax(0,1.4fr)' },
    { key: 'submitted', label: 'Submitted', width: '150px', hideBelow: 'tablet' },
    { key: 'score', label: 'Score', width: '120px' },
    { key: 'accuracy', label: 'Accuracy', width: '90px', hideBelow: 'tablet' },
    { key: 'rank', label: 'Rank', width: '110px', hideBelow: 'tablet' },
    { key: 'go', label: '', width: '32px' },
  ];

  const hasFilters = !!(filterCourseId || filterBatchId || filterTestId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>

      <PageHead
        title="Results"
        subtitle="Every submitted attempt, with the cohort rank and accuracy it earned. Open a row for the full scorecard."
      />

      {error && <Notice tone="danger" icon="alert">{error}</Notice>}

      {/* Filters */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <Field label="Course" htmlFor="res-course">
            <select
              id="res-course"
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              className="form-input"
            >
              <option value="">All courses</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Field>

          <Field label="Batch" htmlFor="res-batch">
            <select
              id="res-batch"
              value={filterBatchId}
              onChange={(e) => setFilterBatchId(e.target.value)}
              className="form-input"
              disabled={!filterCourseId}
            >
              <option value="">All batches</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>

          <Field label="Test" htmlFor="res-test">
            <select
              id="res-test"
              value={filterTestId}
              onChange={(e) => setFilterTestId(e.target.value)}
              className="form-input"
            >
              <option value="">All tests</option>
              {tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Results table */}
      <TableCard>
        <Toolbar
          trailing={
            !loading && (
              <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <Num>{results.length}</Num> on this page
              </span>
            )
          }
        >
          <span style={{ font: '600 12.5px var(--font-body)', color: 'var(--tx2)' }}>
            {hasFilters ? 'Filtered attempts' : 'All attempts'}
          </span>
        </Toolbar>

        {loading && results.length === 0 ? (
          <SkeletonRows />
        ) : results.length === 0 ? (
          <EmptyState
            icon="chart"
            message={
              hasFilters
                ? 'No completed attempts match these filters. Clear one to widen the search.'
                : 'No test has been submitted yet. Results appear here the moment a student submits.'
            }
          />
        ) : (
          <>
            <Table columns={COLUMNS}>
              {results.map((res) => (
                <Row key={res.id} onClick={() => onViewDetail(res.id)}>
                  <Cell label="Student">
                    <CellTitle>{res.user?.name}</CellTitle>
                    <CellSub>{res.user?.email}</CellSub>
                  </Cell>
                  <Cell label="Test">
                    <CellTitle>{res.test?.title}</CellTitle>
                    <CellSub>{res.test?.course?.title}</CellSub>
                  </Cell>
                  <Cell label="Submitted" hideBelow="tablet">
                    <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--tx2)' }}>
                      {res.submitted_at ? new Date(res.submitted_at).toLocaleDateString() : '—'}
                    </span>
                  </Cell>
                  <Cell label="Score">
                    <Num style={{ fontSize: '13.5px', fontWeight: 700 }}>
                      {parseFloat(res.analytic?.total_score || 0).toFixed(2)}
                    </Num>
                    <span style={{ font: '500 11.5px var(--font-mono)', color: 'var(--muted)', marginLeft: '4px' }}>
                      / {parseFloat(res.analytic?.max_score || 0).toFixed(2)}
                    </span>
                  </Cell>
                  <Cell label="Accuracy" hideBelow="tablet">
                    <Num style={{ fontSize: '13px' }}>
                      {parseFloat(res.analytic?.accuracy_percentage || 0).toFixed(1)}%
                    </Num>
                  </Cell>
                  <Cell label="Rank" hideBelow="tablet">
                    <Num style={{ fontSize: '13px' }}>#{res.rank}</Num>
                    <CellSub>{parseFloat(res.percentile).toFixed(1)} pct</CellSub>
                  </Cell>
                  <Cell align="right">
                    <RowChevron onClick={() => onViewDetail(res.id)} label="Open scorecard" />
                  </Cell>
                </Row>
              ))}
            </Table>
            <Pagination page={page} lastPage={lastPage} onPage={setPage} />
          </>
        )}
      </TableCard>
    </div>
  );
}
