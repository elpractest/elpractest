import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Admin2FASetup({ setUser }) {
  const [qrSvg, setQrSvg] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingQr, setFetchingQr] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Generate 2FA secret and QR SVG on mount
    api.post('/api/2fa/setup')
      .then((res) => {
        setQrSvg(res.data.qr_code_svg);
        setSecretKey(res.data.secret);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to initialize 2FA setup. Please try again.');
      })
      .finally(() => {
        setFetchingQr(false);
      });
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/2fa/enable', { code });
      
      // Refresh user session state
      const meRes = await api.get('/api/me');
      setUser(meRes.data.user || meRes.data);
      
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px', backgroundColor: 'var(--bg-color)' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '40px', display: 'flex', flexDirection: 'col', gap: '24px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Secure Admin Account</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>Two-Factor Authentication (2FA) is mandatory for administrator accounts.</p>
        </div>

        {fetchingQr ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            Generating secure keys...
          </div>
        ) : error && !qrSvg ? (
          <div style={{ padding: '16px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.95rem' }}>
            {error}
          </div>
        ) : (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div 
                style={{ 
                  background: '#ffffff', 
                  padding: '12px', 
                  borderRadius: '12px', 
                  display: 'inline-flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 8px 24px var(--surface-sunken)'
                }}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Or enter secret key manually:</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', letterSpacing: '2px', color: 'var(--accent-color)', fontWeight: 'bold', marginTop: '4px', background: 'var(--surface-2)', padding: '6px 12px', borderRadius: '6px' }}>
                  {secretKey}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              1. Scan the QR code with Google Authenticator or any TOTP client.<br />
              2. Enter the 6-digit verification code below to activate.
            </div>

            {error && (
              <div style={{ padding: '12px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verification Code</label>
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="form-input"
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '6px', fontWeight: 'bold' }}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem' }} disabled={loading || code.length !== 6}>
              {loading ? 'Activating Security...' : 'Activate & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
