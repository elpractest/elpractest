import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../api';

export default function Login({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Social login settings
  const [socialEnabled, setSocialEnabled] = useState(false);
  useEffect(() => {
    api.get('/api/settings/public').then(res => {
      const s = res.data.settings || {};
      setSocialEnabled(s.social_login_enabled === 'true' || s.social_login_enabled === true);
    }).catch(() => {});

    // Handle social login error from redirect
    if (searchParams.get('error') === 'social_failed') {
      setError('Social login failed. Please try again or sign in with email.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await api.post('/api/login', { email, password });

      if (res.data['2fa_required']) {
        if (res.data['2fa_setup_needed']) {
          navigate('/admin/2fa/setup');
        } else {
          navigate('/admin/2fa/verify');
        }
        return;
      }

      // Fetch current user details
      const userRes = await api.get('/api/me');
      setUser(userRes.data.user || userRes.data);
      navigate('/dashboard');
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;

      if (status === 403 && data?.email_verified === false) {
        setError('Please verify your email address before logging in. Check your inbox for the verification link.');
      } else if (status === 429) {
        setError('Too many login attempts. Please wait a moment and try again.');
      } else {
        setError(data?.message || 'Invalid credentials. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialLogin = (provider) => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    window.location.href = `${apiBase}/api/auth/${provider}/redirect`;
  };

  return (
    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-color)' }}>Welcome to Practest</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Log in to your govt exam test prep account</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem', lineHeight: '1.4' }}>
            {error}
          </div>
        )}

        {socialEnabled && (
          <>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => handleSocialLogin('google')} className="btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '0.85rem', gap: '8px' }} type="button">
                <span>🔵</span> Google
              </button>
              <button onClick={() => handleSocialLogin('facebook')} className="btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '0.85rem', gap: '8px' }} type="button">
                <span>🔷</span> Facebook
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>or sign in with email</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent-color)', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={submitting}
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>Create Account</Link>
        </div>
      </div>
    </div>
  );
}
