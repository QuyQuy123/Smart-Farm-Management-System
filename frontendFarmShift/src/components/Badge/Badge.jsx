// src/components/Badge/Badge.jsx
// Status badge — color variants matching farmgo PDF design
import React from 'react';
import styles from './Badge.module.css';

/**
 * @param {'success'|'warning'|'error'|'info'|'neutral'|'green'|'orange'|'blue'} variant
 * @param {'sm'|'md'} size
 */
export const Badge = ({
  children,
  variant = 'neutral',
  size    = 'md',
  className = '',
  ...props
}) => {
  const cls = [
    styles.badge,
    styles[variant],
    size === 'sm' ? styles.sm : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={cls} {...props}>
      {children}
    </span>
  );
};
