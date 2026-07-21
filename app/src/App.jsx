import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import api, { setOn2FARequired } from './api';
import ThemeToggle from './components/ThemeToggle';
import Icon from './components/Icon';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmailNotice from './pages/VerifyEmailNotice';
import VerifyEmail from './pages/VerifyEmail';
import VerifyOtp from './pages/VerifyOtp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CourseOutline from './pages/CourseOutline';
import LessonPlayer from './pages/LessonPlayer';
import ResultsHistory from './pages/ResultsHistory';
import Dashboard from './pages/Dashboard';
import TestTaking from './pages/TestTaking';
import TestResult from './pages/TestResult';

// Admin screens
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Admin2FASetup from './pages/Admin2FASetup';
import Admin2FAVerify from './pages/Admin2FAVerify';

// Student Guard Component
const StudentGuard = ({ user, loading, children }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" />
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.05em' }}>LOADING PRACTEST</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.roles?.includes('super-admin')) {
    return <Navigate to="/super-admin/dashboard" replace />;
  }
  if (user.roles?.includes('admin')) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
};

// Admin Guard Component
const AdminGuard = ({ user, loading, children }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" />
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.05em' }}>LOADING PRACTEST ADMIN</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  const isAdmin = user.roles?.includes('admin') || user.roles?.includes('super-admin');
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Super Admin Guard Component
const SuperAdminGuard = ({ user, loading, children }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" />
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.05em' }}>LOADING SUPER ADMIN CONSOLE</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.roles?.includes('super-admin')) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
};

function AppContent({ user, setUser, loading }) {
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

  // Wire up 2FA interceptor to trigger client-side routing on 403 response
  useEffect(() => {
    setOn2FARequired((setupNeeded) => {
      if (setupNeeded) {
        navigate('/admin/2fa/setup');
      } else {
        navigate('/admin/2fa/verify');
      }
    });
  }, [navigate]);

  const isStudent = user && !user.roles?.includes('admin') && !user.roles?.includes('super-admin');

  return (
    <>
      <ThemeToggle />
      {isStudent && (
        <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '14px 22px', margin: '16px', position: 'sticky', top: '12px', zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', background: 'var(--grad-primary)', color: '#ffffff', boxShadow: '0 6px 16px -6px var(--accent-glow)' }}>
                <Icon name="graduation-cap" size={19} />
              </span>
              <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '1px', lineHeight: 1.02 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--warning)' }}>e-Learning</span>
                <span className="text-gradient" style={{ fontSize: '1.18rem', fontWeight: 700, letterSpacing: '0.02em', fontFamily: 'var(--font-display)' }}>
                  Practest<sup style={{ fontSize: '0.5em', verticalAlign: 'super', WebkitTextFillColor: 'var(--text-secondary)', marginLeft: '1px' }}>®</sup>
                </span>
              </span>
            </Link>
            <span className="chip">STUDENT</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Icon name="user" size={16} /> {user.name}
            </span>
            <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.88rem' }}>
              <Icon name="log-out" size={16} /> Logout
            </button>
          </div>
        </header>
      )}

      {/* Non-blocking banner nudge if student phone is unverified */}
      {isStudent && !user.phone_verified && (
        <div style={{ margin: '0 16px 16px 16px', padding: '12px 20px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', color: 'var(--warning-text)', fontSize: '0.88rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
            <Icon name="alert" size={17} /> Your phone number is unverified. Mobile OTP verification is required to request course activation.
          </span>
          <Link to="/verify-otp" className="btn-primary" style={{ padding: '7px 14px', fontSize: '0.8rem', textDecoration: 'none' }}>
            Verify Phone Now
          </Link>
        </div>
      )}

      <Routes>
        {/* Public Auth & Onboarding Routes */}
        <Route path="/login" element={
          user ? (
            user.roles?.includes('admin') || user.roles?.includes('super-admin') ? (
              <Navigate to="/admin/dashboard" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Login setUser={setUser} />
          )
        } />
        
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email-notice" element={<VerifyEmailNotice />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Student Protected Routes */}
        <Route path="/dashboard" element={
          <StudentGuard user={user} loading={loading}>
            <Dashboard user={user} />
          </StudentGuard>
        } />

        <Route path="/courses/:courseId/outline" element={
          <StudentGuard user={user} loading={loading}>
            <CourseOutline />
          </StudentGuard>
        } />

        <Route path="/lessons/:lessonId" element={
          <StudentGuard user={user} loading={loading}>
            <LessonPlayer />
          </StudentGuard>
        } />

        <Route path="/results" element={
          <StudentGuard user={user} loading={loading}>
            <ResultsHistory />
          </StudentGuard>
        } />

        <Route path="/verify-otp" element={
          <StudentGuard user={user} loading={loading}>
            <VerifyOtp setUser={setUser} />
          </StudentGuard>
        } />
        
        <Route path="/tests/:session" element={
          <StudentGuard user={user} loading={loading}>
            <TestTaking />
          </StudentGuard>
        } />

        <Route path="/tests/:session/result" element={
          <StudentGuard user={user} loading={loading}>
            <TestResult />
          </StudentGuard>
        } />

        {/* Admin Protected Routes */}
        <Route path="/admin/dashboard" element={
          <AdminGuard user={user} loading={loading}>
            <AdminDashboard user={user} setUser={setUser} />
          </AdminGuard>
        } />

        {/* Super Admin Protected Routes */}
        <Route path="/super-admin/dashboard" element={
          <SuperAdminGuard user={user} loading={loading}>
            <SuperAdminDashboard user={user} setUser={setUser} />
          </SuperAdminGuard>
        } />

        <Route path="/admin/2fa/setup" element={
          <AdminGuard user={user} loading={loading}>
            <Admin2FASetup setUser={setUser} />
          </AdminGuard>
        } />

        <Route path="/admin/2fa/verify" element={
          <AdminGuard user={user} loading={loading}>
            <Admin2FAVerify setUser={setUser} />
          </AdminGuard>
        } />

        {/* Catch-all redirect */}
        <Route path="*" element={
          user ? (
            user.roles?.includes('super-admin') ? (
              <Navigate to="/super-admin/dashboard" replace />
            ) : user.roles?.includes('admin') ? (
              <Navigate to="/admin/dashboard" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        } />
      </Routes>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    api.get('/api/me')
      .then((res) => {
        setUser(res.data.user || res.data);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <BrowserRouter>
      <AppContent user={user} setUser={setUser} loading={loading} />
    </BrowserRouter>
  );
}
