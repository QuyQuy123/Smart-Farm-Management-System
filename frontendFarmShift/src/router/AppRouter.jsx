// d:\Smart-Farm-Management-System\frontendFarmShift\src\router\AppRouter.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Login } from '../features/auth/Login';
import { ForgotPassword } from '../features/auth/ForgotPassword';
import { ResetPassword } from '../features/auth/ResetPassword';
import { OwnerDashboard } from '../features/dashboard/OwnerDashboard';
import { AccountantDashboard } from '../features/dashboard/AccountantDashboard';
import { WorkerDashboard } from '../features/dashboard/WorkerDashboard';

// ProtectedRoute checks if user is logged in AND has the required role
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If they are logged in but lack the role, send them back to login or an unauthorized page
    return <Navigate to="/login" replace />;
  }

  return children;
};

// If a logged-in user hits '/', redirect them to their respective dashboard
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  
  if (user.role === 'ROLE_FARM_OWNER') return <Navigate to="/owner-dashboard" replace />;
  if (user.role === 'ROLE_ACCOUNTANT') return <Navigate to="/accountant-dashboard" replace />;
  return <Navigate to="/worker-dashboard" replace />;
};

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-otp" element={<ResetPassword />} />

      {/* Role-Based Protected Routes */}
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
    </Routes>
  );
};
