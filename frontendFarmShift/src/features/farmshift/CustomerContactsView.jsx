import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, X, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listCustomerContacts, createCustomerContact, updateCustomerContact, deleteCustomerContact } from '../../services/customerContactService';
import styles from './WarehouseCategoriesView.module.css';
import { validateContactPhone } from '../../utils/contactPhone';

const errorMessage = error => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';

function CustomerDialog({ mode, customer, onClose, onSaved }) {
  const dialog = useRef(null);
  const [name, setName] = useState(customer?.name || ''), [phone, setPhone] = useState(customer?.phone || '');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneError = validateContactPhone(phone);
  const readOnly = mode === 'view', deleting = mode === 'delete';
  const title = { create: 'Thêm khách hàng', edit: 'Chỉnh sửa khách hàng', view: 'Chi tiết khách hàng', delete: 'Xóa khách hàng' }[mode];
  useEffect(() => {
    const element = dialog.current, overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    if (!deleting && (!name.trim() || !phone.trim())) { setError('Vui lòng nhập tên và số điện thoại khách hàng.'); return; }
    if (!deleting && phoneError) { setPhoneTouched(true); setError(phoneError); return; }
    setSaving(true); setError('');
    try {
      if (deleting) await deleteCustomerContact(customer.id);
      else if (mode === 'edit') await updateCustomerContact(customer.id, { name: name.trim(), phone: phone.trim() });
      else await createCustomerContact({ name: name.trim(), phone: phone.trim() });
      onSaved(deleting ? 'Đã xóa khách hàng.' : 'Đã lưu khách hàng thành công.');
    } catch (error) { setError(errorMessage(error)); setSaving(false); }
  };
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="customer-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className={styles.modal}>
      <header className={styles.modalHeader}><h2 id="customer-title">{title}</h2><button type="button" className={styles.iconButton} onClick={onClose} disabled={saving} aria-label="Đóng"><X size={20} /></button></header>
      <form onSubmit={submit}><div className={styles.modalBody}>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {deleting ? <p>Bạn muốn xóa khách hàng <strong>{customer.name}</strong>? Thao tác này không thể hoàn tác.</p> : <>
          <label htmlFor="customer-name">Tên khách hàng {!readOnly && <span className={styles.required}>*</span>}</label>
          <input id="customer-name" className="farmshift-form-control" placeholder="Nguyễn Văn A" value={name} onChange={event => setName(event.target.value)} required maxLength={200} readOnly={readOnly} disabled={saving} />
          <label htmlFor="customer-phone">Số điện thoại {!readOnly && <span className={styles.required}>*</span>}</label>
          <input id="customer-phone" type="tel" inputMode="numeric" className="farmshift-form-control" placeholder="0912345678" value={phone}
            onChange={event => { setPhone(event.target.value.replace(/[^0-9]/g, '')); setPhoneTouched(true); }} onBlur={() => setPhoneTouched(true)}
            aria-invalid={!readOnly && phoneTouched && !!phoneError} aria-describedby={!readOnly && phoneTouched && phoneError ? 'customer-phone-error' : undefined} required maxLength={11} readOnly={readOnly} disabled={saving} />
          {!readOnly && phoneTouched && phoneError && <p id="customer-phone-error" role="alert" style={{ color: '#dc2626', fontSize: '13.5px', margin: '-12px 0 16px' }}>{phoneError}</p>}
        </>}
      </div><footer className={styles.footer}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>{readOnly ? 'Đóng' : 'Hủy bỏ'}</button>
        {!readOnly && <button type="submit" className={`farmshift-btn ${deleting ? styles.deleteButton : 'farmshift-btn-mint'}`} disabled={saving} aria-busy={saving}>{saving ? 'Đang xử lý...' : deleting ? 'Xóa khách hàng' : 'Lưu khách hàng'}</button>}
      </footer></form>
    </section>
  </dialog>;
}

export const CustomerContactsView = () => {
  const { user } = useAuth(), { showToast } = useNotification();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [page, setPage] = useState(0), [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [modal, setModal] = useState(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    listCustomerContacts(page, search).then(result => {
      if (cancelled) return;
      if (page > 0 && page >= result.totalPages) { setPage(Math.max(0, result.totalPages - 1)); return; }
      setData(result);
    }).catch(error => { if (!cancelled) setError(errorMessage(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, search, revision]);
  const totalPages = Math.max(1, data.totalPages);
  return <div className={`farmshift-card ${styles.card}`}>
    <div className={styles.toolbar}><div className={styles.heading}><span className={styles.headingIcon}><Users size={21} /></span><div><h2>Khách hàng</h2><p>Danh bạ khách hàng · 10 khách hàng mỗi trang</p></div></div>{canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => setModal({ mode: 'create' })}><Plus size={16} />Thêm khách hàng</button>}</div>
    <div className={styles.searchRow}><div className={styles.search}><Search size={17} /><input aria-label="Tìm khách hàng" placeholder="Tìm theo tên hoặc số điện thoại..." maxLength={200} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></div>{!loading && !error && <span className={styles.total}>{data.totalElements} khách hàng</span>}</div>
    {error ? <div className={styles.empty} role="alert"><p>{error}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : <>
      <div className="farmshift-table-container" style={{ border: 0 }}><table className={`farmshift-table ${styles.table}`} style={{ minWidth: '440px' }}>
        <thead><tr><th>Tên khách hàng</th><th>Số điện thoại</th><th>Thao tác</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={3} className={styles.empty} role="status">Đang tải khách hàng...</td></tr> : !(data?.content?.length) ? <tr><td colSpan={3} className={styles.empty}>{search ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng. Thêm khách hàng đầu tiên để bắt đầu.'}</td></tr> : (data?.content || []).map(customer => <tr key={customer.id}>
          <td><strong>{customer.name}</strong></td><td>{customer.phone}</td><td><div className={styles.actions}>
            <button type="button" className={styles.iconButton} aria-label={`Xem ${customer.name}`} title="Xem chi tiết" onClick={() => setModal({ mode: 'view', customer })}><Eye size={16} /></button>
            {canEdit && <><button type="button" className={styles.iconButton} aria-label={`Sửa ${customer.name}`} title="Chỉnh sửa" onClick={() => setModal({ mode: 'edit', customer })}><Pencil size={16} /></button><button type="button" className={`${styles.iconButton} ${styles.danger}`} aria-label={`Xóa ${customer.name}`} title="Xóa" onClick={() => setModal({ mode: 'delete', customer })}><Trash2 size={16} /></button></>}
          </div></td>
        </tr>)}</tbody>
      </table></div>
      <nav aria-label="Phân trang khách hàng" className={styles.searchRow} style={{ borderTop: '1px solid #edf1f0' }}>
        <span className={styles.total}>{data.totalElements ? `${page * 10 + 1}–${Math.min((page + 1) * 10, data.totalElements)} / ${data.totalElements} khách hàng` : '0 khách hàng'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" aria-label="Trang trước" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} />Trước</button>
          <span className={styles.total}>Trang {page + 1} / {totalPages}</span>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" aria-label="Trang sau" disabled={loading || page + 1 >= totalPages} onClick={() => setPage(value => value + 1)}>Sau<ChevronRight size={16} /></button>
        </div>
      </nav>
    </>}
    {modal && <CustomerDialog key={`${modal.mode}-${modal.customer?.id || 'new'}`} {...modal} onClose={() => setModal(null)} onSaved={text => { setModal(null); showToast(text, 'success'); setRevision(value => value + 1); }} />}
  </div>;
};
