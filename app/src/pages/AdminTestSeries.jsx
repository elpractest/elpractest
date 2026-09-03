import React, { useState, useEffect } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import { useExamCategories } from '../lib/examCategories';
import {
  PageHead, TableCard, Toolbar, Chip, Table, Row, Cell, CellTitle, CellSub, RowChevron,
  StatusDot, Badge, EmptyState, SkeletonRows, Modal, Drawer, Field, FormGrid, FormSection,
  Notice, Num,
} from '../components/admin/ui';

export default function AdminTestSeries() {
  const examCategories = useExamCategories();
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
  const [detailSeries, setDetailSeries] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [publishFilter, setPublishFilter] = useState('all');

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

  // Open the Create/Edit modal pre-filled for an existing series.
  const openEditModal = (series) => {
    setEditingSeries(series);
    setFormData({
      title: series.title || '',
      exam_category: series.exam_category || 'SSC',
      course_id: series.course_id || '',
      description: series.description || '',
      sort_order: series.sort_order ?? 0,
    });
    setError('');
    setSuccess('');
    setShowCreateModal(true);
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

  const COLUMNS = [
    { key: 'title', label: 'Series', width: 'minmax(0,1.8fr)' },
    { key: 'exam', label: 'Exam', width: '110px', hideBelow: 'tablet' },
    { key: 'tests', label: 'Tests', width: '110px' },
    { key: 'status', label: 'Status', width: '110px' },
    { key: 'go', label: '', width: '32px' },
  ];

  const visible = seriesList.filter((x) =>
    publishFilter === 'all' ? true : publishFilter === 'live' ? x.is_published : !x.is_published,
  );
  const liveCount = seriesList.filter((x) => x.is_published).length;

  const openDetail = (series) => {
    setDetailSeries(series);
    setError('');
    setSuccess('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>

      <PageHead
        title="Test series"
        subtitle="Reusable master series: order tests into a guided study path, then assign the series to batch cohorts."
      >
        <button
          type="button"
          onClick={() => { resetForm(); setEditingSeries(null); setShowCreateModal(true); }}
          className="btn-primary"
        >
          <Icon name="plus" size={16} strokeWidth={2.4} />
          New series
        </button>
      </PageHead>

      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}
      {success && <Notice tone="success" icon="check-circle" onDismiss={() => setSuccess('')}>{success}</Notice>}

      <TableCard>
        <Toolbar
          trailing={
            !loading && (
              <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <Num>{liveCount}</Num> live of <Num>{seriesList.length}</Num>
              </span>
            )
          }
        >
          <Chip active={publishFilter === 'all'} onClick={() => setPublishFilter('all')}>All</Chip>
          <Chip active={publishFilter === 'live'} onClick={() => setPublishFilter('live')}>Published</Chip>
          <Chip active={publishFilter === 'draft'} onClick={() => setPublishFilter('draft')}>Draft</Chip>
        </Toolbar>

        {loading ? (
          <SkeletonRows />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="target"
            message={
              seriesList.length === 0
                ? 'No test series yet. Create one, attach tests in the builder, then publish it.'
                : 'No series in that state.'
            }
            action={
              seriesList.length === 0 && (
                <button
                  type="button"
                  onClick={() => { resetForm(); setEditingSeries(null); setShowCreateModal(true); }}
                  className="btn-primary"
                >
                  <Icon name="plus" size={16} strokeWidth={2.4} />
                  New series
                </button>
              )
            }
          />
        ) : (
          <Table columns={COLUMNS}>
            {visible.map((series) => (
              <Row key={series.id} selected={detailSeries?.id === series.id} onClick={() => openDetail(series)}>
                <Cell label="Series">
                  <CellTitle>{series.title}</CellTitle>
                  <CellSub>{series.course ? series.course.title : 'Standalone series'}</CellSub>
                </Cell>
                <Cell label="Exam" hideBelow="tablet">
                  <Badge tone="primary">{series.exam_category}</Badge>
                </Cell>
                <Cell label="Tests">
                  <Num style={{ fontSize: '13px', color: 'var(--tx)' }}>{series.total_tests || 0}</Num>
                  <CellSub>{series.free_tests_count || 0} free</CellSub>
                </Cell>
                <Cell label="Status">
                  <StatusDot tone={series.is_published ? 'success' : 'reward'}>
                    {series.is_published ? 'Published' : 'Draft'}
                  </StatusDot>
                </Cell>
                <Cell align="right">
                  <RowChevron onClick={() => openDetail(series)} label="Open series" />
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </TableCard>

      {/* ---- detail drawer: every row action lives here ---- */}
      {detailSeries && (
        <Drawer
          title={detailSeries.title}
          subtitle={`${detailSeries.exam_category} · ${detailSeries.course ? detailSeries.course.title : 'Standalone'}`}
          onClose={() => setDetailSeries(null)}
          footer={
            <>
              <button
                type="button"
                className="btn-secondary"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                onClick={() => setPendingDelete(detailSeries)}
              >
                <Icon name="trash" size={15} />
                Delete
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => { const target = detailSeries; setDetailSeries(null); openBuilder(target); }}
              >
                Open builder
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <p style={{ margin: 0, font: '400 13.5px/1.6 var(--font-body)', color: 'var(--tx2)' }}>
              {detailSeries.description || 'No description provided.'}
            </p>

            <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
              {[
                ['Tests attached', detailSeries.total_tests || 0],
                ['Free to attempt', detailSeries.free_tests_count || 0],
                ['Sort order', detailSeries.sort_order ?? 0],
              ].map(([label, value], i) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginTop: i === 0 ? 0 : '9px',
                    font: '400 12.5px var(--font-body)',
                    color: 'var(--muted)',
                  }}
                >
                  <span>{label}</span>
                  <Num style={{ color: 'var(--tx)', fontSize: '12.5px' }}>{value}</Num>
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '9px',
                  font: '400 12.5px var(--font-body)',
                  color: 'var(--muted)',
                }}
              >
                <span>Status</span>
                <StatusDot tone={detailSeries.is_published ? 'success' : 'reward'}>
                  {detailSeries.is_published ? 'Published' : 'Draft'}
                </StatusDot>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { const target = detailSeries; setDetailSeries(null); openAssignModal(target); }}
              >
                <Icon name="users" size={15} />
                Assign to batches
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { const target = detailSeries; setDetailSeries(null); openEditModal(target); }}
              >
                <Icon name="edit" size={15} />
                Edit details
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => { handlePublishToggle(detailSeries); setDetailSeries(null); }}
              >
                <Icon name={detailSeries.is_published ? 'eye-off' : 'check-circle'} size={15} />
                {detailSeries.is_published ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {/* ---- create / edit ---- */}
      {showCreateModal && (
        <Modal
          title={editingSeries ? 'Edit test series' : 'New test series'}
          description="A series is the shell; the builder decides which papers sit inside it and in what order."
          onClose={() => { setShowCreateModal(false); setEditingSeries(null); }}
          footer={
            <>
              <button
                type="button"
                onClick={() => { setShowCreateModal(false); setEditingSeries(null); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" form="series-form" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : editingSeries ? 'Update series' : 'Create series'}
              </button>
            </>
          }
        >
          <form id="series-form" onSubmit={handleCreateOrUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Series title" htmlFor="ts-title">
              <input
                id="ts-title"
                type="text"
                required
                className="form-input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. SSC CGL 2026 Tier I Mock Series"
              />
            </Field>

            <FormGrid min="180px">
              <Field label="Exam category" htmlFor="ts-exam">
                <select
                  id="ts-exam"
                  className="form-input"
                  value={formData.exam_category}
                  onChange={(e) => setFormData({ ...formData, exam_category: e.target.value })}
                >
                  {examCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </Field>
              <Field label="Course" hint="Leave unset for a standalone series." htmlFor="ts-course">
                <select
                  id="ts-course"
                  className="form-input"
                  value={formData.course_id}
                  onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                >
                  <option value="">Standalone series</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </Field>
            </FormGrid>

            <Field label="Description" htmlFor="ts-desc">
              <textarea
                id="ts-desc"
                className="form-input"
                style={{ height: '84px', resize: 'vertical' }}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Syllabus, pattern and how many papers the series holds…"
              />
            </Field>
          </form>
        </Modal>
      )}

      {/* ---- series builder ---- */}
      {buildingSeries && (
        <Modal
          title={`Builder — ${buildingSeries.title}`}
          description="Attach papers from the bank, set the study-path order, and mark which ones are free to attempt."
          width={860}
          onClose={() => setBuildingSeries(null)}
          footer={
            <>
              <button type="button" onClick={() => setBuildingSeries(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleSaveBuilder} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save study path'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              style={{ flex: 1, minWidth: '220px' }}
              aria-label="Test to attach"
              value={selectedTestToAdd}
              onChange={(e) => setSelectedTestToAdd(e.target.value)}
            >
              <option value="">Select a paper from the bank…</option>
              {availableTestsToAdd.map((t) => (
                <option key={t.id} value={t.id}>{t.title} ({t.type})</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddTestToBuilder}
              disabled={!selectedTestToAdd}
              className="btn-secondary"
              style={{ flex: 'none' }}
            >
              <Icon name="plus" size={15} strokeWidth={2.4} />
              Attach
            </button>
          </div>

          <div className="adm-tablecard" style={{ overflowX: 'auto' }}>
            <table className="adm-ltable">
              <thead>
                <tr>
                  <th style={{ width: '64px' }}>Order</th>
                  <th>Paper</th>
                  <th style={{ width: '170px' }}>Category</th>
                  <th className="ta-c" style={{ width: '80px' }}>Free</th>
                  <th className="ta-c" style={{ width: '60px' }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {builderTests.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 0 }}>
                      <div className="adm-empty">
                        <span className="adm-empty-tile"><Icon name="award" size={24} /></span>
                        <p className="adm-empty-msg">No paper is attached yet. Pick one above to add it to the path.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  builderTests.map((t, idx) => (
                    <tr key={t.id}>
                      <td>
                        <Num style={{ fontSize: '12.5px', color: 'var(--primary)' }}>{idx + 1}</Num>
                      </td>
                      <td style={{ fontWeight: 600 }}>{t.title}</td>
                      <td>
                        <select
                          className="form-input"
                          aria-label={`Category for ${t.title}`}
                          style={{ padding: '7px 10px', fontSize: '12.5px' }}
                          value={t.category || 'full_mock'}
                          onChange={(e) => {
                            const updated = [...builderTests];
                            updated[idx].category = e.target.value;
                            setBuilderTests(updated);
                          }}
                        >
                          <option value="full_mock">Full mock</option>
                          <option value="sectional">Sectional</option>
                          <option value="pyp">Previous year</option>
                          <option value="topic">Topic test</option>
                          <option value="current_affairs">Current affairs</option>
                        </select>
                      </td>
                      <td className="ta-c">
                        <input
                          type="checkbox"
                          aria-label={`Free access for ${t.title}`}
                          checked={!!t.is_free}
                          onChange={(e) => {
                            const updated = [...builderTests];
                            updated[idx].is_free = e.target.checked;
                            setBuilderTests(updated);
                          }}
                        />
                      </td>
                      <td className="ta-c">
                        <button
                          type="button"
                          className="adm-rowaction"
                          onClick={() => handleRemoveTestFromBuilder(idx)}
                          aria-label={`Remove ${t.title}`}
                          title="Remove"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* ---- assign to batches ---- */}
      {assigningSeries && (
        <Modal
          title={`Assign — ${assigningSeries.title}`}
          description="Give the series to one or more batches, with an optional window."
          onClose={() => setAssigningSeries(null)}
          footer={
            <>
              <button type="button" onClick={() => setAssigningSeries(null)} className="btn-secondary">Cancel</button>
              <button type="submit" form="assign-form" disabled={saving} className="btn-primary">
                {saving ? 'Assigning…' : 'Assign series'}
              </button>
            </>
          }
        >
          <form id="assign-form" onSubmit={handleSaveAssignment}>
            <FormSection title="Target batches">
              <div
                style={{
                  maxHeight: '190px',
                  overflowY: 'auto',
                  border: '1px solid var(--line)',
                  borderRadius: '14px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {batches.length === 0 ? (
                  <span style={{ font: '400 13px var(--font-body)', color: 'var(--muted)', padding: '10px' }}>
                    No batch exists yet. Create one under a course first.
                  </span>
                ) : (
                  batches.map((b) => (
                    <label
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        minHeight: '44px',
                        padding: '0 10px',
                        borderRadius: '10px',
                        font: '400 13px var(--font-body)',
                        color: 'var(--tx)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedBatchIds([...selectedBatchIds, b.id]);
                          else setSelectedBatchIds(selectedBatchIds.filter((id) => id !== b.id));
                        }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600 }}>{b.name}</span>
                        <span style={{ color: 'var(--muted)' }}> · {b.course_title}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </FormSection>

            <FormSection title="Window" description="Both are optional — leave them empty for immediate, open-ended access.">
              <FormGrid min="180px">
                <Field label="Available from" htmlFor="ts-from">
                  <input
                    id="ts-from"
                    type="datetime-local"
                    className="form-input"
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                  />
                </Field>
                <Field label="Due at" htmlFor="ts-due">
                  <input
                    id="ts-due"
                    type="datetime-local"
                    className="form-input"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                </Field>
              </FormGrid>
            </FormSection>
          </form>
        </Modal>
      )}

      {/* ---- destructive confirmation ---- */}
      {pendingDelete && (
        <Modal
          danger
          title={`Delete “${pendingDelete.title}”?`}
          description={`Its ${pendingDelete.total_tests || 0} attached ${(pendingDelete.total_tests || 0) === 1 ? 'paper is' : 'papers are'} detached, not deleted. Students lose access to the series.`}
          width={480}
          onClose={() => setPendingDelete(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => { const target = pendingDelete; setPendingDelete(null); setDetailSeries(null); handleDelete(target); }}
              >
                Delete series
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
