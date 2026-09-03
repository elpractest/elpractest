import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';

export default function ActivationModal({ user, onClose, onSuccess, presetCourseId }) {
  const [tab, setTab] = useState('request'); // 'request' | 'redeem'
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [file, setFile] = useState(null);

  const [code, setCode] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  // Load public courses and batches for request tab
  useEffect(() => {
    setLoadingCourses(true);
    api.get('/api/courses/public')
      .then(res => {
        const list = res.data.courses || res.data || [];
        setCourses(list);
        // Arrived from a specific Store card ("Request access" on one
        // course) — jump straight to its batch instead of making the
        // student find it again in a list of every course. A course with
        // more than one open batch still needs a manual pick, since we
        // can't guess which one they already paid for offline.
        if (presetCourseId) {
          const match = list.find((c) => c.id === presetCourseId);
          if (match?.batches?.length === 1) {
            setSelectedBatchId(String(match.batches[0].id));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCourses(false));
  }, [presetCourseId]);

  // Scoped to one course when opened from its Store card — this is a
  // *published* course (Course.is_published, via /api/courses/public) that
  // may still be entirely absent from that list, or published with no
  // priced active batch: a course can sit in the Store (a Product wraps it)
  // without ever having been published on the course record itself, since
  // those are two independent admin actions. That gap is real, so it's
  // surfaced here rather than left as a dropdown with nothing in it.
  const presetCourse = presetCourseId ? courses.find((c) => c.id === presetCourseId) : null;
  const presetCourseUnavailable = presetCourseId && !loadingCourses && !presetCourse;
  const batchOptions = presetCourseId
    ? (presetCourse?.batches || []).map((b) => ({ ...b, courseTitle: presetCourse.title }))
    : courses.flatMap((c) => (c.batches || []).map((b) => ({ ...b, courseTitle: c.title })));

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!user?.phone_verified) {
      setError('Mobile OTP verification is required before submitting an activation request.');
      return;
    }

    if (!selectedBatchId || !paymentRef || !file) {
      setError('Please select a batch, enter your payment reference, and attach proof document.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('batch_id', selectedBatchId);
      formData.append('payment_reference', paymentRef);
      formData.append('proof_document', file);

      await api.post('/api/student/activation-requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccessMsg('Your activation request has been submitted! An admin will review your receipt shortly.');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.phone_verified === false) {
        setError('Please verify your phone number first before requesting activation.');
      } else {
        setError(err.response?.data?.message || err.response?.data?.errors?.payment_reference?.[0] || 'Failed to submit activation request.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedeemSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!code || code.trim().length !== 8) {
      setError('Please enter a valid 8-character activation code.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/api/student/activation-codes/redeem', {
        code: code.trim().toUpperCase(),
      });

      setSuccessMsg(res.data.message || 'Activation code redeemed! Course unlocked.');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired activation code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sheet-overlay" style={{ zIndex: 1000 }}>
      <div
        className="sheet-panel"
        style={{
          maxWidth: '520px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div className="sheet-handle" aria-hidden="true" />
        {/* Close */}
        <button
          onClick={onClose}
          className="adm-rowaction"
          aria-label="Close"
          style={{ position: 'absolute', top: '14px', right: '14px' }}
        >
          <Icon name="x" size={18} />
        </button>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '16px' }}>
          <button
            onClick={() => { setTab('request'); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === 'request' ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: tab === 'request' ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Request Batch Activation
          </button>
          <button
            onClick={() => { setTab('redeem'); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === 'redeem' ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: tab === 'redeem' ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Redeem Activation Code
          </button>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', fontSize: '0.85rem' }}>
            {error}
            {!user?.phone_verified && tab === 'request' && (
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={() => { onClose(); navigate('/verify-otp'); }}
                  style={{ background: 'var(--warning)', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Verify Phone Number Now →
                </button>
              </div>
            )}
          </div>
        )}

        {successMsg && (
          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--success-text)', fontSize: '0.85rem' }}>
            {successMsg}
          </div>
        )}

        {tab === 'request' ? (
          <form onSubmit={handleRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {presetCourseId ? 'Batch' : 'Select Course & Batch *'}
              </label>
              {loadingCourses ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading batches...</div>
              ) : presetCourseUnavailable ? (
                <div style={{ background: 'var(--warning-bg, var(--danger-bg))', border: '1px solid var(--warning-border, var(--danger-border))', padding: '10px 14px', borderRadius: '8px', color: 'var(--warning-text, var(--danger-text))', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  This course isn't open for activation requests yet — it has no active priced batch. Ask your admin to set one up, or use Buy if online payment is available.
                </div>
              ) : batchOptions.length === 0 ? (
                <div style={{ background: 'var(--warning-bg, var(--danger-bg))', border: '1px solid var(--warning-border, var(--danger-border))', padding: '10px 14px', borderRadius: '8px', color: 'var(--warning-text, var(--danger-text))', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  {presetCourse?.title || 'This course'} has no batch open for activation requests right now.
                </div>
              ) : (
                <select
                  className="form-input"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  required
                  style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                >
                  <option value="" style={{ background: 'var(--bg-color)' }}>-- Select {presetCourseId ? 'Batch' : 'Course Batch'} --</option>
                  {batchOptions.map((b) => (
                    <option key={b.id} value={b.id} style={{ background: 'var(--bg-color)' }}>
                      {presetCourseId ? b.name : `${b.courseTitle} — ${b.name}`} ({b.price_in_rupees || (b.price_paise ? `₹${b.price_paise / 100}` : 'Free')})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Payment Reference / Transaction ID *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. UTR-9876543210 or Bank Reference No."
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Upload Payment Proof (JPG, PNG, PDF ≤ 4MB) *</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="form-input"
                onChange={(e) => setFile(e.target.files[0])}
                required
                style={{ padding: '8px' }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={submitting || !selectedBatchId || !paymentRef || !file}
            >
              {submitting ? 'Submitting Request...' : 'Submit Activation Request'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRedeemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>8-Character Activation Code *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. PRAC8821"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                required
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', fontWeight: 700 }}
              />
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Enter the unique 8-character activation code issued by your coaching admin to immediately unlock course access.
            </p>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={submitting || code.trim().length !== 8}
            >
              {submitting ? 'Redeeming Code...' : 'Redeem Code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
