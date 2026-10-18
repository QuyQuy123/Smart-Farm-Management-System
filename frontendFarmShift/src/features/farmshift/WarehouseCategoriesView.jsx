import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, X, Warehouse, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listWarehouseCategories, createWarehouseCategory, updateWarehouseCategory, deleteWarehouseCategory } from '../../services/warehouseCategoryService';
import styles from './WarehouseCategoriesView.module.css';

const formatDate = value => value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '—';
const errorMessage = error => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';

function CategoryDialog({ mode, category, onClose, onSaved, canEdit }) {
  const dialog = useRef(null);
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const readOnly = mode === 'view';
  const deleting = mode === 'delete';
  const title = { create: 'Thêm danh mục kho', edit: 'Chỉnh sửa danh mục kho', view: 'Chi tiết danh mục kho', delete: 'Xóa danh mục kho' }[mode];

  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    if (!deleting && !name.trim()) { setError('Vui lòng nhập tên danh mục kho.'); return; }
    setSaving(true);
    setError('');
    try {
      if (deleting) await deleteWarehouseCategory(category.id);
      else if (mode === 'edit') await updateWarehouseCategory(category.id, { name: name.trim(), description: description.trim() });
      else await createWarehouseCategory({ name: name.trim(), description: description.trim() });
      onSaved(deleting ? 'Đã xóa danh mục kho.' : 'Đã lưu danh mục kho thành công.');
    } catch (error) { setError(errorMessage(error)); setSaving(false); }
  };

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="warehouse-category-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className={styles.modal}>
      <header className={styles.modalHeader}>
        <h2 id="warehouse-category-title">{title}</h2>
        <button type="button" className={styles.iconButton} onClick={onClose} disabled={saving} aria-label="Đóng"><X size={20} /></button>
      </header>
      <form onSubmit={submit}>
        <div className={styles.modalBody}>
          {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
          {deleting ? <p>Bạn muốn xóa danh mục <strong>{category.name}</strong> ({category.code})? Thao tác này không thể hoàn tác.</p> : <>
            {category && <div className={styles.metadata}><span>{category.code}</span><span>{category.itemCount} hàng hóa · {formatDate(category.createdAt)}</span></div>}
            <label htmlFor="warehouse-category-name">Tên danh mục {!readOnly && <span className={styles.required}>*</span>}</label>
            <input id="warehouse-category-name" className="farmshift-form-control" placeholder="Ví dụ: Kho cám" value={name} onChange={event => setName(event.target.value)} required maxLength={150} readOnly={readOnly} disabled={saving} />
            <label htmlFor="warehouse-category-description">Mô tả</label>
            <textarea id="warehouse-category-description" className="farmshift-form-control" rows={4} placeholder="Nhập mô tả danh mục kho" value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} readOnly={readOnly} disabled={saving} />
          </>}
        </div>
        <footer className={styles.footer}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>{readOnly ? 'Đóng' : 'Hủy bỏ'}</button>
          {!readOnly && canEdit && <button type="submit" className={`farmshift-btn ${deleting ? styles.deleteButton : 'farmshift-btn-mint'}`} disabled={saving} aria-busy={saving}>{saving ? 'Đang xử lý...' : deleting ? 'Xóa danh mục' : 'Lưu danh mục'}</button>}
        </footer>
      </form>
    </section>
  </dialog>;
}

export const WarehouseCategoriesView = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listWarehouseCategories().then(data => { if (!cancelled) setCategories(data); })
      .catch(error => { if (!cancelled) setError(errorMessage(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  const needle = query.trim().toLocaleLowerCase('vi');
  const filtered = categories.filter(category => [category.code, category.name, category.description].some(value => value?.toLocaleLowerCase('vi').includes(needle)));
  const open = (mode, category) => { setModal({ mode, category }); };

  return <div className={`farmshift-card ${styles.card}`}>
    <div className={styles.toolbar}>
      <div className={styles.heading}><span className={styles.headingIcon}><Warehouse size={21} /></span><div><h2>Danh mục kho</h2><p>Quản lý các nhóm lưu trữ hàng hóa</p></div></div>
      {canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => open('create')}><Plus size={16} />Thêm danh mục kho</button>}
    </div>
    <div className={styles.searchRow}>
      <div className={styles.search}><Search size={17} /><input aria-label="Tìm danh mục kho" placeholder="Tìm theo mã, tên hoặc mô tả..." value={query} onChange={event => setQuery(event.target.value)} /></div>
      {!loading && !error && <span className={styles.total}>{filtered.length} danh mục</span>}
    </div>
    {error ? <div role="alert" className={styles.empty}><p>{error}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> :
      <div className="farmshift-table-container" style={{ border: 0 }}>
        <table className={`farmshift-table ${styles.table}`}>
          <thead><tr><th>Mã danh mục</th><th>Tên danh mục</th><th>Mô tả</th><th>SL hàng hóa</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className={styles.empty} role="status">Đang tải danh mục kho...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className={styles.empty}>{query ? 'Không tìm thấy danh mục phù hợp.' : 'Chưa có danh mục kho. Thêm danh mục đầu tiên để bắt đầu.'}</td></tr> :
              filtered.map(category => <tr key={category.id}>
                <td><span className={styles.code}>{category.code}</span></td><td><strong>{category.name}</strong></td><td className={styles.description}>{category.description || '—'}</td>
                <td><span className={styles.count}>{category.itemCount}</span></td><td className={styles.date}>{formatDate(category.createdAt)}</td>
                <td><div className={styles.actions}>
                  <button type="button" className={styles.iconButton} onClick={() => open('view', category)} aria-label={`Xem ${category.name}`} title="Xem chi tiết"><Eye size={16} /></button>
                  {canEdit && <><button type="button" className={styles.iconButton} onClick={() => open('edit', category)} aria-label={`Sửa ${category.name}`} title="Chỉnh sửa"><Pencil size={16} /></button>
                    <button type="button" className={`${styles.iconButton} ${styles.danger}`} onClick={() => open('delete', category)} aria-label={`Xóa ${category.name}`} title="Xóa danh mục"><Trash2 size={16} /></button></>}
                </div></td>
              </tr>)}
          </tbody>
        </table>
      </div>}
    {modal && <CategoryDialog key={`${modal.mode}-${modal.category?.id || 'new'}`} {...modal} canEdit={canEdit} onClose={() => setModal(null)} onSaved={message => { setModal(null); showToast(message, 'success'); setRevision(value => value + 1); }} />}
  </div>;
};
