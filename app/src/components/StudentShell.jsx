import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BrandHeader from './BrandHeader';
import BottomNav from './BottomNav';
import Icon from './Icon';

/**
 * Layout wrapper for the standard student surfaces: branded header on top,
 * scrollable content, and the bottom tab bar (which becomes a left sidebar
 * at ≥1024px). Immersive routes (the CBT room, result screen) deliberately
 * render WITHOUT this shell — they are full-bleed.
 */
export default function StudentShell({ user, children, hideSearch = false }) {
  const { t } = useTranslation();
  return (
    <div className="app-shell">
      <BottomNav />
      <div className="app-shell-body">
        <BrandHeader user={user} hideSearch={hideSearch} />

        {/* Non-blocking nudge if the student's phone is unverified (required
            to request course activation). Preserved from the old header. */}
        {user && !user.phone_verified && (
          <div style={{ margin: '14px 16px 0', padding: '12px 16px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', color: 'var(--warning-text)', fontSize: '0.85rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
              <Icon name="alert" size={17} /> {t('verify.banner')}
            </span>
            <Link to="/verify-otp" className="btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem', textDecoration: 'none' }}>
              {t('verify.verifyNow')}
            </Link>
          </div>
        )}

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
