// src/components/Button/Button.jsx
import React from 'react';
import styles from './Button.module.css';

/**
 * Design-system Button — implements DESIGN.md button-primary & button-secondary.
 *
 * @param {'primary'|'secondary'} variant
 * @param {boolean} fullWidth
 * @param {boolean} loading   — shows inline spinner, disables interaction
 */
export const Button = ({
  children,
  variant = 'primary',
  fullWidth = false,
  loading  = false,
  className = '',
  disabled,
  type = 'button',
  ...props
}) => {
  const cls = [
    styles.btn,
    styles[variant],
    fullWidth ? styles.fullWidth : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
};
