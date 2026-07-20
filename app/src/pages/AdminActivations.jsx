import React, { useState, useEffect } from 'react';
import api from '../api';

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

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/activation-requests');
      setRequests(res.data);
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
    if (!window.confirm('Approve this course activation request? The student will be enrolled in the course immediately.')) return;
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
    if (!notes.trim()) {
      alert('Please provide a rejection reason in the notes field.');
      return;
    }
    if (!window.confirm('Reject this activation request?')) return;
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/api/admin/activation-requests/${selectedReq.id}/reject`, { admin_notes: notes });
      setSuccess('Request rejected successfully.');
      setSelectedReq(null);
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Title Header */}
      <div>
        <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>Course Activation Queue</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Review manual bank transfers/receipt proof documents and approve course admissions.</p>
      </div>

      {success && (
        <div style={{ padding: '16px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '8px', color: 'var(--success)' }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Main Grid View */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '30px', alignItems: 'start' }}>
        
        {/* Left Side: Pending requests queue table */}
        <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
          <h2 style={{ fontSize: '1.2rem', margin: '0 0 16px 0', fontWeight: 700 }}>Pending Verification Queue</h2>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <th style={{ padding: '12px 16px' }}>Student Details</th>
                <th style={{ padding: '12px 16px' }}>Course / Batch Target</th>
                <th style={{ padding: '12px 16px' }}>Reference Code</th>
                <th style={{ padding: '12px 16px' }}>Requested At</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && requests.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading activation queue...</td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Queue is empty. No pending activation requests.</td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} style={{ borderBottom: '1px solid var(--surface-2)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600 }}>{req.user?.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{req.user?.email}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div>{req.course?.title}</div>
                      {req.batch && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600, marginTop: '2px' }}>
                          Batch: {req.batch.name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {req.payment_reference || 'N/A'}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <button 
                        onClick={() => selectRequestForVerification(req)}
                        className="btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      >
                        🔍 Verify
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Right Side: Verification Details & Receipt Proof Viewer */}
        <div className="glass-panel" style={{ padding: '32px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          {selectedReq ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
              
              {/* Request Info */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>Verify Request #{selectedReq.id}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
                  Submitted by: <strong>{selectedReq.user?.name}</strong> ({selectedReq.user?.email})
                </p>
                <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '8px', marginTop: '12px', fontSize: '0.85rem' }}>
                  <div>Target Course: <strong>{selectedReq.course?.title}</strong></div>
                  {selectedReq.batch && <div>Target Batch: <strong>{selectedReq.batch?.name}</strong></div>}
                  <div style={{ marginTop: '4px' }}>Transaction Ref: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--accent-color)' }}>{selectedReq.payment_reference}</span></div>
                </div>
              </div>

              {/* Receipt File Previewer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Uploaded Payment Proof</label>
                
                {loadingProof ? (
                  <div style={{ height: '220px', background: 'var(--surface-sunken)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Downloading secure file...
                  </div>
                ) : proofUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* Render Image Inline if it is image type */}
                    {proofType.startsWith('image/') ? (
                      <div 
                        style={{ 
                          height: '220px', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px', 
                          overflow: 'hidden', 
                          background: '#000000',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        <img 
                          src={proofUrl} 
                          alt="Receipt Proof" 
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'zoom-in' }} 
                          onClick={() => window.open(proofUrl, '_blank')}
                        />
                      </div>
                    ) : (
                      <div style={{ height: '100px', background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PDF or Document Uploaded ({proofType})</span>
                      </div>
                    )}
                    
                    <a 
                      href={proofUrl} 
                      download={`proof_${selectedReq.payment_reference || selectedReq.id}`} 
                      className="btn-secondary" 
                      style={{ padding: '8px 12px', fontSize: '0.85rem', textAlign: 'center', textDecoration: 'none', display: 'block' }}
                    >
                      💾 Download Receipt File
                    </a>

                  </div>
                ) : (
                  <div style={{ height: '100px', border: '1px dashed var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Failed to fetch document
                  </div>
                )}
              </div>

              {/* Action Form */}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Approval / Rejection Notes</label>
                  <textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Provide comments (Required for rejection)..." 
                    className="form-input" 
                    rows={3} 
                    disabled={actionLoading}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button 
                    type="button" 
                    onClick={handleReject} 
                    className="btn-secondary" 
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', padding: '12px' }}
                    disabled={actionLoading}
                  >
                    ❌ Reject Request
                  </button>
                  <button 
                    type="button" 
                    onClick={handleApprove} 
                    className="btn-primary" 
                    style={{ background: 'var(--success)', boxShadow: 'none', padding: '12px' }}
                    disabled={actionLoading}
                  >
                    ✓ Approve Request
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '340px', color: 'var(--text-secondary)' }}>
              Select an activation request from the queue to verify details and documents.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
