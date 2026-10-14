// src/router/AppRouter.jsx
// FarmShift Main App Router with Code-Splitting
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ── Fallback Loader ────────────────────────────────────────── */
const PageFallback = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#019788',
    fontSize: '15px',
    fontWeight: 600,
    background: '#f8fafc'
  }}>
    Đang tải trang FarmShift...
  </div>
);

/* ── Lazy Loaded Auth Pages ─────────────────────────────────── */
const Login = lazy(() => import('../features/auth/Login').then(m => ({ default: m.Login })));
const ForgotPassword = lazy(() => import('../features/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('../features/auth/ResetPassword').then(m => ({ default: m.ResetPassword })));

/* ── Lazy Loaded Core FarmShift Modules ─────────────────────── */
const DashboardView = lazy(() => import('../features/farmshift/DashboardView').then(m => ({ default: m.DashboardView })));
const BarnsView = lazy(() => import('../features/farmshift/BarnsView').then(m => ({ default: m.BarnsView })));
const JournalView = lazy(() => import('../features/farmshift/JournalView').then(m => ({ default: m.JournalView })));
const InventoryView = lazy(() => import('../features/farmshift/InventoryView').then(m => ({ default: m.InventoryView })));
const PurchasesView = lazy(() => import('../features/farmshift/PurchasesView').then(m => ({ default: m.PurchasesView })));
const SalesView = lazy(() => import('../features/farmshift/SalesView').then(m => ({ default: m.SalesView })));
const TransfersView = lazy(() => import('../features/farmshift/TransfersView').then(m => ({ default: m.TransfersView })));
const CashbookView = lazy(() => import('../features/farmshift/CashbookView').then(m => ({ default: m.CashbookView })));
const ReportsView = lazy(() => import('../features/farmshift/ReportsView').then(m => ({ default: m.ReportsView })));
const CatalogSettingsView = lazy(() => import('../features/farmshift/CatalogSettingsView').then(m => ({ default: m.CatalogSettingsView })));
const BreedingSettingsView = lazy(() => import('../features/farmshift/BreedingSettingsView').then(m => ({ default: m.BreedingSettingsView })));
const GeneralSettingsView = lazy(() => import('../features/farmshift/GeneralSettingsView').then(m => ({ default: m.GeneralSettingsView })));
const AccountView = lazy(() => import('../features/farmshift/AccountView').then(m => ({ default: m.AccountView })));

/* ── ProtectedRoute ─────────────────────────────────────────── */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageFallback />;
  }

  // Allow access even without login in demo mode, or redirect if required
  if (!user && !sessionStorage.getItem('demo_mode')) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/* ── AppRouter ─────────────────────────────────────────────── */
export const AppRouter = () => {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* ── Public Auth Routes ──────────────────────────────── */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<ResetPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ── Core FarmShift Functional Routes ────────────────── */}
        <Route path="/" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
        <Route path="/areas" element={<ProtectedRoute><BarnsView /></ProtectedRoute>} />
        <Route path="/areas/:id" element={<ProtectedRoute><BarnsView /></ProtectedRoute>} />
        <Route path="/barns" element={<ProtectedRoute><BarnsView /></ProtectedRoute>} />
        <Route path="/journal" element={<ProtectedRoute><JournalView /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><InventoryView /></ProtectedRoute>} />
        <Route path="/transfers" element={<ProtectedRoute><TransfersView /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute><PurchasesView /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute><SalesView /></ProtectedRoute>} />
        <Route path="/cashbook" element={<ProtectedRoute><CashbookView /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute><CashbookView /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><AccountView /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsView /></ProtectedRoute>} />

        {/* ── Settings Routes ─────────────────────────────────── */}
        <Route path="/catalog-settings" element={<ProtectedRoute><CatalogSettingsView /></ProtectedRoute>} />
        <Route path="/breeding-settings" element={<ProtectedRoute><BreedingSettingsView /></ProtectedRoute>} />
        <Route path="/general-settings" element={<ProtectedRoute><GeneralSettingsView /></ProtectedRoute>} />

        {/* ── Legacy Aliases & Role Dashboards ────────────────── */}
        <Route path="/system-map" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
        <Route path="/energy" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
        <Route path="/cycles" element={<ProtectedRoute><BarnsView /></ProtectedRoute>} />
        <Route path="/payroll" element={<ProtectedRoute><CashbookView /></ProtectedRoute>} />
        <Route path="/assets" element={<ProtectedRoute><CashbookView /></ProtectedRoute>} />
        <Route path="/growth-targets" element={<ProtectedRoute><BreedingSettingsView /></ProtectedRoute>} />
        <Route path="/harvest-types" element={<ProtectedRoute><BreedingSettingsView /></ProtectedRoute>} />
        <Route path="/screens" element={<ProtectedRoute><GeneralSettingsView /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><GeneralSettingsView /></ProtectedRoute>} />
        <Route path="/owner-dashboard" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
        <Route path="/accountant-dashboard" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
        <Route path="/worker-dashboard" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
        <Route path="/batches" element={<ProtectedRoute><BarnsView /></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute><JournalView /></ProtectedRoute>} />
        <Route path="/iot" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><AccountView /></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
