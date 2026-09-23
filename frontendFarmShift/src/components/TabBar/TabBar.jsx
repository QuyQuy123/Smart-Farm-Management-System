// src/components/TabBar/TabBar.jsx
// Horizontal tab navigation — used on Inventory pages (farmgo PDF pages 3-4)
import React from 'react';
import styles from './TabBar.module.css';

/**
 * @param {Array}  tabs     — [{ key, label }]
 * @param {string} active   — active tab key
 * @param {Function} onChange
 */
export const TabBar = ({ tabs = [], active, onChange }) => {
  return (
    <div className={styles.tabBar} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          className={`${styles.tab} ${active === tab.key ? styles.tabActive : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
