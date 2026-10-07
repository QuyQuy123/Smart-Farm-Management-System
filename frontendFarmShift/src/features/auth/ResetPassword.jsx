// src/features/auth/ResetPassword.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { authService } from '../../services/authService';
import { AuthLayout } from './AuthLayout';
import '../../theme/farmshift.css';

export const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  // step 1 = Verify OTP, step 2 = Create New Password
  const [step, setStep] = useState(1);

  // OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Timer state for resend code
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    let interval;
    if (timer > 0 && step === 1) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer, step]);

  // Auto-submit OTP
  useEffect(() => {
    const otpString = otp.join('');
    if (otpString.length === 6 && step === 1 && !loading) {
      verifyOtpAction(otpString);
    }
  }, [otp, step]);

  if (!email) {
    return <Navigate to="/forgot-password" replace />;
  }

  // ── Step 1: Handle OTP Input ──────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      const pastedData = value.slice(0, 6).split('');
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        if (index + i < 6) newOtp[index + i] = pastedData[i];
      }
      setOtp(newOtp);
      const focusIndex = Math.min(index + pastedData.length, 5);
      otpRefs.current[focusIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtpAction = async (otpString) => {
    setError('');
    setLoading(true);

    try {
      await authService.verifyOtp(email, otpString);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Mã xác thực không hợp lệ. Vui lòng thử lại.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length === 6) {
      verifyOtpAction(otpString);
    }
  };

  const handleResendCode = async () => {
    if (timer > 0 || loading) return;
    try {
      setLoading(true);
      setError('');
      await authService.forgotPassword(email);
      setTimer(60);
      setSuccess('Mã xác thực mới đã được gửi!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Lỗi khi gửi lại mã. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Handle Password Reset ─────────────────────────────
  const calculatePasswordStrength = (pwd) => {
    if (pwd.length === 0) return -1;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = calculatePasswordStrength(newPassword);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      setError('Mật khẩu phải dài ít nhất 8 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu không khớp.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const otpString = otp.join('');
      await authService.resetPassword(email, otpString, newPassword);
      setSuccess('Mật khẩu của bạn đã được thay đổi.');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Đổi mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div style={{ marginBottom: '24px' }}>
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-muted)', textDecoration: 'none', marginBottom: '16px' }}>
          <ArrowLeft size={14} /> Quay lại đăng nhập
        </Link>
        <h2 style={{ fontSize: '24px', fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 6px' }}>
          {step === 1 ? 'Nhập mã xác thực' : 'Tạo mật khẩu mới'}
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: 0 }}>
          {step === 1 
            ? <>Chúng tôi đã gửi 6 số xác thực tới <strong style={{ color: 'var(--color-ink)' }}>{email}</strong></>
            : 'Vui lòng nhập mật khẩu mới và bảo mật.'
          }
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
      
      {success && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px 14px',
          borderRadius: 'var(--rounded-md)',
          backgroundColor: '#e6f4ea',
          border: '1px solid #ceead6',
          color: '#137333',
          fontSize: '13px',
          marginBottom: '20px'
        }}>
          <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{success}</div>
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleVerifyOtp}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', display: 'block', marginBottom: '12px', textAlign: 'center' }}>
              Mã xác thực
            </label>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (otpRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  style={{
                    width: '44px',
                    height: '52px',
                    fontSize: '24px',
                    fontWeight: 600,
                    textAlign: 'center',
                    border: `1px solid ${digit ? 'var(--color-primary)' : 'var(--color-hairline)'}`,
                    borderRadius: 'var(--rounded-md)',
                    backgroundColor: digit ? '#fff' : 'var(--color-surface-soft)',
                    color: 'var(--color-ink)',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  disabled={loading}
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <button
              type="submit"
              disabled={loading || otp.join('').length < 6}
              className="farmshift-btn farmshift-btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: '44px' }}
            >
              {loading ? 'Đang xác thực...' : 'Xác thực mã'}
            </button>
            
            <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
              Không nhận được mã?{' '}
              {timer > 0 ? (
                <span style={{ fontWeight: 600 }}>Gửi lại sau {timer}s</span>
              ) : (
                <button 
                  type="button" 
                  onClick={handleResendCode}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Gửi lại mã
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleResetPassword}>
          <div className="farmshift-form-group">
            <label className="farmshift-form-label">Mật khẩu mới *</label>
            <input
              type="password"
              required
              placeholder="Ít nhất 8 ký tự"
              className="farmshift-form-control"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={success !== ''}
              autoFocus
            />
            {newPassword.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                <div style={{ height: '4px', flex: 1, borderRadius: '2px', backgroundColor: strength >= 0 ? '#ea4335' : 'var(--color-hairline)' }} />
                <div style={{ height: '4px', flex: 1, borderRadius: '2px', backgroundColor: strength >= 1 ? '#fbbc04' : 'var(--color-hairline)' }} />
                <div style={{ height: '4px', flex: 1, borderRadius: '2px', backgroundColor: strength >= 2 ? '#34a853' : 'var(--color-hairline)' }} />
              </div>
            )}
          </div>

          <div className="farmshift-form-group" style={{ marginTop: '16px' }}>
            <label className="farmshift-form-label">Xác nhận mật khẩu *</label>
            <input
              type="password"
              required
              placeholder="Nhập lại mật khẩu"
              className="farmshift-form-control"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={success !== ''}
            />
          </div>
          
          <div style={{ marginTop: '24px' }}>
            <button
              type="submit"
              disabled={loading || success !== ''}
              className="farmshift-btn farmshift-btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: '44px' }}
            >
              {loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};
