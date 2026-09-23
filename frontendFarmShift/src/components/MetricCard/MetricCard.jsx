// src/components/MetricCard/MetricCard.jsx
// Stat card with icon, value, label, and optional badge
// Used in all dashboard and listing pages (farmgo PDF pages 1, 3, 4, 7)
import React from 'react';
import styles from './MetricCard.module.css';

/**
 * @param {string}         label   — metric label e.g. "Sản lượng"
 * @param {string|number}  value   — main figure e.g. "125 Kg"
 * @param {string}         sub     — secondary text
 * @param {React.ReactNode} icon   — icon component
 * @param {'green'|'orange'|'blue'|'red'|'default'} color
 */
export const MetricCard = ({
  label,
  value,
  sub,
  icon,
  color = 'default',
  className = '',
}) => {
  return (
    <div className={`${styles.card} ${styles[color]} ${className}`}>
      <div className={styles.top}>
        <div className={styles.iconWrap}>
          {icon}
        </div>
      </div>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
};
