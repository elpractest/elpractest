import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import {
  PageHead, EmptyState, Modal, Field, FormGrid, Notice, StatusDot, Badge, Num,
} from '../components/admin/ui';

/**
 * Super-admin management for Home promo banners (Phase 4). Full CRUD + image
 * upload against /api/super-admin/banners. The images and text set here are
 * what the student app's Home carousel (and the public /banners/public feed)
 * display. Uses the shared admin styling / token system.
 */
const EMPTY = { title: '', subtitle: '', kicker: '', cta_label: '', cta_url: '', exam_category: '', sort_order: 0, is_active: true };

function BannerRow({ banner, onEdit, onDelete, onUploaded, onError }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post(`/api/super-admin/banners/${banner.id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(banner.id, res.data.image_url);
    } catch (err) {
      onError(err.response?.data?.message || 'Image upload failed. Use a 16:9 image (1920×1080) under 2MB.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '14px',
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: '1px solid var(--line)',
        opacity: banner.is_active ? 1 : 0.6,
      }}
    >
      {/* 16:9, matching what students actually see — a preview at any other
          ratio would show a crop the student app never renders. */}
      <div
        style={{
          width: '112px',
          aspectRatio: '16 / 9',
          borderRadius: '12px',
          flex: 'none',
          overflow: 'hidden',
          border: '1px solid var(--line)',
          background: banner.image_url ? `center/cover url(${banner.image_url})` : 'var(--surf)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--muted)',
        }}
      >
        {!banner.image_url && <Icon name="image" size={18} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ font: '600 13.5px var(--font-body)', color: 'var(--tx)' }}>{banner.title}</span>
          {banner.kicker && <Badge tone="primary">{banner.kicker}</Badge>}
          <StatusDot tone={banner.is_active ? 'success' : 'neutral'}>{banner.is_active ? 'Visible' : 'Hidden'}</StatusDot>
        </div>
        {banner.subtitle && (
          <div style={{ font: '400 12.5px var(--font-body)', color: 'var(--muted)', marginTop: '3px' }}>{banner.subtitle}</div>
        )}
        <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '4px' }}>
          Order <Num style={{ fontSize: '11.5px' }}>{banner.sort_order}</Num>
          {banner.exam_category ? ` · ${banner.exam_category}` : ''}
          {banner.cta_url ? ` · → ${banner.cta_url}` : ''}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={upload} style={{ display: 'none' }} />
      <div style={{ display: 'flex', gap: '7px', flex: 'none', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '7px 12px', minHeight: '36px', fontSize: '11.5px' }}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="upload" size={15} />
          {busy ? 'Uploading…' : 'Image'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '7px 12px', minHeight: '36px', fontSize: '11.5px' }}
          onClick={() => onEdit(banner)}
        >
          <Icon name="edit" size={15} />
          Edit
        </button>
        <button
          type="button"
          className="btn-secondary"
          aria-label={`Delete ${banner.title}`}
          style={{ padding: '7px 10px', minHeight: '36px', fontSize: '11.5px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
          onClick={() => onDelete(banner)}
        >
          <Icon name="trash" size={15} />
        </button>
      </div>
    </div>
  );
}

export default function SuperAdminBanners() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null | EMPTY (new) | banner (edit)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/api/super-admin/banners')
      .then((res) => setBanners(res.data || []))
      .catch(() => setError('Failed to load banners.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title?.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, sort_order: Number(form.sort_order) || 0 };
      if (form.id) await api.put(`/api/super-admin/banners/${form.id}`, payload);
      else await api.post('/api/super-admin/banners', payload);
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (banner) => {
    try {
      await api.delete(`/api/super-admin/banners/${banner.id}`);
      load();
    } catch {
      setError('Delete failed.');
    }
  };

  const onUploaded = (id, url) => setBanners((bs) => bs.map((b) => (b.id === id ? { ...b, image_url: url } : b)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '940px' }}>
      <PageHead
        title="Home banners"
        subtitle="Promo cards on the student app’s Home carousel. A new banner appears for every student immediately."
      >
        <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
          <Icon name="plus" size={16} strokeWidth={2.4} />
          New banner
        </button>
      </PageHead>

      {error && !form && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '12px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: '76px', borderRadius: '12px', marginBottom: '10px' }} />
            ))}
          </div>
        ) : banners.length === 0 ? (
          <EmptyState
            icon="image"
            message="No banners yet. Create one and it appears on every student’s Home immediately."
            action={
              <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
                <Icon name="plus" size={16} strokeWidth={2.4} />
                New banner
              </button>
            }
          />
        ) : (
          <div>
            {banners.map((b) => (
              <BannerRow key={b.id} banner={b} onEdit={(bn) => setForm({ ...bn })} onDelete={setPendingDelete} onUploaded={onUploaded} onError={setError} />
            ))}
          </div>
        )}
      </div>

      {form && (
        <Modal
          title={form.id ? 'Edit banner' : 'New banner'}
          description="Use a 16:9 image (1920×1080) under 2MB. Keep the subject to the right — the left third sits under the text."
          onClose={() => { setForm(null); setError(''); }}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => { setForm(null); setError(''); }}>Cancel</button>
              <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save banner'}
              </button>
            </>
          }
        >
          {error && (
            <div style={{ marginBottom: '14px' }}>
              <Notice tone="danger" icon="alert">{error}</Notice>
            </div>
          )}

          <FormGrid>
            <Field label="Title" htmlFor="bn-title">
              <input id="bn-title" className="form-input" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Subtitle" htmlFor="bn-sub">
              <input id="bn-sub" className="form-input" value={form.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} />
            </Field>
            <Field label="Kicker (eyebrow)" htmlFor="bn-kick">
              <input id="bn-kick" className="form-input" value={form.kicker ?? ''} onChange={(e) => set('kicker', e.target.value)} />
            </Field>
            <Field label="CTA label" htmlFor="bn-cta">
              <input id="bn-cta" className="form-input" value={form.cta_label ?? ''} onChange={(e) => set('cta_label', e.target.value)} />
            </Field>
            <Field label="CTA link" hint="A /path inside the app, or a full https:// URL." htmlFor="bn-url">
              <input id="bn-url" className="form-input" value={form.cta_url ?? ''} onChange={(e) => set('cta_url', e.target.value)} />
            </Field>
            <Field label="Exam category" htmlFor="bn-exam">
              <input id="bn-exam" className="form-input" value={form.exam_category ?? ''} onChange={(e) => set('exam_category', e.target.value)} />
            </Field>
            <Field label="Sort order" htmlFor="bn-order">
              <input id="bn-order" className="form-input" type="number" value={form.sort_order ?? 0} onChange={(e) => set('sort_order', e.target.value)} />
            </Field>
            <Field label="Visibility">
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  minHeight: '46px',
                  padding: '0 4px',
                  font: '500 13px var(--font-body)',
                  color: 'var(--tx2)',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={!!form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
                Show on Home
              </label>
            </Field>
          </FormGrid>

          {form.id && (
            <p style={{ margin: '16px 0 0', font: '400 12px/1.55 var(--font-body)', color: 'var(--muted)' }}>
              Save first, then use the row’s <strong>Image</strong> button to upload or replace the picture.
            </p>
          )}
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          danger
          title={`Delete “${pendingDelete.title}”?`}
          description="The banner and its image are removed. Students stop seeing it immediately."
          width={460}
          onClose={() => setPendingDelete(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => { const target = pendingDelete; setPendingDelete(null); remove(target); }}
              >
                Delete banner
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
