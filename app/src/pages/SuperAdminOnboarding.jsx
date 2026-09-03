import React, { useState, useEffect } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import {
  PageHead, EmptyState, Modal, Field, FormSection, Notice, Num,
} from '../components/admin/ui';

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
  const [resetError, setResetError] = useState('');

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
      setResetError('Use at least 8 characters.');
      return;
    }
    setResetError('');

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '1040px' }}>
      <PageHead
        title="Admin accounts"
        subtitle="Onboard this deployment’s Admin owner, and help them back in when they are locked out."
      />

      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}
      {success && <Notice tone="success" icon="check-circle" onDismiss={() => setSuccess('')}>{success}</Notice>}

      <div className="adm-onboard-grid">
        {/* Onboarding form */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '20px', padding: '20px 22px' }}>
          <FormSection
            title="Onboard the Admin"
            description="One Admin account per tenant deployment — that is the white-label model, not a limit that can be raised here."
          >
            {loading ? (
              <div className="skeleton" style={{ height: '220px', borderRadius: '14px' }} />
            ) : adminExists ? (
              <Notice tone="primary" icon="shield-check">
                This deployment already has an active Admin account. To hand the console to someone else, reset the
                existing account’s password rather than creating a second owner.
              </Notice>
            ) : (
              <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="Full name" htmlFor="ob-name">
                  <input
                    id="ob-name"
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Raj Sharma"
                    required
                  />
                </Field>
                <Field label="Email address" htmlFor="ob-email">
                  <input
                    id="ob-email"
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. raj@sharmaclasses.com"
                    required
                  />
                </Field>
                <Field label="Initial password" hint="At least 8 characters. They set up 2FA on first sign-in." htmlFor="ob-pass">
                  <input
                    id="ob-pass"
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                  />
                </Field>
                <Field label="Phone number" hint="Optional." htmlFor="ob-phone">
                  <input
                    id="ob-phone"
                    type="text"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                  />
                </Field>

                <div className="adm-formfoot">
                  <button type="submit" className="btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Onboarding…' : 'Onboard & set up 2FA'}
                  </button>
                </div>
              </form>
            )}
          </FormSection>
        </div>

        {/* Directory */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '20px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)' }}>
            <h3 className="t-heading" style={{ margin: 0, color: 'var(--tx)' }}>Support directory</h3>
            <p style={{ margin: '5px 0 0', font: '400 12.5px/1.55 var(--font-body)', color: 'var(--muted)' }}>
              Resetting a password signs the admin out everywhere.
            </p>
          </div>

          {loading ? (
            <div style={{ padding: '14px' }}>
              <div className="skeleton" style={{ height: '96px', borderRadius: '14px' }} />
            </div>
          ) : admins.length === 0 ? (
            <EmptyState icon="users" message="No Admin account exists yet. Use the panel on the left to create one." />
          ) : (
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  style={{
                    background: 'var(--card2)',
                    border: '1px solid var(--line)',
                    borderRadius: '14px',
                    padding: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: '600 13.5px var(--font-body)', color: 'var(--tx)' }}>{admin.name}</div>
                    <div style={{ font: '400 12.5px var(--font-body)', color: 'var(--muted)', marginTop: '2px' }}>{admin.email}</div>
                    {admin.phone && (
                      <div style={{ marginTop: '2px' }}>
                        <Num style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>{admin.phone}</Num>
                      </div>
                    )}
                    <div className="t-overline" style={{ marginTop: '6px', fontSize: '9.5px', color: 'var(--muted)' }}>
                      CREATED {new Date(admin.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setResettingUser(admin); setResetError(''); }}
                    className="btn-secondary"
                    style={{ padding: '8px 14px', minHeight: '40px', fontSize: '12px' }}
                  >
                    <Icon name="key" size={15} />
                    Reset password
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .adm-onboard-grid { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; }
        @media (min-width: 1024px) { .adm-onboard-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>

      {/* Password reset */}
      {resettingUser && (
        <Modal
          title="Reset admin password"
          description={`A new password for ${resettingUser.name} (${resettingUser.email}).`}
          width={460}
          onClose={() => { setResettingUser(null); setNewPassword(''); setResetError(''); }}
          footer={
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setResettingUser(null); setNewPassword(''); setResetError(''); }}
              >
                Cancel
              </button>
              <button type="submit" form="admin-reset-form" className="btn-primary" disabled={actionLoading}>
                {actionLoading ? 'Resetting…' : 'Reset password'}
              </button>
            </>
          }
        >
          <form id="admin-reset-form" onSubmit={handleResetPassword}>
            <Field label="New password" error={resetError} hint="At least 8 characters." htmlFor="ob-newpass">
              <input
                id="ob-newpass"
                type="password"
                className={`form-input${resetError ? ' has-error' : ''}`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
