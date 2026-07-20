import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';
import StudentCheckout from './StudentCheckout';
import ActivationModal from './ActivationModal';

function formatRupees(paise) {
  if (paise === null || paise === undefined) return 'Free';
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default function Dashboard({ user }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [tests, setTests] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingTests, setLoadingTests] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Activation requests & modal state
  const [activationRequests, setActivationRequests] = useState([]);
  const [showActivationModal, setShowActivationModal] = useState(false);

  // Payment integration state
  const [paymentGatewayEnabled, setPaymentGatewayEnabled] = useState(false);
  const [purchasableCourses, setPurchasableCourses] = useState([]);
  const [loadingPurchasable, setLoadingPurchasable] = useState(false);
  const [checkoutBatch, setCheckoutBatch] = useState(null);

  const fetchPurchasableCourses = () => {
    setLoadingPurchasable(true);
    api.get('/api/student/purchasable-courses')
      .then((res) => {
        setPurchasableCourses(res.data);
      })
      .catch((err) => {
        console.error('Failed to fetch purchasable courses', err);
      })
      .finally(() => {
        setLoadingPurchasable(false);
      });
  };

  const fetchActivationRequests = () => {
    api.get('/api/student/activation-requests')
      .then((res) => {
        setActivationRequests(res.data.requests || []);
      })
      .catch(() => {});
  };

  const fetchEnrolledCourses = () => {
    setLoadingCourses(true);
    api.get('/api/student/courses')
      .then((res) => {
        setCourses(res.data.courses || res.data || []);
      })
      .catch((err) => {
        setError('Failed to load courses. Please refresh.');
      })
      .finally(() => {
        setLoadingCourses(false);
      });
  };

  useEffect(() => {
    fetchEnrolledCourses();
    fetchActivationRequests();

    // Fetch public settings for payment gateway toggle
    api.get('/api/settings/public')
      .then((res) => {
        const enabled = res.data.settings?.payment_gateway_enabled === 'true' || res.data.settings?.payment_gateway_enabled === true;
        setPaymentGatewayEnabled(enabled);
        if (enabled) {
          api.get('/api/student/purchasable-courses')
            .then((purchaseRes) => {
              setPurchasableCourses(purchaseRes.data);
            });
        }
      })
      .catch((err) => {
        console.error('Failed to load public settings.', err);
      });
  }, []);

  const handleCourseClick = async (course) => {
    setSelectedCourse(course);
    setLoadingTests(true);
    setTests([]);
    setError('');

    try {
      const res = await api.get('/api/student/tests');
      const allTests = res.data.tests || [];
      const courseTests = allTests.filter(t => t.course_id === course.id);
      setTests(courseTests);
    } catch (err) {
      setError('Failed to fetch tests for this course.');
    } finally {
      setLoadingTests(false);
    }
  };

  const handleStartTest = async (testId) => {
    setError('');
    try {
      const res = await api.post(`/api/student/tests/${testId}/start`);
      const session = res.data.session;
      navigate(`/tests/${session.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start the test session.');
    }
  };

  const handleEnrolled = () => {
    fetchEnrolledCourses();
    fetchActivationRequests();
    if (paymentGatewayEnabled) {
      fetchPurchasableCourses();
    }
  };

  const statusColors = {
    pending: { bg: 'var(--warning-bg)', text: 'var(--warning-text)', border: 'var(--warning-border)' },
    approved: { bg: 'var(--success-bg)', text: 'var(--success-text)', border: 'var(--success-border)' },
    rejected: { bg: 'var(--danger-bg)', text: 'var(--danger-text)', border: 'var(--danger-border)' },
  };

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '32px', padding: '0 24px 40px 24px' }}>
      {/* Header & Quick Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', fontWeight: 800 }}>Student Dashboard</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Access your enrolled course lectures, practice tests, and analytics.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowActivationModal(true)}
            className="btn-primary"
            style={{ padding: '10px 18px', fontSize: '0.88rem', gap: '8px' }}
          >
            <Icon name="key" size={18} /> Request Activation / Redeem Code
          </button>
          <Link
            to="/results"
            className="btn-secondary"
            style={{ padding: '10px 18px', fontSize: '0.88rem', textDecoration: 'none', gap: '8px', display: 'inline-flex', alignItems: 'center' }}
          >
            <Icon name="chart" size={18} /> Results History
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px 16px', borderRadius: '8px', color: 'var(--danger-text)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Activation Requests Status Chips */}
      {activationRequests.length > 0 && (
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Your Activation Requests Status
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activationRequests.map(req => {
              const sc = statusColors[req.status] || statusColors.pending;
              return (
                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '0.88rem' }}>
                    <strong>{req.batch?.course?.title || 'Course'}</strong> — {req.batch?.name || 'Batch'}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>Ref: {req.payment_reference}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, textTransform: 'uppercase' }}>
                      {req.status}
                    </span>
                    {req.admin_notes && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({req.admin_notes})</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Courses List */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Enrolled Courses</h2>
        {loadingCourses ? (
          <div style={{ color: 'var(--text-secondary)' }}>Loading your courses...</div>
        ) : courses.length === 0 ? (
          <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><span style={{ display: 'inline-flex', padding: '15px', borderRadius: '18px', background: 'var(--accent-soft)', color: 'var(--accent-color)', border: '1px solid var(--accent-border)' }}><Icon name="book" size={30} /></span></div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              You are not enrolled in any courses yet. Request activation or redeem a code to start learning!
            </div>
            <button
              onClick={() => setShowActivationModal(true)}
              className="btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.9rem' }}
            >
              Request Activation / Enter Code
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {courses.map((course) => {
              const isSelected = selectedCourse?.id === course.id;
              return (
                <div 
                  key={course.id} 
                  className="glass-panel"
                  style={{ 
                    padding: '24px', 
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-color)',
                    boxShadow: isSelected ? '0 0 16px var(--accent-glow)' : 'none',
                    gap: '16px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', background: 'var(--accent-soft)', color: 'var(--accent-color)', borderRadius: '6px', textTransform: 'uppercase' }}>
                        {course.exam_category}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        Mode: {course.mode}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700 }}>{course.title}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {course.short_description || course.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <Link
                      to={`/courses/${course.id}/outline`}
                      className="btn-primary"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', textDecoration: 'none', textAlign: 'center' }}
                    >
                      Course Outline
                    </Link>
                    <button
                      onClick={() => handleCourseClick(course)}
                      className="btn-secondary"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
                    >
                      📝 View Tests
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Browse Courses (Available for Purchase) */}
      {paymentGatewayEnabled && purchasableCourses.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '32px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Browse & Purchase Courses</h2>
          {loadingPurchasable ? (
            <div style={{ color: 'var(--text-secondary)' }}>Loading available courses...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {purchasableCourses.map((course) => (
                <div 
                  key={course.id} 
                  className="glass-panel"
                  style={{ 
                    padding: '24px', 
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', background: 'var(--accent-soft)', color: 'var(--accent-color)', borderRadius: '6px', textTransform: 'uppercase' }}>
                        {course.exam_category}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        Mode: {course.mode}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700 }}>{course.title}</h3>
                    <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {course.short_description || course.description}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 'auto' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)' }}>Select Batch to Enroll:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {course.batches && course.batches.map((batch) => (
                        <div 
                          key={batch.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            background: 'var(--surface-1)', 
                            padding: '10px 12px', 
                            borderRadius: '8px', 
                            border: '1px solid var(--border-color)' 
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{batch.name}</div>
                            {batch.starts_at && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                Starts: {new Date(batch.starts_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setCheckoutBatch({ ...batch, course: { title: course.title } })}
                            className="btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            Buy for {formatRupees(batch.price_paise)}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tests List for Selected Course */}
      {selectedCourse && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '32px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>
            Available Tests for <span style={{ color: 'var(--accent-color)' }}>{selectedCourse.title}</span>
          </h2>
          <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Select an exam below. Timed sections lock automatically when section time runs out.
          </p>

          {loadingTests ? (
            <div style={{ color: 'var(--text-secondary)' }}>Loading tests...</div>
          ) : tests.length === 0 ? (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No tests are currently assigned to this course.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {tests.map((test) => (
                <div key={test.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 700 }}>{test.title}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Attempts taken: {test.sessions_count || 0} {test.max_attempts ? `/ ${test.max_attempts}` : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div>
                      <strong>Duration:</strong> {Math.round(test.duration_seconds / 60)} mins
                    </div>
                    <div>
                      <strong>Total Marks:</strong> {test.total_marks || 'N/A'}
                    </div>
                  </div>

                  <button 
                    onClick={() => handleStartTest(test.id)} 
                    className="btn-primary" 
                    style={{ padding: '8px 16px', fontSize: '0.85rem', width: '100%' }}
                  >
                    Start Exam
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activation Request & Code Modal */}
      {showActivationModal && (
        <ActivationModal
          user={user}
          onClose={() => setShowActivationModal(false)}
          onSuccess={handleEnrolled}
        />
      )}

      {/* Checkout Modal overlay */}
      {checkoutBatch && (
        <StudentCheckout 
          batch={checkoutBatch}
          onClose={() => setCheckoutBatch(null)}
          onEnrolled={handleEnrolled}
        />
      )}
    </div>
  );
}
