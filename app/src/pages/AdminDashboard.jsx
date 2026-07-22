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
import SuperAdminSettings from './SuperAdminSettings';
import SuperAdminOnboarding from './SuperAdminOnboarding';
import SuperAdminAuditLogs from './SuperAdminAuditLogs';

export default function AdminDashboard({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('courses');
  const [selectedResultSessionId, setSelectedResultSessionId] = useState(null);
  const navigate = useNavigate();

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
      case 'onboarding':
        return <SuperAdminOnboarding />;
      case 'audit_logs':
        return <SuperAdminAuditLogs />;
      default:
        return <AdminCourses />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      
      {/* Sidebar Navigation */}
      <aside style={{ width: '280px', background: 'var(--panel-bg-solid)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* Sidebar Header Logo */}
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
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
          {user?.roles?.includes('super-admin') ? (
            <span style={{ fontSize: '0.65rem', color: 'var(--accent-color)', background: 'rgba(99, 102, 241, 0.15)', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
              Admin Mode
            </span>
          ) : (
            <span style={{ fontSize: '0.65rem', color: 'var(--success)', background: 'var(--success-bg)', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
              Admin Console
            </span>
          )}
        </div>

        {/* Sidebar Navigation Links */}
        <nav style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          {[
            { id: 'courses', label: 'Courses & Syllabus', icon: '📚' },
            { id: 'questions', label: 'Question Bank', icon: '📝' },
            { id: 'tests', label: 'Tests Manager', icon: '🏆' },
            { id: 'test_series', label: 'Test Series Builder', icon: '🎯' },
            { id: 'enrollments', label: 'Batches & Enrollments', icon: '👥' },
            { id: 'activations', label: 'Activation Requests', icon: '⏳' },
            { id: 'codes', label: 'Activation Codes', icon: '🔑' },
            { id: 'results', label: 'Results Dashboard', icon: '📊' },
          ].map((tab) => {
            const isSelected = activeTab === tab.id || (tab.id === 'results' && activeTab === 'result_detail');
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'results') setSelectedResultSessionId(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  background: isSelected ? 'var(--accent-color)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <span style={{ fontSize: '1.2rem' }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}

          {user?.roles?.includes('super-admin') && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button
                onClick={() => navigate('/super-admin/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'rgba(230, 57, 70, 0.12)',
                  border: '1px solid rgba(230, 57, 70, 0.3)',
                  borderRadius: '8px',
                  color: '#e63946',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>👑 Super Admin Console</span>
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar Footer User Info */}
        {user && (
          <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
            <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem', width: '100%' }}>
              Logout
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        
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
              fontSize: '0.9rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>CSV Question Import Status:</span>
              {csvState.status === 'pending' ? (
                <span style={{ color: 'var(--accent-color)' }}>⏳ Processing in background (Imported: {csvState.imported})...</span>
              ) : csvState.status === 'complete' && csvState.errors.length === 0 ? (
                <span style={{ color: 'var(--success)' }}>✅ Successfully imported {csvState.imported} questions!</span>
              ) : (
                <span style={{ color: 'var(--danger)' }}>⚠️ Completed with {csvState.errors.length} failed rows (Imported: {csvState.imported}).</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
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
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Panel Content */}
        <div style={{ padding: '40px', boxSizing: 'border-box' }}>
          {renderContent()}
        </div>
      </main>

    </div>
  );
}
