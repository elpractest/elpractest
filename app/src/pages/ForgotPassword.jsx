import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await api.post('/api/forgot-password', { email });
      setSent(true);
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many requests. Please wait before trying again.');
      } else {
        setError(err.response?.data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><span style={{ display: 'inline-flex', padding: '15px', borderRadius: '18px', background: 'var(--accent-soft)', color: 'var(--accent-color)', border: '1px solid var(--accent-border)' }}><Icon name="mail" size={34} /></span></div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-color)' }}>Check Your Inbox</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
            If an account exists with <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>, we've sent a password reset link. 
            Please check your email and click the link to reset your password.
          </p>
          <Link to="/login" className="btn-primary" style={{ display: 'inline-flex', textDecoration: 'none', justifyContent: 'center' }}>
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-color)' }}>Forgot Password?</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <Link to="/login" style={{ textAlign: 'center', color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}
