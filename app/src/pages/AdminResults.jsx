import React, { useState, useEffect } from 'react';
import api from '../api';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Title Header */}
      <div>
        <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>Results Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Monitor student performance, cohort ranks, accuracy rates, and scorecard reviews.</p>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Filter panel */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px 0', fontWeight: 700 }}>Filter Test Session Results</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Course</label>
            <select 
              value={filterCourseId} 
              onChange={(e) => setFilterCourseId(e.target.value)} 
              className="form-input"
              style={{ padding: '10px 12px', fontSize: '0.9rem' }}
            >
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Batch</label>
            <select 
              value={filterBatchId} 
              onChange={(e) => setFilterBatchId(e.target.value)} 
              className="form-input"
              style={{ padding: '10px 12px', fontSize: '0.9rem' }}
              disabled={!filterCourseId}
            >
              <option value="">All Batches</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Test</label>
            <select 
              value={filterTestId} 
              onChange={(e) => setFilterTestId(e.target.value)} 
              className="form-input"
              style={{ padding: '10px 12px', fontSize: '0.9rem' }}
            >
              <option value="">All Tests</option>
              {tests.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>

        </div>
      </div>

      {/* Results Table */}
      <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <th style={{ padding: '12px 16px' }}>Student Details</th>
              <th style={{ padding: '12px 16px' }}>Test Name</th>
              <th style={{ padding: '12px 16px' }}>Submitted At</th>
              <th style={{ padding: '12px 16px' }}>Score</th>
              <th style={{ padding: '12px 16px' }}>Accuracy</th>
              <th style={{ padding: '12px 16px' }}>Batch Rank</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && results.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading session results...</td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No completed test attempts match the filters.</td>
              </tr>
            ) : (
              results.map((res) => (
                <tr key={res.id} style={{ borderBottom: '1px solid var(--surface-2)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600 }}>{res.user?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{res.user?.email}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600 }}>{res.test?.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Course: {res.test?.course?.title}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {new Date(res.submitted_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent-color)', fontSize: '1rem' }}>
                      {parseFloat(res.analytic?.total_score || 0).toFixed(2)}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '4px' }}>
                      / {parseFloat(res.analytic?.max_score || 0).toFixed(2)}
                    </span>
                  </td>
                  <td style={{ padding: '16px', fontWeight: 'bold', color: 'var(--success)' }}>
                    {parseFloat(res.analytic?.accuracy_percentage || 0).toFixed(1)}%
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 'bold' }}>Rank #{res.rank}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Percentile: {parseFloat(res.percentile).toFixed(1)}%
                    </div>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button 
                      onClick={() => onViewDetail(res.id)}
                      className="btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      🔍 Scorecard
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination buttons */}
        {!loading && lastPage > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              className="btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              disabled={page === 1}
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Page {page} of {lastPage}
            </span>
            <button 
              onClick={() => setPage(p => Math.min(lastPage, p + 1))} 
              className="btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              disabled={page === lastPage}
            >
              Next
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
