// src/router/AppRouter.jsx
// FarmShift Main App Router with Code-Splitting
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { PageLoading } from '../components/Loading/PageLoading';

/* ── Lazy Loaded Auth Pages ─────────────────────────────────── */
const Login = lazy(() => import('../features/auth/Login').then(m => ({ default: m.Login })));
const ForgotPassword = lazy(() => import('../features/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('../features/auth/ResetPassword').then(m => ({ default: m.ResetPassword })));

/* ── Lazy Loaded Core FarmShift Modules ─────────────────────── */
const DashboardView = lazy(() => import('../features/farmshift/DashboardView').then(m => ({ default: m.DashboardView })));
const BarnsView = lazy(() => import('../features/farmshift/BarnsView').then(m => ({ default: m.BarnsView })));
const AreasView = lazy(() => import('../features/farmshift/AreasView').then(m => ({ default: m.AreasView })));
const BarnDetailView = lazy(() => import('../features/farmshift/BarnDetailView').then(m => ({ default: m.BarnDetailView })));
const TodayTasksView = lazy(() => import('../features/farmshift/TodayTasksView').then(m => ({ default: m.TodayTasksView })));
const JournalView = lazy(() => import('../features/farmshift/JournalView').then(m => ({ default: m.JournalView })));
const InventoryView = lazy(() => import('../features/farmshift/InventoryView').then(m => ({ default: m.InventoryView })));
const PurchasesView = lazy(() => import('../features/farmshift/PurchasesView').then(m => ({ default: m.PurchasesView })));
const SalesView = lazy(() => import('../features/farmshift/SalesView').then(m => ({ default: m.SalesView })));
const TransfersView = lazy(() => import('../features/farmshift/InternalStockView').then(m => ({ default: m.InternalStockView })));
const InternalStockView = TransfersView;
const CashbookView = lazy(() => import('../features/farmshift/CashbookView').then(m => ({ default: m.CashbookView })));
const ReportsView = lazy(() => import('../features/farmshift/ReportsView').then(m => ({ default: m.ReportsView })));
const CatalogSettingsView = lazy(() => import('../features/farmshift/CatalogSettingsView').then(m => ({ default: m.CatalogSettingsView })));
const BreedingSettingsView = lazy(() => import('../features/farmshift/BreedingSettingsView').then(m => ({ default: m.BreedingSettingsView })));
const GeneralSettingsView = lazy(() => import('../features/farmshift/GeneralSettingsView').then(m => ({ default: m.GeneralSettingsView })));
const AccountView = lazy(() => import('../features/farmshift/AccountView').then(m => ({ default: m.AccountView })));

/* ── Role Constants ─────────────────────────────────────────── */
const OWNER_ONLY = ['ROLE_FARM_OWNER'];
const FINANCE_ROLES = ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT'];
const FARM_ROLES = ['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER'];
const ALL_ROLES = ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER'];

/* ── ProtectedRoute ─────────────────────────────────────────── */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoading />;
  }

  // Allow access even without login in demo mode, or redirect if required
  if (!user && !sessionStorage.getItem('demo_mode')) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role;
  if (role && allowedRoles && !allowedRoles.includes(role)) {
    const fallback = role === 'ROLE_FARM_WORKER' ? '/today-tasks' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return children;
};

const HomeRoute = () => {
  const { user } = useAuth();
  if (user?.role === 'ROLE_FARM_WORKER') {
    return <Navigate to="/today-tasks" replace />;
  }
  return <DashboardView />;
};

/* ── AppRouter ─────────────────────────────────────────────── */
export const AppRouter = () => {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* ── Public Auth Routes ──────────────────────────────── */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<ResetPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ── Core FarmShift Functional Routes ────────────────── */}
        <Route path="/" element={<ProtectedRoute><HomeRoute /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={FINANCE_ROLES}><DashboardView /></ProtectedRoute>} />
        <Route path="/areas" element={<ProtectedRoute allowedRoles={FARM_ROLES}><AreasView /></ProtectedRoute>} />
        <Route path="/areas/:id" element={<ProtectedRoute allowedRoles={FARM_ROLES}><AreasView /></ProtectedRoute>} />
        <Route path="/barns" element={<ProtectedRoute allowedRoles={FARM_ROLES}><AreasView /></ProtectedRoute>} />
        <Route path="/barns/:id" element={<ProtectedRoute allowedRoles={FARM_ROLES}><BarnDetailView /></ProtectedRoute>} />
        <Route path="/today-tasks" element={<ProtectedRoute allowedRoles={FARM_ROLES}><TodayTasksView /></ProtectedRoute>} />
        {/* Phân công công việc nằm trong Việc hôm nay (tab Phân công). */}
        <Route path="/work-assignments" element={<Navigate to="/today-tasks?view=assign" replace />} />
        <Route path="/journal" element={<ProtectedRoute allowedRoles={FARM_ROLES}><JournalView /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute allowedRoles={FINANCE_ROLES}><InventoryView /></ProtectedRoute>} />
        <Route path="/transfers" element={<ProtectedRoute allowedRoles={ALL_ROLES}><TransfersView /></ProtectedRoute>} />
        <Route path="/internal-stock" element={<ProtectedRoute allowedRoles={ALL_ROLES}><InternalStockView /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute allowedRoles={FINANCE_ROLES}><PurchasesView /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute allowedRoles={FINANCE_ROLES}><SalesView /></ProtectedRoute>} />
        <Route path="/cashbook" element={<ProtectedRoute allowedRoles={FINANCE_ROLES}><CashbookView /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute allowedRoles={FINANCE_ROLES}><CashbookView /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute allowedRoles={OWNER_ONLY}><AccountView /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={FINANCE_ROLES}><ReportsView /></ProtectedRoute>} />

        {/* ── Settings Routes ─────────────────────────────────── */}
        <Route path="/catalog-settings" element={<ProtectedRoute allowedRoles={OWNER_ONLY}><CatalogSettingsView /></ProtectedRoute>} />
        <Route path="/breeding-settings" element={<ProtectedRoute allowedRoles={OWNER_ONLY}><BreedingSettingsView /></ProtectedRoute>} />
        <Route path="/general-settings" element={<ProtectedRoute allowedRoles={OWNER_ONLY}><GeneralSettingsView /></ProtectedRoute>} />

        {/* ── Legacy Aliases & Role Dashboards ────────────────── */}
        <Route path="/system-map" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
        <Route path="/energy" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
        <Route path="/cycles" element={<ProtectedRoute><BarnsView /></ProtectedRoute>} />
        <Route path="/payroll" element={<ProtectedRoute><CashbookView /></ProtectedRoute>} />
        <Route path="/assets" element={<ProtectedRoute><CashbookView /></ProtectedRoute>} />
        <Route path="/growth-targets" element={<ProtectedRoute><BreedingSettingsView /></ProtectedRoute>} />
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
