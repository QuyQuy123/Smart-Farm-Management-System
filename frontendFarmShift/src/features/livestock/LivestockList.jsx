// src/features/livestock/LivestockList.jsx
// Danh sách lứa gà thịt — redirect tới BatchList (tránh trùng lặp)
// Màn hình này giữ lại để backward-compatible với route /owner-dashboard/livestock
import React from 'react';
import { Navigate } from 'react-router-dom';

// Redirect về BatchList — đây là màn hình đúng nghiệp vụ gà thịt
export const LivestockList = () => <Navigate to="/owner-dashboard/batches" replace />;
