import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Admin2FAVerify({ setUser }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/api/2fa/verify', { code });
      
      // Refresh user session state
      const meRes = await api.get('/api/me');
      setUser(meRes.data.user || meRes.data);
      
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid passcode. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      await api.post('/api/logout');
    } catch (e) {
      // ignore
    } finally {
      setUser(null);
      navigate('/login');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px', backgroundColor: '#0b0f19' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Two-Factor Security</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>Enter the 6-digit verification code from your authenticator app.</p>
        </div>

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Passcode</label>
            <input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="form-input"
              style={{ textAlign: 'center', fontSize: '1.6rem', letterSpacing: '8px', fontWeight: 'bold' }}
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem' }} disabled={loading || code.length !== 6}>
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>

        <button onClick={handleBackToLogin} className="btn-secondary" style={{ width: '100%', padding: '12px', fontSize: '0.9rem' }}>
          Back to Login
        </button>
      </div>
    </div>
  );
}
