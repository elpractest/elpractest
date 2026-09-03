import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';
import BannerCarousel from '../components/BannerCarousel';
import Carousel from '../components/Carousel';
import StudentCheckout from './StudentCheckout';
import ActivationModal from './ActivationModal';
import { useTheme } from '../lib/theme';
import { useActivity } from '../lib/activity';
import {
  withDemo, demoCourses, demoExamCats,
  demoContinue, demoGoal,
} from '../lib/demoData';

/* ============================================================
   HOME — artboard 03.
   ------------------------------------------------------------
   Order: readiness → quick modes → this week → continue → explore
   by exam → promo banners → popular series. Every fetch the page
   had is unchanged; `home-summary` and the shared activity store
   are additive reads of endpoints that already exist.
   ============================================================ */

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
    real: true,
  };
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function fmtDuration(seconds) {
  const s = Number(seconds) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const { tint } = useTheme();
  const { week, weekTests, loading: activityLoading } = useActivity();

  const [courses, setCourses] = useState([]);
  const [tests, setTests] = useState([]);
  const [activationRequests, setActivationRequests] = useState([]);
  const [purchasableCourses, setPurchasableCourses] = useState([]);
  const [paymentGatewayEnabled, setPaymentGatewayEnabled] = useState(false);
  const [summary, setSummary] = useState(null);

  const [showActivationModal, setShowActivationModal] = useState(false);
  const [checkoutBatch, setCheckoutBatch] = useState(null);

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
  // One round trip for the readiness card: active session, week figures,
  // weakest topic and the nearest entitlement expiry. A 404 means the API
  // predates this endpoint, and the card falls back to what it has.
  const fetchSummary = () => {
    api.get('/api/student/home-summary')
      .then((res) => setSummary(res.data))
      .catch(() => {});
  };

  // A fresh test always goes through the instructions gate first — duration,
  // marking scheme and the admin-written instructions — never straight into
  // a session. `active` (an in-progress session) is a separate, resume-only
  // path that navigates by SESSION id and bypasses this on purpose: a
  // candidate already mid-paper has already cleared the gate once.
  const goToTest = (testId) => navigate(`/tests/${testId}/instructions`);

  useEffect(() => {
    fetchEnrolledCourses();
    fetchActivationRequests();
    fetchTests();
    fetchSummary();
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
    fetchSummary();
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
    pending: { bg: 'var(--reward-bg)', text: 'var(--reward-text)', border: 'var(--reward-border)' },
    approved: { bg: 'var(--success-bg)', text: 'var(--success)', border: 'var(--success-border)' },
    rejected: { bg: 'var(--danger-bg)', text: 'var(--danger)', border: 'var(--danger-border)' },
  };

  const sectionHead = (title, action, onAction) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 18px 10px', gap: '12px' }}>
      <h2 className="t-heading" style={{ margin: 0, color: 'var(--tx)' }}>{title}</h2>
      {action && (
        <button type="button" onClick={onAction} className="link-btn">
          {action}
        </button>
      )}
    </div>
  );

  /* ---- readiness card figures, all real or honestly absent ---- */
  const active = summary?.active_session || null;
  const accuracy = summary?.week?.accuracy ?? null;
  const daysLeft = summary?.entitlement?.days_remaining ?? null;
  const goalLine = summary?.entitlement?.batch_name || demoGoal;
  const weakest = summary?.weakest_topic || null;

  const readinessHeadline = active
    ? 'Pick up where you stopped'
    : weakest
      ? `${weakest.topic} is costing you marks`
      : accuracy !== null
        ? `You are at ${accuracy}% accuracy`
        : 'Start your first mock';

  const ctaLabel = active
    ? `Resume ${active.test_title || 'your paper'}${active.time_remaining_seconds ? ` · ${Math.max(0, Math.round(active.time_remaining_seconds / 60))} min left` : ''}`
    : tests.length > 0
      ? 'Start a mock test'
      : 'Browse test series';

  const onReadinessCta = () => {
    if (active) navigate(`/tests/${active.id}`);
    else if (tests.length > 0) goToTest(tests[0].id);
    else navigate('/student/test-series');
  };

  const weekPeak = week.length ? Math.max(...week.map((d) => d.count)) : 0;
  const weekSeconds = summary?.week?.time_seconds ?? null;

  /* ---- quick modes, per the artboard's tints ---- */
  const quickModes = [
    { label: 'Mock', hue: 'blue', icon: 'target', to: '/student/test-series' },
    { label: 'Practice', hue: 'green', icon: 'book-open', to: '/practice' },
    { label: 'PYQ', hue: 'gold', icon: 'file', to: '/study' },
    { label: 'Analysis', hue: 'violet', icon: 'chart', to: '/results' },
  ];

  /* ---- continue rail: real active session first, demo as the fallback ---- */
  const continueCards = active
    ? [{
        key: 'active',
        overline: (active.category || 'MOCK').toUpperCase(),
        title: active.section_title || active.test_title || 'Your paper',
        done: active.answered_count ?? 0,
        total: active.question_count ?? 0,
        hue: 'blue',
        icon: 'target',
        onClick: () => navigate(`/tests/${active.id}`),
      }]
    : courses.slice(0, 4).map((c) => ({
        key: `c-${c.id}`,
        overline: (c.exam_category || 'COURSE').toUpperCase(),
        title: c.title,
        done: c.lessons_completed ?? 0,
        total: c.lessons_total ?? 0,
        hue: 'green',
        icon: 'book-open',
        onClick: () => navigate(`/student/test-series/${c.id}`),
      }));

  const railCards = continueCards.length
    ? continueCards
    : [{
        key: 'demo',
        overline: 'MOCK',
        title: demoContinue.title,
        done: demoContinue.pct,
        total: 100,
        hue: 'blue',
        icon: 'target',
        onClick: () => navigate('/student/test-series'),
      }];

  return (
    <div style={{ padding: '16px 0 24px' }}>
      <style>{`
        .dash-popular { display: flex; gap: 14px; overflow-x: auto; padding: 0 18px 6px; scroll-snap-type: x mandatory; }
        .dash-popular-card { flex: none; width: 262px; scroll-snap-align: start; }
        .dash-rail { display: flex; gap: 11px; overflow-x: auto; padding: 0 18px 4px; scroll-snap-type: x mandatory; scrollbar-width: none; }
        .dash-rail::-webkit-scrollbar { display: none; }
        .dash-rail-card { flex: none; width: 190px; scroll-snap-align: start; }
        .dash-exam { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 10px; padding: 0 18px; }
        @media (min-width: 640px) {
          .dash-popular { display: grid; grid-template-columns: repeat(2, 1fr); overflow: visible; }
          .dash-popular-card { width: auto; }
          .dash-exam { grid-template-columns: repeat(8, 1fr); }
        }
        @media (min-width: 1024px) {
          .dash-popular { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      {/* ---- 1. Readiness ---- */}
      <div
        style={{
          margin: '0 18px',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '20px',
          background: 'var(--primary)',
          color: 'var(--on-primary)',
          padding: '18px',
        }}
      >
        <span
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg, var(--on-primary-veil), transparent 48%)' }}
        />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                font: '600 9px/1 var(--font-mono)',
                letterSpacing: '.18em',
                color: 'var(--on-primary-soft)',
                textTransform: 'uppercase',
              }}
            >
              {goalLine}{daysLeft !== null ? ` · ${daysLeft} DAYS LEFT` : ''}
            </div>
            <div style={{ marginTop: '9px', font: '700 22px/1.12 var(--font-display)', letterSpacing: '-.03em' }}>
              {readinessHeadline}
            </div>
          </div>

          <div
            style={{
              width: '68px',
              height: '68px',
              flex: 'none',
              borderRadius: '20px',
              background: 'var(--on-primary-veil)',
              border: '1px solid var(--on-primary-line)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div className="t-num" style={{ fontSize: '20px', lineHeight: 1, color: 'var(--on-primary)' }}>
                {accuracy === null ? '—' : Math.round(accuracy)}
              </div>
              <div
                style={{
                  marginTop: '3px',
                  font: '500 7.5px/1 var(--font-mono)',
                  letterSpacing: '.1em',
                  color: 'var(--on-primary-soft)',
                }}
              >
                {accuracy === null ? 'NO DATA' : 'ACCURACY'}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            marginTop: '16px',
            height: '5px',
            borderRadius: '99px',
            background: 'var(--on-primary-track)',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: `${Math.max(2, Math.min(100, accuracy ?? 0))}%`, height: '100%', borderRadius: '99px', background: 'var(--on-primary)' }} />
        </div>

        <button
          type="button"
          onClick={onReadinessCta}
          style={{
            position: 'relative',
            marginTop: '15px',
            width: '100%',
            minHeight: '48px',
            padding: '14px',
            border: 'none',
            borderRadius: '14px',
            background: 'var(--on-primary-btn-bg)',
            color: 'var(--on-primary-btn-fg)',
            font: '700 14px var(--font-body)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
          }}
        >
          {ctaLabel}
          <Icon name="arrow-right" size={16} strokeWidth={2.4} />
        </button>
      </div>

      {/* ---- 2. Quick modes ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '9px', padding: '16px 18px 0' }}>
        {quickModes.map((m) => {
          const t = tint(m.hue);
          return (
            <button
              key={m.label}
              type="button"
              onClick={() => navigate(m.to)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '13px 8px',
                minHeight: '48px',
                borderRadius: '16px',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'grid', placeItems: 'center', width: '40px', height: '40px', borderRadius: '13px', background: t.bg, color: t.c }}>
                <Icon name={m.icon} size={20} />
              </span>
              <span style={{ font: '600 10.5px var(--font-body)', color: 'var(--tx2)' }}>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---- 3. This week ---- */}
      <div style={{ margin: '22px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px', gap: '12px' }}>
          <h2 className="t-heading" style={{ margin: 0, color: 'var(--tx)' }}>This week</h2>
          <button type="button" onClick={() => navigate('/results')} className="link-btn">
            Full report
          </button>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '18px', padding: '16px' }}>
          {activityLoading ? (
            <div className="skeleton" style={{ height: '60px', borderRadius: '10px' }} />
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '60px' }}>
              {week.map((d) => {
                const isPeak = weekPeak > 0 && d.count === weekPeak;
                const h = weekPeak > 0 ? Math.max(6, Math.round((d.count / weekPeak) * 52)) : 6;
                return (
                  <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
                    <div
                      title={`${d.date.toDateString()} — ${d.count}`}
                      style={{
                        width: '100%',
                        maxWidth: '20px',
                        height: `${h}px`,
                        borderRadius: '6px',
                        background: isPeak ? 'var(--primary)' : d.count === 0 ? 'var(--line)' : 'var(--primary-soft)',
                      }}
                    />
                    <div style={{ font: `${isPeak ? 600 : 500} 9px var(--font-mono)`, color: isPeak ? 'var(--primary)' : 'var(--muted)' }}>
                      {DAY_LETTERS[d.date.getDay()]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: '14px', paddingTop: '13px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div className="t-num" style={{ fontSize: '17px', lineHeight: 1, color: 'var(--tx)' }}>{weekTests}</div>
              <div style={{ marginTop: '4px', font: '400 10.5px var(--font-body)', color: 'var(--muted)' }}>tests</div>
            </div>
            <div>
              <div className="t-num" style={{ fontSize: '17px', lineHeight: 1, color: 'var(--tx)' }}>
                {accuracy === null ? '—' : `${accuracy}%`}
              </div>
              <div style={{ marginTop: '4px', font: '400 10.5px var(--font-body)', color: 'var(--muted)' }}>accuracy</div>
            </div>
            <div>
              <div className="t-num" style={{ fontSize: '17px', lineHeight: 1, color: 'var(--tx)' }}>
                {weekSeconds === null ? '—' : fmtDuration(weekSeconds)}
              </div>
              <div style={{ marginTop: '4px', font: '400 10.5px var(--font-body)', color: 'var(--muted)' }}>on task</div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- 4. Continue where you left ---- */}
      <div style={{ margin: '24px 0 0' }}>
        {sectionHead('Continue where you left')}
        <div className="dash-rail">
          {railCards.map((c) => {
            const t = tint(c.hue);
            const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
            return (
              <button
                key={c.key}
                type="button"
                onClick={c.onClick}
                className="dash-rail-card"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '13px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: '30px', height: '30px', borderRadius: '10px', background: t.bg, color: t.c }}>
                    <Icon name={c.icon} size={16} />
                  </span>
                  <span className="t-overline" style={{ fontSize: '9.5px', letterSpacing: '.1em', color: 'var(--muted)' }}>{c.overline}</span>
                </span>
                <span
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    font: '600 13px/1.35 var(--font-body)',
                    color: 'var(--tx)',
                    minHeight: '35px',
                  }}
                >
                  {c.title}
                </span>
                <span style={{ display: 'block', marginTop: '11px', height: '4px', borderRadius: '99px', background: 'var(--line)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: 'var(--primary)' }} />
                </span>
                <span className="t-num" style={{ display: 'block', marginTop: '7px', fontSize: '10.5px', fontWeight: 500, color: 'var(--muted)' }}>
                  {c.done} / {c.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- your mock tests (real, startable) ---- */}
      {tests.length > 0 && (
        <div style={{ margin: '24px 0 0' }}>
          {sectionHead('Your mock tests')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 18px' }}>
            {tests.map((tst) => (
              <div
                key={tst.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '16px',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                }}
              >
                <span
                  style={{
                    width: '42px',
                    height: '42px',
                    flex: 'none',
                    borderRadius: '13px',
                    background: tint('blue').bg,
                    color: tint('blue').c,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name="target" size={20} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 13.5px var(--font-body)', color: 'var(--tx)' }}>{tst.title}</div>
                  <div className="t-num" style={{ font: '500 11.5px var(--font-mono)', color: 'var(--muted)', marginTop: '3px' }}>
                    {Math.round((tst.duration_seconds || 0) / 60)} min · {tst.total_marks ?? '—'} marks
                    {tst.max_attempts ? ` · ${tst.sessions_count || 0}/${tst.max_attempts}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToTest(tst.id)}
                  className="btn-secondary"
                  style={{ padding: '10px 18px', minHeight: '44px', fontSize: '13px', flex: 'none' }}
                >
                  Start
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- 5. Explore by exam ---- */}
      <div style={{ margin: '24px 0 0' }}>
        {sectionHead('Explore by exam', 'See all', () => navigate('/student/test-series'))}
        <div className="dash-exam">
          {demoExamCats.map((c) => {
            const t = tint(c.hue);
            return (
              <button
                key={c.k}
                type="button"
                onClick={() => navigate('/student/test-series')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                <span
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '16px',
                    background: t.bg,
                    color: t.c,
                    border: `1px solid ${t.bd}`,
                    display: 'grid',
                    placeItems: 'center',
                    font: '700 14px var(--font-display)',
                    letterSpacing: '-.02em',
                  }}
                >
                  {c.mono}
                </span>
                <span style={{ font: '500 11px/1.1 var(--font-body)', color: 'var(--tx2)', textAlign: 'center' }}>{c.k}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- 6. Promo banners (real, demo fallback) ---- */}
      <div style={{ marginTop: '24px' }}>
        <BannerCarousel onDemoCta={() => setShowActivationModal(true)} />
      </div>

      {/* ---- 7. Popular test series ---- */}
      <div style={{ margin: '24px 0 0' }}>
        {sectionHead('Popular test series', 'View all', () => navigate('/student/test-series'))}
        <Carousel trackClassName="dash-popular" ariaLabel="Popular test series">
          {popular.map((c, i) => (
            <div
              key={c.id || i}
              onClick={() => openCourse(c)}
              className="dash-popular-card"
              style={{
                cursor: 'pointer',
                borderRadius: '20px',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  height: '110px',
                  background: 'var(--primary-soft)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--primary)',
                }}
              >
                <Icon name="target" size={30} />
                {c.tag && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      font: '600 10px var(--font-body)',
                      letterSpacing: '.06em',
                      color: 'var(--primary)',
                      background: 'var(--card)',
                      border: '1px solid var(--primary-border)',
                      padding: '4px 9px',
                      borderRadius: '999px',
                    }}
                  >
                    {c.tag}
                  </span>
                )}
                {c.lang && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      font: '600 10px var(--font-hindi)',
                      color: 'var(--tx2)',
                      background: 'var(--card)',
                      border: '1px solid var(--line2)',
                      padding: '4px 9px',
                      borderRadius: '999px',
                    }}
                  >
                    {c.lang}
                  </span>
                )}
              </div>
              <div style={{ padding: '13px 14px 15px' }}>
                <div className="t-overline" style={{ color: 'var(--muted)' }}>{c.exam}</div>
                <div style={{ font: '600 14px/1.3 var(--font-body)', color: 'var(--tx)', margin: '6px 0 0', minHeight: '36px' }}>{c.title}</div>
                <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--muted)', marginTop: '6px' }}>{c.meta}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '11px' }}>
                  {c.price && <span className="t-num" style={{ fontSize: '16px', color: 'var(--tx)' }}>{c.price}</span>}
                  {c.mrp && (
                    <span className="t-num" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)', textDecoration: 'line-through' }}>{c.mrp}</span>
                  )}
                  {c.off && <span style={{ font: '600 11px var(--font-body)', color: 'var(--success)', marginLeft: 'auto' }}>{c.off}</span>}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowActivationModal(true); }}
                  className="btn-secondary"
                  style={{ width: '100%', marginTop: '12px', padding: '11px', fontSize: '13px' }}
                >
                  Enroll now
                </button>
              </div>
            </div>
          ))}
        </Carousel>
      </div>

      {/* ---- Activation requests status (real data only) ---- */}
      {activationRequests.length > 0 && (
        <div style={{ margin: '24px 0 0' }}>
          {sectionHead('Your activation requests')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 18px' }}>
            {activationRequests.map((req) => {
              const sc = statusColors[req.status] || statusColors.pending;
              return (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                    padding: '13px 14px',
                    borderRadius: '16px',
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: '600 13px var(--font-body)', color: 'var(--tx)' }}>
                      {req.batch?.course?.title || 'Course'} — {req.batch?.name || 'Batch'}
                    </div>
                    <div className="t-num" style={{ font: '500 11px var(--font-mono)', color: 'var(--muted)', marginTop: '3px' }}>
                      REF {req.payment_reference}
                    </div>
                  </div>
                  <span
                    style={{
                      font: '600 11px var(--font-body)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: sc.bg,
                      color: sc.text,
                      textTransform: 'capitalize',
                      flex: 'none',
                    }}
                  >
                    {req.status}
                  </span>
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
        <StudentCheckout batch={checkoutBatch} user={user} onClose={() => setCheckoutBatch(null)} onEnrolled={handleEnrolled} />
      )}
    </div>
  );
}
