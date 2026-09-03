import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';

export default function VerifyEmailNotice() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [resendEmail, setResendEmail] = useState(email);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const handleResend = async () => {
    if (cooldown > 0 || !resendEmail) return;
    setResending(true);
    setResendMsg('');

    try {
      await api.post('/api/email/resend', { email: resendEmail });
      setResendMsg('Verification email sent! Check your inbox.');
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      if (err.response?.status === 429) {
        setResendMsg('Too many requests. Please wait before trying again.');
      } else {
        setResendMsg('Failed to resend. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><span style={{ display: 'inline-flex', padding: '15px', borderRadius: '18px', background: 'var(--accent-soft)', color: 'var(--accent-color)', border: '1px solid var(--accent-border)' }}><Icon name="mail" size={34} /></span></div>
        <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-color)' }}>Verify Your Email</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
          We've sent a verification link to your email. Please click the link to verify your account before logging in.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'left' }}>Didn't receive the email? Enter your email to resend:</label>
          <input
            type="email"
            className="form-input"
            placeholder="Your email address"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
          />
          <button
            onClick={handleResend}
            className="btn-secondary"
            disabled={resending || cooldown > 0 || !resendEmail}
            style={{ width: '100%' }}
          >
            {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Verification Email'}
          </button>
        </div>

        {resendMsg && (
          <div style={{ 
            background: resendMsg.includes('sent') ? 'var(--success-bg)' : 'var(--danger-bg)', 
            border: `1px solid ${resendMsg.includes('sent') ? 'var(--success-border)' : 'var(--danger-border)'}`,
            padding: '12px 16px', borderRadius: '8px', 
            color: resendMsg.includes('sent') ? 'var(--success-text)' : 'var(--danger-text)', 
            fontSize: '0.85rem' 
          }}>
            {resendMsg}
          </div>
        )}

        <Link to="/login" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}
