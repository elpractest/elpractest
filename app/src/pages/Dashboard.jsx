import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';
import BannerCarousel from '../components/BannerCarousel';
import StudentCheckout from './StudentCheckout';
import ActivationModal from './ActivationModal';
import { useTheme } from '../lib/theme';
import {
  withDemo, demoCourses, demoQuickModes, demoExamCats,
  demoContinue, demoGoal,
} from '../lib/demoData';

/* Map a real enrolled/purchasable course into the reference card shape. */
function toCard(c) {
  return {
    id: c.id,
    exam: c.exam_category || 'Test Series',
    lang: c.mode === 'hindi' ? 'हिं' : c.mode === 'bilingual' ? 'हिं+EN' : 'EN',
    tag: c.tag || 'Enrolled',
    title: c.title,
    meta: c.short_description || c.description || 'Mock tests · analytics',
    price: null, mrp: null, off: null,
    grad: 'linear-gradient(120deg,#3A2A08,#1A1206)',
    real: true,
  };
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const { isDark, tint } = useTheme();

  const [courses, setCourses] = useState([]);
  const [tests, setTests] = useState([]);
  const [activationRequests, setActivationRequests] = useState([]);
  const [purchasableCourses, setPurchasableCourses] = useState([]);
  const [paymentGatewayEnabled, setPaymentGatewayEnabled] = useState(false);

  const [showActivationModal, setShowActivationModal] = useState(false);
  const [checkoutBatch, setCheckoutBatch] = useState(null);
  const [startError, setStartError] = useState('');

  const fetchEnrolledCourses = () => {
    api.get('/api/student/courses')
      .then((res) => setCourses(res.data.courses || res.data || []))
      .catch(() => {});
  };
  const fetchActivationRequests = () => {
    api.get('/api/student/activation-requests')
      .then((res) => setActivationRequests(res.data.requests || []))
      .catch(() => {});
  };
  const fetchPurchasableCourses = () => {
    api.get('/api/student/purchasable-courses')
      .then((res) => setPurchasableCourses(res.data || []))
      .catch(() => {});
  };
  const fetchTests = () => {
    api.get('/api/student/tests')
      .then((res) => setTests(res.data.tests || res.data || []))
      .catch(() => {});
  };

  const handleStartTest = async (testId) => {
    setStartError('');
    try {
      const res = await api.post(`/api/student/tests/${testId}/start`);
      const session = res.data.session;
      navigate(`/tests/${session.id}`);
    } catch (err) {
      setStartError(err.response?.data?.message || 'Could not start the test session.');
    }
  };

  useEffect(() => {
    fetchEnrolledCourses();
    fetchActivationRequests();
    fetchTests();
    api.get('/api/settings/public')
      .then((res) => {
        const enabled = res.data.settings?.payment_gateway_enabled === 'true' || res.data.settings?.payment_gateway_enabled === true;
        setPaymentGatewayEnabled(enabled);
        if (enabled) fetchPurchasableCourses();
      })
      .catch(() => {});
  }, []);

  const handleEnrolled = () => {
    fetchEnrolledCourses();
    fetchActivationRequests();
    if (paymentGatewayEnabled) fetchPurchasableCourses();
  };

  const openCourse = (c) => {
    if (c.real && c.id) navigate(`/student/test-series/${c.id}`);
    else navigate('/student/test-series');
  };

  // Popular test series: real courses first (enrolled ∪ purchasable), demo fallback.
  const realCards = [...courses, ...purchasableCourses].map(toCard);
  const popular = withDemo(realCards, demoCourses);

  const statusColors = {
    pending: { bg: 'var(--warning-bg)', text: 'var(--warning-text)', border: 'var(--warning-border)' },
    approved: { bg: 'var(--success-bg)', text: 'var(--success-text)', border: 'var(--success-border)' },
    rejected: { bg: 'var(--danger-bg)', text: 'var(--danger-text)', border: 'var(--danger-border)' },
  };

  const sectionHead = (title, action, onAction) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 18px 12px' }}>
      <h2 style={{ margin: 0, font: '700 17px var(--font-display)', color: 'var(--tx)', letterSpacing: '-.02em' }}>{title}</h2>
      {action && <span onClick={onAction} style={{ font: '700 12px var(--font-body)', color: tint('gold').c, cursor: 'pointer' }}>{action}</span>}
    </div>
  );

  return (
    <div style={{ padding: '16px 0 24px' }}>
      <style>{`
        .dash-popular { display: flex; gap: 14px; overflow-x: auto; padding: 0 18px 6px; scroll-snap-type: x mandatory; }
        .dash-popular-card { flex: none; width: 262px; scroll-snap-align: start; }
        @media (min-width: 640px) {
          .dash-popular { display: grid; grid-template-columns: repeat(2, 1fr); overflow: visible; }
          .dash-popular-card { width: auto; }
        }
        @media (min-width: 1024px) {
          .dash-popular { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
      {/* ---- Your goal ---- */}
      <div style={{
        margin: '0 18px', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 15px', borderRadius: '14px',
        background: isDark ? 'linear-gradient(120deg,rgba(59,111,246,.16),rgba(139,92,246,.1))' : 'linear-gradient(120deg,rgba(59,111,246,.1),rgba(139,92,246,.07))',
        border: `1px solid ${isDark ? 'rgba(139,150,255,.2)' : 'rgba(59,111,246,.26)'}`,
      }}>
        <span style={{ width: '34px', height: '34px', borderRadius: '10px', background: isDark ? 'rgba(59,111,246,.22)' : 'rgba(59,111,246,.14)', display: 'grid', placeItems: 'center', flex: 'none', color: tint('blue').c }}>
          <Icon name="target" size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '600 11px var(--font-body)', color: tint('blue').c, letterSpacing: '.04em' }}>YOUR GOAL</div>
          <div style={{ font: '700 14px var(--font-body)', color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>{demoGoal}</div>
        </div>
        <span onClick={() => navigate('/student/test-series')} style={{ font: '700 13px var(--font-body)', color: tint('blue').c, cursor: 'pointer', flex: 'none' }}>Change</span>
      </div>

      {/* ---- Promo banners (real, demo fallback) ---- */}
      <BannerCarousel onDemoCta={() => setShowActivationModal(true)} />

      {/* ---- Quick modes ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '11px', padding: '14px 18px 0' }}>
        {demoQuickModes.map((m) => {
          const t = tint(m.hue);
          const to = m.label === 'Analytics' ? '/results' : m.label === 'Notes & PDF' ? '/study' : '/student/test-series';
          return (
            <div key={m.label} onClick={() => navigate(to)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', padding: '16px 6px', borderRadius: '16px', background: 'var(--card)', border: '1px solid var(--line)', boxShadow: 'var(--cardsh)' }}>
              <span style={{ width: '44px', height: '44px', borderRadius: '13px', background: t.bg, display: 'grid', placeItems: 'center', color: t.c }}>
                <Icon name={m.icon} size={22} />
              </span>
              <span style={{ font: '700 11.5px/1.15 var(--font-body)', color: 'var(--tx2)', textAlign: 'center' }}>{m.label}</span>
            </div>
          );
        })}
      </div>

      {/* ---- Continue where you left ---- */}
      <div style={{ margin: '22px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '11px' }}>
          <h2 style={{ margin: 0, font: '700 17px var(--font-display)', color: 'var(--tx)', letterSpacing: '-.02em' }}>Continue where you left</h2>
        </div>
        <div onClick={() => navigate('/student/test-series')} style={{ cursor: 'pointer', padding: '15px', borderRadius: '18px', background: 'var(--card2)', border: '1px solid var(--line)', boxShadow: 'var(--cardsh)', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '52px', height: '52px', flex: 'none' }}>
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="23" fill="none" stroke={isDark ? 'rgba(255,255,255,.1)' : 'rgba(20,24,34,.12)'} strokeWidth="5" />
              <circle cx="26" cy="26" r="23" fill="none" stroke="#F5A623" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 23} strokeDashoffset={2 * Math.PI * 23 * (1 - demoContinue.pct / 100)} transform="rotate(-90 26 26)" />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: '800 13px var(--font-mono)', color: '#FFC968' }}>{demoContinue.pct}%</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 14px var(--font-body)', color: 'var(--tx)' }}>{demoContinue.title}</div>
            <div style={{ font: '600 12px var(--font-body)', color: 'var(--muted)', marginTop: '3px' }}>{demoContinue.next}</div>
          </div>
          <span style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'linear-gradient(135deg,#FFC968,#E07C0A)', display: 'grid', placeItems: 'center', flex: 'none', color: '#1A1206' }}>
            <Icon name="play" size={18} />
          </span>
        </div>
      </div>

      {/* ---- Your mock tests (real, startable) ---- */}
      {tests.length > 0 && (
        <div style={{ margin: '24px 0 0' }}>
          {sectionHead('Your mock tests')}
          {startError && (
            <div style={{ margin: '0 18px 10px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '10px 14px', borderRadius: '12px', color: 'var(--danger-text)', fontSize: '0.85rem' }}>{startError}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 18px' }}>
            {tests.map((tst) => (
              <div key={tst.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px', borderRadius: '16px', background: 'var(--card)', border: '1px solid var(--line)', boxShadow: 'var(--cardsh)' }}>
                <span style={{ width: '42px', height: '42px', borderRadius: '12px', background: tint('gold').bg, display: 'grid', placeItems: 'center', color: tint('gold').c, flex: 'none' }}>
                  <Icon name="target" size={20} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 14px var(--font-body)', color: 'var(--tx)' }}>{tst.title}</div>
                  <div style={{ font: '600 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '3px' }}>
                    {Math.round((tst.duration_seconds || 0) / 60)} min · {tst.total_marks ?? '—'} marks{tst.max_attempts ? ` · ${tst.sessions_count || 0}/${tst.max_attempts} attempts` : ''}
                  </div>
                </div>
                <button onClick={() => handleStartTest(tst.id)} className="btn-primary" style={{ padding: '10px 18px', fontSize: '0.85rem', flex: 'none' }}>Start</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Explore by exam ---- */}
      <div style={{ margin: '24px 0 0' }}>
        {sectionHead('Explore by exam', 'See all', () => navigate('/student/test-series'))}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px 10px', padding: '0 18px' }}>
          {demoExamCats.map((c) => {
            const t = tint(c.hue);
            return (
              <div key={c.k} onClick={() => navigate('/student/test-series')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
                <span style={{ width: '52px', height: '52px', borderRadius: '16px', background: t.bg, display: 'grid', placeItems: 'center', font: '800 15px var(--font-display)', color: t.c, border: `1px solid ${t.bd}` }}>{c.mono}</span>
                <span style={{ font: '600 11px/1.1 var(--font-body)', color: 'var(--tx2)', textAlign: 'center' }}>{c.k}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Popular test series ---- */}
      <div style={{ margin: '26px 0 0' }}>
        {sectionHead('Popular test series', 'View all', () => navigate('/student/test-series'))}
        <div className="dash-popular">
          {popular.map((c, i) => (
            <div key={c.id || i} onClick={() => openCourse(c)} className="dash-popular-card" style={{ cursor: 'pointer', borderRadius: '20px', background: 'var(--card)', border: '1px solid var(--line)', boxShadow: 'var(--cardsh)', overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: '132px', background: c.grad }}>
                {c.tag && <span style={{ position: 'absolute', top: '10px', left: '10px', font: '800 10px var(--font-body)', letterSpacing: '.08em', color: '#fff', background: 'rgba(8,12,20,.6)', backdropFilter: 'blur(6px)', padding: '4px 9px', borderRadius: '999px' }}>{c.tag}</span>}
                {c.lang && <span style={{ position: 'absolute', top: '10px', right: '10px', font: '700 10px var(--font-hindi)', color: '#0B0F1A', background: '#FFC968', padding: '4px 9px', borderRadius: '999px' }}>{c.lang}</span>}
              </div>
              <div style={{ padding: '13px 14px 15px' }}>
                <div style={{ font: '700 10px var(--font-body)', letterSpacing: '.06em', color: tint('gold').c, textTransform: 'uppercase' }}>{c.exam}</div>
                <div style={{ font: '700 15px/1.25 var(--font-body)', color: 'var(--tx)', margin: '5px 0 0', minHeight: '38px' }}>{c.title}</div>
                <div style={{ font: '600 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '6px' }}>{c.meta}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '11px' }}>
                  {c.price && <span style={{ font: '800 17px var(--font-display)', color: 'var(--tx)' }}>{c.price}</span>}
                  {c.mrp && <span style={{ font: '600 12px var(--font-body)', color: '#748099', textDecoration: 'line-through' }}>{c.mrp}</span>}
                  {c.off && <span style={{ font: '800 11px var(--font-body)', color: '#12B981', marginLeft: 'auto' }}>{c.off}</span>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setShowActivationModal(true); }} className="btn-primary" style={{ width: '100%', marginTop: '12px', padding: '11px', borderRadius: '12px', fontSize: '13px' }}>Enroll now</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Scholarship strip ---- */}
      <div style={{ margin: '24px 18px 0', padding: '18px', borderRadius: '20px', background: 'linear-gradient(120deg,#10243F,#0B1830)', border: '1px solid rgba(59,111,246,.25)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,166,35,.35),transparent 70%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ font: '800 11px var(--font-body)', letterSpacing: '.12em', color: '#FFC968' }}>FREE SCHOLARSHIP TEST</div>
          <div style={{ font: '800 20px/1.15 var(--font-display)', color: '#fff', marginTop: '7px', letterSpacing: '-.02em' }}>Win up to 100% off any test pass</div>
          <div style={{ font: '600 12px var(--font-body)', color: '#9AB0E0', marginTop: '5px' }}>30 min · attempt once · instant result</div>
          <button onClick={() => setShowActivationModal(true)} style={{ marginTop: '13px', padding: '10px 20px', border: 'none', borderRadius: '999px', background: '#fff', color: '#0B1830', font: '800 13px var(--font-display)', cursor: 'pointer' }}>Attempt free</button>
        </div>
      </div>

      {/* ---- Activation requests status (real data only) ---- */}
      {activationRequests.length > 0 && (
        <div style={{ margin: '24px 18px 0' }}>
          {sectionHead('Your activation requests')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 18px' }}>
            {activationRequests.map((req) => {
              const sc = statusColors[req.status] || statusColors.pending;
              return (
                <div key={req.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '0.88rem' }}>
                    <strong>{req.batch?.course?.title || 'Course'}</strong> — {req.batch?.name || 'Batch'}
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: '8px' }}>Ref: {req.payment_reference}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, textTransform: 'uppercase' }}>{req.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showActivationModal && (
        <ActivationModal user={user} onClose={() => setShowActivationModal(false)} onSuccess={handleEnrolled} />
      )}
      {checkoutBatch && (
        <StudentCheckout batch={checkoutBatch} onClose={() => setCheckoutBatch(null)} onEnrolled={handleEnrolled} />
      )}
    </div>
  );
}
