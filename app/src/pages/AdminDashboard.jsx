import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';

// Sub-components import
import AdminCourses from './AdminCourses';
import AdminQuestions from './AdminQuestions';
import AdminTests from './AdminTests';
import AdminTestSeries from './AdminTestSeries';
import AdminEnrollments from './AdminEnrollments';
import AdminActivations from './AdminActivations';
import AdminActivationCodes from './AdminActivationCodes';
import AdminResults from './AdminResults';
import AdminResultDetail from './AdminResultDetail';
import AdminCohortAnalytics from './AdminCohortAnalytics';
import SuperAdminSettings from './SuperAdminSettings';
import SuperAdminOnboarding from './SuperAdminOnboarding';
import SuperAdminAuditLogs from './SuperAdminAuditLogs';
import SuperAdminBanners from './SuperAdminBanners';

/* Nav model — the same two groups the code has always had. Icons are
   like-for-like lucide glyphs from Icon.jsx (no emoji, no new destinations). */
const MAIN_NAV = [
  { id: 'courses', label: 'Courses & Syllabus', icon: 'book-open' },
  { id: 'questions', label: 'Question Bank', icon: 'edit' },
  { id: 'tests', label: 'Tests Manager', icon: 'award' },
  { id: 'test_series', label: 'Test Series Builder', icon: 'target' },
  { id: 'enrollments', label: 'Batches & Enrollments', icon: 'user' },
  { id: 'activations', label: 'Activation Requests', icon: 'clock' },
  { id: 'codes', label: 'Activation Codes', icon: 'key' },
  { id: 'results', label: 'Results Dashboard', icon: 'chart' },
  { id: 'cohort', label: 'Cohort Analytics', icon: 'target' },
];
const GOV_NAV = [
  { id: 'settings', label: 'White-Label Settings', icon: 'settings' },
  { id: 'banners', label: 'Home Banners', icon: 'file' },
  { id: 'onboarding', label: 'Admin Accounts & Onboarding', icon: 'zap' },
  { id: 'audit_logs', label: 'System Audit Logs', icon: 'file' },
];

function GroupLabel({ children }) {
  return (
    <div style={{ font: '800 10px var(--font-body)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', padding: '0 12px', marginBottom: '8px' }}>
      {children}
    </div>
  );
}

/* A single nav row: 18px line icon + label. Idle = tx2 icon / tx label 600.
   Active = soft-tint background, brand left-bar, accent icon + full-weight label. */
function NavRow({ tab, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`admin-nav-row${active ? ' active' : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '11px 12px',
        background: active ? 'var(--accent-soft)' : 'transparent',
        border: 'none',
        borderRadius: '11px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-body)',
        transition: 'background .18s ease',
      }}
    >
      {active && (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: '8px', bottom: '8px', width: '3px', borderRadius: '0 3px 3px 0', background: 'var(--brand)' }}
        />
      )}
      <span style={{ display: 'inline-flex', flexShrink: 0, color: active ? 'var(--accent-color)' : 'var(--tx2)' }}>
        <Icon name={tab.icon} size={18} strokeWidth={2} />
      </span>
      <span style={{ font: active ? '700 0.92rem var(--font-body)' : '600 0.92rem var(--font-body)', color: 'var(--tx)' }}>
        {tab.label}
      </span>
    </button>
  );
}

export default function AdminDashboard({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('courses');
  const [selectedResultSessionId, setSelectedResultSessionId] = useState(null);
  const [navOpen, setNavOpen] = useState(false); // mobile/tablet drawer
  const navigate = useNavigate();

  const isSuperAdmin = user?.roles?.includes('super-admin');

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

  const selectTab = (id) => {
    setActiveTab(id);
    if (id !== 'results') setSelectedResultSessionId(null);
    setNavOpen(false);
  };

  // Render active panel content
  const renderContent = () => {
    switch (activeTab) {
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
        return <AdminCourses />;
    }
  };

  // ---- shared building blocks (used by the sidebar AND the mobile drawer) ----

  const brandMark = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'var(--grad-primary)', color: '#ffffff' }}>
        <Icon name="graduation-cap" size={17} />
      </span>
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '1px', lineHeight: 1.02 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warning)' }}>e-Learning</span>
        <span className="text-gradient" style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.02em', fontFamily: 'var(--font-display)' }}>
          Practest<sup style={{ fontSize: '0.5em', verticalAlign: 'super', WebkitTextFillColor: 'var(--text-secondary)', marginLeft: '1px' }}>®</sup>
        </span>
      </span>
    </div>
  );

  const roleBadge = isSuperAdmin ? (
    <span style={{ fontSize: '0.65rem', color: '#ffffff', background: 'var(--grad-primary)', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold', letterSpacing: '0.05em' }}>
      SUPER ADMIN
    </span>
  ) : (
    <span style={{ fontSize: '0.65rem', color: 'var(--success)', background: 'var(--success-bg)', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
      Admin Console
    </span>
  );

  const navList = (
    <nav style={{ flex: 1, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
      <GroupLabel>Main</GroupLabel>
      {MAIN_NAV.map((tab) => (
        <NavRow key={tab.id} tab={tab} active={isActive(tab.id)} onClick={() => selectTab(tab.id)} />
      ))}

      {isSuperAdmin && (
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
          <GroupLabel>Governance</GroupLabel>
          {GOV_NAV.map((tab) => (
            <NavRow key={tab.id} tab={tab} active={isActive(tab.id)} onClick={() => selectTab(tab.id)} />
          ))}
        </div>
      )}
    </nav>
  );

  const footer = user && (
    <div style={{ padding: '20px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--tx)' }}>{user.name}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
      </div>
      <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem', width: '100%' }}>
        Logout
      </button>
    </div>
  );

  return (
    <>
      <style>{`
        .admin-shell { display: flex; min-height: 100vh; background: var(--bg); color: var(--tx); }
        .admin-sidebar { display: flex; width: 280px; flex-shrink: 0; flex-direction: column; background: var(--card); border-right: 1px solid var(--line); }
        .admin-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow-y: auto; }
        .admin-topbar { display: none; }
        .admin-content { padding: 24px; box-sizing: border-box; }
        .admin-nav-row:not(.active):hover { background: var(--surf); }
        @media (min-width: 1024px) {
          .admin-content { padding: 40px; }
        }
        @media (max-width: 1023px) {
          .admin-sidebar { display: none; }
          .admin-topbar { display: flex; }
        }
      `}</style>

      <div className="admin-shell">

        {/* Sidebar Navigation (>=1024px) */}
        <aside className="admin-sidebar">
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
            {brandMark}
            {roleBadge}
          </div>
          {navList}
          {footer}
        </aside>

        {/* Main Content Area */}
        <main className="admin-main">

          {/* Mobile / tablet top app-bar with menu button (<1024px) */}
          <div className="admin-topbar" style={{ alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--card)', position: 'sticky', top: 0, zIndex: 20 }}>
            {brandMark}
            <button
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation menu"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '11px', background: 'var(--surf)', border: '1px solid var(--line2)', color: 'var(--tx)', cursor: 'pointer', flexShrink: 0 }}
            >
              <Icon name="grid" size={18} />
            </button>
          </div>

          {/* Global CSV Import Polling Indicator Bar */}
          {showCsvAlert && csvState.status && (
            <div
              style={{
                background: csvState.status === 'pending' ? 'var(--accent-soft)' : csvState.status === 'complete' && csvState.errors.length === 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                borderBottom: '1px solid ' + (csvState.status === 'pending' ? 'var(--accent-border)' : csvState.status === 'complete' && csvState.errors.length === 0 ? 'var(--success-border)' : 'var(--danger-border)'),
                padding: '12px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                fontSize: '0.9rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>CSV Question Import Status:</span>
                {csvState.status === 'pending' ? (
                  <span style={{ color: 'var(--accent-color)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="clock" size={15} /> Processing in background (Imported: {csvState.imported})...
                  </span>
                ) : csvState.status === 'complete' && csvState.errors.length === 0 ? (
                  <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="check-circle" size={15} /> Successfully imported {csvState.imported} questions!
                  </span>
                ) : (
                  <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="alert" size={15} /> Completed with {csvState.errors.length} failed rows (Imported: {csvState.imported}).
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {activeTab !== 'questions' && (
                  <button
                    onClick={() => setActiveTab('questions')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
                  >
                    View Details
                  </button>
                )}
                <button
                  onClick={() => setShowCsvAlert(false)}
                  aria-label="Dismiss import status"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Panel Content */}
          <div className="admin-content">
            {renderContent()}
          </div>
        </main>

        {/* Mobile / tablet drawer — same grouped nav, over the content */}
        {navOpen && (
          <div
            onClick={() => setNavOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--overlay)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', animation: 'fade-in .2s ease both' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(88vw, 320px)', height: '100%', background: 'var(--card)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-pop)' }}
            >
              <div style={{ padding: '16px 16px 16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
                {brandMark}
                <button
                  onClick={() => setNavOpen(false)}
                  aria-label="Close navigation menu"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '11px', background: 'var(--surf)', border: '1px solid var(--line2)', color: 'var(--tx)', cursor: 'pointer', flexShrink: 0 }}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
              <div style={{ padding: '12px 16px 0' }}>{roleBadge}</div>
              {navList}
              {footer}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
