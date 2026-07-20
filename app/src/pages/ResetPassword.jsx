import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [form, setForm] = useState({ email: emailParam, password: '', password_confirmation: '' });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrors({});
    setSubmitting(true);

    try {
      await api.post('/api/reset-password', {
        token,
        email: form.email,
        password: form.password,
        password_confirmation: form.password_confirmation,
      });
      setSuccess(true);
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setError(err.response?.data?.message || 'Failed to reset password. The link may be invalid or expired.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '3rem' }}>❌</div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#f87171' }}>Invalid Reset Link</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            This password reset link is invalid. Please request a new one.
          </p>
          <Link to="/forgot-password" className="btn-primary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
            Request New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '3rem' }}>✅</div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-color)' }}>Password Reset!</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Your password has been reset successfully. You can now log in with your new password.
          </p>
          <Link to="/login" className="btn-primary" style={{ display: 'inline-flex', textDecoration: 'none', justifyContent: 'center' }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const renderFieldError = (field) => {
    const errList = errors[field];
    if (!errList) return null;
    return (
      <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '4px' }}>
        {Array.isArray(errList) ? errList[0] : errList}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-color)' }}>Reset Password</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Choose a new password for your account.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</label>
            <input type="email" className="form-input" value={form.email} onChange={handleChange('email')} required disabled={submitting} />
            {renderFieldError('email')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>New Password</label>
            <input type="password" className="form-input" placeholder="Min 8 chars, mixed case + number" value={form.password} onChange={handleChange('password')} required disabled={submitting} />
            {renderFieldError('password')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Confirm New Password</label>
            <input type="password" className="form-input" placeholder="Re-enter your new password" value={form.password_confirmation} onChange={handleChange('password_confirmation')} required disabled={submitting} />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <Link to="/login" style={{ textAlign: 'center', color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}
