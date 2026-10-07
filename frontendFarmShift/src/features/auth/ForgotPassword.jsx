// src/features/auth/ForgotPassword.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { AuthLayout } from './AuthLayout';
import '../../theme/farmshift.css';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      // Proceed to OTP verification screen, passing email via state
      navigate('/verify-otp', { state: { email } });
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể yêu cầu đặt lại mật khẩu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div style={{ marginBottom: '24px' }}>
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-muted)', textDecoration: 'none', marginBottom: '16px' }}>
          <ArrowLeft size={14} /> Quay lại đăng nhập
        </Link>
        <h2 style={{ fontSize: '24px', fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 6px' }}>
          Khôi phục mật khẩu
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: 0 }}>
          Nhập email của bạn, chúng tôi sẽ gửi mã xác thực 6 số.
        </p>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px 14px',
          borderRadius: 'var(--rounded-md)',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: '13px',
          marginBottom: '20px'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleRequestOtp}>
        <div className="farmshift-form-group">
          <label className="farmshift-form-label">Email đăng ký *</label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              required
              placeholder="name@smartfarm.com"
              className="farmshift-form-control"
              style={{ paddingLeft: '38px' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <Mail size={16} color="var(--color-muted)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
          </div>
        </div>
        
        <div style={{ marginTop: '24px' }}>
          <button
            type="submit"
            disabled={loading}
            className="farmshift-btn farmshift-btn-primary"
            style={{ width: '100%', justifyContent: 'center', height: '44px' }}
          >
            {loading ? 'Đang gửi mã...' : 'Gửi mã xác thực'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
};
