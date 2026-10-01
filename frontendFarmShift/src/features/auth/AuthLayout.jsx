// src/features/auth/AuthLayout.jsx
// Exact FarmShift.html Login visual + form split panel
import React from 'react';
import { Bird, Activity, TrendingUp } from 'lucide-react';

export const AuthLayout = ({ children }) => {
  return (
    <div className="login">
      {/* Left: Brand visual panel (Exact FarmShift.html) */}
      <section className="login-visual">
        <div className="brand" style={{ padding: 0 }}>
          <span className="leaf">◒</span>FarmShift
          <small>Trang trại Miền Bính</small>
        </div>

        <h1>
          Chăm đàn tốt hơn.<br />
          Quản lý rõ ràng hơn.
        </h1>

        <p>
          Một nơi theo dõi lứa nuôi, công việc, vật tư và hiệu quả vận hành của trang trại.
        </p>

        <div style={{ marginTop: 40, display: 'flex', gap: 24, alignItems: 'center', fontSize: 13, color: '#bed5c8' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Bird size={16} color="#90ca92" /> Chăn nuôi
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Activity size={16} color="#90ca92" /> Môi trường
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={16} color="#90ca92" /> Hiệu quả
          </span>
        </div>
      </section>

      {/* Right: Form panel */}
      <section className="login-form">
        {children}
      </section>
    </div>
  );
};
