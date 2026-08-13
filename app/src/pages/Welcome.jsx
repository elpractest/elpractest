import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import logoMark from '../assets/logo-mark.png';
import hero from '../assets/hero.png';

/**
 * WELCOME / onboarding — static first-run splash matching the design
 * reference. Purely presentational: "Get Started" routes to registration
 * and "I already have an account" to sign-in. No backend calls.
 */
export default function Welcome() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isHindi = i18n.language.startsWith('hi');
  const toggleLang = () => i18n.changeLanguage(isHindi ? 'en' : 'hi');

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0B0F1A', overflow: 'auto' }}>
      {/* Hero */}
      <div style={{ position: 'relative', height: '52%', minHeight: '300px', overflow: 'hidden', flex: 'none' }}>
        <img src={hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(11,15,26,.35) 0%,rgba(11,15,26,0) 34%,rgba(11,15,26,.7) 78%,#0B0F1A 100%)' }} />
        <div style={{ position: 'absolute', top: 'max(env(safe-area-inset-top),24px)', left: '22px', right: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 8px 22px -8px rgba(0,0,0,.6)' }}>
              <img src={logoMark} alt="" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
            </div>
            <div style={{ font: '800 17px var(--font-display)', color: '#fff', letterSpacing: '-.02em', textShadow: '0 2px 12px rgba(0,0,0,.5)' }}>Practest</div>
          </div>
          <button onClick={toggleLang} style={{ display: 'flex', gap: '2px', padding: '5px', borderRadius: '999px', background: 'rgba(8,12,20,.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.16)', cursor: 'pointer' }}>
            <span style={{ padding: '3px 9px', borderRadius: '999px', font: '700 12px var(--font-body)', color: !isHindi ? '#0B0F1A' : '#C7D0E4', background: !isHindi ? '#F5A623' : 'transparent' }}>EN</span>
            <span style={{ padding: '3px 9px', borderRadius: '999px', font: '700 12px var(--font-hindi)', color: isHindi ? '#0B0F1A' : '#C7D0E4', background: isHindi ? '#F5A623' : 'transparent' }}>हिं</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 26px 30px' }}>
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: '7px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(245,166,35,.14)', border: '1px solid rgba(245,166,35,.32)', font: '700 11px var(--font-body)', letterSpacing: '.1em', color: '#FFC968' }}>
          <Icon name="file" size={13} strokeWidth={2.2} /> EXAM-ACCURATE CBT
        </div>
        <h1 style={{ margin: '16px 0 0', font: '800 33px/1.08 var(--font-display)', letterSpacing: '-.03em', color: '#F3F6FF' }}>Crack it with mocks that feel like the real exam.</h1>
        <p style={{ margin: '12px 0 0', font: '600 15px/1.5 var(--font-hindi)', color: '#9AA6C2' }}>असली परीक्षा जैसे मॉक टेस्ट · All-India rank · हिंदी + English</p>
        <div style={{ display: 'flex', gap: '18px', margin: '20px 0 auto', flexWrap: 'wrap' }}>
          {['Real CBT engine', 'Deep analytics'].map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '7px', font: '600 13px var(--font-body)', color: '#C7D0E4' }}>
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(18,185,129,.18)', display: 'grid', placeItems: 'center', color: '#12B981' }}>
                <Icon name="check" size={11} strokeWidth={3.2} />
              </span>{f}
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/register')} style={{ width: '100%', padding: '17px', border: 'none', borderRadius: '16px', background: 'linear-gradient(135deg,#FFC968,#F5A623 55%,#E07C0A)', color: '#1A1206', font: '800 16px var(--font-display)', cursor: 'pointer', boxShadow: '0 16px 34px -12px rgba(245,166,35,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          Get Started <Icon name="arrow-right" size={19} strokeWidth={2.4} />
        </button>
        <button onClick={() => navigate('/login')} style={{ width: '100%', marginTop: '12px', padding: '15px', border: '1px solid rgba(255,255,255,.12)', borderRadius: '16px', background: 'rgba(255,255,255,.04)', color: '#C7D0E4', font: '700 14px var(--font-body)', cursor: 'pointer' }}>
          I already have an account
        </button>
      </div>
    </div>
  );
}
