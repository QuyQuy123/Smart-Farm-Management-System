// src/features/auth/Login.jsx
// Exact FarmShift.html Login Form with rolepick & demo support
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { AuthLayout } from './AuthLayout';

export const Login = () => {
  const [selectedRole, setSelectedRole] = useState('owner'); // 'owner' | 'accountant' | 'worker'
  const [email, setEmail] = useState('owner@farmshift.vn');
  const [password, setPassword] = useState('demo12345');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'FarmShift · Đăng nhập demo';
  }, []);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    if (role === 'owner') {
      setEmail('owner@farmshift.vn');
      setPassword('demo12345');
    } else if (role === 'accountant') {
      setEmail('accountant@farmshift.vn');
      setPassword('demo12345');
    } else {
      setEmail('worker@farmshift.vn');
      setPassword('demo12345');
    }
  };

  const roleNameMap = {
    owner: 'Chủ trang trại',
    accountant: 'Kế toán',
    worker: 'Công nhân',
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const currentEmail = (e.target.email?.value || email).trim();
    const currentPassword = e.target.password?.value || password;

    if (!currentEmail || !currentPassword) {
      setError('Vui lòng nhập tài khoản và mật khẩu.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // First attempt backend login
      const response = await api.post('/auth/login', { email: currentEmail, password: currentPassword });
      const data = response.data?.data || response.data;
      if (data && data.accessToken) {
        login(data.accessToken, data.email || currentEmail, data.role);
        if (data.role === 'ROLE_FARM_OWNER') navigate('/owner-dashboard');
        else if (data.role === 'ROLE_ACCOUNTANT') navigate('/accountant-dashboard');
        else navigate('/worker-dashboard');
        return;
      }
    } catch (err) {
      // If backend fails or not running, use demo fallback
      const roleMap = {
        owner: 'ROLE_FARM_OWNER',
        accountant: 'ROLE_ACCOUNTANT',
        worker: 'ROLE_FARM_WORKER',
      };
      const userRole = roleMap[selectedRole] || 'ROLE_FARM_OWNER';
      login('mock-demo-token-12345', currentEmail, userRole);

      if (userRole === 'ROLE_FARM_OWNER') navigate('/owner-dashboard');
      else if (userRole === 'ROLE_ACCOUNTANT') navigate('/accountant-dashboard');
      else navigate('/worker-dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Chào mừng trở lại</h1>
      <p className="muted" style={{ marginBottom: 20 }}>Bộ HTML tương tác · Chọn vai trò để xem bản mẫu</p>

      {/* Role Picker (Exact FarmShift.html) */}
      <div className="rolepick">
        <button
          type="button"
          className={selectedRole === 'owner' ? 'active' : ''}
          onClick={() => handleRoleSelect('owner')}
        >
          Chủ trang trại
        </button>
        <button
          type="button"
          className={selectedRole === 'accountant' ? 'active' : ''}
          onClick={() => handleRoleSelect('accountant')}
        >
          Kế toán
        </button>
        <button
          type="button"
          className={selectedRole === 'worker' ? 'active' : ''}
          onClick={() => handleRoleSelect('worker')}
        >
          Công nhân
        </button>
      </div>

      {error && (
        <div className="error" role="alert" style={{ marginBottom: 15 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin}>
        <div className="formgrid" style={{ gridTemplateColumns: '1fr' }}>
          <label className="field">
            Tài khoản demo
            <input
              name="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>

          <label className="field">
            Mật khẩu demo
            <input
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
        </div>

        <button
          type="submit"
          className="btn primary"
          style={{ width: '100%', marginTop: 24, padding: '12px 18px', fontSize: 14 }}
          disabled={loading}
        >
          {loading ? 'Đang mở...' : `Mở giao diện ${roleNameMap[selectedRole]}`}
        </button>
      </form>

      <div className="note" style={{ marginTop: 24 }}>
        Tài khoản: owner / accountant / worker · Mật khẩu: demo12345. Đây là mô phỏng đăng nhập, có thể dùng ngay.
      </div>

      <small className="muted" style={{ display: 'block', marginTop: 12 }}>
        Hệ thống nội bộ một trang trại · Tài khoản được cấp bởi chủ trại.
      </small>
    </AuthLayout>
  );
};
