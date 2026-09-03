import React, { useState, useEffect } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import {
  PageHead, TableCard, Toolbar, Table, Row, Cell, CellTitle, CellSub, StatusDot,
  EmptyState, SkeletonRows, Modal, Field, FormGrid, Notice, Num,
} from '../components/admin/ui';

export default function AdminActivationCodes() {
  const [codes, setCodes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    course_id: '',
    batch_id: '',
    quantity: 5,
    max_uses: 1,
    expires_at: ''
  });

  const fetchCodes = async () => {
    try {
      const res = await api.get('/api/admin/activation-codes');
      // Endpoint returns a Laravel paginator envelope ({ data: [...], ... }); reading
      // res.data directly left `codes` as an object, so codes.map(...) in render threw
      // "e.map is not a function" and crashed the page. Normalise to the row array.
      setCodes(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } catch (e) {
      setError('Failed to fetch activation codes.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await api.get('/api/admin/courses');
      setCourses(res.data);
    } catch (e) {}
  };

  const fetchBatches = async (courseId) => {
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
    fetchCodes();
    fetchCourses();
  }, []);

  useEffect(() => {
    if (form.course_id) {
      fetchBatches(form.course_id);
    }
  }, [form.course_id]);

  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.course_id) {
      setError('Please select a course.');
      return;
    }

    try {
      const payload = {
        ...form,
        batch_id: form.batch_id || null,
        expires_at: form.expires_at || null
      };

      await api.post('/api/admin/activation-codes', payload);
      setSuccess(`Successfully generated ${form.quantity} activation codes.`);
      setShowForm(false);
      setForm({ course_id: '', batch_id: '', quantity: 5, max_uses: 1, expires_at: '' });
      fetchCodes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate codes.');
    }
  };

  const COLUMNS = [
    { key: 'code', label: 'Code', width: 'minmax(0,1fr)' },
    { key: 'scope', label: 'Scope', width: 'minmax(0,1.3fr)' },
    { key: 'uses', label: 'Redemptions', width: '130px' },
    { key: 'expires', label: 'Expires', width: '120px', hideBelow: 'tablet' },
    { key: 'status', label: 'Status', width: '130px' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>

      <PageHead
        title="Activation codes"
        subtitle="Bulk-generate alphanumeric codes students redeem to enrol themselves."
      >
        <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
          <Icon name="plus" size={16} strokeWidth={2.4} />
          Generate codes
        </button>
      </PageHead>

      {success && <Notice tone="success" icon="check-circle" onDismiss={() => setSuccess('')}>{success}</Notice>}
      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      <TableCard>
        <Toolbar
          trailing={
            !loading && (
              <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <Num>{codes.length}</Num> issued
              </span>
            )
          }
        >
          <span style={{ font: '600 12.5px var(--font-body)', color: 'var(--tx2)' }}>All codes</span>
        </Toolbar>

        {loading && codes.length === 0 ? (
          <SkeletonRows />
        ) : codes.length === 0 ? (
          <EmptyState
            icon="key"
            message="No activation codes yet. Generate a batch and hand them to students who paid offline."
            action={
              <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
                <Icon name="plus" size={16} strokeWidth={2.4} />
                Generate codes
              </button>
            }
          />
        ) : (
          <Table columns={COLUMNS}>
            {codes.map((code) => {
              const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
              const isFull = code.times_used >= code.max_uses;
              const isValid = !isExpired && !isFull;

              return (
                <Row key={code.id}>
                  <Cell label="Code">
                    <Num style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)', letterSpacing: '.04em' }}>
                      {code.code}
                    </Num>
                  </Cell>
                  <Cell label="Scope">
                    <CellTitle>{code.course?.title}</CellTitle>
                    {code.batch && <CellSub>{code.batch.name}</CellSub>}
                  </Cell>
                  <Cell label="Redemptions">
                    <Num style={{ fontSize: '13px', color: 'var(--tx)' }}>{code.times_used}</Num>
                    <span style={{ font: '500 12px var(--font-mono)', color: 'var(--muted)' }}> / {code.max_uses}</span>
                  </Cell>
                  <Cell label="Expires" hideBelow="tablet">
                    <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--tx2)' }}>
                      {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Never'}
                    </span>
                  </Cell>
                  <Cell label="Status">
                    <StatusDot tone={isValid ? 'success' : isExpired ? 'danger' : 'reward'}>
                      {isValid ? 'Valid' : isExpired ? 'Expired' : 'Fully redeemed'}
                    </StatusDot>
                  </Cell>
                </Row>
              );
            })}
          </Table>
        )}
      </TableCard>

      {/* Generator — a modal on desktop, a bottom sheet on a phone */}
      {showForm && (
        <Modal
          title="Bulk code generator"
          description="Codes are unique, single-course and redeemable until they expire or run out of uses."
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" form="code-gen-form" className="btn-primary">Generate</button>
            </>
          }
        >
          <form id="code-gen-form" onSubmit={handleGenerateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Target course" htmlFor="code-course">
              <select
                id="code-course"
                value={form.course_id}
                onChange={(e) => setForm({ ...form, course_id: e.target.value, batch_id: '' })}
                className="form-input"
                required
              >
                <option value="">Select a course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>

            <Field label="Target batch" hint="Leave unset to let the code work across every batch." htmlFor="code-batch">
              <select
                id="code-batch"
                value={form.batch_id}
                onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
                className="form-input"
                disabled={!form.course_id}
              >
                <option value="">All batches</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>

            <FormGrid min="160px">
              <Field label="How many codes" htmlFor="code-qty">
                <input
                  id="code-qty"
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) })}
                  className="form-input"
                  min={1}
                  max={100}
                  required
                />
              </Field>
              <Field label="Max uses per code" htmlFor="code-uses">
                <input
                  id="code-uses"
                  type="number"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: parseInt(e.target.value) })}
                  className="form-input"
                  min={1}
                  required
                />
              </Field>
            </FormGrid>

            <Field label="Expires on" hint="Optional — leave empty for codes that never lapse." htmlFor="code-exp">
              <input
                id="code-exp"
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="form-input"
              />
            </Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
