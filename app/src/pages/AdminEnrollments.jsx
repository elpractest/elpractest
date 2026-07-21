import React, { useState, useEffect } from 'react';
import api from '../api';

export default function AdminEnrollments() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tabs state
  const [activeTab, setActiveTab] = useState('enrollments'); // enrollments | payments

  // Batch Form State
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchForm, setBatchForm] = useState({ id: null, name: '', max_students: '', starts_at: '', ends_at: '', is_active: true, price_paise: null });

  // Enrollment Form State
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [enrollForm, setEnrollForm] = useState({ expires_at: '' });

  // Payments History State
  const [payments, setPayments] = useState([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsLastPage, setPaymentsLastPage] = useState(1);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Fetch all courses on mount
  const fetchCourses = async () => {
    try {
      const res = await api.get('/api/admin/courses');
      setCourses(res.data);
      if (res.data.length > 0 && !selectedCourse) {
        setSelectedCourse(res.data[0]);
      }
    } catch (e) {
      setError('Failed to fetch courses.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch batches for selected course
  const fetchBatches = async () => {
    if (!selectedCourse) return;
    try {
      const res = await api.get(`/api/admin/courses/${selectedCourse.id}/batches`);
      setBatches(res.data);
      if (res.data.length > 0) {
        setSelectedBatch(res.data[0]);
      } else {
        setSelectedBatch(null);
      }
    } catch (e) {
      setError('Failed to fetch batches.');
    }
  };

  // Fetch enrollments filter by course and batch
  const fetchEnrollments = async () => {
    try {
      const params = {};
      if (selectedCourse) params.course_id = selectedCourse.id;
      if (selectedBatch) params.batch_id = selectedBatch.id;

      const res = await api.get('/api/admin/enrollments', { params });
      setEnrollments(res.data.data || res.data);
    } catch (e) {
      setError('Failed to fetch enrollments.');
    }
  };

  // Fetch payments log
  const fetchPayments = async (page = 1) => {
    setLoadingPayments(true);
    try {
      const res = await api.get(`/api/admin/payments?page=${page}`);
      setPayments(res.data.data || []);
      setPaymentsPage(res.data.current_page || 1);
      setPaymentsLastPage(res.data.last_page || 1);
    } catch (e) {
      setError('Failed to fetch payment history.');
    } finally {
      setLoadingPayments(false);
    }
  };

  // Search students for picker
  const searchStudents = async (val) => {
    setStudentSearch(val);
    if (val.length < 2) {
      setStudentSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/api/admin/users?search=${val}`);
      setStudentSearchResults(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [selectedCourse]);

  useEffect(() => {
    fetchEnrollments();
  }, [selectedCourse, selectedBatch]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPayments(paymentsPage);
    }
  }, [activeTab, paymentsPage]);

  // Batch Form Submit
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: batchForm.name,
        max_students: batchForm.max_students ? parseInt(batchForm.max_students) : null,
        starts_at: batchForm.starts_at || null,
        ends_at: batchForm.ends_at || null,
        is_active: batchForm.is_active,
        price_paise: batchForm.price_paise !== null && batchForm.price_paise !== undefined ? parseInt(batchForm.price_paise) : null,
      };

      if (batchForm.id) {
        await api.put(`/api/admin/batches/${batchForm.id}`, payload);
        setSuccess('Batch updated successfully.');
      } else {
        await api.post(`/api/admin/courses/${selectedCourse.id}/batches`, payload);
        setSuccess('Batch created successfully.');
      }
      setShowBatchForm(false);
      fetchBatches();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving batch.');
    }
  };

  const handleDeactivateBatch = async (batch) => {
    if (!window.confirm(`Deactivate batch "${batch.name}"? Active students will remain enrolled but no new registrations can join.`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/api/admin/batches/${batch.id}`);
      setSuccess(`Batch "${batch.name}" deactivated.`);
      fetchBatches();
    } catch (err) {
      setError('Failed to deactivate batch.');
    }
  };

  // Enrollment Submit
  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedStudent) {
      setError('Please select a student.');
      return;
    }

    try {
      await api.post('/api/admin/enrollments', {
        user_id: selectedStudent.id,
        course_id: selectedCourse.id,
        batch_id: selectedBatch?.id || null,
        expires_at: enrollForm.expires_at || null
      });

      setSuccess(`Student "${selectedStudent.name}" enrolled successfully.`);
      setShowEnrollForm(false);
      setSelectedStudent(null);
      setStudentSearch('');
      setStudentSearchResults([]);
      fetchEnrollments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to enroll student.');
    }
  };

  const handleToggleEnrollmentStatus = async (enrollment) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/api/admin/enrollments/${enrollment.id}/toggle`);
      setSuccess(res.data.message);
      fetchEnrollments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle enrollment status.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>Batches & Enrollments</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Manage student class groups, batch capacities, pricing, and active learning enrollments.</p>
        </div>
        {activeTab === 'enrollments' && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => {
                setBatchForm({ id: null, name: '', max_students: '', starts_at: '', ends_at: '', is_active: true, price_paise: null });
                setShowBatchForm(true);
              }} 
              className="btn-secondary"
              style={{ padding: '10px 20px', fontSize: '0.9rem' }}
              disabled={!selectedCourse}
            >
              ➕ Create Batch
            </button>
            <button 
              onClick={() => {
                setSelectedStudent(null);
                setStudentSearch('');
                setStudentSearchResults([]);
                setEnrollForm({ expires_at: '' });
                setShowEnrollForm(true);
              }} 
              className="btn-primary"
              disabled={!selectedCourse}
            >
              ➕ Enroll Student
            </button>
          </div>
        )}
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('enrollments')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'enrollments' ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            paddingBottom: '8px',
            borderBottom: activeTab === 'enrollments' ? '2px solid var(--accent-color)' : 'none',
            marginBottom: '-13px'
          }}
        >
          🎓 Enrollments
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'payments' ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            paddingBottom: '8px',
            borderBottom: activeTab === 'payments' ? '2px solid var(--accent-color)' : 'none',
            marginBottom: '-13px'
          }}
        >
          💳 Payment History
        </button>
      </div>

      {activeTab === 'enrollments' ? (
        /* Main Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '30px', alignItems: 'start' }}>
          
          {/* Left Side: Course and Batch selection list */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Course Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>1. Select Course</label>
              <select 
                value={selectedCourse?.id || ''} 
                onChange={(e) => setSelectedCourse(courses.find(c => c.id === parseInt(e.target.value)))}
                className="form-input"
              >
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            {/* Batch Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>2. Filter Batch</label>
              
              {batches.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px' }}>
                  No batches created yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => setSelectedBatch(null)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      textAlign: 'left',
                      background: selectedBatch === null ? 'var(--accent-soft)' : 'transparent',
                      border: selectedBatch === null ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                      color: selectedBatch === null ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    📁 All Batches
                  </button>
                  {batches.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBatch(b)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: selectedBatch?.id === b.id ? 'var(--accent-soft)' : 'var(--surface-1)',
                        border: selectedBatch?.id === b.id ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: b.is_active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {b.name} {!b.is_active && '(Suspended)'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Limit: {b.max_students || 'No Limit'} | Price: {b.price_paise ? `₹${b.price_paise/100}` : 'Free/Manual'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBatchForm(b);
                            setShowBatchForm(true);
                          }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                          ✏️
                        </button>
                        {b.is_active && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeactivateBatch(b);
                            }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Side: Enrollments List Table */}
          <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 16px 0', fontWeight: 700 }}>
              Enrolled Students {selectedBatch ? `in: ${selectedBatch.name}` : ''}
            </h2>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <th style={{ padding: '12px 16px' }}>Student Details</th>
                  <th style={{ padding: '12px 16px' }}>Course / Batch</th>
                  <th style={{ padding: '12px 16px' }}>Enrolled At</th>
                  <th style={{ padding: '12px 16px' }}>Expires At</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No student enrollments found.</td>
                  </tr>
                ) : (
                  enrollments.map((en) => (
                    <tr key={en.id} style={{ borderBottom: '1px solid var(--surface-2)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 600 }}>{en.user?.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{en.user?.email}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div>{en.course?.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Batch: {en.batch?.name || 'All'}
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {new Date(en.enrolled_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '16px' }}>
                        {en.expires_at ? new Date(en.expires_at).toLocaleDateString() : 'Lifetime'}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span 
                          style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 'bold', 
                            padding: '2px 8px', 
                            borderRadius: '4px',
                            background: en.is_active ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: en.is_active ? 'var(--success)' : 'var(--danger)'
                          }}
                        >
                          {en.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleToggleEnrollmentStatus(en)}
                          className="btn-secondary"
                          style={{ 
                            padding: '4px 10px', 
                            fontSize: '0.8rem', 
                            color: en.is_active ? 'var(--danger)' : 'var(--success)',
                            borderColor: en.is_active ? 'var(--danger-border)' : 'var(--success-border)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {en.is_active ? 'Suspend' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      ) : (
        /* Payment History View */
        <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>Transaction History</h2>
            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => fetchPayments(1)}>🔄 Refresh</button>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <th style={{ padding: '12px 16px' }}>Student</th>
                <th style={{ padding: '12px 16px' }}>Course / Batch</th>
                <th style={{ padding: '12px 16px' }}>Order ID / Payment ID</th>
                <th style={{ padding: '12px 16px' }}>Amount</th>
                <th style={{ padding: '12px 16px' }}>Coupon</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {loadingPayments ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading transactions...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No payment records found.</td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--surface-2)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600 }}>{p.user?.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{p.user?.email}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div>{p.batch?.course?.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Batch: {p.batch?.name}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontSize: '0.85rem' }}>Order: <span style={{ color: 'var(--text-secondary)' }}>{p.razorpay_order_id || 'N/A'}</span></div>
                      <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>Pay ID: <span style={{ color: 'var(--text-secondary)' }}>{p.razorpay_payment_id || 'N/A'}</span></div>
                    </td>
                    <td style={{ padding: '16px', fontWeight: 'bold' }}>
                      ₹{p.amount / 100}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {p.coupon?.code ? (
                        <span style={{ fontSize: '0.8rem', padding: '2px 6px', background: 'var(--accent-soft)', color: 'var(--accent-color)', borderRadius: '4px', fontWeight: 600 }}>
                          {p.coupon.code}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span 
                        style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold', 
                          padding: '2px 8px', 
                          borderRadius: '4px',
                          background: p.status === 'paid' ? 'var(--success-bg)' : p.status === 'failed' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                          color: p.status === 'paid' ? 'var(--success)' : p.status === 'failed' ? 'var(--danger)' : 'var(--warning)'
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {paymentsLastPage > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button 
                onClick={() => setPaymentsPage(p => Math.max(p - 1, 1))}
                disabled={paymentsPage === 1 || loadingPayments}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Previous
              </button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Page {paymentsPage} of {paymentsLastPage}
              </span>
              <button 
                onClick={() => setPaymentsPage(p => Math.min(p + 1, paymentsLastPage))}
                disabled={paymentsPage === paymentsLastPage || loadingPayments}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Batch Form Modal */}
      {showBatchForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
              {batchForm.id ? 'Edit Batch' : 'Create Batch'}
            </h3>
            
            <form onSubmit={handleBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Batch Name</label>
                <input 
                  type="text" 
                  value={batchForm.name} 
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} 
                  className="form-input" 
                  required 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Max Students Capacity (Optional)</label>
                <input 
                  type="number" 
                  value={batchForm.max_students || ''} 
                  onChange={(e) => setBatchForm({ ...batchForm, max_students: e.target.value })} 
                  className="form-input" 
                  min={1}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Price (₹, Optional)</label>
                <input 
                  type="number" 
                  value={batchForm.price_paise ? (batchForm.price_paise / 100).toString() : ''} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setBatchForm({ 
                      ...batchForm, 
                      price_paise: val ? Math.round(parseFloat(val) * 100) : null 
                    });
                  }} 
                  className="form-input" 
                  min={0}
                  step="any"
                  placeholder="Leave empty for free / manual-only"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Starts At</label>
                  <input 
                    type="date" 
                    value={batchForm.starts_at ? batchForm.starts_at.substring(0, 10) : ''} 
                    onChange={(e) => setBatchForm({ ...batchForm, starts_at: e.target.value })} 
                    className="form-input" 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ends At</label>
                  <input 
                    type="date" 
                    value={batchForm.ends_at ? batchForm.ends_at.substring(0, 10) : ''} 
                    onChange={(e) => setBatchForm({ ...batchForm, ends_at: e.target.value })} 
                    className="form-input" 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                <input 
                  type="checkbox" 
                  id="batch_active"
                  checked={batchForm.is_active} 
                  onChange={(e) => setBatchForm({ ...batchForm, is_active: e.target.checked })} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="batch_active" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                  Batch Active & Registrations open
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowBatchForm(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Enrollment Modal */}
      {showEnrollForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
              Enroll Student Manual Form
            </h3>
            
            <form onSubmit={handleEnrollSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Course detail readout */}
              <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}>Target Scoping:</div>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '2px' }}>
                  Course: {selectedCourse?.title}
                </div>
                <div style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginTop: '2px' }}>
                  Batch: {selectedBatch ? selectedBatch.name : 'All Batches (No Group)'}
                </div>
              </div>

              {/* Student Picker Dropdown with Search */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Search Student (Name or Email)</label>
                <input 
                  type="text" 
                  value={studentSearch} 
                  onChange={(e) => searchStudents(e.target.value)} 
                  className="form-input" 
                  placeholder="Type to search..."
                  required={!selectedStudent}
                />
                
                {/* Search Results Dropdown Overlay */}
                {studentSearchResults.length > 0 && (
                  <div 
                    className="glass-panel"
                    style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0, 
                      maxHeight: '180px', 
                      overflowY: 'auto', 
                      zIndex: 1010, 
                      marginTop: '4px',
                      background: 'var(--panel-bg-solid)',
                      boxShadow: '0 10px 20px var(--overlay)'
                    }}
                  >
                    {studentSearchResults.map(student => (
                      <div 
                        key={student.id} 
                        onClick={() => {
                          setSelectedStudent(student);
                          setStudentSearch(`${student.name} (${student.email})`);
                          setStudentSearchResults([]);
                        }}
                        style={{ 
                          padding: '10px 14px', 
                          cursor: 'pointer', 
                          borderBottom: '1px solid var(--surface-2)',
                          fontSize: '0.85rem'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 'bold' }}>{student.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{student.email}</div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedStudent && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '4px', fontWeight: 'bold' }}>
                    Selected student ID: #{selectedStudent.id}
                  </div>
                )}
              </div>

              {/* Expiry date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Expiration Date (Optional)</label>
                <input 
                  type="date" 
                  value={enrollForm.expires_at} 
                  onChange={(e) => setEnrollForm({ ...enrollForm, expires_at: e.target.value })} 
                  className="form-input" 
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Leave blank for lifetime access.</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowEnrollForm(false)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }} disabled={!selectedStudent}>Enroll</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
