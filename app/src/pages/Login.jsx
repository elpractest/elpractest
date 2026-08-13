import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import logoMark from '../assets/logo-mark.png';

export default function Login({ setUser }) {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language.startsWith('hi');
  const toggleLang = () => i18n.changeLanguage(isHindi ? 'en' : 'hi');
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
      const u = userRes.data.user || userRes.data;
      setUser(u);

      if (u.roles?.includes('super-admin')) {
        navigate('/super-admin/dashboard');
      } else if (u.roles?.includes('admin')) {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
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
    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px', position: 'relative' }}>
      {/* language pill — usable before sign-in, persisted */}
      <button className="lang-pill" onClick={toggleLang} aria-label="Toggle language" title="Language" style={{ position: 'fixed', top: '18px', right: '18px', zIndex: 2000 }}>
        <span className={!isHindi ? 'on' : ''}>EN</span>
        <span className={`hi ${isHindi ? 'on' : ''}`}>हिं</span>
      </button>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <span className="brand-mark" style={{ width: '58px', height: '58px', borderRadius: '16px' }}>
            <img src={logoMark} alt="Practest" style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
          </span>
          <div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--tx)', letterSpacing: '-0.02em' }}>{t('login.welcome')}</h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{t('login.subtitle')}</p>
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', fontSize: '0.85rem', lineHeight: '1.4' }}>
            {error}
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
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('login.orEmail')}</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('login.email')}</label>
            <input
              type="email"
              className="form-input"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('login.password')}</label>
              <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent-color)', textDecoration: 'none' }}>
                {t('login.forgot')}
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
            {submitting ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {t('login.noAccount')}{' '}
          <Link to="/register" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>{t('login.create')}</Link>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link to="/welcome" style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none' }}>New to Practest? See what's inside →</Link>
        </div>
      </div>
    </div>
  );
}
