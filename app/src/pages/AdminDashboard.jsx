import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';

// Sub-components import
import AdminOverview from './AdminOverview';
import AdminCourses from './AdminCourses';
import AdminQuestions from './AdminQuestions';
import AdminTests from './AdminTests';
import AdminTestSeries from './AdminTestSeries';
import AdminProducts from './AdminProducts';
import AdminEnrollments from './AdminEnrollments';
import AdminActivations from './AdminActivations';
import AdminActivationCodes from './AdminActivationCodes';
import AdminResults from './AdminResults';
import AdminResultDetail from './AdminResultDetail';
import AdminCohortAnalytics from './AdminCohortAnalytics';
import AdminVideoAnalytics from './AdminVideoAnalytics';
import SuperAdminSettings from './SuperAdminSettings';
import SuperAdminOnboarding from './SuperAdminOnboarding';
import SuperAdminAuditLogs from './SuperAdminAuditLogs';
import SuperAdminBanners from './SuperAdminBanners';

/* ============================================================
   NAV MODEL
   ------------------------------------------------------------
   The same 14 destinations the console has always had, regrouped
   into four sections and renamed for clarity. Nothing was added and
   nothing was removed — `overview` is a new landing PAGE, not a new
   destination for work that used to live somewhere else.
   ============================================================ */
const NAV_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [{ id: 'overview', label: 'Dashboard', icon: 'layout-dashboard' }],
  },
  {
    label: 'CONTENT',
    items: [
      { id: 'courses', label: 'Courses & syllabus', icon: 'book-open' },
      { id: 'questions', label: 'Question bank', icon: 'file-text', count: 'questions' },
      { id: 'tests', label: 'Tests manager', icon: 'award' },
      { id: 'test_series', label: 'Test series', icon: 'target' },
    ],
  },
  {
    label: 'STUDENTS & SALES',
    items: [
      { id: 'enrollments', label: 'Batches & enrollments', icon: 'users' },
      { id: 'activations', label: 'Activations', icon: 'clock', queue: 'activations' },
      { id: 'codes', label: 'Activation codes', icon: 'key' },
      { id: 'products', label: 'Store products', icon: 'shopping-bag' },
      { id: 'results', label: 'Results', icon: 'chart' },
      { id: 'cohort', label: 'Cohort analytics', icon: 'trending-up' },
      { id: 'video_analytics', label: 'Video engagement', icon: 'play' },
    ],
  },
  {
    label: 'GOVERNANCE',
    superOnly: true,
    items: [
      { id: 'settings', label: 'White-label', icon: 'shield-check' },
      { id: 'banners', label: 'Home banners', icon: 'image' },
      { id: 'onboarding', label: 'Admin accounts', icon: 'zap' },
      { id: 'audit_logs', label: 'Audit logs', icon: 'history' },
    ],
  },
];

/* Breadcrumb tail + page title for the sticky header. */
const PAGE_META = {
  overview: { crumb: 'OVERVIEW', title: 'Platform health' },
  courses: { crumb: 'CONTENT / COURSES', title: 'Courses & syllabus' },
  questions: { crumb: 'CONTENT / QUESTIONS', title: 'Question bank' },
  tests: { crumb: 'CONTENT / TESTS', title: 'Tests manager' },
  test_series: { crumb: 'CONTENT / SERIES', title: 'Test series' },
  enrollments: { crumb: 'STUDENTS / BATCHES', title: 'Batches & enrollments' },
  activations: { crumb: 'STUDENTS / ACTIVATIONS', title: 'Activation requests' },
  codes: { crumb: 'STUDENTS / CODES', title: 'Activation codes' },
  products: { crumb: 'SALES / PRODUCTS', title: 'Store products' },
  results: { crumb: 'STUDENTS / RESULTS', title: 'Results' },
  result_detail: { crumb: 'STUDENTS / RESULTS / DETAIL', title: 'Scorecard' },
  cohort: { crumb: 'STUDENTS / COHORTS', title: 'Cohort analytics' },
  settings: { crumb: 'GOVERNANCE / WHITE-LABEL', title: 'White-label settings' },
  banners: { crumb: 'GOVERNANCE / BANNERS', title: 'Home banners' },
  onboarding: { crumb: 'GOVERNANCE / ACCOUNTS', title: 'Admin accounts' },
  audit_logs: { crumb: 'GOVERNANCE / AUDIT', title: 'System audit logs' },
};

const AUTHORING_TABS = new Set(['questions', 'tests', 'test_series']);
const NAV_KEY = 'practest-admin-nav';

function compactCount(n) {
  if (n === null || n === undefined) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

/* ---------- nav row ---------- */

function NavRow({ item, active, collapsed, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={`admin-nav-row${active ? ' active' : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : '11px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        width: '100%',
        minHeight: '44px',
        padding: collapsed ? '10px 0' : '10px 11px',
        background: active ? 'var(--primary-soft)' : 'transparent',
        border: 'none',
        borderRadius: '11px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-body)',
        marginBottom: '2px',
        transition: 'background var(--t-base) ease',
      }}
    >
      {active && !collapsed && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: '9px',
            bottom: '9px',
            width: '3px',
            borderRadius: '0 3px 3px 0',
            background: 'var(--primary)',
          }}
        />
      )}
      <span
        style={{
          display: 'inline-flex',
          flexShrink: 0,
          color: active ? 'var(--primary)' : 'var(--tx2)',
          position: 'relative',
        }}
      >
        <Icon name={item.icon} size={18} strokeWidth={2} />
        {collapsed && badge?.value ? (
          <span
            style={{
              position: 'absolute',
              top: '-7px',
              right: '-9px',
              minWidth: '16px',
              height: '16px',
              padding: '0 4px',
              borderRadius: '999px',
              background: badge.queue ? 'var(--reward-text)' : 'var(--line2)',
              color: badge.queue ? '#fff' : 'var(--tx2)',
              font: '700 9px/16px var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'center',
            }}
          >
            {badge.value}
          </span>
        ) : null}
      </span>

      {!collapsed && (
        <>
          <span
            style={{
              font: `${active ? 700 : 500} 13px var(--font-body)`,
              color: active ? 'var(--primary)' : 'var(--tx2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </span>
          {badge?.value ? (
            badge.queue ? (
              <span
                className="t-num"
                style={{
                  marginLeft: 'auto',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: 'var(--reward-bg)',
                  color: 'var(--reward-text)',
                  fontSize: '10px',
                }}
              >
                {badge.value}
              </span>
            ) : (
              <span
                className="t-num"
                style={{ marginLeft: 'auto', color: 'var(--muted)', fontWeight: 600, fontSize: '10.5px' }}
              >
                {badge.value}
              </span>
            )
          ) : null}
        </>
      )}
    </button>
  );
}

/* ============================================================
   SHELL
   ============================================================ */

export default function AdminDashboard({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedResultSessionId, setSelectedResultSessionId] = useState(null);
  const [navOpen, setNavOpen] = useState(false); // phone drawer
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(NAV_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  const [jump, setJump] = useState('');
  const [jumpOpen, setJumpOpen] = useState(false);
  const [authoringNoticeDismissed, setAuthoringNoticeDismissed] = useState(false);
  const [counts, setCounts] = useState({ questions: null, activations: null });

  const jumpRef = useRef(null);
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const isSuperAdmin = user?.roles?.includes('super-admin');

  /* ---- sidebar counters: both from endpoints the console already calls ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [q, a] = await Promise.all([
          api.get('/api/admin/questions', { params: { page: 1 } }),
          api.get('/api/admin/activation-requests', { params: { status: 'pending' } }),
        ]);
        if (!alive) return;
        setCounts({ questions: q.data?.total ?? null, activations: a.data?.total ?? null });
      } catch {
        /* the sidebar simply shows no counter */
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_KEY, collapsed ? 'collapsed' : 'expanded');
    } catch {
      /* private mode — the choice just does not persist */
    }
  }, [collapsed]);

  /* ---- ⌘K / Ctrl-K focuses the jump field ---- */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        jumpRef.current?.focus();
        setJumpOpen(true);
      }
      if (e.key === 'Escape') setJumpOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Global CSV Import Polling State
  const [csvJobId, setCsvJobId] = useState(null);
  const [csvState, setCsvState] = useState({
    status: null, // 'pending', 'complete', 'failed'
    imported: 0,
    errors: []
  });
  const [showCsvAlert, setShowCsvAlert] = useState(false);

  // Trigger CSV import polling
  const triggerCsvImport = (jobId) => {
    setCsvJobId(jobId);
    setCsvState({ status: 'pending', imported: 0, errors: [] });
    setShowCsvAlert(true);
  };

  // Poll CSV import status
  useEffect(() => {
    if (!csvJobId) return;

    let timer;
    const poll = async () => {
      try {
        const res = await api.get(`/api/admin/questions/import/${csvJobId}/status`);
        const { status, imported, errors } = res.data;

        setCsvState({ status, imported, errors });

        if (status === 'complete' || status === 'failed') {
          // Finished. Stop polling.
          setCsvJobId(null);
        }
      } catch (err) {
        // Ignore errors and keep polling unless expired
      }
    };

    // Initial check
    poll();

    // Setup interval
    timer = setInterval(poll, 2000);

    return () => clearInterval(timer);
  }, [csvJobId]);

  const handleLogout = async () => {
    try {
      await api.post('/api/logout');
    } catch (e) {
      // ignore
    } finally {
      setUser(null);
      navigate('/login');
    }
  };

  const isActive = (id) => activeTab === id || (id === 'results' && activeTab === 'result_detail');

  const selectTab = useCallback((id) => {
    setActiveTab(id);
    if (id !== 'results') setSelectedResultSessionId(null);
    setNavOpen(false);
    setJump('');
    setJumpOpen(false);
    setAuthoringNoticeDismissed(false);
  }, []);

  const groups = useMemo(() => NAV_GROUPS.filter((g) => !g.superOnly || isSuperAdmin), [isSuperAdmin]);

  const jumpMatches = useMemo(() => {
    const q = jump.trim().toLowerCase();
    if (!q) return [];
    return groups
      .flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })))
      .filter((i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q))
      .slice(0, 6);
  }, [jump, groups]);

  const badgeFor = (item) => {
    if (item.count === 'questions') {
      const v = compactCount(counts.questions);
      return v ? { value: v } : null;
    }
    if (item.queue === 'activations' && counts.activations) {
      return { value: String(counts.activations), queue: true };
    }
    return null;
  };

  // Render active panel content
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AdminOverview isSuperAdmin={isSuperAdmin} onNavigate={selectTab} />;
      case 'courses':
        return <AdminCourses />;
      case 'questions':
        return (
          <AdminQuestions
            csvState={csvState}
            triggerCsvImport={triggerCsvImport}
            csvJobId={csvJobId}
          />
        );
      case 'tests':
        return <AdminTests />;
      case 'test_series':
        return <AdminTestSeries />;
      case 'products':
        return <AdminProducts />;
      case 'enrollments':
        return <AdminEnrollments />;
      case 'activations':
        return <AdminActivations />;
      case 'codes':
        return <AdminActivationCodes />;
      case 'results':
        return (
          <AdminResults
            onViewDetail={(sessionId) => {
              setSelectedResultSessionId(sessionId);
              setActiveTab('result_detail');
            }}
          />
        );
      case 'cohort':
        return <AdminCohortAnalytics />;
      case 'video_analytics':
        return <AdminVideoAnalytics />;
      case 'result_detail':
        return (
          <AdminResultDetail
            sessionId={selectedResultSessionId}
            onBack={() => {
              setSelectedResultSessionId(null);
              setActiveTab('results');
            }}
          />
        );
      case 'settings':
        return <SuperAdminSettings />;
      case 'banners':
        return <SuperAdminBanners />;
      case 'onboarding':
        return <SuperAdminOnboarding />;
      case 'audit_logs':
        return <SuperAdminAuditLogs />;
      default:
        return <AdminOverview isSuperAdmin={isSuperAdmin} onNavigate={selectTab} />;
    }
  };

  const meta = PAGE_META[activeTab] || PAGE_META.overview;
  const roleCrumb = isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN';

  // ---- shared building blocks (sidebar, icon rail AND the phone drawer) ----

  const brandRow = (mode /* 'full' | 'rail' */) => (
    <div
      style={{
        height: '68px',
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: mode === 'rail' ? 'center' : 'flex-start',
        gap: '11px',
        padding: mode === 'rail' ? 0 : '0 18px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span
        style={{
          width: '36px',
          height: '36px',
          flex: 'none',
          borderRadius: '11px',
          background: 'var(--primary)',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
        }}
      >
        <Icon name="graduation-cap" size={20} />
      </span>
      {mode === 'full' && (
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', font: '700 15px/1 var(--font-display)', letterSpacing: '-.025em', color: 'var(--tx)' }}>
            Practest
          </span>
          <span
            style={{
              display: 'block',
              marginTop: '4px',
              font: '600 8.5px/1 var(--font-mono)',
              letterSpacing: '.16em',
              color: 'var(--primary)',
            }}
          >
            {roleCrumb}
          </span>
        </span>
      )}
    </div>
  );

  const navList = (collapsedMode) => (
    <nav style={{ flex: 1, overflowY: 'auto', padding: collapsedMode ? '14px 10px' : '16px 12px' }} aria-label="Admin sections">
      {groups.map((g, gi) => (
        <div
          key={g.label}
          style={
            g.superOnly
              ? { marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--line)' }
              : gi === 0
                ? undefined
                : { marginTop: '18px' }
          }
        >
          {!collapsedMode && (
            <div
              className="t-overline"
              style={{ fontSize: '9.5px', color: 'var(--muted)', padding: gi === 0 ? '6px 10px 8px' : '0 10px 8px' }}
            >
              {g.label}
            </div>
          )}
          {g.items.map((item) => (
            <NavRow
              key={item.id}
              item={item}
              collapsed={collapsedMode}
              active={isActive(item.id)}
              badge={badgeFor(item)}
              onClick={() => selectTab(item.id)}
            />
          ))}
        </div>
      ))}
    </nav>
  );

  const initials = (user?.name || 'A')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const footer = user && (
    <div style={{ flex: 'none', padding: '12px', borderTop: '1px solid var(--line)' }}>
      <button
        type="button"
        onClick={handleLogout}
        className="admin-nav-row"
        title="Log out"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          width: '100%',
          minHeight: '48px',
          padding: '9px 10px',
          borderRadius: '12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: '34px',
            height: '34px',
            flex: 'none',
            borderRadius: '999px',
            background: 'var(--primary)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            font: '700 12px var(--font-body)',
          }}
        >
          {initials}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: 'block',
              font: '600 12.5px var(--font-body)',
              color: 'var(--tx)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.name}
          </span>
          <span
            style={{
              display: 'block',
              font: '400 11px var(--font-body)',
              color: 'var(--muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isSuperAdmin ? 'Super administrator' : 'Administrator'}
          </span>
        </span>
        <span style={{ color: 'var(--muted)', display: 'inline-flex' }}>
          <Icon name="log-out" size={17} />
        </span>
      </button>
    </div>
  );

  const railFooter = (
    <div style={{ flex: 'none', padding: '10px 0', display: 'flex', justifyContent: 'center' }}>
      <button
        type="button"
        onClick={handleLogout}
        title="Log out"
        aria-label="Log out"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '999px',
          background: 'var(--primary)',
          border: 'none',
          color: '#fff',
          font: '700 12px var(--font-body)',
          cursor: 'pointer',
        }}
      >
        {initials}
      </button>
    </div>
  );

  const showAuthoringNotice = AUTHORING_TABS.has(activeTab) && !authoringNoticeDismissed;

  const csvTone =
    csvState.status === 'pending'
      ? { bg: 'var(--primary-soft)', bd: 'var(--primary-border)', fg: 'var(--primary)', icon: 'clock' }
      : csvState.status === 'complete' && csvState.errors.length === 0
        ? { bg: 'var(--success-bg)', bd: 'var(--success-border)', fg: 'var(--success)', icon: 'check-circle' }
        : { bg: 'var(--danger-bg)', bd: 'var(--danger-border)', fg: 'var(--danger)', icon: 'alert' };

  return (
    <>
      <style>{`
        .admin-shell { display: flex; min-height: 100vh; background: var(--bg); color: var(--tx); }
        .admin-sidebar { display: none; flex-shrink: 0; flex-direction: column; background: var(--card); border-right: 1px solid var(--line); }
        .admin-rail { display: none; }
        .admin-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 100vh; }
        .admin-topbar { display: flex; }
        .admin-content { padding: 16px; box-sizing: border-box; }
        .admin-pagehead { display: none; }
        .admin-jump-wrap { position: relative; width: 280px; }
        .admin-authoring-notice { display: flex; }
        @media (hover: hover) {
          .admin-nav-row:not(.active):hover { background: var(--surf); }
          .admin-jump-item:hover { background: var(--surf); }
          .admin-icon-btn:hover { background: var(--card2); }
        }
        /* tablet — 72px icon rail, sticky page header, no drawer */
        @media (min-width: 640px) {
          .admin-content { padding: 20px; }
          .admin-rail { display: flex; }
          .admin-pagehead { display: flex; }
          .admin-topbar { display: none; }
        }
        /* desktop — 260px sectioned sidebar (collapsible), no rail */
        @media (min-width: 1024px) {
          .admin-content { padding: 24px 28px; }
          .admin-rail { display: none; }
          .admin-sidebar { display: flex; }
          .admin-authoring-notice { display: none; }
        }
      `}</style>

      <div className="admin-shell">

        {/* --- 260px sectioned sidebar (>=1024px), collapsible to 72px --- */}
        <aside className="admin-sidebar" style={{ width: collapsed ? '72px' : '260px' }}>
          {brandRow(collapsed ? 'rail' : 'full')}
          {navList(collapsed)}
          <div
            style={{
              flex: 'none',
              padding: collapsed ? '8px 0' : '8px 12px',
              display: 'flex',
              justifyContent: collapsed ? 'center' : 'flex-end',
            }}
          >
            <button
              type="button"
              className="admin-icon-btn"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '11px',
                background: 'transparent',
                border: '1px solid var(--line)',
                color: 'var(--tx2)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={17} />
            </button>
          </div>
          {collapsed ? railFooter : footer}
        </aside>

        {/* --- 72px icon rail (tablet) --- */}
        <aside
          className="admin-rail"
          style={{
            width: '72px',
            flex: 'none',
            flexDirection: 'column',
            background: 'var(--card)',
            borderRight: '1px solid var(--line)',
          }}
        >
          {brandRow('rail')}
          {navList(true)}
          {railFooter}
        </aside>

        {/* --- main column --- */}
        <main className="admin-main">

          {/* phone top app-bar */}
          <div
            className="admin-topbar"
            style={{
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderBottom: '1px solid var(--line)',
              background: 'var(--card)',
              position: 'sticky',
              top: 0,
              zIndex: 20,
            }}
          >
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation menu"
              className="admin-icon-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'var(--surf)',
                border: '1px solid var(--line)',
                color: 'var(--tx2)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Icon name="menu" size={19} />
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="t-overline" style={{ fontSize: '9.5px', letterSpacing: '.1em', color: 'var(--muted)' }}>
                {roleCrumb} / {meta.crumb}
              </div>
              <div
                style={{
                  marginTop: '3px',
                  font: '700 16px/1 var(--font-display)',
                  letterSpacing: '-.03em',
                  color: 'var(--tx)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {meta.title}
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="admin-icon-btn"
              aria-label={`Switch to ${isDark ? 'day' : 'night'} mode`}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'var(--surf)',
                border: '1px solid var(--line)',
                color: 'var(--tx2)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Icon name={isDark ? 'sun' : 'moon'} size={18} />
            </button>
          </div>

          {/* sticky page header (>=640px) */}
          <div
            className="admin-pagehead"
            style={{
              height: '68px',
              flex: 'none',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '18px',
              padding: '0 20px',
              background: 'var(--card)',
              borderBottom: '1px solid var(--line)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              position: 'sticky',
              top: 0,
              zIndex: 20,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="t-overline" style={{ fontSize: '10.5px', letterSpacing: '.1em', color: 'var(--muted)' }}>
                {roleCrumb} / {meta.crumb}
              </div>
              <div
                style={{
                  marginTop: '4px',
                  font: '700 20px/1 var(--font-display)',
                  letterSpacing: '-.03em',
                  color: 'var(--tx)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {meta.title}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 'none' }}>
              {/* jump-to — filters the console's own destinations, no API call */}
              <div className="admin-jump-wrap">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    padding: '10px 13px',
                    borderRadius: '12px',
                    background: 'var(--surf)',
                    border: '1px solid var(--line)',
                    color: 'var(--muted)',
                  }}
                >
                  <Icon name="search" size={16} />
                  <input
                    ref={jumpRef}
                    value={jump}
                    onChange={(e) => {
                      setJump(e.target.value);
                      setJumpOpen(true);
                    }}
                    onFocus={() => setJumpOpen(true)}
                    onBlur={() => window.setTimeout(() => setJumpOpen(false), 120)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && jumpMatches[0]) selectTab(jumpMatches[0].id);
                    }}
                    placeholder="Jump to a section"
                    aria-label="Jump to a section"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      font: '400 13px var(--font-body)',
                      color: 'var(--tx)',
                    }}
                  />
                  <span
                    style={{
                      font: '500 10.5px var(--font-mono)',
                      color: 'var(--muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ⌘K
                  </span>
                </div>

                {jumpOpen && jumpMatches.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      background: 'var(--card)',
                      border: '1px solid var(--line)',
                      borderRadius: '14px',
                      boxShadow: 'var(--shadow-2)',
                      padding: '6px',
                      zIndex: 40,
                    }}
                  >
                    {jumpMatches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="admin-jump-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectTab(m.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          padding: '9px 10px',
                          borderRadius: '10px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ color: 'var(--tx2)', display: 'inline-flex' }}>
                          <Icon name={m.icon} size={16} />
                        </span>
                        <span style={{ font: '600 12.5px var(--font-body)', color: 'var(--tx)' }}>{m.label}</span>
                        <span className="t-overline" style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--muted)' }}>
                          {m.group}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="admin-icon-btn"
                aria-label={`Switch to ${isDark ? 'day' : 'night'} mode`}
                title={`Switch to ${isDark ? 'day' : 'night'} mode`}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'var(--surf)',
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
                onClick={() => selectTab('activations')}
                className="admin-icon-btn"
                aria-label={counts.activations ? `${counts.activations} activation requests waiting` : 'Activation requests'}
                title="Activation requests"
                style={{
                  position: 'relative',
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'var(--surf)',
                  border: '1px solid var(--line)',
                  color: 'var(--tx2)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <Icon name="bell" size={18} />
                {counts.activations > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '9px',
                      right: '10px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: 'var(--danger)',
                      border: '1.5px solid var(--card)',
                    }}
                  />
                )}
              </button>

              {/* One filled primary per view. On the overview the header owns it;
                  on every other tab the page below owns its own primary action. */}
              {activeTab === 'overview' && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => selectTab('tests')}
                  style={{ padding: '11px 17px', fontSize: '13px' }}
                >
                  <Icon name="plus" size={16} strokeWidth={2.4} />
                  New test
                </button>
              )}
            </div>
          </div>

          {/* authoring is desktop-first — say so, never block */}
          {showAuthoringNotice && (
            <div
              className="admin-authoring-notice"
              style={{
                alignItems: 'center',
                gap: '10px',
                padding: '11px 16px',
                background: 'var(--primary-soft)',
                borderBottom: '1px solid var(--primary-border)',
                color: 'var(--primary)',
                font: '500 12.5px/1.45 var(--font-body)',
              }}
            >
              <Icon name="monitor" size={16} />
              <span style={{ flex: 1 }}>
                Authoring works best on a larger screen — review and approvals are fully supported here.
              </span>
              <button
                type="button"
                onClick={() => setAuthoringNoticeDismissed(true)}
                aria-label="Dismiss notice"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  padding: 0,
                }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          )}

          {/* CSV import status bar */}
          {showCsvAlert && csvState.status && (
            <div
              style={{
                background: csvTone.bg,
                borderBottom: `1px solid ${csvTone.bd}`,
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: csvTone.fg, font: '500 13px var(--font-body)' }}>
                <Icon name={csvTone.icon} size={16} />
                {csvState.status === 'pending' ? (
                  <span>
                    Importing questions — <span className="t-num" style={{ fontWeight: 600 }}>{csvState.imported}</span> done so far…
                  </span>
                ) : csvState.status === 'complete' && csvState.errors.length === 0 ? (
                  <span>
                    Imported <span className="t-num" style={{ fontWeight: 600 }}>{csvState.imported}</span> questions.
                  </span>
                ) : (
                  <span>
                    <span className="t-num" style={{ fontWeight: 600 }}>{csvState.errors.length}</span> rows failed —{' '}
                    <span className="t-num" style={{ fontWeight: 600 }}>{csvState.imported}</span> imported.
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {activeTab !== 'questions' && (
                  <button
                    type="button"
                    onClick={() => selectTab('questions')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: csvTone.fg,
                      font: '600 13px var(--font-body)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    View details
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowCsvAlert(false)}
                  aria-label="Dismiss import status"
                  style={{ display: 'inline-flex', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="admin-content">{renderContent()}</div>
        </main>

        {/* --- phone drawer: same grouped nav --- */}
        {navOpen && (
          <div
            onClick={() => setNavOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'var(--overlay)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 1000,
              display: 'flex',
              animation: 'fade-in .2s ease both',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(88vw, 300px)',
                height: '100%',
                background: 'var(--card)',
                borderRight: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-pop)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>{brandRow('full')}</div>
                <button
                  type="button"
                  onClick={() => setNavOpen(false)}
                  aria-label="Close navigation menu"
                  style={{
                    width: '44px',
                    height: '44px',
                    margin: '0 10px',
                    borderRadius: '12px',
                    background: 'var(--surf)',
                    border: '1px solid var(--line)',
                    color: 'var(--tx2)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
              {navList(false)}
              {footer}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
