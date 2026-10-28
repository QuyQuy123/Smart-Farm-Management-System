import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, X, Truck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../services/supplierService';
import { listProductTypes } from '../../services/productTypeService';
import styles from './WarehouseCategoriesView.module.css';
import { validateContactPhone } from '../../utils/contactPhone';

const date = value => value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '—';
const message = error => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';

/** Form thêm / sửa / xem / xóa nhà cung cấp; onSaved(message, savedSupplier) — savedSupplier khi thêm hoặc sửa. */
export function SupplierDialog({ mode, supplier, onClose, onSaved }) {
  const dialog = useRef(null);
  const [name, setName] = useState(supplier?.name || '');
  const [representative, setRepresentative] = useState(supplier?.representative || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneError = validateContactPhone(phone);
  const [productTypeId, setProductTypeId] = useState(String(supplier?.productTypeId || ''));
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(!['view', 'delete'].includes(mode));
  const [groupError, setGroupError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const readOnly = mode === 'view', deleting = mode === 'delete';
  const title = { create: 'Thêm nhà cung cấp', edit: 'Chỉnh sửa nhà cung cấp', view: 'Chi tiết nhà cung cấp', delete: 'Xóa nhà cung cấp' }[mode];
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => {
    if (readOnly || deleting) return;
    let cancelled = false;
    setLoading(true); setGroupError('');
    listProductTypes().then(data => { if (!cancelled) setGroups(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setGroupError('Không tải được nhóm nhà cung cấp.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [readOnly, deleting, revision]);
  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    if (!deleting && (!name.trim() || !representative.trim() || !phone.trim())) { setError('Vui lòng nhập đầy đủ thông tin bắt buộc.'); return; }
    if (!deleting && (loading || groupError || !groups.some(group => String(group.id) === productTypeId))) { setError('Vui lòng chọn nhóm nhà cung cấp hợp lệ.'); return; }
    if (!deleting && phoneError) { setPhoneTouched(true); setError(phoneError); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: name.trim(), representative: representative.trim(), phone: phone.trim(), productTypeId: Number(productTypeId) };
      let saved = null;
      if (deleting) await deleteSupplier(supplier.id);
      else if (mode === 'edit') saved = await updateSupplier(supplier.id, payload);
      else saved = await createSupplier(payload);
      onSaved(deleting ? 'Đã xóa nhà cung cấp.' : 'Đã lưu nhà cung cấp thành công.', saved);
    } catch (error) { setError(message(error)); setSaving(false); }
  };
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="supplier-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className={styles.modal}>
      <header className={styles.modalHeader}><h2 id="supplier-title">{title}</h2><button type="button" className={styles.iconButton} onClick={onClose} disabled={saving} aria-label="Đóng"><X size={20} /></button></header>
      <form onSubmit={submit}>
        <div className={styles.modalBody}>
          {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
          {deleting ? <p>Bạn muốn xóa nhà cung cấp <strong>{supplier.name}</strong>? Thao tác này không thể hoàn tác.</p> : <>
            <label htmlFor="supplier-name">Đơn vị cung cấp {!readOnly && <span className={styles.required}>*</span>}</label>
            <input id="supplier-name" className="farmshift-form-control" placeholder="Ví dụ: Công ty Minh An" required maxLength={200} value={name} onChange={event => setName(event.target.value)} readOnly={readOnly} disabled={saving} />
            <label htmlFor="supplier-representative">Người đại diện {!readOnly && <span className={styles.required}>*</span>}</label>
            <input id="supplier-representative" className="farmshift-form-control" placeholder="Nguyễn Văn A" required maxLength={100} value={representative} onChange={event => setRepresentative(event.target.value)} readOnly={readOnly} disabled={saving} />
            <label htmlFor="supplier-phone">Số điện thoại {!readOnly && <span className={styles.required}>*</span>}</label>
            <input id="supplier-phone" type="tel" inputMode="numeric" className="farmshift-form-control" placeholder="0912345678" required maxLength={11} value={phone}
              onChange={event => { setPhone(event.target.value.replace(/[^0-9]/g, '')); setPhoneTouched(true); }} onBlur={() => setPhoneTouched(true)}
              aria-invalid={!readOnly && phoneTouched && !!phoneError} aria-describedby={!readOnly && phoneTouched && phoneError ? 'supplier-phone-error' : undefined} readOnly={readOnly} disabled={saving} />
            {!readOnly && phoneTouched && phoneError && <p id="supplier-phone-error" role="alert" style={{ color: '#dc2626', fontSize: '13.5px', margin: '-12px 0 16px' }}>{phoneError}</p>}
            <label htmlFor="supplier-group">Nhóm nhà cung cấp {!readOnly && <span className={styles.required}>*</span>}</label>
            {readOnly ? <input id="supplier-group" className="farmshift-form-control" value={supplier.productTypeName} readOnly /> : <>
              <select id="supplier-group" className="farmshift-form-control" required value={productTypeId} onChange={event => setProductTypeId(event.target.value)} disabled={saving || loading || !!groupError}>
                <option value="">{loading ? 'Đang tải nhóm nhà cung cấp...' : 'Chọn nhóm nhà cung cấp'}</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              {groupError && <p role="alert" className={styles.error}>{groupError}<button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></p>}
              {!loading && !groupError && !groups.length && <p className={styles.error}>Chưa có nhóm. Vui lòng thêm dữ liệu trong tab Loại hàng hóa trước.</p>}
            </>}
            {readOnly && <><label htmlFor="supplier-date">Ngày tạo</label><input id="supplier-date" className="farmshift-form-control" value={date(supplier.createdAt)} readOnly /></>}
          </>}
        </div>
        <footer className={styles.footer}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={saving} onClick={onClose}>{readOnly ? 'Đóng' : 'Hủy bỏ'}</button>
          {!readOnly && <button type="submit" className={`farmshift-btn ${deleting ? styles.deleteButton : 'farmshift-btn-mint'}`} disabled={saving || (!deleting && (loading || !!groupError || !groups.length))} aria-busy={saving}>{saving ? 'Đang xử lý...' : deleting ? 'Xóa nhà cung cấp' : 'Lưu nhà cung cấp'}</button>}
        </footer>
      </form>
    </section>
  </dialog>;
}

export const SuppliersView = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const [suppliers, setSuppliers] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [modal, setModal] = useState(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    listSuppliers().then(data => { if (!cancelled) setSuppliers(Array.isArray(data) ? data : []); })
      .catch(error => { if (!cancelled) setError(message(error)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);
  useEffect(() => {
    // Trợ lý AI vừa sửa/tạo nhà cung cấp trong DB → tải lại bảng ngay lập tức.
    const handleAiAction = event => {
      const action = event.detail;
      if (action && (action.executed || action.uiCommand === 'REFRESH_DATA')) setRevision(value => value + 1);
    };
    window.addEventListener('farmshift:ai-action', handleAiAction);
    return () => window.removeEventListener('farmshift:ai-action', handleAiAction);
  }, []);
  const filtered = suppliers.filter(supplier => [supplier.name, supplier.representative, supplier.phone, supplier.productTypeName].some(value => value?.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))));
  return <div className={`farmshift-card ${styles.card}`}>
    <div className={styles.toolbar}><div className={styles.heading}><span className={styles.headingIcon}><Truck size={21} /></span><div><h2>Nhà cung cấp</h2><p>Quản lý đối tác và nhóm cung cấp hàng hóa</p></div></div>{canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => setModal({ mode: 'create' })}><Plus size={16} />Thêm nhà cung cấp</button>}</div>
    <div className={styles.searchRow}><div className={styles.search}><Search size={17} /><input aria-label="Tìm nhà cung cấp" placeholder="Tìm đơn vị, đại diện, số điện thoại, nhóm..." value={query} onChange={event => setQuery(event.target.value)} /></div>{!loading && !error && <span className={styles.total}>{filtered.length} nhà cung cấp</span>}</div>
    {error ? <div role="alert" className={styles.empty}><p>{error}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : <div className="farmshift-table-container" style={{ border: 0 }}><table className={`farmshift-table ${styles.table}`}>
      <thead><tr><th>Đơn vị cung cấp</th><th>Người đại diện</th><th>Số điện thoại</th><th>Nhóm nhà cung cấp</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={6} className={styles.empty} role="status">Đang tải nhà cung cấp...</td></tr> : !filtered.length ? <tr><td colSpan={6} className={styles.empty}>{query ? 'Không tìm thấy nhà cung cấp phù hợp.' : 'Chưa có nhà cung cấp. Thêm đối tác đầu tiên để bắt đầu.'}</td></tr> : filtered.map(supplier => <tr key={supplier.id}>
        <td><strong>{supplier.name}</strong></td><td>{supplier.representative}</td><td>{supplier.phone}</td><td>{supplier.productTypeName}</td><td className={styles.date}>{date(supplier.createdAt)}</td>
        <td><div className={styles.actions}><button type="button" className={styles.iconButton} aria-label={`Xem ${supplier.name}`} title="Xem chi tiết" onClick={() => setModal({ mode: 'view', supplier })}><Eye size={16} /></button>{canEdit && <><button type="button" className={styles.iconButton} aria-label={`Sửa ${supplier.name}`} title="Chỉnh sửa" onClick={() => setModal({ mode: 'edit', supplier })}><Pencil size={16} /></button><button type="button" className={`${styles.iconButton} ${styles.danger}`} aria-label={`Xóa ${supplier.name}`} title="Xóa" onClick={() => setModal({ mode: 'delete', supplier })}><Trash2 size={16} /></button></>}</div></td>
      </tr>)}</tbody>
    </table></div>}
    {modal && <SupplierDialog key={`${modal.mode}-${modal.supplier?.id || 'new'}`} {...modal} onClose={() => setModal(null)} onSaved={text => { setModal(null); showToast(text, 'success'); setRevision(value => value + 1); }} />}
  </div>;
};
