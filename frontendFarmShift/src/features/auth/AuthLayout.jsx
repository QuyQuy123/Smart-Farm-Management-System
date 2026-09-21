// src/features/auth/AuthLayout.jsx
import React from 'react';
import styles from './Auth.module.css';

/**
 * Clean, editorial layout for authentication.
 * Uses a white canvas card centered on a soft gray surface,
 * relying strictly on typography and whitespace for structure.
 */
export const AuthLayout = ({ children }) => {
  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        {children}
      </div>
    </div>
  );
};
