import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  PageHead, TableCard, Toolbar, Table, Row, Cell, CellTitle, CellSub, Badge,
  EmptyState, SkeletonRows, Pagination, Drawer, Notice, Num,
} from '../components/admin/ui';

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

  const COLUMNS = [
    { key: 'when', label: 'Timestamp', width: '170px' },
    { key: 'action', label: 'Action', width: 'minmax(0,1fr)' },
    { key: 'user', label: 'User', width: 'minmax(0,1fr)' },
    { key: 'ip', label: 'IP address', width: '140px', hideBelow: 'tablet' },
    { key: 'go', label: '', width: '32px' },
  ];

  const expanded = logs.find((l) => l.id === expandedLogId) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
      <PageHead
        title="System audit logs"
        subtitle="A chronological trail of every sensitive admin and settings change on this deployment."
      />

      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      <TableCard>
        <Toolbar
          trailing={
            <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
              <Num>{pagination.total}</Num> entries
            </span>
          }
        >
          <span style={{ font: '600 12.5px var(--font-body)', color: 'var(--tx2)' }}>Newest first</span>
        </Toolbar>

        {loading && logs.length === 0 ? (
          <SkeletonRows />
        ) : logs.length === 0 ? (
          <EmptyState icon="history" message="Nothing has been audited yet. Sensitive changes appear here as they happen." />
        ) : (
          <>
            <Table columns={COLUMNS}>
              {logs.map((log) => (
                <Row
                  key={log.id}
                  selected={expandedLogId === log.id}
                  onClick={() => toggleExpandLog(log.id)}
                >
                  <Cell label="Timestamp">
                    <Num style={{ fontSize: '12px', fontWeight: 500, color: 'var(--tx2)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </Num>
                  </Cell>
                  <Cell label="Action">
                    <Badge tone="ai">{log.action}</Badge>
                  </Cell>
                  <Cell label="User">
                    {log.user ? (
                      <>
                        <CellTitle>{log.user.name}</CellTitle>
                        <CellSub>{log.user.email}</CellSub>
                      </>
                    ) : (
                      <CellSub>System / guest</CellSub>
                    )}
                  </Cell>
                  <Cell label="IP address" hideBelow="tablet">
                    <Num style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>{log.ip_address}</Num>
                  </Cell>
                  <Cell align="right">
                    <span style={{ color: 'var(--muted)', display: 'inline-flex' }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                    </span>
                  </Cell>
                </Row>
              ))}
            </Table>
            <Pagination
              page={pagination.currentPage}
              lastPage={pagination.lastPage}
              onPage={(next) => fetchLogs(next)}
            />
          </>
        )}
      </TableCard>

      {expanded && (
        <Drawer
          title={expanded.action}
          subtitle={`${expanded.user?.name || 'System'} · ${new Date(expanded.created_at).toLocaleString()}`}
          onClose={() => setExpandedLogId(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div className="t-overline" style={{ color: 'var(--muted)', marginBottom: '8px' }}>OLD VALUES</div>
              <pre
                style={{
                  margin: 0,
                  padding: '12px',
                  background: 'var(--card2)',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  overflowX: 'auto',
                  font: '400 11.5px/1.6 var(--font-mono)',
                  color: 'var(--danger)',
                  maxHeight: '200px',
                }}
              >
                {formatJSON(expanded.old_values)}
              </pre>
            </div>
            <div>
              <div className="t-overline" style={{ color: 'var(--muted)', marginBottom: '8px' }}>NEW VALUES</div>
              <pre
                style={{
                  margin: 0,
                  padding: '12px',
                  background: 'var(--card2)',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  overflowX: 'auto',
                  font: '400 11.5px/1.6 var(--font-mono)',
                  color: 'var(--success)',
                  maxHeight: '200px',
                }}
              >
                {formatJSON(expanded.new_values)}
              </pre>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <span>IP address</span>
                <Num style={{ color: 'var(--tx)', fontSize: '12px' }}>{expanded.ip_address}</Num>
              </div>
              {expanded.user_agent && (
                <div style={{ font: '400 11.5px/1.5 var(--font-body)', color: 'var(--muted)' }}>
                  <span className="t-overline" style={{ display: 'block', marginBottom: '4px' }}>USER AGENT</span>
                  {expanded.user_agent}
                </div>
              )}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
