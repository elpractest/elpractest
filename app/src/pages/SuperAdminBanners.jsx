import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import Icon from '../components/Icon';

/**
 * Super-admin management for Home promo banners (Phase 4). Full CRUD + image
 * upload against /api/super-admin/banners. The images and text set here are
 * what the student app's Home carousel (and the public /banners/public feed)
 * display. Uses the shared admin styling / token system.
 */
const EMPTY = { title: '', subtitle: '', kicker: '', cta_label: '', cta_url: '', exam_category: '', sort_order: 0, is_active: true };

function BannerRow({ banner, onEdit, onDelete, onUploaded }) {
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
      alert(err.response?.data?.message || 'Image upload failed (must be an image ≤ 2MB).');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '14px', display: 'flex', gap: '14px', alignItems: 'center', opacity: banner.is_active ? 1 : 0.6 }}>
      <div style={{ width: '120px', height: '68px', borderRadius: '10px', flex: 'none', overflow: 'hidden', background: banner.image_url ? `center/cover url(${banner.image_url})` : 'linear-gradient(120deg,#12203A,#0B1830)', display: 'grid', placeItems: 'center' }}>
        {!banner.image_url && <Icon name="upload" size={18} style={{ color: 'rgba(255,255,255,.6)' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ color: 'var(--tx)' }}>{banner.title}</strong>
          {banner.kicker && <span className="chip" style={{ fontSize: '0.6rem' }}>{banner.kicker}</span>}
          {!banner.is_active && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', border: '1px solid var(--line2)', padding: '2px 7px', borderRadius: '999px' }}>HIDDEN</span>}
        </div>
        {banner.subtitle && <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '2px' }}>{banner.subtitle}</div>}
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>
          order {banner.sort_order}{banner.exam_category ? ` · ${banner.exam_category}` : ''}{banner.cta_url ? ` · → ${banner.cta_url}` : ''}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={upload} style={{ display: 'none' }} />
      <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem' }} disabled={busy} onClick={() => fileRef.current?.click()}>
        <Icon name="upload" size={15} /> {busy ? '…' : 'Image'}
      </button>
      <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem' }} onClick={() => onEdit(banner)}>
        <Icon name="edit" size={15} /> Edit
      </button>
      <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }} onClick={() => onDelete(banner)}>
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

export default function SuperAdminBanners() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null | EMPTY (new) | banner (edit)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    if (!window.confirm(`Delete banner “${banner.title}”? This also removes its image.`)) return;
    try {
      await api.delete(`/api/super-admin/banners/${banner.id}`);
      load();
    } catch {
      alert('Delete failed.');
    }
  };

  const onUploaded = (id, url) => setBanners((bs) => bs.map((b) => (b.id === id ? { ...b, image_url: url } : b)));

  const field = (label, key, type = 'text') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
      {label}
      <input className="form-input" type={type} value={form[key] ?? ''} onChange={(e) => set(key, e.target.value)} />
    </label>
  );

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>Home Banners</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Promo cards shown on the student app’s Home carousel.</p>
        </div>
        {!form && (
          <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
            <Icon name="plus" size={16} /> New banner
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</div>
      )}

      {form && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{form.id ? 'Edit banner' : 'New banner'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {field('Title *', 'title')}
            {field('Subtitle', 'subtitle')}
            {field('Kicker (eyebrow)', 'kicker')}
            {field('CTA label', 'cta_label')}
            {field('CTA link (/path or https://)', 'cta_url')}
            {field('Exam category', 'exam_category')}
            {field('Sort order', 'sort_order', 'number')}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', alignSelf: 'end', paddingBottom: '10px' }}>
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active (visible)
            </label>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save banner'}</button>
            <button className="btn-secondary" onClick={() => { setForm(null); setError(''); }}>Cancel</button>
          </div>
          {form.id && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Tip: save first, then use the “Image” button on the row to upload/replace the picture.</p>}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner" /></div>
      ) : banners.length === 0 ? (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No banners yet. Create one — it appears on every student’s Home immediately.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {banners.map((b) => (
            <BannerRow key={b.id} banner={b} onEdit={(bn) => setForm({ ...bn })} onDelete={remove} onUploaded={onUploaded} />
          ))}
        </div>
      )}
    </div>
  );
}
