// src/router/AppRouter.jsx
// FarmShift App Router — role-based routing with all PDF screens connected
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ── Auth Pages ─────────────────────────────────────────────── */
import { Login }         from '../features/auth/Login';
import { ForgotPassword } from '../features/auth/ForgotPassword';
import { ResetPassword }  from '../features/auth/ResetPassword';

/* ── Owner Dashboards ───────────────────────────────────────── */
import { OwnerDashboard }    from '../features/dashboard/OwnerDashboard';
import { LivestockList }     from '../features/livestock/LivestockList';
import { InventoryList }     from '../features/inventory/InventoryList';
import { InventoryCategories } from '../features/inventory/InventoryCategories';
import { WarehousePermissions } from '../features/inventory/WarehousePermissions';
import { PurchaseOrders }    from '../features/orders/PurchaseOrders';
import { StockRecords }      from '../features/orders/StockRecords';

/* ── Accountant & Worker Dashboards ─────────────────────────── */
import { AccountantDashboard } from '../features/dashboard/AccountantDashboard';
import { WorkerDashboard }     from '../features/dashboard/WorkerDashboard';

/* ── ProtectedRoute ─────────────────────────────────────────── */
/**
 * Guards a route by auth state and optional role.
 * Shows loading placeholder while auth resolves.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'var(--color-muted)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--fs-body-md)',
      }}>
        Đang tải...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/* ── Root Redirect ──────────────────────────────────────────── */
/** Redirects logged-in users to their dashboard based on role. */
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const roleRoutes = {
    'ROLE_FARM_OWNER':  '/owner-dashboard',
    'ROLE_ACCOUNTANT':  '/accountant-dashboard',
    'ROLE_FARM_WORKER': '/worker-dashboard',
  };
  return <Navigate to={roleRoutes[user.role] || '/login'} replace />;
};

/* ── AppRouter ─────────────────────────────────────────────── */
export const AppRouter = () => {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"              element={<RootRedirect />} />
      <Route path="/login"         element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-otp"    element={<ResetPassword />} />

      {/* ── Owner Routes ──────────────────────────────────── */}
      {/* Page 1: Dashboard Overview */}
      <Route
        path="/owner-dashboard"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <OwnerDashboard />
          </ProtectedRoute>
        }
      />

      {/* Pages 2: Livestock */}
      <Route
        path="/owner-dashboard/livestock"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <LivestockList />
          </ProtectedRoute>
        }
      />

      {/* Page 3: Inventory List */}
      <Route
        path="/owner-dashboard/inventory"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <InventoryList />
          </ProtectedRoute>
        }
      />

      {/* Page 4: Inventory Categories */}
      <Route
        path="/owner-dashboard/inventory/categories"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <InventoryCategories />
          </ProtectedRoute>
        }
      />

      {/* Pages 5+6: Warehouse Permissions + Modal */}
      <Route
        path="/owner-dashboard/inventory/warehouse"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <WarehousePermissions />
          </ProtectedRoute>
        }
      />

      {/* Page 7: Purchase Orders */}
      <Route
        path="/owner-dashboard/orders"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <PurchaseOrders />
          </ProtectedRoute>
        }
      />

      {/* Page 8: Stock Records */}
      <Route
        path="/owner-dashboard/orders/stock"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <StockRecords />
          </ProtectedRoute>
        }
      />

      {/* ── Accountant Routes ─────────────────────────────── */}
      <Route
        path="/accountant-dashboard"
        element={
          <ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}>
            <AccountantDashboard />
          </ProtectedRoute>
        }
      />

      {/* ── Worker Routes ─────────────────────────────────── */}
      <Route
        path="/worker-dashboard"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}>
            <WorkerDashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
