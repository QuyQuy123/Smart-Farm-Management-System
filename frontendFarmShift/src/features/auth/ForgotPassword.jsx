// src/features/auth/ForgotPassword.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { api } from '../../utils/api';
import { AuthLayout } from './AuthLayout';
import styles from './Auth.module.css';

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
      setError(err.response?.data?.message || 'Failed to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className={styles.cardHeader}>
        <Link to="/login" className={styles.backLink}>
          ← Back to login
        </Link>
        <h2 className={styles.title}>Reset password</h2>
        <p className={styles.subtitle}>
          Enter your email and we'll send you a 6-digit verification code.
        </p>
      </div>

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert">
          {error}
        </div>
      )}

      <form className={styles.form} onSubmit={handleRequestOtp} noValidate>
        <Input 
          label="Email address" 
          type="email" 
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />
        
        <div className={styles.formFoot}>
          <Button type="submit" fullWidth loading={loading}>
            Send reset code
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
};
