import React, { useState, useEffect } from 'react';
import api from '../api';

export default function SuperAdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  useEffect(() => {
    fetchLogs(pagination.currentPage);
  }, []);

  const fetchLogs = async (page) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/super-admin/audit-logs?page=${page}`);
      const { data, current_page, last_page, total } = res.data;
      setLogs(data || []);
      setPagination({
        currentPage: current_page,
        lastPage: last_page,
        total: total
      });
    } catch (err) {
      setError('Failed to fetch audit log records.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandLog = (id) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const formatJSON = (val) => {
    if (!val || Object.keys(val).length === 0) return 'None';
    return JSON.stringify(val, null, 2);
  };

  if (loading && logs.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
        <span>⏳ Loading audit trail...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', background: 'linear-gradient(to right, #ffffff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Platform Audit Logs
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Review a secure, chronological trail of all sensitive admin and settings modification actions taken on this deployment.
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#f87171', marginBottom: '24px', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>Timestamp</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>Action</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>User</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>IP Address</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff', textAlign: 'right' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No audit log entries found.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', background: isExpanded ? 'rgba(99, 102, 241, 0.03)' : 'transparent', transition: 'background 0.2s ease' }}>
                      <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#a78bfa', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {log.user ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#ffffff' }}>{log.user.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.user.email}</div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>System / Guest</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {log.ip_address}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => toggleExpandLog(log.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-color)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            padding: 0
                          }}
                        >
                          {isExpanded ? 'Hide ▲' : 'Show Details ▼'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0, 0, 0, 0.2)' }}>
                        <td colSpan="5" style={{ padding: '20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Old Values</div>
                              <pre style={{ margin: 0, padding: '12px', background: '#090d16', border: '1px solid var(--border-color)', borderRadius: '6px', overflowX: 'auto', fontSize: '0.75rem', fontFamily: 'monospace', color: '#f87171', maxHeight: '180px' }}>
                                {formatJSON(log.old_values)}
                              </pre>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>New Values</div>
                              <pre style={{ margin: 0, padding: '12px', background: '#090d16', border: '1px solid var(--border-color)', borderRadius: '6px', overflowX: 'auto', fontSize: '0.75rem', fontFamily: 'monospace', color: '#34d399', maxHeight: '180px' }}>
                                {formatJSON(log.new_values)}
                              </pre>
                            </div>
                          </div>
                          {log.user_agent && (
                            <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              <strong>User Agent:</strong> {log.user_agent}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.lastPage > 1 && (
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Page {pagination.currentPage} of {pagination.lastPage}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => fetchLogs(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1 || loading}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Previous
              </button>
              <button
                onClick={() => fetchLogs(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.lastPage || loading}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
