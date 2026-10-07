// src/router/AppRouter.jsx
// FarmShift Main App Router
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ── Auth Pages ─────────────────────────────────────────────── */
import { Login } from '../features/auth/Login';
import { ForgotPassword } from '../features/auth/ForgotPassword';
import { ResetPassword } from '../features/auth/ResetPassword';

/* ── Core FarmShift Modules ─────────────────────────────────── */
import { DashboardView } from '../features/farmshift/DashboardView';
import { BarnsView } from '../features/farmshift/BarnsView';
import { JournalView } from '../features/farmshift/JournalView';
import { InventoryView } from '../features/farmshift/InventoryView';
import { PurchasesView } from '../features/farmshift/PurchasesView';
import { SalesView } from '../features/farmshift/SalesView';
import { TransfersView } from '../features/farmshift/TransfersView';
import { CashbookView } from '../features/farmshift/CashbookView';
import { ReportsView } from '../features/farmshift/ReportsView';
import { CatalogSettingsView } from '../features/farmshift/CatalogSettingsView';
import { BreedingSettingsView } from '../features/farmshift/BreedingSettingsView';
import { GeneralSettingsView } from '../features/farmshift/GeneralSettingsView';
import { AccountView } from '../features/farmshift/AccountView';

/* ── ProtectedRoute ─────────────────────────────────────────── */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#019788',
        fontSize: '15px',
        fontWeight: 600
      }}>
        Đang tải hệ thống FarmShift...
      </div>
    );
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
  );
};
