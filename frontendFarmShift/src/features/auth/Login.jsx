// src/features/auth/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { AuthLayout } from './AuthLayout';
import styles from './Auth.module.css';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data && response.data.accessToken) {
        const { accessToken, email: userEmail, role } = response.data;
        login(accessToken, userEmail, role);
        
        // Role-based routing
        if (role === 'ROLE_FARM_OWNER') navigate('/owner-dashboard');
        else if (role === 'ROLE_ACCOUNTANT') navigate('/accountant-dashboard');
        else navigate('/worker-dashboard');
      } else if (response.data && response.data.data) {
        // Handle wrapper response if standard in backend
        const { accessToken, email: userEmail, role } = response.data.data;
        login(accessToken, userEmail, role);
        if (role === 'ROLE_FARM_OWNER') navigate('/owner-dashboard');
        else if (role === 'ROLE_ACCOUNTANT') navigate('/accountant-dashboard');
        else navigate('/worker-dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className={styles.cardHeader}>
        <div className={styles.logo}>🚜</div>
        <h2 className={styles.title}>Sign in</h2>
        <p className={styles.subtitle}>Welcome back to your workspace</p>
      </div>

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert">
          {error}
        </div>
      )}

      <form className={styles.form} onSubmit={handleLogin} noValidate>
        <Input 
          label="Email" 
          type="email" 
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />
        
        <Input 
          label="Password" 
          type="password" 
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        
        <div className={styles.formFoot}>
          <Button type="submit" fullWidth loading={loading}>
            Sign In
          </Button>
          
          <Link to="/forgot-password" className={styles.textLink}>
            Forgot your password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};
