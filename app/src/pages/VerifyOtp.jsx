import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function VerifyOtp() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // phone | otp
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [autoSent, setAutoSent] = useState(false);
  const navigate = useNavigate();
  const otpInputRef = useRef(null);

  // Load existing phone from /me
  useEffect(() => {
    api.get('/api/me').then(res => {
      const user = res.data.user || res.data;
      if (user.phone) {
        setPhone(user.phone);
        // Auto-send OTP if phone exists
        if (!autoSent) {
          setAutoSent(true);
          sendOtp(user.phone);
        }
      }
    }).catch(() => {});
  }, []);

  const sendOtp = async (phoneNum) => {
    if (cooldown > 0) return;
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await api.post('/api/otp/send', { phone: phoneNum || phone });
      setStep('otp');
      setSuccess('OTP sent! Check your phone.');
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many OTP requests. Please wait before trying again.');
        // Extract retry-after if available
        setCooldown(60);
        const timer = setInterval(() => {
          setCooldown(prev => {
            if (prev <= 1) { clearInterval(timer); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError(err.response?.data?.message || 'Failed to send OTP.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await api.post('/api/otp/verify', { phone, otp });
      setSuccess('Phone verified successfully!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>📱</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-color)' }}>Verify Phone Number</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            {step === 'phone' 
              ? 'Enter your mobile number to receive a one-time verification code.' 
              : `Enter the 6-digit OTP sent to ${phone}`
            }
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#34d399', fontSize: '0.85rem' }}>
            {success}
          </div>
        )}

        {step === 'phone' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mobile Number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
                maxLength={20}
              />
            </div>
            <button
              onClick={() => sendOtp()}
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={submitting || !phone || cooldown > 0}
            >
              {submitting ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send OTP'}
            </button>
          </div>
        ) : (
          <form onSubmit={verifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>6-Digit OTP</label>
              <input
                ref={otpInputRef}
                type="text"
                className="form-input"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={submitting}
                maxLength={6}
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.4rem', fontWeight: 700 }}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submitting || otp.length !== 6}>
              {submitting ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={() => sendOtp()}
              className="btn-secondary"
              style={{ width: '100%', fontSize: '0.85rem' }}
              disabled={cooldown > 0}
            >
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </button>
          </form>
        )}

        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Skip for now →
        </button>
        <p style={{ margin: 0, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Phone verification is required to request course activation.
        </p>
      </div>
    </div>
  );
}
