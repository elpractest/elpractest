import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import { useExamCategories } from '../lib/examCategories';

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
    if (!window.confirm(`Remove "${product.title}" from the store? Students who already bought it keep their access.`)) return;
    try {
      await api.delete(`/api/admin/products/${product.id}`);
      setSuccess('Product removed from the store.');
      load();
    } catch {
      setError('Could not remove that product.');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--text-secondary)' }}><span>Loading store catalogue…</span></div>;
  }

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
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>
              {form.id ? 'Edit product' : `New ${TYPES.find((t) => t.key === form.type)?.label.toLowerCase()}`}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              What the student sees in the store, and what buying it grants them.
            </p>
          </div>
          <button onClick={() => setForm(null)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>Cancel</button>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '14px' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', alignItems: 'start' }}>
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="form-input" placeholder="e.g. SSC CGL 2026 Complete Bundle" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Store blurb</label>
              <input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="form-input" placeholder="One line shown on the store card" />
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '140px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Exam</label>
                <select value={form.exam_category} onChange={(e) => setForm({ ...form, exam_category: e.target.value })} className="form-input">
                  {examCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '140px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Access (days)</label>
                <input type="number" min="1" value={form.access_days} onChange={(e) => setForm({ ...form, access_days: e.target.value })} className="form-input" placeholder="Blank = lifetime" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '140px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Price (₹) *</label>
                <input type="number" min="0" value={form.price_rupees} onChange={(e) => setForm({ ...form, price_rupees: e.target.value })} className="form-input" placeholder="999" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '140px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Struck-through price (₹)</label>
                <input type="number" min="0" value={form.list_price_rupees} onChange={(e) => setForm({ ...form, list_price_rupees: e.target.value })} className="form-input" placeholder="Optional" />
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                What buying this grants {form.type === 'bundle' ? '' : '(pick one)'}
              </label>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                A product with nothing in it cannot be published — it would take money and grant nothing.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
              {pickable.length === 0 && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '10px 0' }}>
                  No {form.type === 'test_series' ? 'test series' : 'courses'} exist yet. Create one first.
                </div>
              )}
              {pickable.map((opt) => {
                const on = form.items.some((i) => i.kind === opt.kind && i.id === opt.id);
                return (
                  <button
                    key={`${opt.kind}-${opt.id}`}
                    onClick={() => toggleItem(opt.kind, opt.id)}
                    className={on ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '9px 12px', fontSize: '0.82rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '9px' }}
                  >
                    <Icon name={on ? 'check' : opt.kind === 'course' ? 'book-open' : 'target'} size={14} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.title}</span>
                    <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '.05em', flex: 'none' }}>
                      {opt.kind === 'course' ? 'Course' : 'Series'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
          <button onClick={() => save(false)} disabled={!canSave || saving} className="btn-secondary" style={{ padding: '10px 18px', fontSize: '0.85rem', opacity: canSave ? 1 : 0.55 }}>
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button onClick={() => save(true)} disabled={!canSave || saving} className="btn-primary" style={{ padding: '10px 18px', fontSize: '0.85rem', opacity: canSave ? 1 : 0.55 }}>
            {saving ? 'Saving…' : 'Save & publish to store'}
          </button>
        </div>
      </div>
    );
  }

  /* ── List ───────────────────────────────────────────────────────────── */
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Store Products</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            What students can buy — a course, a test series, or a bundle of both.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => openNew(t.key)} className="btn-secondary" style={{ padding: '8px 13px', fontSize: '0.8rem' }} title={t.hint}>
              + {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '14px' }}>{error}</div>}
      {success && <div className="alert-success" style={{ marginBottom: '14px' }}>{success}</div>}

      {products.length === 0 ? (
        <div className="glass-panel" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>Nothing is on sale yet</div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Create a product above. Until one is published, the student store shows its empty state and points at activation codes.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
          {products.map((p) => (
            <div key={p.id} className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    {TYPES.find((t) => t.key === p.type)?.label || p.type}
                  </div>
                  <h3 style={{ margin: '3px 0 0', fontSize: '0.98rem', fontWeight: 700 }}>{p.title}</h3>
                </div>
                <span
                  style={{
                    padding: '3px 9px', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, flex: 'none',
                    background: p.is_published ? 'var(--success-bg)' : 'var(--warning-bg)',
                    color: p.is_published ? 'var(--success)' : 'var(--warning)',
                  }}
                >
                  {p.is_published ? 'Live' : 'Draft'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span><strong style={{ color: 'var(--text)' }}>{rupees(p.price_paise)}</strong></span>
                <span>{p.items_count} item{p.items_count === 1 ? '' : 's'}</span>
                <span>{p.entitlements_count} sold</span>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {p.access_days ? `${p.access_days} days access` : 'Lifetime access'} · {p.exam_category}
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--line)', paddingTop: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => openEdit(p)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.76rem' }}>Edit</button>
                <button onClick={() => togglePublish(p)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.76rem' }}>
                  {p.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => remove(p)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.76rem', color: 'var(--danger)' }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
