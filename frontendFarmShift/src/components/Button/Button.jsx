// src/components/Button/Button.jsx
// Design-system Button — DESIGN.md button-primary, button-secondary, + farmgo variants
import React from 'react';
import styles from './Button.module.css';

/**
 * FarmShift design-system Button.
 *
 * @param {'primary'|'secondary'|'green'|'orange'|'ghost'|'danger'|'link'} variant
 * @param {'sm'|'md'|'lg'} size
 * @param {boolean} fullWidth
 * @param {boolean} loading  — inline spinner, disables interaction
 */
export const Button = ({
  children,
  variant  = 'primary',
  size     = 'md',
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
    size !== 'md' ? styles[size] : '',
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
