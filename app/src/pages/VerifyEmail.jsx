import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const hash = searchParams.get('hash');
  const [status, setStatus] = useState('verifying'); // verifying | success | already | error
  const [message, setMessage] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    if (!id || !hash) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email and try again.');
      return;
    }

    // Guard against React StrictMode double-fire
    if (calledRef.current) return;
    calledRef.current = true;

    api.get(`/api/email/verify/${id}/${hash}`)
      .then(res => {
        // Treat 'already verified' as success on first visit — the user just clicked
        // the link for the first time; the double-fire or a race is the only reason
        // we'd see 'already' here. Show the positive "Verified!" message.
        setStatus('success');
        setMessage(res.data.message?.includes('already')
          ? 'Your email has been verified successfully. You can now log in.'
          : res.data.message);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed. The link may be invalid or expired.');
      });
  }, [id, hash]);

  const titles = {
    verifying: 'Verifying...',
    success: 'Email Verified!',
    already: 'Already Verified',
    error: 'Verification Failed'
  };

  const medallion = status === 'verifying'
    ? <div className="spinner" />
    : status === 'error'
      ? <span style={{ display: 'inline-flex', padding: '15px', borderRadius: '18px', background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)' }}><Icon name="x" size={34} /></span>
      : <span style={{ display: 'inline-flex', padding: '15px', borderRadius: '18px', background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}><Icon name="check-circle" size={34} /></span>;

  return (
    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>{medallion}</div>
        <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: status === 'error' ? 'var(--danger-text)' : 'var(--accent-color)' }}>
          {titles[status]}
        </h2>
        
        {status === 'verifying' ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Please wait while we verify your email address...
          </p>
        ) : (
          <>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              {message}
            </p>
            {(status === 'success' || status === 'already') && (
              <Link to="/login" className="btn-primary" style={{ display: 'inline-flex', textDecoration: 'none', justifyContent: 'center' }}>
                Continue to Login
              </Link>
            )}
            {status === 'error' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Link to="/verify-email-notice" className="btn-secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                  Resend Verification Email
                </Link>
                <Link to="/login" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                  ← Back to Login
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
