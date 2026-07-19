import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Step 1: CSRF cookie is pre-fetched automatically via interceptor,
      // but let's call login directly (which will trigger it)
      const res = await api.post('/api/login', { email, password });
      
      if (res.data['2fa_required']) {
        if (res.data['2fa_setup_needed']) {
          navigate('/admin/2fa/setup');
        } else {
          navigate('/admin/2fa/verify');
        }
        return;
      }

      // Step 2: Fetch current user details
      const userRes = await api.get('/api/me');
      setUser(userRes.data.user || userRes.data);
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.message || 
        err.response?.data?.errors?.email?.[0] || 
        'Invalid credentials. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
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
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
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

        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Tip: Log in with admin credentials to generate activation codes.
        </div>
      </div>
    </div>
  );
}
