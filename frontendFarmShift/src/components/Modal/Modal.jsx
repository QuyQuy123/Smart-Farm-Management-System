// src/components/Modal/Modal.jsx
// Reusable modal overlay — used by WarehousePermissions detail modal (page 6)
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

/**
 * @param {boolean}  isOpen
 * @param {()=>void} onClose
 * @param {string}   title
 * @param {string}   size   — 'sm'|'md'|'lg'
 * @param {boolean}  isDirty — prevents accidental dismissal when clicking backdrop
 * @param {boolean}  preventBackdropClose — always block backdrop click dismissal
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  isDirty = false,
  preventBackdropClose = false,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape' && !isDirty && !preventBackdropClose) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, isDirty, preventBackdropClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (isDirty || preventBackdropClose) return;
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div
        className={`${styles.panel} ${styles[size]}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>{children}</div>

        {/* Footer */}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
};
