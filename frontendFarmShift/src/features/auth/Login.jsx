// src/features/auth/Login.jsx
// Đăng nhập hệ thống chuẩn FarmShift kết nối Spring Boot Backend
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { getSystemMessage } from '../../constants/systemMessages';
import '../../theme/farmshift.css';

export const Login = () => {
  const [email, setEmail] = useState(() => localStorage.getItem('farmshift_remembered_email') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('farmshift_remembered_email'));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(getSystemMessage('MSG02'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Gọi trực tiếp Spring Boot API: POST /api/auth/login
      const res = await authService.login(email.trim(), password);
      if (res && res.accessToken) {
        if (rememberMe) {
          localStorage.setItem('farmshift_remembered_email', email.trim());
        } else {
          localStorage.removeItem('farmshift_remembered_email');
        }
        await login(res.accessToken, res.email || email.trim(), res.role);
        navigate('/dashboard');
        return;
      }
      throw new Error(getSystemMessage('MSG04'));
    } catch (err) {
      console.warn('Backend login error:', err);
      if (err.response?.status === 401) {
        setError(getSystemMessage('MSG09'));
      } else if (err.response?.status === 403) {
        setError(getSystemMessage('MSG11'));
      } else if (err.response?.data?.messageCode) {
        setError(getSystemMessage(err.response.data.messageCode));
      } else {
        const msg = err.response?.data?.message || getSystemMessage('MSG09');
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
          Đăng nhập tài khoản
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-muted)', margin: 0 }}>
          Vui lòng nhập thông tin xác thực để truy cập hệ thống
        </p>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 14px',
          borderRadius: 'var(--rounded-md)',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: '13.5px',
          marginBottom: '20px'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="farmshift-form-group">
          <label className="farmshift-form-label">Email đăng nhập *</label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="name@smartfarm.com"
              className="farmshift-form-control"
              style={{ paddingLeft: '38px', height: '44px' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Mail
              size={16}
              color="var(--color-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        </div>

        <div className="farmshift-form-group" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="farmshift-form-label">Mật khẩu *</label>
            <Link
              to="/forgot-password"
              style={{ fontSize: '13px', color: 'var(--color-link)', textDecoration: 'none' }}
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              className="farmshift-form-control"
              style={{ paddingLeft: '38px', paddingRight: '40px', height: '44px' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Lock
              size={16}
              color="var(--color-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-muted)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--color-body)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
            />
            <span>Ghi nhớ đăng nhập</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="farmshift-btn farmshift-btn-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            height: '44px',
            fontSize: '14.5px',
            fontWeight: 500
          }}
        >
          {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
        </button>
      </form>
    </AuthLayout>
  );
};
