import React, { useState, useEffect } from 'react';
import api from '../api';

export default function SuperAdminOnboarding() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Create Admin form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Password reset modal state
  const [resettingUser, setResettingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/super-admin/admins');
      setAdmins(res.data || []);
    } catch (err) {
      setError('Failed to fetch Admin account details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/api/super-admin/admins', {
        name,
        email,
        password,
        phone
      });
      setSuccess('Admin account created successfully.');
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create Admin account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post(`/api/super-admin/admins/${resettingUser.id}/reset-password`, {
        password: newPassword
      });
      setSuccess(`Password for ${resettingUser.email} has been reset successfully.`);
      setResettingUser(null);
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const adminExists = admins.length > 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
        <span>⏳ Loading account directory...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          Onboarding &amp; Support Tooling
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Onboard the coaching institute's Admin owner or assist them with support tasks like password resets.
        </p>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', marginBottom: '24px', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--success-text)', marginBottom: '24px', fontSize: '0.9rem' }}>
          ✅ {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        
        {/* Onboarding Form */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Onboard Admin Account</h2>
          
          {adminExists ? (
            <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-soft)', padding: '16px', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
              ℹ️ <strong>Limit Reached:</strong> This deployment already has an active Admin account. In alignment with our white-label business model, only exactly one Admin account is allowed per tenant deployment.
            </div>
          ) : (
            <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Raj Sharma"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. raj@sharmaclasses.com"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Initial Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone Number (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={actionLoading}
                style={{ marginTop: '8px' }}
              >
                {actionLoading ? '⏳ Onboarding...' : 'Onboard & Setup 2FA'}
              </button>
            </form>
          )}
        </div>

        {/* Support Tooling */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Support Directory</h2>
            
            {admins.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '40px 0' }}>
                No active Admin account detected. Use the onboarding panel to create one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{admin.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{admin.email}</div>
                      {admin.phone && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>📞 {admin.phone}</div>}
                      <div style={{ fontSize: '0.7rem', color: 'var(--surface-strong)', marginTop: '6px' }}>
                        Created: {new Date(admin.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <button
                      onClick={() => setResettingUser(admin)}
                      className="btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '0.8rem', borderColor: 'var(--warning)', color: 'var(--warning-text)' }}
                    >
                      Reset Password
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Password Reset Modal */}
      {resettingUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--overlay)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={handleResetPassword}
            className="glass-panel"
            style={{ width: '400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Reset Admin Password
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Enter a new password for <strong>{resettingUser.name}</strong> ({resettingUser.email}).
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>New Password</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={actionLoading}
                style={{ flex: 1, background: 'var(--warning)', boxShadow: 'none' }}
              >
                {actionLoading ? '⏳ Resetting...' : 'Reset Password'}
              </button>
              <button
                type="button"
                onClick={() => { setResettingUser(null); setNewPassword(''); }}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
