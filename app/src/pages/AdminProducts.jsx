import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import { useExamCategories } from '../lib/examCategories';
import {
  PageHead, TableCard, Toolbar, Chip, Table, Row, Cell, CellTitle, CellSub, StatusDot,
  EmptyState, SkeletonRows, Field, FormGrid, FormSection, Notice, Num, Modal,
} from '../components/admin/ui';

/**
 * ADMIN — STORE PRODUCTS.
 *
 * A product is the thing a student buys: one course, one test series, or a
 * bundle of several. Before this screen the store could only be populated from
 * a console, which made the whole purchase rail unusable in practice.
 *
 * Publishing is a gate rather than a toggle — the API refuses to publish a
 * product with no items, because that would take money and grant nothing. The
 * form mirrors that: you pick the contents before you can put it on sale.
 */
const TYPES = [
  { key: 'course', label: 'Course', hint: 'One course and its lessons' },
  { key: 'test_series', label: 'Test series', hint: 'One series and its papers' },
  { key: 'bundle', label: 'Bundle', hint: 'Any mix of courses and series' },
];

const EMPTY = {
  id: null,
  type: 'course',
  title: '',
  short_description: '',
  description: '',
  exam_category: 'SSC',
  price_rupees: '',
  list_price_rupees: '',
  access_days: '',
  items: [],
};

function rupees(paise) {
  if (paise === null || paise === undefined) return '—';
  return (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export default function AdminProducts() {
  const examCategories = useExamCategories();

  const [products, setProducts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(null); // null = list view
  const [typeFilter, setTypeFilter] = useState('all');
  const [newMenu, setNewMenu] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/admin/products', { params: { per_page: 50 } }),
      api.get('/api/admin/courses', { params: { per_page: 100 } }),
      api.get('/api/admin/test-series', { params: { per_page: 100 } }),
    ])
      .then(([p, c, s]) => {
        setProducts(p.data?.data || []);
        setCourses(c.data?.data || c.data || []);
        setSeries(s.data?.data || s.data || []);
      })
      .catch(() => setError('Could not load the store catalogue.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const visibleProducts = typeFilter === 'all' ? products : products.filter((p) => p.type === typeFilter);

  const openNew = (type) => {
    setError('');
    setSuccess('');
    setForm({ ...EMPTY, type, exam_category: examCategories[0] || 'SSC' });
  };

  const openEdit = async (product) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.get(`/api/admin/products/${product.id}`);
      const p = res.data;
      setForm({
        id: p.id,
        type: p.type,
        title: p.title,
        short_description: p.short_description || '',
        description: p.description || '',
        exam_category: p.exam_category,
        price_rupees: String((p.price_paise ?? 0) / 100),
        list_price_rupees: p.list_price_paise ? String(p.list_price_paise / 100) : '',
        access_days: p.access_days ? String(p.access_days) : '',
        items: (p.items || []).map((i) => ({
          kind: i.grantable_type?.includes('TestSeries') ? 'test_series' : 'course',
          id: i.grantable_id,
        })),
      });
    } catch {
      setError('Could not open that product.');
    }
  };

  const toggleItem = (kind, id) => {
    setForm((f) => {
      const exists = f.items.some((i) => i.kind === kind && i.id === id);
      const items = exists
        ? f.items.filter((i) => !(i.kind === kind && i.id === id))
        : [...f.items, { kind, id }];

      // A course or series product holds exactly one thing; picking a second
      // replaces the first rather than silently creating a two-item "course".
      if (f.type !== 'bundle' && !exists) {
        return { ...f, items: [{ kind, id }] };
      }
      return { ...f, items };
    });
  };

  const save = async (publishAfter) => {
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      type: form.type,
      title: form.title,
      short_description: form.short_description || null,
      description: form.description || null,
      exam_category: form.exam_category,
      price_paise: Math.round(Number(form.price_rupees || 0) * 100),
      list_price_paise: form.list_price_rupees ? Math.round(Number(form.list_price_rupees) * 100) : null,
      access_days: form.access_days ? Number(form.access_days) : null,
      items: form.items,
    };

    try {
      const res = form.id
        ? await api.put(`/api/admin/products/${form.id}`, payload)
        : await api.post('/api/admin/products', payload);

      const id = res.data.product.id;

      if (publishAfter) {
        await api.post(`/api/admin/products/${id}/publish`);
      }

      setSuccess(publishAfter ? 'Product published to the store.' : 'Product saved as a draft.');
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the product.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (product) => {
    setError('');
    setSuccess('');
    try {
      const action = product.is_published ? 'unpublish' : 'publish';
      await api.post(`/api/admin/products/${product.id}/${action}`);
      setSuccess(`"${product.title}" ${product.is_published ? 'removed from' : 'published to'} the store.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change that product.');
    }
  };

  const remove = async (product) => {
    try {
      await api.delete(`/api/admin/products/${product.id}`);
      setSuccess('Product removed from the store.');
      load();
    } catch {
      setError('Could not remove that product.');
    }
  };

  const COLUMNS = [
    { key: 'title', label: 'Product', width: 'minmax(0,1.6fr)' },
    { key: 'price', label: 'Price', width: '110px' },
    { key: 'items', label: 'Grants', width: '100px', hideBelow: 'tablet' },
    { key: 'sold', label: 'Sold', width: '90px', hideBelow: 'tablet' },
    { key: 'status', label: 'Status', width: '110px' },
    { key: 'actions', label: '', width: '210px' },
  ];

  /* ── Editor ─────────────────────────────────────────────────────────── */
  if (form) {
    const pickable = form.type === 'bundle'
      ? [...courses.map((c) => ({ kind: 'course', id: c.id, title: c.title })),
         ...series.map((s) => ({ kind: 'test_series', id: s.id, title: s.title }))]
      : form.type === 'course'
        ? courses.map((c) => ({ kind: 'course', id: c.id, title: c.title }))
        : series.map((s) => ({ kind: 'test_series', id: s.id, title: s.title }));

    const canSave = form.title.trim() && form.items.length > 0 && Number(form.price_rupees) >= 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <PageHead
          title={form.id ? 'Edit product' : `New ${TYPES.find((t) => t.key === form.type)?.label.toLowerCase()}`}
          subtitle="What the student sees in the store, and what buying it grants them."
        >
          <button type="button" onClick={() => setForm(null)} className="btn-secondary">Cancel</button>
        </PageHead>

        {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '20px', padding: '20px 22px' }}>
          <FormSection title="Listing" description="How the product reads on the store card.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field label="Title" htmlFor="pr-title">
                <input
                  id="pr-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="form-input"
                  placeholder="e.g. SSC CGL 2026 Complete Bundle"
                />
              </Field>
              <Field label="Store blurb" htmlFor="pr-blurb">
                <input
                  id="pr-blurb"
                  value={form.short_description}
                  onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                  className="form-input"
                  placeholder="One line shown on the store card"
                />
              </Field>
              <FormGrid min="180px">
                <Field label="Exam" htmlFor="pr-exam">
                  <select
                    id="pr-exam"
                    value={form.exam_category}
                    onChange={(e) => setForm({ ...form, exam_category: e.target.value })}
                    className="form-input"
                  >
                    {examCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Access (days)" hint="Blank means lifetime." htmlFor="pr-days">
                  <input
                    id="pr-days"
                    type="number"
                    min="1"
                    value={form.access_days}
                    onChange={(e) => setForm({ ...form, access_days: e.target.value })}
                    className="form-input"
                    placeholder="Blank = lifetime"
                  />
                </Field>
              </FormGrid>
            </div>
          </FormSection>

          <FormSection title="Price" description="The struck-through price is optional and shown only when it is higher.">
            <FormGrid min="180px">
              <Field label="Price (₹)" htmlFor="pr-price">
                <input
                  id="pr-price"
                  type="number"
                  min="0"
                  value={form.price_rupees}
                  onChange={(e) => setForm({ ...form, price_rupees: e.target.value })}
                  className="form-input"
                  placeholder="999"
                />
              </Field>
              <Field label="Struck-through price (₹)" htmlFor="pr-list">
                <input
                  id="pr-list"
                  type="number"
                  min="0"
                  value={form.list_price_rupees}
                  onChange={(e) => setForm({ ...form, list_price_rupees: e.target.value })}
                  className="form-input"
                  placeholder="Optional"
                />
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection
            title={`What buying this grants${form.type === 'bundle' ? '' : ' (pick one)'}`}
            description="A product with nothing in it cannot be published — it would take money and grant nothing."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '320px', overflowY: 'auto' }}>
              {pickable.length === 0 && (
                <div style={{ font: '400 13px var(--font-body)', color: 'var(--muted)', padding: '10px 0' }}>
                  No {form.type === 'test_series' ? 'test series' : 'courses'} exist yet. Create one first.
                </div>
              )}
              {pickable.map((opt) => {
                const on = form.items.some((i) => i.kind === opt.kind && i.id === opt.id);
                return (
                  <button
                    key={`${opt.kind}-${opt.id}`}
                    type="button"
                    onClick={() => toggleItem(opt.kind, opt.id)}
                    aria-pressed={on}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      minHeight: '44px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: on ? 'var(--primary-soft)' : 'var(--card)',
                      border: `1px solid ${on ? 'var(--primary-border)' : 'var(--line2)'}`,
                      color: on ? 'var(--primary)' : 'var(--tx2)',
                      font: `${on ? 600 : 500} 12.5px var(--font-body)`,
                    }}
                  >
                    <Icon name={on ? 'check' : opt.kind === 'course' ? 'book-open' : 'target'} size={15} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.title}</span>
                    <span className="t-overline" style={{ marginLeft: 'auto', fontSize: '9px', flex: 'none', color: 'var(--muted)' }}>
                      {opt.kind === 'course' ? 'COURSE' : 'SERIES'}
                    </span>
                  </button>
                );
              })}
            </div>
          </FormSection>

          <div className="adm-formfoot">
            <button
              type="button"
              onClick={() => save(false)}
              disabled={!canSave || saving}
              className="btn-secondary"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={!canSave || saving}
              className="btn-primary"
            >
              {saving ? 'Saving…' : 'Save & publish'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── List ───────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <PageHead
        title="Store products"
        subtitle="What students can buy — a course, a test series, or a bundle of both."
      >
        <button type="button" onClick={() => setNewMenu(true)} className="btn-primary">
          <Icon name="plus" size={16} strokeWidth={2.4} />
          New product
        </button>
      </PageHead>

      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}
      {success && <Notice tone="success" icon="check-circle" onDismiss={() => setSuccess('')}>{success}</Notice>}

      <TableCard>
        <Toolbar
          trailing={
            !loading && (
              <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <Num>{products.filter((p) => p.is_published).length}</Num> live of <Num>{products.length}</Num>
              </span>
            )
          }
        >
          <Chip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All</Chip>
          {TYPES.map((t) => (
            <Chip key={t.key} active={typeFilter === t.key} onClick={() => setTypeFilter(t.key)}>
              {t.label}
            </Chip>
          ))}
        </Toolbar>

        {loading ? (
          <SkeletonRows />
        ) : visibleProducts.length === 0 ? (
          <EmptyState
            icon="shopping-bag"
            message={
              products.length === 0
                ? 'Nothing is on sale yet. Until a product is published, the student store shows its empty state and points at activation codes.'
                : 'No product of that type yet.'
            }
            action={
              <button type="button" onClick={() => setNewMenu(true)} className="btn-primary">
                <Icon name="plus" size={16} strokeWidth={2.4} />
                New product
              </button>
            }
          />
        ) : (
          <Table columns={COLUMNS}>
            {visibleProducts.map((p) => (
              <Row key={p.id}>
                <Cell label="Product">
                  <span className="t-overline" style={{ display: 'block', color: 'var(--muted)', fontSize: '9px', marginBottom: '3px' }}>
                    {TYPES.find((t) => t.key === p.type)?.label || p.type}
                  </span>
                  <CellTitle>{p.title}</CellTitle>
                  <CellSub>{p.access_days ? `${p.access_days} days access` : 'Lifetime access'} · {p.exam_category}</CellSub>
                </Cell>
                <Cell label="Price">
                  <Num style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--tx)' }}>{rupees(p.price_paise)}</Num>
                </Cell>
                <Cell label="Grants" hideBelow="tablet">
                  <Num style={{ fontSize: '13px' }}>{p.items_count}</Num>
                </Cell>
                <Cell label="Sold" hideBelow="tablet">
                  <Num style={{ fontSize: '13px' }}>{p.entitlements_count}</Num>
                </Cell>
                <Cell label="Status">
                  <StatusDot tone={p.is_published ? 'success' : 'reward'}>{p.is_published ? 'Live' : 'Draft'}</StatusDot>
                </Cell>
                <Cell label="Actions" align="right">
                  <span style={{ display: 'inline-flex', gap: '7px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => openEdit(p)} className="btn-secondary" style={{ padding: '7px 12px', minHeight: '36px', fontSize: '11.5px' }}>
                      Edit
                    </button>
                    <button type="button" onClick={() => togglePublish(p)} className="btn-secondary" style={{ padding: '7px 12px', minHeight: '36px', fontSize: '11.5px' }}>
                      {p.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRemove(p)}
                      className="btn-secondary"
                      style={{ padding: '7px 12px', minHeight: '36px', fontSize: '11.5px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                    >
                      Remove
                    </button>
                  </span>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </TableCard>

      {/* pick a product type */}
      {newMenu && (
        <Modal
          title="New product"
          description="Pick what the product wraps. A bundle can hold any mix of the two."
          onClose={() => setNewMenu(false)}
          width={480}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setNewMenu(false); openNew(t.key); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  minHeight: '56px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: 'var(--card2)',
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: '34px',
                    height: '34px',
                    flex: 'none',
                    borderRadius: '11px',
                    background: 'var(--primary-soft)',
                    color: 'var(--primary)',
                  }}
                >
                  <Icon name={t.key === 'course' ? 'book-open' : t.key === 'test_series' ? 'target' : 'shopping-bag'} size={17} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', font: '600 13px var(--font-body)', color: 'var(--tx)' }}>{t.label}</span>
                  <span style={{ display: 'block', marginTop: '2px', font: '400 12px var(--font-body)', color: 'var(--muted)' }}>{t.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* destructive confirmation names the object */}
      {pendingRemove && (
        <Modal
          danger
          title={`Remove “${pendingRemove.title}”?`}
          description="Students who already bought it keep their access. The product simply leaves the store."
          onClose={() => setPendingRemove(null)}
          width={480}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setPendingRemove(null)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => { const target = pendingRemove; setPendingRemove(null); remove(target); }}
              >
                Remove product
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
