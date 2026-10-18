import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, X, Tag, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listBrands, createBrand, updateBrand, deleteBrand } from '../../services/brandService';
import { listProductTypes } from '../../services/productTypeService';
import styles from './WarehouseCategoriesView.module.css';

const errorMessage = error => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';

function BrandDialog({ mode, brand, onClose, onSaved, canEdit }) {
  const dialog = useRef(null);
  const [name, setName] = useState(brand?.name || '');
  const [productType, setProductType] = useState(brand?.productType || '');
  const [quantity, setQuantity] = useState(brand?.quantity !== undefined && brand?.quantity !== null ? String(brand.quantity) : '0');
  const [note, setNote] = useState(brand?.note || '');
  const [productTypes, setProductTypes] = useState([]);
  const [loadingProductTypes, setLoadingProductTypes] = useState(!['view', 'delete'].includes(mode));
  const [productTypeError, setProductTypeError] = useState('');
  const [productTypeRevision, setProductTypeRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const readOnly = mode === 'view';
  const deleting = mode === 'delete';
  const title = { create: 'Thêm nhãn hiệu', edit: 'Chỉnh sửa nhãn hiệu', view: 'Chi tiết nhãn hiệu', delete: 'Xóa nhãn hiệu' }[mode];

  useEffect(() => {
    if (readOnly || deleting) return;
    let cancelled = false;
    setLoadingProductTypes(true);
    setProductTypeError('');
    listProductTypes()
      .then(data => { if (!cancelled) setProductTypes(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setProductTypeError('Không tải được danh sách loại hàng hóa.'); })
      .finally(() => { if (!cancelled) setLoadingProductTypes(false); });
    return () => { cancelled = true; };
  }, [readOnly, deleting, productTypeRevision]);

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
      setError('Vui lòng nhập tên nhãn hiệu.');
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
      productType: productType.trim(),
      quantity: mode === 'create' ? 0 : (isNaN(parsedQuantity) ? 0 : parsedQuantity),
      note: note.trim()
    };

    try {
      if (deleting) await deleteBrand(brand.id);
      else if (mode === 'edit') await updateBrand(brand.id, payload);
      else await createBrand(payload);
      onSaved(deleting ? 'Đã xóa nhãn hiệu.' : 'Đã lưu nhãn hiệu thành công.');
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="brand-modal-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className={`${styles.modal} ${styles.modalWide}`}>
        <header className={styles.modalHeader}>
          <h2 id="brand-modal-title">{title}</h2>
          <button type="button" className={styles.iconButton} onClick={onClose} disabled={saving} aria-label="Đóng"><X size={20} /></button>
        </header>
        <form onSubmit={submit}>
          <div className={styles.modalBody}>
            {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
            {deleting ? (
              <p>Bạn muốn xóa nhãn hiệu <strong>{brand.name}</strong>? Thao tác này không thể hoàn tác.</p>
            ) : (
              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label htmlFor="brand-name">Tên nhãn hiệu {!readOnly && <span className={styles.required}>*</span>}</label>
                  <input
                    id="brand-name"
                    className="farmshift-form-control"
                    placeholder="Ví dụ: Tập đoàn Dabaco, C.P. Group..."
                    value={name}
                    onChange={event => setName(event.target.value)}
                    required
                    maxLength={150}
                    readOnly={readOnly}
                    disabled={saving}
                  />
                </div>

                <div className={styles.formField}>
                  <label htmlFor="brand-product-type">Loại hàng hóa</label>
                  {readOnly ? (
                    <input
                      id="brand-product-type"
                      className="farmshift-form-control"
                      value={productType || 'Chưa chọn loại hàng'}
                      readOnly
                    />
                  ) : (
                    <>
                      <select
                        id="brand-product-type"
                        className="farmshift-form-control"
                        value={productType}
                        onChange={event => setProductType(event.target.value)}
                        disabled={saving || loadingProductTypes || !!productTypeError}
                      >
                        <option value="">{loadingProductTypes ? 'Đang tải loại hàng hóa...' : 'Chọn loại hàng hóa'}</option>
                        {productType && !productTypes.some(pt => pt.name === productType) && (
                          <option value={productType}>{productType}</option>
                        )}
                        {productTypes.map(pt => (
                          <option key={pt.id} value={pt.name}>
                            {pt.name}
                          </option>
                        ))}
                      </select>
                      {productTypeError && (
                        <p role="alert" className={styles.error} style={{ marginTop: '6px' }}>
                          {productTypeError} <button type="button" onClick={() => setProductTypeRevision(v => v + 1)}>Thử lại</button>
                        </p>
                      )}
                      {!loadingProductTypes && !productTypeError && !productTypes.length && (
                        <p className={styles.error} style={{ marginTop: '6px' }}>
                          Chưa có loại hàng hóa. Vui lòng thêm trong tab Loại hàng hóa trước.
                        </p>
                      )}
                    </>
                  )}
                </div>

                {mode !== 'create' && (
                  <div className={`${styles.formField} ${styles.fullWidth}`}>
                    <label htmlFor="brand-quantity">Số lượng</label>
                    <input
                      id="brand-quantity"
                      type="number"
                      min="0"
                      className="farmshift-form-control"
                      placeholder="0"
                      value={quantity}
                      onChange={event => setQuantity(event.target.value)}
                      readOnly={readOnly}
                      disabled={saving}
                    />
                  </div>
                )}

                <div className={`${styles.formField} ${styles.fullWidth}`}>
                  <label htmlFor="brand-note">Ghi chú</label>
                  <textarea
                    id="brand-note"
                    className="farmshift-form-control"
                    rows={2}
                    placeholder="Nhập ghi chú nhãn hiệu"
                    value={note}
                    onChange={event => setNote(event.target.value)}
                    maxLength={1000}
                    readOnly={readOnly}
                    disabled={saving}
                  />
                </div>
              </div>
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
                disabled={saving || (!deleting && loadingProductTypes)}
                aria-busy={saving}
              >
                {saving ? 'Đang xử lý...' : deleting ? 'Xóa nhãn hiệu' : 'Lưu nhãn hiệu'}
              </button>
            )}
          </footer>
        </form>
      </section>
    </dialog>
  );
}

export const BrandsView = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listBrands()
      .then(data => { if (!cancelled) setBrands(Array.isArray(data) ? data : []); })
      .catch(err => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  const needle = query.trim().toLocaleLowerCase('vi');
  const safeBrands = Array.isArray(brands) ? brands : [];
  const filtered = safeBrands.filter(b =>
    [b.name, b.productType, b.note].some(val => val?.toLocaleLowerCase('vi').includes(needle))
  );

  const open = (mode, brand) => { setModal({ mode, brand }); };

  return (
    <div className={`farmshift-card ${styles.card}`}>
      <div className={styles.toolbar}>
        <div className={styles.heading}>
          <span className={styles.headingIcon}><Tag size={21} /></span>
          <div>
            <h2>Nhãn hiệu</h2>
            <p>Quản lý các thương hiệu và nhãn hiệu đối tác</p>
          </div>
        </div>
        {canEdit && (
          <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => open('create')}>
            <Plus size={16} />Thêm nhãn hiệu
          </button>
        )}
      </div>

      <div className={styles.searchRow}>
        <div className={styles.search}>
          <Search size={17} />
          <input
            aria-label="Tìm nhãn hiệu"
            placeholder="Tìm theo tên, loại hàng hóa hoặc ghi chú..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        {!loading && !error && <span className={styles.total}>{filtered.length} nhãn hiệu</span>}
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
                <th>Tên nhãn hiệu</th>
                <th>Loại hàng hóa</th>
                <th>Số lượng</th>
                <th>Ghi chú</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className={styles.empty} role="status">Đang tải danh sách nhãn hiệu...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    {query ? 'Không tìm thấy nhãn hiệu phù hợp.' : 'Chưa có nhãn hiệu nào. Thêm nhãn hiệu đầu tiên để bắt đầu.'}
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.productType || '—'}</td>
                    <td><span className={styles.count}>{item.quantity ?? 0}</span></td>
                    <td className={styles.description}>{item.note || '—'}</td>
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
                              title="Xóa nhãn hiệu"
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
        <BrandDialog
          key={`${modal.mode}-${modal.brand?.id || 'new'}`}
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
