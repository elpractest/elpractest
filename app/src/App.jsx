import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import api, { setOn2FARequired } from './api';
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
import Admin2FASetup from './pages/Admin2FASetup';
import Admin2FAVerify from './pages/Admin2FAVerify';

// Student Guard Component
const StudentGuard = ({ user, loading, children }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0b0f19' }}>
        <div style={{ color: '#f3f4f6', fontSize: '1.2rem', fontWeight: 600 }}>Loading Practest...</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  const isAdmin = user.roles?.includes('admin') || user.roles?.includes('super-admin');
  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
};

// Admin Guard Component
const AdminGuard = ({ user, loading, children }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0b0f19' }}>
        <div style={{ color: '#f3f4f6', fontSize: '1.2rem', fontWeight: 600 }}>Loading Practest Admin...</div>
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
      {isStudent && (
        <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', margin: '16px', borderBottom: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link to="/dashboard" style={{ textDecoration: 'none', fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-color)', letterSpacing: '1px' }}>PRACTEST</Link>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>Student SPA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{user.name}</span>
            <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Logout</button>
          </div>
        </header>
      )}

      {/* Non-blocking banner nudge if student phone is unverified */}
      {isStudent && !user.phone_verified && (
        <div style={{ margin: '0 16px 16px 16px', padding: '12px 20px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fbbf24', fontSize: '0.88rem' }}>
          <span>⚠️ Your phone number is unverified. Mobile OTP verification is required to request course activation.</span>
          <Link to="/verify-otp" className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem', background: '#f59e0b', color: '#000', textDecoration: 'none' }}>
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
            <VerifyOtp />
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
            user.roles?.includes('admin') || user.roles?.includes('super-admin') ? (
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
