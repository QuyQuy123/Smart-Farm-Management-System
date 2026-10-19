import { useEffect, useRef, useState } from 'react';
import { Plus, Eye, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { createTransferCategory, updateTransferCategory, deleteTransferCategory, TRANSFER_TYPES } from '../../services/transferCategoryService';
import styles from './WarehouseCategoriesView.module.css';
const message = error => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
function CategoryDialog({ mode, item, onClose, onSaved }) {
  const ref = useRef(null);
  const [type, setType] = useState(TRANSFER_TYPES[item?.type] || item?.type || '');
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const viewing = mode === 'view', deleting = mode === 'delete';
  useEffect(() => {
    const element = ref.current, previous = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = previous; };
  }, []);
  async function submit(event) {
    event.preventDefault(); if (saving) return;
    if (!deleting && !type.trim()) { setError('Vui lòng nhập loại phiếu.'); return; }
    if (!deleting && !name.trim()) { setError('Vui lòng nhập tên danh mục.'); return; }
    setSaving(true); setError('');
    try {
      if (deleting) await deleteTransferCategory(item.id);
      else if (mode === 'edit') await updateTransferCategory(item.id, { type: type.trim(), name: name.trim(), description: description.trim() });
      else await createTransferCategory({ type: type.trim(), name: name.trim(), description: description.trim() });
      onSaved(deleting ? 'Đã xóa danh mục phiếu.' : 'Đã lưu danh mục phiếu.');
    } catch (error) { setError(message(error)); setSaving(false); }
  }
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="transfer-category-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className={styles.modal}>
      <header className={styles.modalHeader}><h2 id="transfer-category-title">{({ create: 'Thêm danh mục phiếu', edit: 'Chỉnh sửa danh mục phiếu', view: 'Chi tiết danh mục phiếu', delete: 'Xóa danh mục phiếu' })[mode]}</h2><button type="button" className={styles.iconButton} aria-label="Đóng" disabled={saving} onClick={onClose}><X size={20} /></button></header>
      <form onSubmit={submit}><div className={styles.modalBody}>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {deleting ? <p>Bạn muốn xóa danh mục <strong>{item.name}</strong>?</p> : <>
          <div className="farmshift-form-group"><label htmlFor="transfer-category-type">Loại phiếu <span className={styles.required}>*</span></label>
            <input id="transfer-category-type" className="farmshift-form-control" placeholder="Nhập loại phiếu" maxLength={150} required value={type} onChange={event => setType(event.target.value)} readOnly={viewing} disabled={saving} /></div>
          <div className="farmshift-form-group"><label htmlFor="transfer-category-name">Tên danh mục <span className={styles.required}>*</span></label><input id="transfer-category-name" className="farmshift-form-control" placeholder="Nhập tên danh mục" maxLength={150} required value={name} onChange={event => setName(event.target.value)} readOnly={viewing} disabled={saving} /></div>
          <div className="farmshift-form-group"><label htmlFor="transfer-category-description">Mô tả</label><textarea id="transfer-category-description" className="farmshift-form-control" placeholder="Nhập mô tả danh mục" rows={3} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} readOnly={viewing} disabled={saving} /></div>
          {viewing && <p>Số phiếu: {item.slipCount} · Ngày tạo: {new Date(item.createdAt).toLocaleDateString('vi-VN')}</p>}
        </>}
      </div><footer className={styles.footer}><button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={saving} onClick={onClose}>{viewing ? 'Đóng' : 'Hủy bỏ'}</button>{!viewing && <button type="submit" className={`farmshift-btn ${deleting ? styles.deleteButton : 'farmshift-btn-mint'}`} disabled={saving}>{saving ? 'Đang lưu...' : deleting ? 'Xóa danh mục' : 'Lưu danh mục'}</button>}</footer></form>
    </section>
  </dialog>;
}
export function TransferCategoriesView({ categories, loading, error, onReload }) {
  const { user } = useAuth(), { showToast } = useNotification();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const [modal, setModal] = useState(null);
  return <div className={`farmshift-card ${styles.card}`}>
    <div className={styles.toolbar}><span className={styles.total}>{categories.length} danh mục</span>{canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => setModal({ mode: 'create' })}><Plus size={16} />Thêm danh mục</button>}</div>
    {error ? <div role="alert" className={styles.empty}>{error}<button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onReload}>Thử lại</button></div> : <div className="farmshift-table-container"><table className={`farmshift-table ${styles.table}`}><thead><tr><th>Loại phiếu</th><th>Tên danh mục</th><th>Mô tả</th><th>Số phiếu</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={6} className={styles.empty} role="status">Đang tải danh mục...</td></tr> : !categories.length ? <tr><td colSpan={6} className={styles.empty}>Chưa có danh mục phiếu.</td></tr> : categories.map(item => <tr key={item.id}><td>{TRANSFER_TYPES[item.type] || item.type}</td><td><strong>{item.name}</strong></td><td className={styles.description}>{item.description || '—'}</td><td>{item.slipCount}</td><td>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td><td><div className={styles.actions}><button type="button" className={styles.iconButton} aria-label={`Xem ${item.name}`} onClick={() => setModal({ mode: 'view', item })}><Eye size={16} /></button>{canEdit && <><button type="button" className={styles.iconButton} aria-label={`Sửa ${item.name}`} onClick={() => setModal({ mode: 'edit', item })}><Pencil size={16} /></button><button type="button" className={`${styles.iconButton} ${styles.danger}`} aria-label={`Xóa ${item.name}`} onClick={() => setModal({ mode: 'delete', item })}><Trash2 size={16} /></button></>}</div></td></tr>)}
    </tbody></table></div>}
    {modal && <CategoryDialog {...modal} onClose={() => setModal(null)} onSaved={text => { setModal(null); showToast(text, 'success'); onReload(); }} />}
  </div>;
}
