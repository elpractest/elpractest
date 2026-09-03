import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', password_confirmation: '' });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [searchParams] = useSearchParams();

  // Social login
  const [socialEnabled, setSocialEnabled] = useState(false);
  useEffect(() => {
    api.get('/api/settings/public').then(res => {
      const s = res.data.settings || {};
      setSocialEnabled(s.social_login_enabled === 'true' || s.social_login_enabled === true);
    }).catch(() => {});
  }, []);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');
    setErrors({});
    setSubmitting(true);

    try {
      const payload = { ...form };
      // reCAPTCHA: send token if site key is configured
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
      if (siteKey && window.grecaptcha) {
        try {
          const token = await window.grecaptcha.execute(siteKey, { action: 'register' });
          payload.recaptcha_token = token;
        } catch (recapErr) {
          // If reCAPTCHA fails, try anyway (server may skip in dev)
        }
      }
      if (!payload.phone) delete payload.phone;

      await api.post('/api/register', payload);
      setSuccess(true);
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else if (err.response?.status === 429) {
        setGlobalError('Too many attempts. Please wait a moment and try again.');
      } else {
        setGlobalError(err.response?.data?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Load reCAPTCHA script if site key is configured
  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey && !document.getElementById('recaptcha-script')) {
      const script = document.createElement('script');
      script.id = 'recaptcha-script';
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  if (success) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '40px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}><span style={{ display: 'inline-flex', padding: '15px', borderRadius: '18px', background: 'var(--accent-soft)', color: 'var(--accent-color)', border: '1px solid var(--accent-border)' }}><Icon name="mail" size={34} /></span></div>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-color)' }}>Check Your Inbox</h2>
          <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
            We've sent a verification link to <strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>. 
            Please click the link in the email to verify your account, then come back to log in.
          </p>
          <Link to="/login" className="btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
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
      <div style={{ color: 'var(--danger-text)', fontSize: '0.8rem', marginTop: '4px' }}>
        {Array.isArray(errList) ? errList[0] : errList}
      </div>
    );
  };

  const handleSocialLogin = (provider) => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    window.location.href = `${apiBase}/api/auth/${provider}/redirect`;
  };

  return (
    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-color)' }}>Create Account</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Join e-Learning Practest and start your exam preparation</p>
        </div>

        {searchParams.get('error') === 'social_failed' && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', fontSize: '0.85rem' }}>
            Social login failed. Please try again or register with email.
          </div>
        )}

        {globalError && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', fontSize: '0.85rem' }}>
            {globalError}
          </div>
        )}

        {socialEnabled && (
          <>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => handleSocialLogin('google')} className="btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '0.85rem', gap: '8px' }} type="button">
                Google
              </button>
              <button onClick={() => handleSocialLogin('facebook')} className="btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '0.85rem', gap: '8px' }} type="button">
                Facebook
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>or register with email</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name *</label>
            <input type="text" className="form-input" placeholder="e.g. Rahul Sharma" value={form.name} onChange={handleChange('name')} required disabled={submitting} />
            {renderFieldError('name')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address *</label>
            <input type="email" className="form-input" placeholder="e.g. student@example.com" value={form.email} onChange={handleChange('email')} required disabled={submitting} />
            {renderFieldError('email')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Phone Number <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>(optional — needed for course activation)</span></label>
            <input type="tel" className="form-input" placeholder="e.g. 9876543210" value={form.phone} onChange={handleChange('phone')} disabled={submitting} />
            {renderFieldError('phone')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password *</label>
            <input type="password" className="form-input" placeholder="Min 8 chars, mixed case + number" value={form.password} onChange={handleChange('password')} required disabled={submitting} />
            {renderFieldError('password')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Confirm Password *</label>
            <input type="password" className="form-input" placeholder="Re-enter your password" value={form.password_confirmation} onChange={handleChange('password_confirmation')} required disabled={submitting} />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: '3px', accentColor: 'var(--accent-color)' }} />
            <span>I agree to the Terms of Service and Privacy Policy</span>
          </label>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '4px' }} disabled={submitting || !agreed}>
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" className="link-btn" style={{ textDecoration: 'none' }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
