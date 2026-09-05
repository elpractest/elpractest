import React, { useState, useEffect } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import {
  PageHead, TableCard, Toolbar, Table, Row, Cell, CellTitle, CellSub,
  EmptyState, SkeletonRows, Modal, Field, FormGrid, Notice, Num, Badge,
} from '../components/admin/ui';
import { useExamCategories, useExamTaxonomy, papersFor } from '../lib/examCategories';

/**
 * Question pools — named slices of the bank a student can be entitled to.
 *
 * A pool stores a FILTER, not a list of question ids, so "UGC NET Paper 1,
 * previous-year" keeps meaning the right thing as more of that paper is
 * imported. That is why every count here is fetched live rather than stored:
 * the number an operator sees is the number the pool actually holds right now.
 */
export default function AdminQuestionPools() {
  const categories = useExamCategories();
  const taxonomy = useExamTaxonomy();

  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const blank = () => ({
    id: null,
    title: '',
    description: '',
    exam_category: 'UGC NET',
    exam_code: '',
    paper: '',
    source: '',
    year: '',
    shift: '',
    medium: '',
    is_active: true,
  });
  const [form, setForm] = useState(blank());

  const fetchPools = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/question-pools');
      setPools(res.data);
    } catch (err) {
      setError('Failed to load pools.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPools(); }, []);

  /* Size the pool as it is being defined. The API refuses an unbounded pool,
     so an empty filter set is reported here as 0 rather than as the whole
     bank — the same answer the server would give. */
  useEffect(() => {
    if (!showForm) return undefined;

    const facets = {
      exam_code: form.exam_code, paper: form.paper, source: form.source,
      year: form.year, shift: form.shift, medium: form.medium,
    };
    const chosen = Object.fromEntries(Object.entries(facets).filter(([, v]) => v !== '' && v != null));

    if (Object.keys(chosen).length === 0) { setPreview(null); return undefined; }

    const timer = setTimeout(() => {
      api.get('/api/admin/question-pools/preview', { params: chosen })
        .then((res) => setPreview(res.data.count))
        .catch(() => setPreview(null));
    }, 250);

    return () => clearTimeout(timer);
  }, [showForm, form.exam_code, form.paper, form.source, form.year, form.shift, form.medium]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Blank means "any" — send only what was actually chosen, so the API
    // never has to decide what an empty string was supposed to mean.
    const payload = Object.fromEntries(
      Object.entries(form).filter(([k, v]) => k !== 'id' && v !== '' && v != null)
    );

    try {
      if (form.id) {
        await api.put(`/api/admin/question-pools/${form.id}`, payload);
        setSuccess('Pool updated.');
      } else {
        await api.post('/api/admin/question-pools', payload);
        setSuccess('Pool created.');
      }
      setShowForm(false);
      setForm(blank());
      fetchPools();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the pool.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/api/admin/question-pools/${pendingDelete.id}`);
      setSuccess('Pool deleted.');
      setPendingDelete(null);
      fetchPools();
    } catch (err) {
      setError('Could not delete that pool.');
    }
  };

  const edit = (pool) => {
    setForm({
      id: pool.id,
      title: pool.title,
      description: pool.description || '',
      exam_category: pool.exam_category,
      exam_code: pool.exam_code || '',
      paper: pool.paper || '',
      source: pool.source || '',
      year: pool.year || '',
      shift: pool.shift || '',
      medium: pool.medium || '',
      is_active: pool.is_active,
    });
    setShowForm(true);
  };

  const describe = (pool) => [
    pool.exam_code ? (taxonomy.registry[pool.exam_code]?.name || pool.exam_code) : null,
    pool.paper,
    pool.source ? (taxonomy.sources[pool.source]?.name || pool.source) : null,
    pool.year,
    pool.shift ? `Shift ${pool.shift}` : null,
    pool.medium ? (taxonomy.mediums[pool.medium] || pool.medium) : null,
  ].filter(Boolean).join(' · ');

  const COLUMNS = [
    { key: 'pool', label: 'Pool', width: 'minmax(0,2fr)' },
    { key: 'size', label: 'Questions', width: '120px' },
    { key: 'state', label: 'State', width: '110px' },
    { key: 'act', label: '', width: '96px' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <PageHead
        title="Question pools"
        subtitle="A named slice of the bank, sold and granted for practice. It stores a filter, not a list — import more of an exam and its pools grow with it."
      >
        <button type="button" onClick={() => { setForm(blank()); setShowForm(true); }} className="btn-primary">
          <Icon name="plus" size={16} strokeWidth={2.4} />
          New pool
        </button>
      </PageHead>

      {success && <Notice tone="success" icon="check-circle" onDismiss={() => setSuccess('')}>{success}</Notice>}
      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      <TableCard>
        <Toolbar
          trailing={
            !loading && (
              <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <Num>{pools.length}</Num> pool(s)
              </span>
            )
          }
        />
        {loading ? (
          <SkeletonRows columns={COLUMNS} rows={3} />
        ) : pools.length === 0 ? (
          <EmptyState
            icon="layers"
            message="No pools yet. A pool turns part of the question bank into something a student can buy and practise on."
          />
        ) : (
          <Table columns={COLUMNS}>
            {pools.map((pool) => (
              <Row key={pool.id}>
                <Cell label="Pool">
                  <CellTitle>{pool.title}</CellTitle>
                  <CellSub>{describe(pool) || 'No filters'}</CellSub>
                </Cell>
                <Cell label="Questions">
                  {/* Live count: what the pool holds right now, not at creation. */}
                  <CellTitle><Num>{pool.question_count}</Num></CellTitle>
                  <CellSub>approved &amp; active</CellSub>
                </Cell>
                <Cell label="State">
                  <Badge tone={pool.is_active ? 'success' : 'muted'}>
                    {pool.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </Cell>
                <Cell label="">
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '6px 10px', minHeight: '32px', fontSize: '11.5px' }}
                      onClick={() => edit(pool)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '6px 10px', minHeight: '32px', fontSize: '11.5px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                      onClick={() => setPendingDelete(pool)}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </TableCard>

      {showForm && (
        <Modal
          title={form.id ? 'Edit pool' : 'New pool'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" form="pool-form" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save pool'}
              </button>
            </>
          }
        >
          <form id="pool-form" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Notice tone="info" icon="info">
              Leave a filter blank to mean <em>any</em>. At least one must be set — a pool with no filters
              would contain the entire question bank.
            </Notice>

            <FormGrid min="200px">
              <Field label="Title" htmlFor="pool-title">
                <input
                  id="pool-title"
                  className="form-input"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="UGC NET Paper 1 — PYQ bank"
                />
              </Field>
              <Field label="Store category" htmlFor="pool-cat">
                <select
                  id="pool-cat"
                  className="form-input"
                  value={form.exam_category}
                  onChange={(e) => setForm({ ...form, exam_category: e.target.value })}
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </FormGrid>

            <Field label="Description" htmlFor="pool-desc">
              <textarea
                id="pool-desc"
                className="form-input"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>

            <FormGrid min="140px">
              <Field label="Exam" htmlFor="pool-exam">
                <select
                  id="pool-exam"
                  className="form-input"
                  value={form.exam_code}
                  onChange={(e) => setForm({ ...form, exam_code: e.target.value, paper: '' })}
                >
                  <option value="">Any</option>
                  {Object.entries(taxonomy.registry).map(([code, meta]) => (
                    <option key={code} value={code}>{meta.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Paper" htmlFor="pool-paper">
                <select
                  id="pool-paper"
                  className="form-input"
                  value={form.paper}
                  disabled={papersFor(taxonomy.registry, form.exam_code).length === 0}
                  onChange={(e) => setForm({ ...form, paper: e.target.value })}
                >
                  <option value="">Any</option>
                  {papersFor(taxonomy.registry, form.exam_code).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Source" htmlFor="pool-source">
                <select
                  id="pool-source"
                  className="form-input"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                >
                  <option value="">Any</option>
                  {Object.entries(taxonomy.sources).map(([k, meta]) => <option key={k} value={k}>{meta.name}</option>)}
                </select>
              </Field>
              <Field label="Year" htmlFor="pool-year">
                <input
                  id="pool-year"
                  type="number"
                  className="form-input"
                  placeholder="Any"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                />
              </Field>
              <Field label="Shift" htmlFor="pool-shift">
                <input
                  id="pool-shift"
                  className="form-input"
                  placeholder="Any"
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value })}
                />
              </Field>
              <Field label="Medium" htmlFor="pool-medium">
                <select
                  id="pool-medium"
                  className="form-input"
                  value={form.medium}
                  onChange={(e) => setForm({ ...form, medium: e.target.value })}
                >
                  <option value="">Any</option>
                  {Object.entries(taxonomy.mediums).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </Field>
            </FormGrid>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', font: '500 12.5px var(--font-body)', color: 'var(--tx2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active
            </label>

            {preview !== null && (
              <Notice tone={preview === 0 ? 'danger' : 'success'} icon={preview === 0 ? 'alert' : 'check-circle'}>
                {preview === 0
                  ? 'No approved questions match these filters yet. The pool will be empty until some are imported.'
                  : <><strong>{preview}</strong> question(s) match these filters right now.</>}
              </Notice>
            )}
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          title="Delete this pool?"
          onClose={() => setPendingDelete(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ background: 'var(--danger)' }} onClick={remove}>
                Delete
              </button>
            </>
          }
        >
          <p style={{ font: '400 13px/1.7 var(--font-body)', color: 'var(--tx2)' }}>
            <strong>{pendingDelete.title}</strong> will stop being sellable. Students who already bought it
            keep their entitlement row, so this is reversible by restoring the pool — no practice access is
            revoked outright.
          </p>
        </Modal>
      )}
    </div>
  );
}
