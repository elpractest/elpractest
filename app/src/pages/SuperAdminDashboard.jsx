import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

import SuperAdminSettings from './SuperAdminSettings';
import SuperAdminOnboarding from './SuperAdminOnboarding';
import SuperAdminAuditLogs from './SuperAdminAuditLogs';

export default function SuperAdminDashboard({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('settings');
  const navigate = useNavigate();

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

  const renderContent = () => {
    switch (activeTab) {
      case 'settings':
        return <SuperAdminSettings />;
      case 'onboarding':
        return <SuperAdminOnboarding />;
      case 'audit_logs':
        return <SuperAdminAuditLogs />;
      default:
        return <SuperAdminSettings />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      
      {/* Sidebar Navigation */}
      <aside style={{ width: '280px', background: 'var(--panel-bg-solid)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* Sidebar Header Logo */}
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-color)', letterSpacing: '1px' }}>PRACTEST</span>
          <span style={{ fontSize: '0.75rem', color: '#ffffff', background: 'linear-gradient(135deg, #e63946, #b71c1c)', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            SUPER ADMIN
          </span>
        </div>

        {/* Sidebar Navigation Links */}
        <nav style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', paddingLeft: '8px', marginBottom: '4px' }}>
            Platform Governance
          </div>
          {[
            { id: 'settings', label: 'White-Label Settings', icon: '🎨' },
            { id: 'onboarding', label: 'Admin Accounts & Onboarding', icon: '🚀' },
            { id: 'audit_logs', label: 'System Audit Logs', icon: '📋' },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  background: isSelected ? 'linear-gradient(135deg, #e63946, #b71c1c)' : 'transparent',
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

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => navigate('/admin/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 16px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid var(--accent-border)',
                borderRadius: '8px',
                color: 'var(--accent)',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>📚 Switch to Content Admin</span>
            </button>
          </div>
        </nav>

        {/* User Info & Logout Footer */}
        <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #e63946, #b71c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff' }}>
              SA
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Super Admin'}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ width: '100%', padding: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span>🚪 Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        {renderContent()}
      </main>
    </div>
  );
}
