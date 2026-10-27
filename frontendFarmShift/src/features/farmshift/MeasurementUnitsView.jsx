import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, X, Scale, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listMeasurementUnits, createMeasurementUnit, updateMeasurementUnit, deleteMeasurementUnit } from '../../services/measurementUnitService';
import { USAGE_UNITS, contentText } from './farmAreaOptions';
import styles from './WarehouseCategoriesView.module.css';

const formatDate = value => value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '—';
const errorMessage = error => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';

function CategoryDialog({ mode, category, onClose, onSaved, canEdit }) {
  const dialog = useRef(null);
  const [name, setName] = useState(category?.name || '');
  const [code, setCode] = useState(category?.code || '');
  const [description, setDescription] = useState(category?.description || '');
  const [contentQuantity, setContentQuantity] = useState(category?.contentQuantity == null ? '' : String(category.contentQuantity));
  const [contentUnit, setContentUnit] = useState(category?.contentUnit || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const readOnly = mode === 'view';
  const deleting = mode === 'delete';
  const title = { create: 'Thêm đơn vị tính', edit: 'Chỉnh sửa đơn vị tính', view: 'Chi tiết đơn vị tính', delete: 'Xóa đơn vị tính' }[mode];

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
    if (!deleting && !code.trim()) { setError('Vui lòng nhập mã đơn vị.'); return; }
    if (!deleting && !name.trim()) { setError('Vui lòng nhập tên đơn vị tính.'); return; }
    if (!deleting && (contentQuantity === '') !== (contentUnit === '')) { setError('Quy cách cần nhập cả số lượng và đơn vị (ví dụ 25 kg).'); return; }
    if (!deleting && contentQuantity !== '' && !(Number(contentQuantity) > 0)) { setError('Quy cách phải lớn hơn 0.'); return; }
    const body = { code: code.trim(), name: name.trim(), description: description.trim(),
      contentQuantity: contentQuantity === '' ? null : Number(contentQuantity), contentUnit: contentUnit || null };
    setSaving(true);
    setError('');
    try {
      if (deleting) await deleteMeasurementUnit(category.id);
      else if (mode === 'edit') await updateMeasurementUnit(category.id, body);
      else await createMeasurementUnit(body);
      onSaved(deleting ? 'Đã xóa đơn vị tính.' : 'Đã lưu đơn vị tính thành công.');
    } catch (error) { setError(errorMessage(error)); setSaving(false); }
  };

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="measurement-unit-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className={styles.modal}>
      <header className={styles.modalHeader}>
        <h2 id="measurement-unit-title">{title}</h2>
        <button type="button" className={styles.iconButton} onClick={onClose} disabled={saving} aria-label="Đóng"><X size={20} /></button>
      </header>
      <form onSubmit={submit}>
        <div className={styles.modalBody}>
          {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
          {deleting ? <p>Bạn muốn xóa đơn vị <strong>{category.name}</strong> ({category.code})? Thao tác này không thể hoàn tác.</p> : <>
            {category && <div className={styles.metadata}><span>{category.code}</span><span>{category.itemCount} hàng hóa · {formatDate(category.createdAt)}</span></div>}
            <label htmlFor="measurement-unit-code">Mã đơn vị {!readOnly && <span className={styles.required}>*</span>}</label>
            <input id="measurement-unit-code" className="farmshift-form-control" placeholder="Ví dụ: KG" value={code} onChange={event => setCode(event.target.value)} required maxLength={30} readOnly={readOnly} disabled={saving} />
            <label htmlFor="measurement-unit-name">Tên đơn vị {!readOnly && <span className={styles.required}>*</span>}</label>
            <input id="measurement-unit-name" className="farmshift-form-control" placeholder="Ví dụ: Kilôgam" value={name} onChange={event => setName(event.target.value)} required maxLength={150} readOnly={readOnly} disabled={saving} />
            <label htmlFor="measurement-unit-content">Quy cách: 1 {name.trim() || 'đơn vị'} chứa</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
              <input id="measurement-unit-content" className="farmshift-form-control" type="number" min="0" step="0.001" inputMode="decimal"
                placeholder="Ví dụ: 25" value={contentQuantity} onChange={event => setContentQuantity(event.target.value)} readOnly={readOnly} disabled={saving} />
              <select aria-label="Đơn vị quy cách" className="farmshift-form-control" value={contentUnit} onChange={event => setContentUnit(event.target.value)}
                disabled={readOnly || saving}>
                <option value="">—</option>
                {USAGE_UNITS.map(unit => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
              </select>
            </div>
            <small style={{ display: 'block', margin: '-4px 0 12px', color: '#607781', fontSize: 13.5 }}>
              Dùng để quy đổi định mức chương trình nuôi sang tồn kho, ví dụ Bao 25kg = 25 kg, Lọ 1000 liều = 1000 liều.</small>
            <label htmlFor="measurement-unit-description">Mô tả</label>
            <textarea id="measurement-unit-description" className="farmshift-form-control" rows={4} placeholder="Nhập mô tả đơn vị tính" value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} readOnly={readOnly} disabled={saving} />
          </>}
        </div>
        <footer className={styles.footer}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>{readOnly ? 'Đóng' : 'Hủy bỏ'}</button>
          {!readOnly && canEdit && <button type="submit" className={`farmshift-btn ${deleting ? styles.deleteButton : 'farmshift-btn-mint'}`} disabled={saving} aria-busy={saving}>{saving ? 'Đang xử lý...' : deleting ? 'Xóa đơn vị' : 'Lưu đơn vị'}</button>}
        </footer>
      </form>
    </section>
  </dialog>;
}

export const MeasurementUnitsView = () => {
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
    listMeasurementUnits().then(data => { if (!cancelled) setCategories(Array.isArray(data) ? data : []); })
      .catch(error => { if (!cancelled) setError(errorMessage(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  const needle = query.trim().toLocaleLowerCase('vi');
  const safeCategories = Array.isArray(categories) ? categories : [];
  const filtered = safeCategories.filter(category => [category.code, category.name, category.description].some(value => value?.toLocaleLowerCase('vi').includes(needle)));
  const open = (mode, category) => { setModal({ mode, category }); };

  return <div className={`farmshift-card ${styles.card}`}>
    <div className={styles.toolbar}>
      <div className={styles.heading}><span className={styles.headingIcon}><Scale size={21} /></span><div><h2>Đơn vị tính</h2><p>Quản lý mã và đơn vị đo lường hàng hóa</p></div></div>
      {canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => open('create')}><Plus size={16} />Thêm đơn vị tính</button>}
    </div>
    <div className={styles.searchRow}>
      <div className={styles.search}><Search size={17} /><input aria-label="Tìm đơn vị tính" placeholder="Tìm theo mã, tên hoặc mô tả..." value={query} onChange={event => setQuery(event.target.value)} /></div>
      {!loading && !error && <span className={styles.total}>{filtered.length} đơn vị</span>}
    </div>
    {error ? <div role="alert" className={styles.empty}><p>{error}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> :
      <div className="farmshift-table-container" style={{ border: 0 }}>
        <table className={`farmshift-table ${styles.table}`}>
          <thead><tr><th>Mã đơn vị</th><th>Tên đơn vị</th><th>Quy cách</th><th>Mô tả</th><th>Số lượng hàng hóa</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className={styles.empty} role="status">Đang tải đơn vị tính...</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className={styles.empty}>{query ? 'Không tìm thấy đơn vị phù hợp.' : 'Chưa có đơn vị tính. Thêm đơn vị đầu tiên để bắt đầu.'}</td></tr> :
              filtered.map(category => <tr key={category.id}>
                <td><span className={styles.code}>{category.code}</span></td><td><strong>{category.name}</strong></td>
                <td>{contentText(category.contentQuantity, category.contentUnit) || '—'}</td><td className={styles.description}>{category.description || '—'}</td>
                <td><span className={styles.count}>{category.itemCount}</span></td><td className={styles.date}>{formatDate(category.createdAt)}</td>
                <td><div className={styles.actions}>
                  <button type="button" className={styles.iconButton} onClick={() => open('view', category)} aria-label={`Xem ${category.name}`} title="Xem chi tiết"><Eye size={16} /></button>
                  {canEdit && <><button type="button" className={styles.iconButton} onClick={() => open('edit', category)} aria-label={`Sửa ${category.name}`} title="Chỉnh sửa"><Pencil size={16} /></button>
                    <button type="button" className={`${styles.iconButton} ${styles.danger}`} onClick={() => open('delete', category)} aria-label={`Xóa ${category.name}`} title="Xóa đơn vị"><Trash2 size={16} /></button></>}
                </div></td>
              </tr>)}
          </tbody>
        </table>
      </div>}
    {modal && <CategoryDialog key={`${modal.mode}-${modal.category?.id || 'new'}`} {...modal} canEdit={canEdit} onClose={() => setModal(null)} onSaved={message => { setModal(null); showToast(message, 'success'); setRevision(value => value + 1); }} />}
  </div>;
};
