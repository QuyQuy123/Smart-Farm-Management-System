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
import { ProfilePage } from '../features/profile/ProfilePage';
import { FarmShiftView } from '../features/farmshift/FarmShiftView';

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

      {/* ── Core Dashboards ──────────────────────────────── */}
      <Route
        path="/owner-dashboard"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <OwnerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accountant-dashboard"
        element={
          <ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}>
            <AccountantDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/worker-dashboard"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}>
            <WorkerDashboard />
          </ProtectedRoute>
        }
      />

      {/* ── Universal FarmShift View Engine (All 73 Screens) ── */}
      <Route
        path="/view/:screenId"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER']}>
            <FarmShiftView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/catalog"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER']}>
            <FarmShiftView screen="catalog" />
          </ProtectedRoute>
        }
      />

      {/* ── Direct Group & Screen Short Paths (FarmShift.html Parity) ── */}
      <Route path="/batches" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="batches" /></ProtectedRoute>} />
      <Route path="/batch-create" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="batch-create" /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="tasks" /></ProtectedRoute>} />
      <Route path="/task-board" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="task-board" /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="calendar" /></ProtectedRoute>} />
      <Route path="/journal" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER']}><FarmShiftView screen="journal" /></ProtectedRoute>} />
      <Route path="/quick" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="quick" /></ProtectedRoute>} />
      <Route path="/voice" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="voice" /></ProtectedRoute>} />
      <Route path="/voice-review" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="voice-review" /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="inventory" /></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="purchases" /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="sales" /></ProtectedRoute>} />
      <Route path="/ocr" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="ocr" /></ProtectedRoute>} />
      <Route path="/ocr-upload" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="ocr-upload" /></ProtectedRoute>} />
      <Route path="/ocr-review" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="ocr-review" /></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="finance" /></ProtectedRoute>} />
      <Route path="/cashbook" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="cashbook" /></ProtectedRoute>} />
      <Route path="/iot" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="iot" /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="alerts" /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER']}><FarmShiftView screen="notifications" /></ProtectedRoute>} />
      <Route path="/ai" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER']}><FarmShiftView screen="ai" /></ProtectedRoute>} />
      <Route path="/ai-health" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="ai-health" /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="reports" /></ProtectedRoute>} />
      <Route path="/report-batch" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="report-batch" /></ProtectedRoute>} />
      <Route path="/report-flock" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="report-flock" /></ProtectedRoute>} />
      <Route path="/report-growth" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="report-growth" /></ProtectedRoute>} />
      <Route path="/report-stock" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="report-stock" /></ProtectedRoute>} />
      <Route path="/report-cash" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="report-cash" /></ProtectedRoute>} />
      <Route path="/report-debt" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="report-debt" /></ProtectedRoute>} />
      <Route path="/report-trade" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="report-trade" /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="employees" /></ProtectedRoute>} />
      <Route path="/farm" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="farm" /></ProtectedRoute>} />
      <Route path="/coops" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="coops" /></ProtectedRoute>} />
      <Route path="/areas" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="areas" /></ProtectedRoute>} />
      <Route path="/programs" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="programs" /></ProtectedRoute>} />
      <Route path="/movements" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="movements" /></ProtectedRoute>} />
      <Route path="/counts" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="counts" /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="suppliers" /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="customers" /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="settings" /></ProtectedRoute>} />

      {/* ── Finance Sub-tabs ────────────────────────────────── */}
      <Route path="/receipts"    element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="receipts" /></ProtectedRoute>} />
      <Route path="/payments"    element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="payments" /></ProtectedRoute>} />
      <Route path="/payables"    element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="payables" /></ProtectedRoute>} />
      <Route path="/receivables" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="receivables" /></ProtectedRoute>} />
      <Route path="/costs"       element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="costs" /></ProtectedRoute>} />

      {/* ── Inventory Sub-tabs ──────────────────────────────── */}
      <Route path="/stock-transactions" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="stock-transactions" /></ProtectedRoute>} />
      <Route path="/lots"               element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT']}><FarmShiftView screen="lots" /></ProtectedRoute>} />
      <Route path="/stock-lookup"       element={<ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}><FarmShiftView screen="stock-lookup" /></ProtectedRoute>} />

      {/* ── IoT Sub-tabs ────────────────────────────────────── */}
      <Route path="/devices" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="devices" /></ProtectedRoute>} />
      <Route path="/rules"   element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="rules" /></ProtectedRoute>} />

      {/* ── Journal History ─────────────────────────────────── */}
      <Route path="/feeding-history" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="feeding-history" /></ProtectedRoute>} />
      <Route path="/weight-history"  element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER']}><FarmShiftView screen="weight-history" /></ProtectedRoute>} />

      {/* ── Owner Dashboard Subroutes ───────────────────────── */}
      <Route path="/owner-dashboard/batches" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="batches" /></ProtectedRoute>} />
      <Route path="/owner-dashboard/barns" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="farm" /></ProtectedRoute>} />
      <Route path="/owner-dashboard/inventory" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="inventory" /></ProtectedRoute>} />
      <Route path="/owner-dashboard/orders" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="purchases" /></ProtectedRoute>} />
      <Route path="/owner-dashboard/sales" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="sales" /></ProtectedRoute>} />
      <Route path="/owner-dashboard/fund-ledger" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="finance" /></ProtectedRoute>} />
      <Route path="/owner-dashboard/iot" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="iot" /></ProtectedRoute>} />
      <Route path="/owner-dashboard/pnl" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="report-batch" /></ProtectedRoute>} />
      <Route path="/owner-dashboard/workers" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="employees" /></ProtectedRoute>} />
      <Route path="/owner-dashboard/settings" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView screen="settings" /></ProtectedRoute>} />
      <Route path="/owner-dashboard/view/:screenId" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView /></ProtectedRoute>} />
      <Route path="/owner-dashboard/:screenId" element={<ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}><FarmShiftView /></ProtectedRoute>} />

      {/* ── Accountant Dashboard Subroutes ──────────────────── */}
      <Route path="/accountant-dashboard/orders" element={<ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}><FarmShiftView screen="purchases" /></ProtectedRoute>} />
      <Route path="/accountant-dashboard/sales" element={<ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}><FarmShiftView screen="sales" /></ProtectedRoute>} />
      <Route path="/accountant-dashboard/inventory" element={<ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}><FarmShiftView screen="inventory" /></ProtectedRoute>} />
      <Route path="/accountant-dashboard/transactions" element={<ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}><FarmShiftView screen="finance" /></ProtectedRoute>} />
      <Route path="/accountant-dashboard/reports" element={<ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}><FarmShiftView screen="reports" /></ProtectedRoute>} />
      <Route path="/accountant-dashboard/batches" element={<ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}><FarmShiftView screen="batches" /></ProtectedRoute>} />
      <Route path="/accountant-dashboard/view/:screenId" element={<ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}><FarmShiftView /></ProtectedRoute>} />
      <Route path="/accountant-dashboard/:screenId" element={<ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}><FarmShiftView /></ProtectedRoute>} />

      {/* ── Worker Dashboard Subroutes ──────────────────────── */}
      <Route path="/worker-dashboard/tasks" element={<ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}><FarmShiftView screen="tasks" /></ProtectedRoute>} />
      <Route path="/worker-dashboard/log" element={<ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}><FarmShiftView screen="quick" /></ProtectedRoute>} />
      <Route path="/worker-dashboard/coops" element={<ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}><FarmShiftView screen="coops" /></ProtectedRoute>} />
      <Route path="/worker-dashboard/iot" element={<ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}><FarmShiftView screen="iot" /></ProtectedRoute>} />
      <Route path="/worker-dashboard/alerts" element={<ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}><FarmShiftView screen="alerts" /></ProtectedRoute>} />
      <Route path="/worker-dashboard/view/:screenId" element={<ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}><FarmShiftView /></ProtectedRoute>} />
      <Route path="/worker-dashboard/:screenId" element={<ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}><FarmShiftView /></ProtectedRoute>} />

      {/* ── Profile & Settings Screens (Exact FarmShift.html) ─── */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER']}>
            <ProfilePage initialTab="info" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/profile"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER']}>
            <ProfilePage initialTab="info" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accountant-dashboard/profile"
        element={
          <ProtectedRoute allowedRoles={['ROLE_ACCOUNTANT']}>
            <ProfilePage initialTab="info" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/worker-dashboard/profile"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_WORKER']}>
            <ProfilePage initialTab="info" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/password"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER']}>
            <ProfilePage initialTab="password" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notification-settings"
        element={
          <ProtectedRoute allowedRoles={['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER']}>
            <ProfilePage initialTab="notifications" />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
