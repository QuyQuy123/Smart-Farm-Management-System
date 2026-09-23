// src/features/auth/ResetPassword.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { api } from '../../utils/api';
import { AuthLayout } from './AuthLayout';
import styles from './Auth.module.css';

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
  }, [otp, step]); // Do not include loading to avoid double calls

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
      await api.post('/auth/verify-otp', { email, otp: otpString });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Mã xác thực không hợp lệ. Vui lòng thử lại.');
      // Clear OTP on error so user can re-enter easily
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
      await api.post('/auth/forgot-password', { email });
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
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const otpString = otp.join('');
      await api.post('/auth/reset-password', { 
        email, 
        otp: otpString, 
        newPassword 
      });
      setSuccess('Your password has been successfully reset.');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className={styles.cardHeader}>
        <h2 className={styles.title}>
          {step === 1 ? 'Check your email' : 'Create new password'}
        </h2>
        <p className={styles.subtitle}>
          {step === 1 
            ? <>We sent a 6-digit code to <span className={styles.emailHighlight}>{email}</span></>
            : 'Please enter a strong password for your account.'
          }
        </p>
      </div>

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert">
          {error}
        </div>
      )}
      
      {success && (
        <div className={`${styles.alert} ${styles.alertSuccess}`} role="alert">
          {success}
        </div>
      )}

      {step === 1 && (
        <form className={styles.form} onSubmit={handleVerifyOtp} noValidate>
          <div>
            <label className={styles.title} style={{ fontSize: '14px', marginBottom: '12px', display: 'block', textAlign: 'center' }}>
              Verification code
            </label>
            <div className={styles.otpRow}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (otpRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className={`${styles.otpCell} ${digit ? styles.otpFilled : ''}`}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  disabled={loading}
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>
          
          <div className={styles.formFoot} style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <Button variant="green" type="submit" fullWidth loading={loading} disabled={otp.join('').length < 6}>
              Verify Code
            </Button>
            
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              Không nhận được mã?{' '}
              {timer > 0 ? (
                <span style={{ fontWeight: 600 }}>Gửi lại sau {timer}s</span>
              ) : (
                <button 
                  type="button" 
                  onClick={handleResendCode}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', color: 'var(--color-farm-green)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Gửi lại mã
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {step === 2 && (
        <form className={styles.form} onSubmit={handleResetPassword} noValidate>
          <div>
            <Input 
              label="New password" 
              type="password" 
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={success !== ''}
              autoFocus
            />
            {newPassword.length > 0 && (
              <div className={styles.strengthRow}>
                <div className={`${styles.strengthBar} ${strength >= 0 ? styles['active' + strength] : ''}`} />
                <div className={`${styles.strengthBar} ${strength >= 1 ? styles['active' + strength] : ''}`} />
                <div className={`${styles.strengthBar} ${strength >= 2 ? styles.active2 : ''}`} />
              </div>
            )}
          </div>

          <div>
            <Input 
              label="Confirm new password" 
              type="password" 
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={success !== ''}
            />
          </div>
          
          <div className={styles.formFoot}>
            <Button variant="green" type="submit" fullWidth loading={loading} disabled={success !== ''}>
              Reset Password
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};
