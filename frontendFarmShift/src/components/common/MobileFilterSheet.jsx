// src/components/common/MobileFilterSheet.jsx
// Collapses multi-field filter bars into a touch-friendly "Bộ lọc (N)" Bottom Sheet on Mobile (< 768px)
import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useViewport } from '../../hooks/useViewport';
import styles from './MobileFilterSheet.module.css';

export const MobileFilterSheet = ({
  activeCount = 0,
  title = 'Bộ lọc',
  onReset,
  children,
  triggerLabel = 'Bộ lọc',
}) => {
  const { isMobile } = useViewport();
  const [open, setOpen] = useState(false);
  const isSheetOpen = open && isMobile;

  useEffect(() => {
    if (!isSheetOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [isSheetOpen]);

  // Desktop & Tablet: render filters inline without altering existing layout
  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.triggerBtn} ${activeCount > 0 ? styles.triggerBtnActive : ''}`}
        onClick={() => setOpen(true)}
        data-testid="mobile-filter-trigger"
      >
        <SlidersHorizontal size={16} />
        <span>{triggerLabel}{activeCount > 0 ? ` (${activeCount})` : ''}</span>
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={title}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()} data-testid="mobile-filter-sheet">
            <div className={styles.handle} aria-hidden="true" />
            <div className={styles.header}>
              <strong className={styles.title}>{title}</strong>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="Đóng bộ lọc"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.body}>{children}</div>
            <div className={styles.footer}>
              {onReset && (
                <button
                  type="button"
                  className={styles.resetBtn}
                  onClick={() => { onReset(); }}
                >
                  Đặt lại
                </button>
              )}
              <button
                type="button"
                className={styles.applyBtn}
                onClick={() => setOpen(false)}
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
