import React, { useState, useEffect } from 'react';
import api from '../api';

export default function AdminTestSeries() {
  const [seriesList, setSeriesList] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [allTests, setAllTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals & Panels state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSeries, setEditingSeries] = useState(null);
  const [buildingSeries, setBuildingSeries] = useState(null);
  const [assigningSeries, setAssigningSeries] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    exam_category: 'SSC',
    course_id: '',
    description: '',
    sort_order: 0,
  });

  // Assignment Modal states
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [availableFrom, setAvailableFrom] = useState('');
  const [dueAt, setDueAt] = useState('');

  // Series Builder states
  const [builderTests, setBuilderTests] = useState([]);
  const [availableTestsToAdd, setAvailableTestsToAdd] = useState([]);
  const [selectedTestToAdd, setSelectedTestToAdd] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [seriesRes, coursesRes, testsRes] = await Promise.all([
        api.get('/api/admin/test-series'),
        api.get('/api/admin/courses'),
        api.get('/api/admin/tests'),
      ]);
      setSeriesList(seriesRes.data || []);
      setCourses(coursesRes.data || []);
      setAllTests(testsRes.data || []);
    } catch (err) {
      setError('Failed to load Test Series data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingSeries) {
        await api.put(`/api/admin/test-series/${editingSeries.id}`, formData);
        setSuccess('Test Series updated successfully.');
      } else {
        await api.post('/api/admin/test-series', formData);
        setSuccess('Test Series created successfully.');
      }
      setShowCreateModal(false);
      setEditingSeries(null);
      resetForm();
      fetchInitialData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save Test Series.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async (series) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (series.is_published) {
        await api.post(`/api/admin/test-series/${series.id}/unpublish`);
        setSuccess(`"${series.title}" unpublished.`);
      } else {
        await api.post(`/api/admin/test-series/${series.id}/publish`);
        setSuccess(`"${series.title}" published.`);
      }
      fetchInitialData();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (series) => {
    if (!window.confirm(`Delete test series "${series.title}"? Attached tests will be detached.`)) return;
    setSaving(true);
    try {
      await api.delete(`/api/admin/test-series/${series.id}`);
      setSuccess('Test Series deleted.');
      fetchInitialData();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed.');
    } finally {
      setSaving(false);
    }
  };

  // Open Series Builder Panel
  const openBuilder = async (series) => {
    setBuildingSeries(series);
    try {
      const res = await api.get(`/api/admin/test-series/${series.id}`);
      const attached = res.data.tests || [];
      setBuilderTests(attached);
      
      const attachedIds = new Set(attached.map((t) => t.id));
      const unattached = allTests.filter((t) => !attachedIds.has(t.id));
      setAvailableTestsToAdd(unattached);
    } catch (err) {
      setError('Failed to load series details.');
    }
  };

  const handleAddTestToBuilder = () => {
    if (!selectedTestToAdd) return;
    const test = allTests.find((t) => t.id === parseInt(selectedTestToAdd));
    if (!test) return;

    const newTestItem = {
      ...test,
      series_sort_order: builderTests.length + 1,
      category: test.category || 'full_mock',
      is_free: false,
    };

    setBuilderTests([...builderTests, newTestItem]);
    setAvailableTestsToAdd(availableTestsToAdd.filter((t) => t.id !== test.id));
    setSelectedTestToAdd('');
  };

  const handleRemoveTestFromBuilder = (index) => {
    const removed = builderTests[index];
    const updated = builderTests.filter((_, i) => i !== index);
    setBuilderTests(updated);
    setAvailableTestsToAdd([...availableTestsToAdd, removed]);
  };

  const handleSaveBuilder = async () => {
    if (!buildingSeries) return;
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      tests: builderTests.map((t, idx) => ({
        test_id: t.id,
        series_sort_order: idx + 1,
        category: t.category || 'full_mock',
        is_free: !!t.is_free,
      })),
      detach_missing: true,
    };

    try {
      await api.put(`/api/admin/test-series/${buildingSeries.id}/tests`, payload);
      setSuccess('Series tests and order saved successfully.');
      setBuildingSeries(null);
      fetchInitialData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save series tests.');
    } finally {
      setSaving(false);
    }
  };

  // Open Assignment Modal
  const openAssignModal = async (series) => {
    setAssigningSeries(series);
    setSelectedBatchIds([]);
    setAvailableFrom('');
    setDueAt('');

    try {
      // Fetch all batches across courses
      const allBatches = [];
      for (const course of courses) {
        const res = await api.get(`/api/admin/courses/${course.id}/batches`);
        allBatches.push(...(res.data || []).map((b) => ({ ...b, course_title: course.title })));
      }
      setBatches(allBatches);
    } catch (err) {
      setError('Failed to load batch list.');
    }
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    if (selectedBatchIds.length === 0) {
      setError('Please select at least one batch.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/api/admin/assignments', {
        batch_ids: selectedBatchIds,
        assignable_type: 'series',
        assignable_id: assigningSeries.id,
        available_from: availableFrom || null,
        due_at: dueAt || null,
      });
      setSuccess(`Assigned "${assigningSeries.title}" to selected batch(es).`);
      setAssigningSeries(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Assignment failed.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      exam_category: 'SSC',
      course_id: '',
      description: '',
      sort_order: 0,
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
        <span>⏳ Loading Test Series catalog...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Test Series &amp; Builder
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Build reusable master test series, order tests into guided Study Paths, and assign to batch cohorts.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingSeries(null); setShowCreateModal(true); }}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontWeight: 700 }}
        >
          <span>✨ Create Test Series</span>
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', marginBottom: '24px', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--success-text)', marginBottom: '24px', fontSize: '0.9rem' }}>
          ✅ {success}
        </div>
      )}

      {/* Test Series Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        {seriesList.length === 0 ? (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            🎯 No Test Series created yet. Click <strong>Create Test Series</strong> to get started.
          </div>
        ) : (
          seriesList.map((series) => (
            <div key={series.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: 'var(--accent-soft)', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {series.exam_category}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: series.is_published ? 'var(--success-bg)' : 'var(--surface-2)', color: series.is_published ? 'var(--success)' : 'var(--text-secondary)' }}>
                    {series.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                  {series.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {series.description || 'No description provided.'}
                </p>

                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginBottom: '20px' }}>
                  <span>📚 <strong>{series.total_tests || 0}</strong> Tests</span>
                  <span>🎁 <strong>{series.free_tests_count || 0}</strong> Free</span>
                  {series.course && <span>🏷️ {series.course.title}</span>}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  onClick={() => openBuilder(series)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600 }}
                >
                  🛠️ Builder
                </button>
                <button
                  onClick={() => openAssignModal(series)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600, borderColor: 'var(--accent-border)', color: 'var(--accent-color)' }}
                >
                  📌 Assign
                </button>
                <button
                  onClick={() => handlePublishToggle(series)}
                  className="btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                >
                  {series.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={() => handleDelete(series)}
                  className="btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '0.82rem', color: 'var(--danger-text)' }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleCreateOrUpdate} className="glass-panel" style={{ width: '480px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {editingSeries ? 'Edit Test Series' : 'Create New Test Series'}
            </h2>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Series Title *</label>
              <input
                type="text"
                required
                className="form-input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. SSC CGL 2026 Tier I Mock Series"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Exam Category *</label>
                <select
                  className="form-input"
                  value={formData.exam_category}
                  onChange={(e) => setFormData({ ...formData, exam_category: e.target.value })}
                >
                  {['SSC', 'Banking', 'RRB', 'UPSC', 'State PCS', 'Railways', 'Defence', 'Other'].map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Course (Optional)</label>
                <select
                  className="form-input"
                  value={formData.course_id}
                  onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                >
                  <option value="">-- Standalone Series --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Description</label>
              <textarea
                className="form-input"
                style={{ height: '80px', resize: 'vertical' }}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Overview of the test series syllabus, pattern, and total tests..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ padding: '10px 18px' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 20px', fontWeight: 700 }}>
                {saving ? 'Saving...' : editingSeries ? 'Update Series' : 'Create Series'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SERIES BUILDER PANEL */}
      {buildingSeries && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '800px', maxHeight: '90vh', padding: '28px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Series Builder: {buildingSeries.title}
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Attach tests from question bank, assign Study Path order, set categories &amp; free access flags.
                </span>
              </div>
              <button onClick={() => setBuildingSeries(null)} className="btn-secondary" style={{ padding: '6px 12px' }}>✕ Close</button>
            </div>

            {/* Add Test Bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <select
                className="form-input"
                style={{ flex: 1 }}
                value={selectedTestToAdd}
                onChange={(e) => setSelectedTestToAdd(e.target.value)}
              >
                <option value="">-- Select Test from Bank to Attach --</option>
                {availableTestsToAdd.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.type})</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddTestToBuilder}
                disabled={!selectedTestToAdd}
                className="btn-primary"
                style={{ padding: '8px 16px' }}
              >
                + Add to Series
              </button>
            </div>

            {/* Attached Tests Table */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px', width: '60px' }}>Order</th>
                    <th style={{ padding: '12px' }}>Test Title</th>
                    <th style={{ padding: '12px', width: '160px' }}>Category</th>
                    <th style={{ padding: '12px', width: '90px' }}>Free Access</th>
                    <th style={{ padding: '12px', width: '60px', textAlign: 'center' }}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {builderTests.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No tests attached to this series yet. Pick a test above to add.
                      </td>
                    </tr>
                  ) : (
                    builderTests.map((t, idx) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                          #{idx + 1}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {t.title}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <select
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            value={t.category || 'full_mock'}
                            onChange={(e) => {
                              const updated = [...builderTests];
                              updated[idx].category = e.target.value;
                              setBuilderTests(updated);
                            }}
                          >
                            <option value="full_mock">Full Mock</option>
                            <option value="sectional">Sectional</option>
                            <option value="pyp">Previous Year (PYP)</option>
                            <option value="topic">Topic Test</option>
                            <option value="current_affairs">Current Affairs</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!t.is_free}
                            onChange={(e) => {
                              const updated = [...builderTests];
                              updated[idx].is_free = e.target.checked;
                              setBuilderTests(updated);
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleRemoveTestFromBuilder(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setBuildingSeries(null)} className="btn-secondary" style={{ padding: '10px 18px' }}>
                Cancel
              </button>
              <button onClick={handleSaveBuilder} disabled={saving} className="btn-primary" style={{ padding: '10px 20px', fontWeight: 700 }}>
                {saving ? 'Saving...' : 'Save Study Path'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {assigningSeries && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveAssignment} className="glass-panel" style={{ width: '500px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Assign Series: {assigningSeries.title}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Assign this series to target student batch cohorts with optional homework deadlines.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Select Target Batches *</label>
              <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {batches.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No batches available. Create a batch under a course first.</span>
                ) : (
                  batches.map((b) => (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedBatchIds([...selectedBatchIds, b.id]);
                          else setSelectedBatchIds(selectedBatchIds.filter((id) => id !== b.id));
                        }}
                      />
                      <span><strong>{b.name}</strong> ({b.course_title})</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Available From (Optional)</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Due Date / Deadline (Optional)</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button type="button" onClick={() => setAssigningSeries(null)} className="btn-secondary" style={{ padding: '10px 18px' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 20px', fontWeight: 700 }}>
                {saving ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
