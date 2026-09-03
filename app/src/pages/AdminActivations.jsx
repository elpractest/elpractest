import React, { useState, useEffect } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import {
  PageHead, TableCard, Toolbar, Table, Row, Cell, CellTitle, CellSub, RowChevron,
  EmptyState, SkeletonRows, Drawer, Modal, Field, Notice, Num, Badge,
} from '../components/admin/ui';

export default function AdminActivations() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected Request for verification details
  const [selectedReq, setSelectedReq] = useState(null);
  
  // Proof file preview
  const [proofUrl, setProofUrl] = useState('');
  const [proofType, setProofType] = useState('');
  const [loadingProof, setLoadingProof] = useState(false);

  // Approve/Reject Notes
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  // presentation only: the two confirmations, and the inline rejection-reason error
  const [confirming, setConfirming] = useState(null); // 'approve' | 'reject'
  const [notesError, setNotesError] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Scope to the actionable queue: this panel only ever verifies PENDING
      // requests, and without the filter recent approved/rejected rows push older
      // pending ones off the (unpaginated-in-UI) first page of 15.
      const res = await api.get('/api/admin/activation-requests', { params: { status: 'pending' } });
      // The endpoint returns a Laravel paginator envelope ({ data: [...], ... }),
      // not a bare array. Reading res.data directly left `requests` as an object,
      // so `requests.map(...)` in render threw "e.map is not a function" and the
      // whole queue crashed. Normalise to the row array, tolerant of either shape.
      const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setRequests(rows);
    } catch (err) {
      setError('Failed to fetch activation requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const loadProofDoc = async (req) => {
    setLoadingProof(true);
    setProofUrl('');
    setProofType('');
    try {
      const res = await api.get(`/api/admin/activation-requests/${req.id}/proof`, {
        responseType: 'blob'
      });
      const fileBlob = new Blob([res.data], { type: res.headers['content-type'] });
      const fileUrl = URL.createObjectURL(fileBlob);
      setProofUrl(fileUrl);
      setProofType(res.headers['content-type']);
    } catch (err) {
      setError('Failed to download proof receipt from secure disk.');
    } finally {
      setLoadingProof(false);
    }
  };

  const selectRequestForVerification = (req) => {
    setSelectedReq(req);
    setNotes('');
    loadProofDoc(req);
  };

  const handleApprove = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/api/admin/activation-requests/${selectedReq.id}/approve`, { admin_notes: notes });
      setSuccess('Request approved successfully.');
      setSelectedReq(null);
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Approval transaction failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/api/admin/activation-requests/${selectedReq.id}/reject`, { reason: notes });
      setSuccess('Request rejected successfully.');
      setSelectedReq(null);
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const COLUMNS = [
    { key: 'student', label: 'Student', width: 'minmax(0,1.5fr)' },
    { key: 'target', label: 'Course / batch', width: 'minmax(0,1.3fr)' },
    { key: 'ref', label: 'Reference', width: '150px', hideBelow: 'tablet' },
    { key: 'when', label: 'Waiting', width: '130px' },
    { key: 'go', label: '', width: '32px' },
  ];

  const waitedFor = (iso) => {
    if (!iso) return '—';
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / 86400000);
    if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'}`;
    const hours = Math.max(1, Math.floor(ms / 3600000));
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  };

  const waitTone = (iso) => {
    const days = iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : 0;
    return days >= 3 ? 'var(--danger)' : days >= 1 ? 'var(--reward-text)' : 'var(--tx2)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>

      <PageHead
        title="Activation requests"
        subtitle="Manual bank transfers waiting on a receipt check. Approving enrols the student immediately."
      />

      {success && <Notice tone="success" icon="check-circle" onDismiss={() => setSuccess('')}>{success}</Notice>}
      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      <TableCard>
        <Toolbar
          trailing={
            !loading && requests.length > 0 && (
              <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                Oldest first once you clear the top
              </span>
            )
          }
        >
          <span className="adm-chip queue active">
            Pending <Num style={{ color: 'inherit' }}>{requests.length}</Num>
          </span>
        </Toolbar>

        {loading && requests.length === 0 ? (
          <SkeletonRows />
        ) : requests.length === 0 ? (
          <EmptyState
            icon="check-circle"
            message="The queue is clear — no activation request is waiting on a review."
          />
        ) : (
          <Table columns={COLUMNS}>
            {requests.map((req) => (
              <Row
                key={req.id}
                selected={selectedReq?.id === req.id}
                onClick={() => selectRequestForVerification(req)}
              >
                <Cell label="Student">
                  <CellTitle>{req.user?.name}</CellTitle>
                  <CellSub>{req.user?.email}</CellSub>
                </Cell>
                <Cell label="Course / batch">
                  <CellTitle>{req.course?.title}</CellTitle>
                  {req.batch && <CellSub>{req.batch.name}</CellSub>}
                </Cell>
                <Cell label="Reference" hideBelow="tablet">
                  <Num style={{ fontSize: '12.5px' }}>{req.payment_reference || '—'}</Num>
                </Cell>
                <Cell label="Waiting">
                  <span style={{ font: '600 12.5px var(--font-body)', color: waitTone(req.created_at) }}>
                    {waitedFor(req.created_at)}
                  </span>
                </Cell>
                <Cell align="right">
                  <RowChevron onClick={() => selectRequestForVerification(req)} label="Verify request" />
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </TableCard>

      {/* Verification drawer — desktop right rail, bottom sheet on a phone */}
      {selectedReq && (
        <Drawer
          title={`Request #${selectedReq.id}`}
          subtitle={`${selectedReq.user?.name} · ${selectedReq.user?.email}`}
          onClose={() => setSelectedReq(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  if (!notes.trim()) {
                    setNotesError('A reason is required — the student is shown it.');
                    return;
                  }
                  setNotesError('');
                  setConfirming('reject');
                }}
                className="btn-secondary"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                disabled={actionLoading}
              >
                Reject
              </button>
              <button type="button" onClick={() => setConfirming('approve')} className="btn-primary" disabled={actionLoading}>
                <Icon name="check" size={16} strokeWidth={2.4} />
                Approve
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <span>Course</span>
                <span style={{ color: 'var(--tx)', fontWeight: 600, textAlign: 'right' }}>{selectedReq.course?.title}</span>
              </div>
              {selectedReq.batch && (
                <div style={{ marginTop: '9px', display: 'flex', justifyContent: 'space-between', gap: '12px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
                  <span>Batch</span>
                  <span style={{ color: 'var(--tx)', fontWeight: 600, textAlign: 'right' }}>{selectedReq.batch?.name}</span>
                </div>
              )}
              <div style={{ marginTop: '9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <span>Transaction ref</span>
                <Badge tone="primary" mono>{selectedReq.payment_reference || '—'}</Badge>
              </div>
            </div>

            <div>
              <div className="t-overline" style={{ color: 'var(--muted)', marginBottom: '9px' }}>PAYMENT PROOF</div>

              {loadingProof ? (
                <div className="skeleton" style={{ height: '200px', borderRadius: '14px' }} />
              ) : proofUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {proofType.startsWith('image/') ? (
                    <button
                      type="button"
                      onClick={() => window.open(proofUrl, '_blank')}
                      style={{
                        height: '200px',
                        border: '1px solid var(--line)',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        background: 'var(--surf)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 0,
                        cursor: 'zoom-in',
                      }}
                      aria-label="Open the receipt full size"
                    >
                      <img src={proofUrl} alt="Payment receipt" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </button>
                  ) : (
                    <div
                      style={{
                        height: '100px',
                        background: 'var(--surf)',
                        border: '1px solid var(--line)',
                        borderRadius: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--muted)',
                        font: '400 12.5px var(--font-body)',
                      }}
                    >
                      <Icon name="file-text" size={22} />
                      Document uploaded ({proofType})
                    </div>
                  )}

                  <a
                    href={proofUrl}
                    download={`proof_${selectedReq.payment_reference || selectedReq.id}`}
                    className="btn-secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    <Icon name="download" size={16} />
                    Download receipt
                  </a>
                </div>
              ) : (
                <div
                  style={{
                    padding: '22px',
                    border: '1px dashed var(--line2)',
                    borderRadius: '14px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'var(--muted)',
                    font: '400 12.5px var(--font-body)',
                  }}
                >
                  No document could be fetched.
                </div>
              )}
            </div>

            <Field
              label="Notes"
              error={notesError}
              hint="A reason is required to reject; it is shown to the student."
              htmlFor="act-notes"
            >
              <textarea
                id="act-notes"
                value={notes}
                onChange={(e) => { setNotes(e.target.value); if (notesError) setNotesError(''); }}
                placeholder="Add a comment…"
                className={`form-input${notesError ? ' has-error' : ''}`}
                rows={3}
                disabled={actionLoading}
              />
            </Field>
          </div>
        </Drawer>
      )}

      {/* ---- confirmations, naming the student and what happens next ---- */}
      {confirming === 'approve' && selectedReq && (
        <Modal
          title={`Approve ${selectedReq.user?.name}?`}
          description={`They are enrolled in ${selectedReq.course?.title || 'the course'}${selectedReq.batch ? ` · ${selectedReq.batch.name}` : ''} immediately, and can start straight away.`}
          width={460}
          onClose={() => setConfirming(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setConfirming(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={actionLoading}
                onClick={() => { setConfirming(null); handleApprove(); }}
              >
                Approve & enrol
              </button>
            </>
          }
        />
      )}

      {confirming === 'reject' && selectedReq && (
        <Modal
          danger
          title={`Reject ${selectedReq.user?.name}?`}
          description="They are told why, and can submit a fresh request with a corrected receipt."
          width={460}
          onClose={() => setConfirming(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setConfirming(null)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                disabled={actionLoading}
                onClick={() => { setConfirming(null); handleReject(); }}
              >
                Reject request
              </button>
            </>
          }
        >
          <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px', font: '400 13px/1.6 var(--font-body)', color: 'var(--tx2)' }}>
            {notes}
          </div>
        </Modal>
      )}
    </div>
  );
}
