import React, { useState, useEffect } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import {
  PageHead, TableCard, Toolbar, Chip, Table, Row, Cell, CellTitle, CellSub, StatusDot,
  Badge, EmptyState, SkeletonRows, Pagination, Modal, Field, FormGrid, FormSection, Notice, Num,
} from '../components/admin/ui';

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
  const [batchForm, setBatchForm] = useState({ id: null, name: '', max_students: '', starts_at: '', ends_at: '', is_active: true, price_paise: null, play_product_id: '' });

  // Enrollment Form State
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  // presentation only: the destructive confirmation for a batch
  const [pendingBatch, setPendingBatch] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [enrollForm, setEnrollForm] = useState({ expires_at: '' });

  // Payments History State
  const [payments, setPayments] = useState([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsLastPage, setPaymentsLastPage] = useState(1);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Refund flow — always behind a confirmation, since it moves real money and
  // (for a full refund) takes the student's access away.
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

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

  // Raise a refund with Razorpay. A blank amount means the full captured
  // amount; a smaller amount is a partial refund, which keeps the student's
  // access (they still paid for part of the course).
  const submitRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    setError('');
    try {
      const payload = {};
      if (refundAmount !== '') payload.amount = Math.round(parseFloat(refundAmount) * 100);
      if (refundReason.trim()) payload.reason = refundReason.trim();

      const res = await api.post(`/api/admin/payments/${refundTarget.id}/refund`, payload);
      setSuccess(res.data.message || 'Refund raised.');
      setRefundTarget(null);
      setRefundAmount('');
      setRefundReason('');
      fetchPayments(paymentsPage);
    } catch (err) {
      setError(err.response?.data?.message || 'Refund failed.');
    } finally {
      setRefunding(false);
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
        // Blank means "no Play product", which must be null and not '' — the
        // column is unique, and two empty strings would collide.
        play_product_id: batchForm.play_product_id?.trim() ? batchForm.play_product_id.trim() : null,
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

  const ENROL_COLUMNS = [
    { key: 'student', label: 'Student', width: 'minmax(0,1.5fr)' },
    { key: 'scope', label: 'Course / batch', width: 'minmax(0,1.3fr)', hideBelow: 'tablet' },
    { key: 'from', label: 'Enrolled', width: '120px' },
    { key: 'to', label: 'Expires', width: '120px', hideBelow: 'tablet' },
    { key: 'status', label: 'Status', width: '110px' },
    { key: 'act', label: '', width: '120px' },
  ];

  const PAY_COLUMNS = [
    { key: 'student', label: 'Student', width: 'minmax(0,1.4fr)' },
    { key: 'item', label: 'Bought', width: 'minmax(0,1.3fr)' },
    { key: 'ref', label: 'Reference', width: '190px', hideBelow: 'tablet' },
    { key: 'amount', label: 'Amount', width: '110px' },
    { key: 'status', label: 'Status', width: '110px' },
    { key: 'when', label: 'Date', width: '130px', hideBelow: 'tablet' },
    { key: 'act', label: '', width: '100px' },
  ];

  const activeEnrolments = enrollments.filter((en) => en.is_active).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
      <style>{`
        .enr-split { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; }
        @media (min-width: 1100px) { .enr-split { grid-template-columns: minmax(240px, 0.9fr) minmax(0, 3fr); } }
      `}</style>

      <PageHead
        title="Batches & enrollments"
        subtitle="Class groups, their capacity and price, and who is actually in them."
      >
        {activeTab === 'enrollments' && (
          <>
            <button
              type="button"
              onClick={() => {
                setBatchForm({ id: null, name: '', max_students: '', starts_at: '', ends_at: '', is_active: true, price_paise: null, play_product_id: '' });
                setShowBatchForm(true);
              }}
              className="btn-secondary"
              disabled={!selectedCourse}
            >
              <Icon name="plus" size={16} strokeWidth={2.4} />
              New batch
            </button>
            <button
              type="button"
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
              <Icon name="plus" size={16} strokeWidth={2.4} />
              Enroll student
            </button>
          </>
        )}
        {activeTab === 'payments' && (
          <button type="button" className="btn-secondary" onClick={() => fetchPayments(1)}>
            <Icon name="refresh" size={16} />
            Refresh
          </button>
        )}
      </PageHead>

      {success && <Notice tone="success" icon="check-circle" onDismiss={() => setSuccess('')}>{success}</Notice>}
      {error && <Notice tone="danger" icon="alert" onDismiss={() => setError('')}>{error}</Notice>}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Chip active={activeTab === 'enrollments'} onClick={() => setActiveTab('enrollments')}>Enrollments</Chip>
        <Chip active={activeTab === 'payments'} onClick={() => setActiveTab('payments')}>Payment history</Chip>
      </div>

      {activeTab === 'enrollments' ? (
        <div className="enr-split">
          {/* ---- scope picker ---- */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <Field label="Course" htmlFor="enr-course">
              <select
                id="enr-course"
                value={selectedCourse?.id || ''}
                onChange={(e) => setSelectedCourse(courses.find((c) => c.id === parseInt(e.target.value)))}
                className="form-input"
              >
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
              <div className="t-overline" style={{ color: 'var(--muted)', marginBottom: '10px' }}>BATCH</div>

              {batches.length === 0 ? (
                <p style={{ margin: 0, font: '400 12.5px/1.55 var(--font-body)', color: 'var(--muted)' }}>
                  No batch under this course yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedBatch(null)}
                    style={{
                      padding: '11px 12px',
                      minHeight: '44px',
                      borderRadius: '12px',
                      textAlign: 'left',
                      background: selectedBatch === null ? 'var(--primary-soft)' : 'transparent',
                      border: `1px solid ${selectedBatch === null ? 'var(--primary-border)' : 'var(--line)'}`,
                      color: selectedBatch === null ? 'var(--primary)' : 'var(--tx2)',
                      font: '600 12.5px var(--font-body)',
                      cursor: 'pointer',
                    }}
                  >
                    All batches
                  </button>

                  {batches.map((b) => {
                    const picked = selectedBatch?.id === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBatch(b)}
                        style={{
                          padding: '11px 12px',
                          borderRadius: '12px',
                          background: picked ? 'var(--primary-soft)' : 'var(--card2)',
                          border: `1px solid ${picked ? 'var(--primary-border)' : 'var(--line)'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                            <span style={{ font: '600 12.5px var(--font-body)', color: picked ? 'var(--primary)' : 'var(--tx)' }}>{b.name}</span>
                            {!b.is_active && <Badge tone="neutral">Suspended</Badge>}
                          </div>
                          <div style={{ marginTop: '3px', font: '400 11.5px var(--font-body)', color: 'var(--muted)' }}>
                            {b.max_students ? <>Cap <Num style={{ fontSize: '11.5px' }}>{b.max_students}</Num></> : 'No cap'}
                            {' · '}
                            {b.price_paise ? <Num style={{ fontSize: '11.5px' }}>₹{b.price_paise / 100}</Num> : 'Free / manual'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', flex: 'none' }}>
                          <button
                            type="button"
                            className="adm-rowaction"
                            onClick={(e) => { e.stopPropagation(); setBatchForm(b); setShowBatchForm(true); }}
                            aria-label={`Edit ${b.name}`}
                            title="Edit batch"
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          {b.is_active && (
                            <button
                              type="button"
                              className="adm-rowaction"
                              onClick={(e) => { e.stopPropagation(); setPendingBatch(b); }}
                              aria-label={`Suspend ${b.name}`}
                              title="Suspend batch"
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ---- enrolled students ---- */}
          <TableCard>
            <Toolbar
              trailing={
                enrollments.length > 0 && (
                  <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                    <Num>{activeEnrolments}</Num> active of <Num>{enrollments.length}</Num>
                  </span>
                )
              }
            >
              <span style={{ font: '600 12.5px var(--font-body)', color: 'var(--tx2)' }}>
                {selectedBatch ? selectedBatch.name : 'All batches'}
              </span>
            </Toolbar>

            {enrollments.length === 0 ? (
              <EmptyState
                icon="users"
                message="Nobody is enrolled in this scope yet. Enrol a student, or hand out an activation code."
              />
            ) : (
              <Table columns={ENROL_COLUMNS}>
                {enrollments.map((en) => (
                  <Row key={en.id}>
                    <Cell label="Student">
                      <CellTitle>{en.user?.name}</CellTitle>
                      <CellSub>{en.user?.email}</CellSub>
                    </Cell>
                    <Cell label="Course / batch" hideBelow="tablet">
                      <CellTitle>{en.course?.title}</CellTitle>
                      <CellSub>{en.batch?.name || 'All batches'}</CellSub>
                    </Cell>
                    <Cell label="Enrolled">
                      <Num style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--tx2)' }}>
                        {new Date(en.enrolled_at).toLocaleDateString()}
                      </Num>
                    </Cell>
                    <Cell label="Expires" hideBelow="tablet">
                      {en.expires_at ? (
                        <Num style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--tx2)' }}>
                          {new Date(en.expires_at).toLocaleDateString()}
                        </Num>
                      ) : (
                        <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>Lifetime</span>
                      )}
                    </Cell>
                    <Cell label="Status">
                      <StatusDot tone={en.is_active ? 'success' : 'danger'}>
                        {en.is_active ? 'Active' : 'Suspended'}
                      </StatusDot>
                    </Cell>
                    <Cell align="right">
                      <button
                        type="button"
                        onClick={() => handleToggleEnrollmentStatus(en)}
                        className="btn-secondary"
                        style={{
                          padding: '7px 12px',
                          minHeight: '36px',
                          fontSize: '11.5px',
                          whiteSpace: 'nowrap',
                          color: en.is_active ? 'var(--danger)' : 'var(--success)',
                          borderColor: en.is_active ? 'var(--danger-border)' : 'var(--success-border)',
                        }}
                      >
                        {en.is_active ? 'Suspend' : 'Reactivate'}
                      </button>
                    </Cell>
                  </Row>
                ))}
              </Table>
            )}
          </TableCard>
        </div>
      ) : (
        /* ---- payment history ---- */
        <TableCard>
          <Toolbar
            trailing={
              !loadingPayments && payments.length > 0 && (
                <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
                  Page <Num>{paymentsPage}</Num> of <Num>{paymentsLastPage}</Num>
                </span>
              )
            }
          >
            <span style={{ font: '600 12.5px var(--font-body)', color: 'var(--tx2)' }}>Transactions</span>
          </Toolbar>

          {loadingPayments ? (
            <SkeletonRows />
          ) : payments.length === 0 ? (
            <EmptyState
              icon="shopping-bag"
              message="No payment has been recorded yet. They appear here the moment one settles."
            />
          ) : (
            <>
              <Table columns={PAY_COLUMNS}>
                {payments.map((pmt) => (
                  <Row key={pmt.id}>
                    <Cell label="Student">
                      <CellTitle>{pmt.user?.name}</CellTitle>
                      <CellSub>{pmt.user?.email}</CellSub>
                    </Cell>
                    <Cell label="Bought">
                      {/* Two rails land in this table: a batch enrolment and a
                          store product (a series or bundle has no batch at all,
                          which used to render as two blank lines). */}
                      <CellTitle>{pmt.product?.title || pmt.batch?.course?.title || '—'}</CellTitle>
                      <CellSub>
                        {pmt.product
                          ? (pmt.product.type === 'bundle' ? 'Bundle' : pmt.product.type === 'test_series' ? 'Test series' : 'Course')
                          : pmt.batch?.name ? pmt.batch.name : 'Batch enrolment'}
                      </CellSub>
                    </Cell>
                    <Cell label="Reference" hideBelow="tablet">
                      <Num style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pmt.razorpay_order_id || '—'}
                      </Num>
                      <Num style={{ display: 'block', marginTop: '2px', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pmt.razorpay_payment_id || '—'}
                      </Num>
                    </Cell>
                    <Cell label="Amount">
                      <Num style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>₹{pmt.amount / 100}</Num>
                      {pmt.coupon?.code && <CellSub>{pmt.coupon.code}</CellSub>}
                    </Cell>
                    <Cell label="Status">
                      <StatusDot tone={pmt.status === 'paid' ? 'success' : pmt.status === 'failed' ? 'danger' : 'reward'}>
                        {pmt.status}
                      </StatusDot>
                      {pmt.invoice && <CellSub>{pmt.invoice.invoice_number}</CellSub>}
                    </Cell>
                    <Cell label="Date" hideBelow="tablet">
                      <Num style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--tx2)' }}>
                        {new Date(pmt.created_at).toLocaleDateString()}
                      </Num>
                    </Cell>
                    <Cell align="right">
                      {pmt.status === 'paid' && pmt.razorpay_payment_id ? (
                        <button
                          type="button"
                          onClick={() => setRefundTarget(pmt)}
                          className="btn-secondary"
                          style={{ padding: '7px 12px', minHeight: '36px', fontSize: '11.5px' }}
                        >
                          Refund
                        </button>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </Cell>
                  </Row>
                ))}
              </Table>
              <Pagination
                page={paymentsPage}
                lastPage={paymentsLastPage}
                onPage={(next) => setPaymentsPage(next)}
              />
            </>
          )}
        </TableCard>
      )}

      {/* ---- batch form ---- */}
      {showBatchForm && (
        <Modal
          title={batchForm.id ? 'Edit batch' : 'New batch'}
          description="A batch is the class group students are enrolled into — its capacity, dates and price live here."
          onClose={() => setShowBatchForm(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowBatchForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" form="batch-form" className="btn-primary">Save batch</button>
            </>
          }
        >
          <form id="batch-form" onSubmit={handleBatchSubmit}>
            <FormSection title="Identity">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="Batch name" htmlFor="bt-name">
                  <input
                    id="bt-name"
                    type="text"
                    value={batchForm.name}
                    onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                    className="form-input"
                    required
                  />
                </Field>
                <FormGrid min="170px">
                  <Field label="Capacity" hint="Blank means no cap." htmlFor="bt-max">
                    <input
                      id="bt-max"
                      type="number"
                      value={batchForm.max_students || ''}
                      onChange={(e) => setBatchForm({ ...batchForm, max_students: e.target.value })}
                      className="form-input"
                      min={1}
                    />
                  </Field>
                  <Field label="Price (₹)" hint="Blank means free or manual-only." htmlFor="bt-price">
                    <input
                      id="bt-price"
                      type="number"
                      value={batchForm.price_paise ? (batchForm.price_paise / 100).toString() : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBatchForm({ ...batchForm, price_paise: val ? Math.round(parseFloat(val) * 100) : null });
                      }}
                      className="form-input"
                      min={0}
                      step="any"
                      placeholder="Free / manual"
                    />
                  </Field>
                </FormGrid>
              </div>
            </FormSection>

            <FormSection title="Window">
              <FormGrid min="170px">
                <Field label="Starts at" htmlFor="bt-from">
                  <input
                    id="bt-from"
                    type="date"
                    value={batchForm.starts_at ? batchForm.starts_at.substring(0, 10) : ''}
                    onChange={(e) => setBatchForm({ ...batchForm, starts_at: e.target.value })}
                    className="form-input"
                  />
                </Field>
                <Field label="Ends at" htmlFor="bt-to">
                  <input
                    id="bt-to"
                    type="date"
                    value={batchForm.ends_at ? batchForm.ends_at.substring(0, 10) : ''}
                    onChange={(e) => setBatchForm({ ...batchForm, ends_at: e.target.value })}
                    className="form-input"
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection
              title="In-app purchase"
              description="The Android app resolves a Play purchase back to a batch by this id alone. Leave it blank unless the batch is sold inside the app — the web checkout uses the price above, not this."
            >
              <Field label="Google Play product id" hint="Must match the Play Console entry exactly." htmlFor="bt-play">
                <input
                  id="bt-play"
                  type="text"
                  value={batchForm.play_product_id || ''}
                  onChange={(e) => setBatchForm({ ...batchForm, play_product_id: e.target.value })}
                  className="form-input"
                  placeholder="e.g. ssc_cgl_2026_tier1"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </Field>
            </FormSection>

            <FormSection title="Registration">
              <label
                htmlFor="batch_active"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', cursor: 'pointer', font: '400 13px var(--font-body)', color: 'var(--tx)' }}
              >
                <input
                  type="checkbox"
                  id="batch_active"
                  checked={batchForm.is_active}
                  onChange={(e) => setBatchForm({ ...batchForm, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                Active — registrations are open
              </label>
            </FormSection>
          </form>
        </Modal>
      )}

      {/* ---- manual enrolment ---- */}
      {showEnrollForm && (
        <Modal
          title="Enroll a student"
          description={`${selectedCourse?.title || 'Course'} · ${selectedBatch ? selectedBatch.name : 'all batches'}`}
          onClose={() => setShowEnrollForm(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowEnrollForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" form="enroll-form" className="btn-primary" disabled={!selectedStudent}>Enroll</button>
            </>
          }
        >
          <form id="enroll-form" onSubmit={handleEnrollSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <Field
                label="Student"
                hint={selectedStudent ? `Selected — student #${selectedStudent.id}` : 'Search by name or email.'}
                htmlFor="enr-search"
              >
                <input
                  id="enr-search"
                  type="text"
                  value={studentSearch}
                  onChange={(e) => searchStudents(e.target.value)}
                  className="form-input"
                  placeholder="Type to search…"
                  autoComplete="off"
                  required={!selectedStudent}
                />
              </Field>

              {studentSearchResults.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '190px',
                    overflowY: 'auto',
                    zIndex: 1010,
                    marginTop: '4px',
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    borderRadius: '14px',
                    boxShadow: 'var(--shadow-2)',
                    padding: '6px',
                  }}
                >
                  {studentSearchResults.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="admin-jump-item"
                      onClick={() => {
                        setSelectedStudent(student);
                        setStudentSearch(`${student.name} (${student.email})`);
                        setStudentSearchResults([]);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        minHeight: '44px',
                        padding: '9px 10px',
                        borderRadius: '10px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'block', font: '600 12.5px var(--font-body)', color: 'var(--tx)' }}>{student.name}</span>
                      <span style={{ display: 'block', marginTop: '2px', font: '400 11.5px var(--font-body)', color: 'var(--muted)' }}>{student.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Field label="Expires on" hint="Leave blank for lifetime access." htmlFor="enr-exp">
              <input
                id="enr-exp"
                type="date"
                value={enrollForm.expires_at}
                onChange={(e) => setEnrollForm({ ...enrollForm, expires_at: e.target.value })}
                className="form-input"
              />
            </Field>
          </form>
        </Modal>
      )}

      {/* ---- refund ---- */}
      {refundTarget && (
        <Modal
          danger
          title={`Refund ₹${refundTarget.amount / 100} to ${refundTarget.user?.name}?`}
          description="A full refund also withdraws course access; a partial refund leaves it in place."
          width={480}
          onClose={() => { setRefundTarget(null); setRefundAmount(''); setRefundReason(''); }}
          footer={
            <>
              <button
                type="button"
                disabled={refunding}
                onClick={() => { setRefundTarget(null); setRefundAmount(''); setRefundReason(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="button" onClick={submitRefund} disabled={refunding} className="btn-danger">
                {refunding ? 'Refunding…' : 'Refund payment'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <span>Bought</span>
                <span style={{ color: 'var(--tx)', fontWeight: 600, textAlign: 'right' }}>
                  {refundTarget.product?.title || refundTarget.batch?.course?.title || '—'}
                </span>
              </div>
              <div style={{ marginTop: '9px', display: 'flex', justifyContent: 'space-between', gap: '12px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
                <span>Captured</span>
                <Num style={{ color: 'var(--tx)', fontSize: '12.5px' }}>₹{refundTarget.amount / 100}</Num>
              </div>
            </div>

            <Field
              label="Amount to refund (₹)"
              hint={`Leave blank to refund in full — ₹${refundTarget.amount / 100}.`}
              htmlFor="rf-amount"
            >
              <input
                id="rf-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={refundTarget.amount / 100}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={`Full refund — ₹${refundTarget.amount / 100}`}
                className="form-input"
              />
            </Field>

            <Field label="Reason" hint="Recorded in the audit log." htmlFor="rf-reason">
              <input
                id="rf-reason"
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Duplicate payment"
                className="form-input"
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* ---- suspend a batch ---- */}
      {pendingBatch && (
        <Modal
          danger
          title={`Suspend “${pendingBatch.name}”?`}
          description="Students already enrolled keep their access; no new registration can join until you reactivate it."
          width={480}
          onClose={() => setPendingBatch(null)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setPendingBatch(null)}>Cancel</button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => { const b = pendingBatch; setPendingBatch(null); handleDeactivateBatch(b); }}
              >
                Suspend batch
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
