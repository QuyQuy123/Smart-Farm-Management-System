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

/* ── Barn Management ────────────────────────────────────────── */
import { BarnList }   from '../features/barn/BarnList';
import { BarnDetail } from '../features/barn/BarnDetail';

/* ── Batch Management ───────────────────────────────────────── */
import { BatchList }    from '../features/batch/BatchList';
import { BatchDetail }  from '../features/batch/BatchDetail';
import { DailyLogForm } from '../features/batch/DailyLogForm';

/* ── Finance / Sprint 2 ────────────────────────────────────── */
import { SupplierList }  from '../features/finance/SupplierList';
import { DebtTracking } from '../features/finance/DebtTracking';
import { CustomerList } from '../features/finance/CustomerList';
import { SalesList }    from '../features/finance/SalesList';
import { BatchPnL }     from '../features/finance/BatchPnL';
import { FundLedger }   from '../features/finance/FundLedger';
import { CustomerDebt } from '../features/finance/CustomerDebt';
import { InternalTransfer } from '../features/inventory/InternalTransfer';
import { EmployeeList } from '../features/employee/EmployeeList';
import { IotDashboard } from '../features/iot/IotDashboard';
import { LoginLogs } from '../features/system/LoginLogs';
import { Settings } from '../features/system/Settings';

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

      {/* ── Barn Routes ───────────────────────────────────── */}
      <Route
        path="/owner-dashboard/barns"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <BarnList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/barns/:barnId"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <BarnDetail />
          </ProtectedRoute>
        }
      />

      {/* ── Batch Routes ──────────────────────────────────── */}
      <Route
        path="/owner-dashboard/batches"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <BatchList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/batches/:batchId"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <BatchDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/batches/:batchId/log"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}>
            <DailyLogForm />
          </ProtectedRoute>
        }
      />

      {/* ── Sprint 2: Supplier Routes ───────────────────────── */}
      <Route
        path="/owner-dashboard/suppliers"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}>
            <SupplierList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/suppliers/debts"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}>
            <DebtTracking />
          </ProtectedRoute>
        }
      />

      {/* ── Sprint 2: Customer & Sales Routes ────────────────── */}
      <Route
        path="/owner-dashboard/customers"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}>
            <CustomerList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/sales"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}>
            <SalesList />
          </ProtectedRoute>
        }
      />

      {/* ── Sprint 2: P&L Report ───────────────────────────── */}
      <Route
        path="/owner-dashboard/pnl"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}>
            <BatchPnL />
          </ProtectedRoute>
        }
      />

      {/* ── Tài liệu: Feature 3 – Sổ quỹ ───────────────────────── */}
      <Route
        path="/owner-dashboard/fund-ledger"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}>
            <FundLedger />
          </ProtectedRoute>
        }
      />

      {/* ── Tài liệu: Feature 7 – Xuất nhập nội bộ ─────────────── */}
      <Route
        path="/owner-dashboard/internal-transfers"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER']}>
            <InternalTransfer />
          </ProtectedRoute>
        }
      />

      {/* ── Tài liệu: Feature 9 – Công nợ thương lái ───────────── */}
      <Route
        path="/owner-dashboard/customers/debts"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}>
            <CustomerDebt />
          </ProtectedRoute>
        }
      />

      {/* ── Tài liệu: Feature 1 – Nhân sự ──────────────────────── */}
      <Route
        path="/owner-dashboard/workers"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <EmployeeList />
          </ProtectedRoute>
        }
      />

      {/* ── Tài liệu: Feature 11 – Giám sát IoT ────────────────── */}
      <Route
        path="/owner-dashboard/iot"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <IotDashboard />
          </ProtectedRoute>
        }
      />

      {/* ── Hệ thống ────────────────────────── */}
      <Route
        path="/owner-dashboard/settings"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/login-logs"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <LoginLogs />
          </ProtectedRoute>
        }
      />

      {/* ── Accountant Routes ────────────────────────────── */}
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
