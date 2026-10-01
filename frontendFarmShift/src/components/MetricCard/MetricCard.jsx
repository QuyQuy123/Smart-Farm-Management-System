// src/components/MetricCard/MetricCard.jsx
// Editorial KPI card — DESIGN.md Airtable-editorial style
// White canvas, colored icon circle, large 26px editorial number
import React from 'react';
import styles from './MetricCard.module.css';

/**
 * @param {string}         label   — metric label e.g. "Tổng đàn"
 * @param {string|number}  value   — main figure e.g. "7,880 con"
 * @param {string}         sub     — secondary/unit text
 * @param {React.ReactNode} icon   — icon component (from lucide-react)
 * @param {'green'|'orange'|'blue'|'red'|'teal'|'default'} color
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
      <div className={styles.iconWrap}>
        {icon}
      </div>
      <div className={styles.body}>
        <div className={styles.label}>{label}</div>
        <div className={styles.value}>{value}</div>
        {sub && <div className={styles.sub}>{sub}</div>}
      </div>
    </div>
  );
};
