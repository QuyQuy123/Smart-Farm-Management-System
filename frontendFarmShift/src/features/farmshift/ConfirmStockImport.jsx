import { useEffect, useRef, useState } from 'react';
import { PackageCheck, X } from 'lucide-react';
import styles from './WarehouseCategoriesView.module.css';

export function ConfirmStockImport({ invoiceCode, onClose, onConfirm }) {
  const dialog = useRef(null), pending = useRef(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current, previous = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = previous; };
  }, []);
  async function confirm() {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError('');
    const success = await onConfirm();
    if (success) onClose();
    else { setError('Không thể xác nhận nhập kho. Vui lòng thử lại.'); pending.current = false; setSaving(false); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="stock-confirm-title" aria-describedby="stock-confirm-description"
    onKeyDown={event => { event.stopPropagation(); }}
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className={styles.modal}>
      <header className={styles.modalHeader}><h2 id="stock-confirm-title">Xác nhận nhập kho</h2><button type="button" className={styles.iconButton} aria-label="Đóng xác nhận nhập kho" onClick={onClose} disabled={saving}><X size={18} /></button></header>
      <div className={styles.modalBody}>
        <p id="stock-confirm-description">Bạn có đồng ý nhập kho cho hóa đơn <strong>{invoiceCode}</strong>? Số lượng hàng hóa sẽ được cộng vào tồn kho.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <footer className={styles.footer}><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>Từ chối</button><button type="button" className="farmshift-btn farmshift-btn-mint" onClick={confirm} disabled={saving} aria-busy={saving}><PackageCheck size={16} />{saving ? 'Đang xác nhận...' : 'Đồng ý'}</button></footer>
    </section>
  </dialog>;
}
