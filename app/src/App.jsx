import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import api, { setOn2FARequired } from './api';
import ThemeToggle from './components/ThemeToggle';
import StudentShell from './components/StudentShell';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
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
import StudentTestSeries from './pages/StudentTestSeries';
import TestSeriesDetail from './pages/TestSeriesDetail';
import StudyZone from './pages/StudyZone';
import Store from './pages/Store';
import Profile from './pages/Profile';
import Vajini from './pages/Vajini';
import Notifications from './pages/Notifications';
import SearchPage from './pages/SearchPage';

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
  if (user.roles?.includes('super-admin') || user.roles?.includes('admin')) {
    // Super-admin is a superset: both roles land on the unified admin dashboard
    // (super-admin additionally sees the Platform Governance tabs there).
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

  // Wrap a student page in the branded shell (header + bottom-tab/sidebar nav).
  const shell = (node) => <StudentShell user={user}>{node}</StudentShell>;

  return (
    <>
      {/* Floating theme toggle only where there is no branded header
          (auth + admin surfaces); inside the student shell the header owns it. */}
      {!isStudent && <ThemeToggle />}

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
        
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email-notice" element={<VerifyEmailNotice />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Student Protected Routes — wrapped in the branded shell */}
        <Route path="/dashboard" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<Dashboard user={user} />)}
          </StudentGuard>
        } />

        <Route path="/study" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<StudyZone />)}
          </StudentGuard>
        } />

        <Route path="/store" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<Store user={user} />)}
          </StudentGuard>
        } />

        <Route path="/profile" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<Profile user={user} onLogout={handleLogout} />)}
          </StudentGuard>
        } />

        <Route path="/courses/:courseId/outline" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<CourseOutline />)}
          </StudentGuard>
        } />

        <Route path="/lessons/:lessonId" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<LessonPlayer />)}
          </StudentGuard>
        } />

        <Route path="/results" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<ResultsHistory />)}
          </StudentGuard>
        } />

        <Route path="/verify-otp" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<VerifyOtp setUser={setUser} />)}
          </StudentGuard>
        } />

        {/* Immersive full-bleed surfaces (no shell) */}
        <Route path="/tests/:session" element={
          <StudentGuard user={user} loading={loading}>
            <TestTaking />
          </StudentGuard>
        } />

        <Route path="/tests/:session/result" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<TestResult />)}
          </StudentGuard>
        } />

        <Route path="/vajini" element={
          <StudentGuard user={user} loading={loading}>
            <Vajini />
          </StudentGuard>
        } />

        <Route path="/notifications" element={
          <StudentGuard user={user} loading={loading}>
            <Notifications />
          </StudentGuard>
        } />

        <Route path="/search" element={
          <StudentGuard user={user} loading={loading}>
            <SearchPage />
          </StudentGuard>
        } />

        <Route path="/student/test-series" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<StudentTestSeries />)}
          </StudentGuard>
        } />

        <Route path="/student/test-series/:id" element={
          <StudentGuard user={user} loading={loading}>
            {shell(<TestSeriesDetail />)}
          </StudentGuard>
        } />

        {/* Admin Protected Routes */}
        <Route path="/admin/dashboard" element={
          <AdminGuard user={user} loading={loading}>
            <AdminDashboard user={user} setUser={setUser} />
          </AdminGuard>
        } />

        {/* Super-admin is now a superset of admin: the unified /admin/dashboard
            shows the Platform Governance tabs to super-admins. Keep this path as a
            redirect so any old links/bookmarks still work. */}
        <Route path="/super-admin/dashboard" element={<Navigate to="/admin/dashboard" replace />} />

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
            user.roles?.includes('super-admin') || user.roles?.includes('admin') ? (
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
