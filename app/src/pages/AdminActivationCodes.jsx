import React, { useState, useEffect } from 'react';
import api from '../api';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>Activation Codes</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Bulk-generate and distribute alphanumeric course registration codes to students.</p>
        </div>
        <button 
          onClick={() => setShowForm(true)} 
          className="btn-primary"
        >
          🔑 Generate Codes
        </button>
      </div>

      {success && (
        <div style={{ padding: '16px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '8px', color: 'var(--success)' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Codes Table List */}
      <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.2rem', margin: '0 0 16px 0', fontWeight: 700 }}>Available Activation Codes</h2>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <th style={{ padding: '12px 16px' }}>Code</th>
              <th style={{ padding: '12px 16px' }}>Course / Batch Scope</th>
              <th style={{ padding: '12px 16px' }}>Redemptions (Times Used)</th>
              <th style={{ padding: '12px 16px' }}>Expires At</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && codes.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading activation codes...</td>
              </tr>
            ) : codes.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No activation codes generated yet.</td>
              </tr>
            ) : (
              codes.map((code) => {
                const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                const isFull = code.times_used >= code.max_uses;
                const isValid = !isExpired && !isFull;
                
                return (
                  <tr key={code.id} style={{ borderBottom: '1px solid var(--surface-2)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent-color)' }}>
                      {code.code}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div>{code.course?.title}</div>
                      {code.batch && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Batch: {code.batch.name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ fontWeight: 'bold' }}>{code.times_used}</span> / {code.max_uses} redemptions
                    </td>
                    <td style={{ padding: '16px' }}>
                      {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span 
                        style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold', 
                          padding: '2px 8px', 
                          borderRadius: '4px',
                          background: isValid ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color: isValid ? 'var(--success)' : 'var(--danger)'
                        }}
                      >
                        {isValid ? 'Valid' : isExpired ? 'Expired' : 'Max Redeemed'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Code Generation Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
              Bulk Code Generator
            </h3>
            
            <form onSubmit={handleGenerateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Target Course</label>
                <select 
                  value={form.course_id} 
                  onChange={(e) => setForm({ ...form, course_id: e.target.value, batch_id: '' })}
                  className="form-input"
                  required
                >
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Target Batch (Optional)</label>
                <select 
                  value={form.batch_id} 
                  onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
                  className="form-input"
                  disabled={!form.course_id}
                >
                  <option value="">All Batches (No Scope)</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Quantity to Generate</label>
                  <input 
                    type="number" 
                    value={form.quantity} 
                    onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) })} 
                    className="form-input" 
                    min={1} 
                    max={100}
                    required 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Max Uses Per Code</label>
                  <input 
                    type="number" 
                    value={form.max_uses} 
                    onChange={(e) => setForm({ ...form, max_uses: parseInt(e.target.value) })} 
                    className="form-input" 
                    min={1} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Expiration Date (Optional)</label>
                <input 
                  type="date" 
                  value={form.expires_at} 
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })} 
                  className="form-input" 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Generate</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
