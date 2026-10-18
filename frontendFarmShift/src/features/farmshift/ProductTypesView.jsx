import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, X, Layers, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listProductTypes, createProductType, updateProductType, deleteProductType } from '../../services/productTypeService';
import styles from './WarehouseCategoriesView.module.css';

const formatDate = value => value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '—';
const errorMessage = error => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';

function ProductTypeDialog({ mode, item, onClose, onSaved, canEdit }) {
  const dialog = useRef(null);
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [quantity, setQuantity] = useState(item?.quantity !== undefined && item?.quantity !== null ? String(item.quantity) : '0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const readOnly = mode === 'view';
  const deleting = mode === 'delete';
  const title = {
    create: 'Thêm loại hàng hóa',
    edit: 'Chỉnh sửa loại hàng hóa',
    view: 'Chi tiết loại hàng hóa',
    delete: 'Xóa loại hàng hóa'
  }[mode];

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
    if (!deleting && !name.trim()) {
      setError('Vui lòng nhập tên loại hàng.');
      return;
    }
    const parsedQuantity = mode === 'create' ? 0 : parseInt(quantity, 10);
    if (!deleting && mode !== 'create' && (isNaN(parsedQuantity) || parsedQuantity < 0)) {
      setError('Số lượng phải là số nguyên không âm.');
      return;
    }

    setSaving(true);
    setError('');
    const payload = {
      name: name.trim(),
      description: description.trim(),
      quantity: mode === 'create' ? 0 : (isNaN(parsedQuantity) ? 0 : parsedQuantity)
    };

    try {
      if (deleting) await deleteProductType(item.id);
      else if (mode === 'edit') await updateProductType(item.id, payload);
      else await createProductType(payload);
      onSaved(deleting ? 'Đã xóa loại hàng hóa.' : 'Đã lưu loại hàng hóa thành công.');
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="product-type-modal-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className={styles.modal}>
        <header className={styles.modalHeader}>
          <h2 id="product-type-modal-title">{title}</h2>
          <button type="button" className={styles.iconButton} onClick={onClose} disabled={saving} aria-label="Đóng"><X size={20} /></button>
        </header>
        <form onSubmit={submit}>
          <div className={styles.modalBody}>
            {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
            {deleting ? (
              <p>Bạn muốn xóa loại hàng <strong>{item.name}</strong>? Thao tác này không thể hoàn tác.</p>
            ) : (
              <>
                <label htmlFor="product-type-name">Tên loại hàng {!readOnly && <span className={styles.required}>*</span>}</label>
                <input
                  id="product-type-name"
                  className="farmshift-form-control"
                  placeholder="Ví dụ: Thức ăn chăn nuôi, Thuốc thú y..."
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                  maxLength={150}
                  readOnly={readOnly}
                  disabled={saving}
                />

                {mode !== 'create' && (
                  <>
                    <label htmlFor="product-type-quantity">Số lượng</label>
                    <input
                      id="product-type-quantity"
                      type="number"
                      min="0"
                      className="farmshift-form-control"
                      placeholder="0"
                      value={quantity}
                      onChange={event => setQuantity(event.target.value)}
                      readOnly={readOnly}
                      disabled={saving}
                    />
                  </>
                )}

                <label htmlFor="product-type-description">Mô tả</label>
                <textarea
                  id="product-type-description"
                  className="farmshift-form-control"
                  rows={3}
                  placeholder="Nhập mô tả loại hàng hóa"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  maxLength={1000}
                  readOnly={readOnly}
                  disabled={saving}
                />
              </>
            )}
          </div>
          <footer className={styles.footer}>
            <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>
              {readOnly ? 'Đóng' : 'Hủy bỏ'}
            </button>
            {!readOnly && canEdit && (
              <button
                type="submit"
                className={`farmshift-btn ${deleting ? styles.deleteButton : 'farmshift-btn-mint'}`}
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? 'Đang xử lý...' : deleting ? 'Xóa loại hàng' : 'Lưu loại hàng'}
              </button>
            )}
          </footer>
        </form>
      </section>
    </dialog>
  );
}

export const ProductTypesView = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listProductTypes()
      .then(data => { if (!cancelled) setTypes(Array.isArray(data) ? data : []); })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  const needle = query.trim().toLocaleLowerCase('vi');
  const safeTypes = Array.isArray(types) ? types : [];
  const filtered = safeTypes.filter(t =>
    [t.name, t.description].some(val => val?.toLocaleLowerCase('vi').includes(needle))
  );

  const open = (mode, item) => { setModal({ mode, item }); };

  return (
    <div className={`farmshift-card ${styles.card}`}>
      <div className={styles.toolbar}>
        <div className={styles.heading}>
          <span className={styles.headingIcon}><Layers size={21} /></span>
          <div>
            <h2>Loại hàng hóa</h2>
            <p>Quản lý các nhóm và loại hình hàng hóa</p>
          </div>
        </div>
        {canEdit && (
          <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => open('create')}>
            <Plus size={16} />Thêm loại hàng hóa
          </button>
        )}
      </div>

      <div className={styles.searchRow}>
        <div className={styles.search}>
          <Search size={17} />
          <input
            aria-label="Tìm loại hàng hóa"
            placeholder="Tìm theo tên hoặc mô tả..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        {!loading && !error && <span className={styles.total}>{filtered.length} loại hàng</span>}
      </div>

      {error ? (
        <div role="alert" className={styles.empty}>
          <p>{error}</p>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(v => v + 1)}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="farmshift-table-container" style={{ border: 0 }}>
          <table className={`farmshift-table ${styles.table}`}>
            <thead>
              <tr>
                <th>Tên loại hàng</th>
                <th>Mô tả</th>
                <th>Số lượng</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className={styles.empty} role="status">Đang tải danh sách loại hàng hóa...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    {query ? 'Không tìm thấy loại hàng phù hợp.' : 'Chưa có loại hàng hóa nào. Thêm loại hàng đầu tiên để bắt đầu.'}
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td className={styles.description}>{item.description || '—'}</td>
                    <td><span className={styles.count}>{item.quantity ?? 0}</span></td>
                    <td className={styles.date}>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => open('view', item)}
                          aria-label={`Xem ${item.name}`}
                          title="Xem chi tiết"
                        >
                          <Eye size={16} />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => open('edit', item)}
                              aria-label={`Sửa ${item.name}`}
                              title="Chỉnh sửa"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconButton} ${styles.danger}`}
                              onClick={() => open('delete', item)}
                              aria-label={`Xóa ${item.name}`}
                              title="Xóa loại hàng"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ProductTypeDialog
          key={`${modal.mode}-${modal.item?.id || 'new'}`}
          {...modal}
          canEdit={canEdit}
          onClose={() => setModal(null)}
          onSaved={message => {
            setModal(null);
            showToast(message, 'success');
            setRevision(v => v + 1);
          }}
        />
      )}
    </div>
  );
};
