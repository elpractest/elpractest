import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';
import hero from '../assets/hero.png';

/**
 * WELCOME / onboarding — the in-app landing, light-first on Signal.
 *
 * A full-bleed image slot at 52% height, a soft fade into the page ground,
 * then the pitch and exactly one filled primary. Purely presentational:
 * "Get Started" routes to registration and the secondary to sign-in. No
 * backend calls, and no hardcoded colour — it themes with everything else.
 */
export default function Welcome() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const isHindi = i18n.language.startsWith('hi');
  const toggleLang = () => i18n.changeLanguage(isHindi ? 'en' : 'hi');

  const proof = [
    'Exam-accurate CBT engine — the same palette, timer and section rules',
    'All-India rank, percentile and a per-topic verdict after every paper',
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--tx)',
        overflowY: 'auto',
      }}
    >
      {/* ---- hero ---- */}
      <div style={{ position: 'relative', height: '52%', minHeight: '280px', flex: 'none', overflow: 'hidden' }}>
        <img src={hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {/* the ground fades up into the image so there is no hard seam */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 38%, transparent 62%, var(--bg) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 'max(env(safe-area-inset-top), 22px)',
            left: '22px',
            right: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'var(--primary)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="graduation-cap" size={21} />
            </span>
            <span style={{ font: '700 17px var(--font-display)', letterSpacing: '-.025em', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.45)' }}>
              Practest
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'day' : 'night'} mode`}
            title={`Switch to ${isDark ? 'day' : 'night'} mode`}
            style={{
              width: '38px',
              height: '38px',
              flex: 'none',
              borderRadius: '999px',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              color: 'var(--tx2)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <Icon name={isDark ? 'sun' : 'moon'} size={18} />
          </button>

          <button
            type="button"
            onClick={toggleLang}
            aria-label="Toggle language"
            style={{
              display: 'flex',
              gap: '2px',
              padding: '5px',
              minHeight: '38px',
              alignItems: 'center',
              borderRadius: '999px',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                padding: '5px 11px',
                borderRadius: '999px',
                font: '600 12px var(--font-body)',
                color: !isHindi ? 'var(--brand-ink)' : 'var(--tx2)',
                background: !isHindi ? 'var(--primary)' : 'transparent',
              }}
            >
              EN
            </span>
            <span
              style={{
                padding: '5px 11px',
                borderRadius: '999px',
                font: '600 12px var(--font-hindi)',
                color: isHindi ? 'var(--brand-ink)' : 'var(--tx2)',
                background: isHindi ? 'var(--primary)' : 'transparent',
              }}
            >
              हिं
            </span>
          </button>
          </div>
        </div>
      </div>

      {/* ---- content ---- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '4px 24px calc(28px + env(safe-area-inset-bottom, 0px))', maxWidth: '560px', width: '100%', margin: '0 auto' }}>
        <span
          style={{
            display: 'inline-flex',
            alignSelf: 'flex-start',
            alignItems: 'center',
            gap: '7px',
            padding: '6px 12px',
            borderRadius: '999px',
            background: 'var(--primary-soft)',
            color: 'var(--primary)',
            font: '600 11px var(--font-body)',
            letterSpacing: '.1em',
          }}
        >
          <Icon name="file-text" size={13} strokeWidth={2.2} />
          EXAM-ACCURATE CBT
        </span>

        <h1 style={{ margin: '16px 0 0', font: '700 33px/1.08 var(--font-display)', letterSpacing: '-.035em', color: 'var(--tx)' }}>
          Crack it with mocks that feel like the real exam.
        </h1>

        <p style={{ margin: '12px 0 0', font: '500 15px/1.55 var(--font-hindi)', color: 'var(--tx2)' }}>
          असली परीक्षा जैसे मॉक टेस्ट · अखिल भारतीय रैंक · हिंदी + English
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', margin: '22px 0 auto' }}>
          {proof.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', font: '400 13.5px/1.5 var(--font-body)', color: 'var(--tx2)' }}>
              <span style={{ color: 'var(--success)', display: 'inline-flex', flex: 'none', marginTop: '1px' }}>
                <Icon name="check-circle" size={16} />
              </span>
              {f}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate('/register')}
          className="btn-primary"
          style={{ width: '100%', marginTop: '24px', padding: '16px', borderRadius: '14px', fontSize: '15px', fontWeight: 700 }}
        >
          Get Started
          <Icon name="arrow-right" size={18} strokeWidth={2.4} />
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="btn-secondary"
          style={{ width: '100%', marginTop: '10px', padding: '15px', borderRadius: '14px', fontSize: '14px' }}
        >
          I already have an account
        </button>
      </div>
    </div>
  );
}
