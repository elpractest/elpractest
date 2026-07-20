import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const hash = searchParams.get('hash');
  const [status, setStatus] = useState('verifying'); // verifying | success | already | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!id || !hash) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email and try again.');
      return;
    }

    api.get(`/api/email/verify/${id}/${hash}`)
      .then(res => {
        if (res.data.message?.includes('already')) {
          setStatus('already');
        } else {
          setStatus('success');
        }
        setMessage(res.data.message);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed. The link may be invalid or expired.');
      });
  }, [id, hash]);

  const icons = { verifying: '⏳', success: '✅', already: '✅', error: '❌' };
  const titles = { 
    verifying: 'Verifying...', 
    success: 'Email Verified!', 
    already: 'Already Verified', 
    error: 'Verification Failed' 
  };

  return (
    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '16px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontSize: '3rem' }}>{icons[status]}</div>
        <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: status === 'error' ? '#f87171' : 'var(--accent-color)' }}>
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
