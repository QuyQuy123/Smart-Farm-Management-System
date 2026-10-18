import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, X, Package, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listProductCategories, createProductCategory, updateProductCategory, deleteProductCategory } from '../../services/productCategoryService';
import styles from './WarehouseCategoriesView.module.css';
import { listWarehouseCategories } from '../../services/warehouseCategoryService';
import { listBrands } from '../../services/brandService';
import { listProductTypes } from '../../services/productTypeService';
import { listMeasurementUnits } from '../../services/measurementUnitService';

const errorMessage = error => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';

function CategoryDialog({ mode, category, onClose, onSaved, canEdit }) {
  const dialog = useRef(null);
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [specification, setSpecification] = useState(category?.specification || '');
  const [brand, setBrand] = useState(category?.brand || '');
  const [productType, setProductType] = useState(category?.productType || '');
  const [warehouseId, setWarehouseId] = useState(String(category?.warehouseId || ''));
  const [warehouses, setWarehouses] = useState([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(!['view', 'delete'].includes(mode));
  const [warehouseError, setWarehouseError] = useState('');
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(!['view', 'delete'].includes(mode));
  const [brandError, setBrandError] = useState('');
  const [productTypes, setProductTypes] = useState([]);
  const [loadingProductTypes, setLoadingProductTypes] = useState(!['view', 'delete'].includes(mode));
  const [productTypeError, setProductTypeError] = useState('');
  const [specifications, setSpecifications] = useState([]);
  const [loadingSpecifications, setLoadingSpecifications] = useState(!['view', 'delete'].includes(mode));
  const [specificationError, setSpecificationError] = useState('');
  const [metadataRevision, setMetadataRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const readOnly = mode === 'view';
  const deleting = mode === 'delete';
  const title = { create: 'Thêm tên hàng hóa', edit: 'Chỉnh sửa tên hàng hóa', view: 'Chi tiết tên hàng hóa', delete: 'Xóa tên hàng hóa' }[mode];

  useEffect(() => {
    if (readOnly || deleting) return;
    let cancelled = false;

    setLoadingWarehouses(true);
    setWarehouseError('');
    listWarehouseCategories()
      .then(data => { if (!cancelled) setWarehouses(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setWarehouseError('Không tải được danh sách kho.'); })
      .finally(() => { if (!cancelled) setLoadingWarehouses(false); });

    setLoadingBrands(true);
    setBrandError('');
    listBrands()
      .then(data => { if (!cancelled) setBrands(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setBrandError('Không tải được danh sách nhãn hiệu.'); })
      .finally(() => { if (!cancelled) setLoadingBrands(false); });

    setLoadingProductTypes(true);
    setProductTypeError('');
    listProductTypes()
      .then(data => { if (!cancelled) setProductTypes(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setProductTypeError('Không tải được danh sách loại hàng hóa.'); })
      .finally(() => { if (!cancelled) setLoadingProductTypes(false); });

    setLoadingSpecifications(true);
    setSpecificationError('');
    listMeasurementUnits()
      .then(data => { if (!cancelled) setSpecifications(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setSpecificationError('Không tải được danh sách đơn vị tính.'); })
      .finally(() => { if (!cancelled) setLoadingSpecifications(false); });

    return () => { cancelled = true; };
  }, [readOnly, deleting, metadataRevision]);

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
    if (!deleting && !name.trim()) { setError('Vui lòng nhập tên hàng hóa.'); return; }
    if (!deleting && (loadingWarehouses || warehouseError || !warehouses.some(warehouse => String(warehouse.id) === warehouseId))) {
      setError('Vui lòng chọn kho lưu trữ.'); return;
    }
    setSaving(true);
    setError('');
    const payload = { name: name.trim(), description: description.trim(), specification: specification.trim(), brand: brand.trim(), productType: productType.trim(), warehouseId: Number(warehouseId) };
    try {
      if (deleting) await deleteProductCategory(category.id);
      else if (mode === 'edit') await updateProductCategory(category.id, payload);
      else await createProductCategory(payload);
      onSaved(deleting ? 'Đã xóa tên hàng hóa.' : 'Đã lưu tên hàng hóa thành công.');
    } catch (error) { setError(errorMessage(error)); setSaving(false); }
  };

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="product-category-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className={`${styles.modal} ${styles.modalWide}`}>
      <header className={styles.modalHeader}>
        <h2 id="product-category-title">{title}</h2>
        <button type="button" className={styles.iconButton} onClick={onClose} disabled={saving} aria-label="Đóng"><X size={20} /></button>
      </header>
      <form onSubmit={submit}>
        <div className={styles.modalBody}>
          {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
          {deleting ? <p>Bạn muốn xóa tên hàng hóa <strong>{category.name}</strong>? Thao tác này không thể hoàn tác.</p> : (
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label htmlFor="product-category-warehouse">Kho lưu trữ {!readOnly && <span className={styles.required}>*</span>}</label>
                {readOnly ? <input id="product-category-warehouse" className="farmshift-form-control" value={category?.warehouseName || 'Chưa chọn kho'} readOnly /> : <>
                  <select id="product-category-warehouse" className="farmshift-form-control" value={warehouseId} onChange={event => setWarehouseId(event.target.value)} required disabled={saving || loadingWarehouses || !!warehouseError}>
                    <option value="">{loadingWarehouses ? 'Đang tải danh sách kho...' : 'Chọn kho lưu trữ'}</option>
                    {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}
                  </select>
                  {warehouseError && <p role="alert" className={styles.error} style={{ marginTop: '6px' }}>{warehouseError} <button type="button" onClick={() => setMetadataRevision(value => value + 1)}>Thử lại</button></p>}
                  {!loadingWarehouses && !warehouseError && !warehouses.length && <p className={styles.error} style={{ marginTop: '6px' }}>Chưa có kho. Vui lòng thêm kho trong tab Danh mục kho trước.</p>}
                </>}
              </div>

              <div className={styles.formField}>
                <label htmlFor="product-category-name">Tên hàng hóa {!readOnly && <span className={styles.required}>*</span>}</label>
                <input id="product-category-name" className="farmshift-form-control" placeholder="Ví dụ: Cám gà thịt, Thuốc thú y Hanvet..." value={name} onChange={event => setName(event.target.value)} required maxLength={150} readOnly={readOnly} disabled={saving} />
              </div>

              <div className={styles.formField}>
                <label htmlFor="product-category-specification">Đơn vị</label>
                {readOnly ? <input id="product-category-specification" className="farmshift-form-control" value={specification || '—'} readOnly /> : <>
                  <select
                    id="product-category-specification"
                    className="farmshift-form-control"
                    value={specification}
                    onChange={event => setSpecification(event.target.value)}
                    disabled={saving || loadingSpecifications || !!specificationError}
                  >
                    <option value="">{loadingSpecifications ? 'Đang tải danh sách đơn vị tính...' : 'Chọn đơn vị tính'}</option>
                    {specification && !specifications.some(s => s.name === specification) && (
                      <option value={specification}>{specification}</option>
                    )}
                    {specifications.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                  {specificationError && <p role="alert" className={styles.error} style={{ marginTop: '6px' }}>{specificationError} <button type="button" onClick={() => setMetadataRevision(value => value + 1)}>Thử lại</button></p>}
                </>}
              </div>

              <div className={styles.formField}>
                <label htmlFor="product-category-brand">Nhãn hiệu</label>
                {readOnly ? <input id="product-category-brand" className="farmshift-form-control" value={brand || '—'} readOnly /> : <>
                  <select
                    id="product-category-brand"
                    className="farmshift-form-control"
                    value={brand}
                    onChange={event => setBrand(event.target.value)}
                    disabled={saving || loadingBrands || !!brandError}
                  >
                    <option value="">{loadingBrands ? 'Đang tải danh sách nhãn hiệu...' : 'Chọn nhãn hiệu'}</option>
                    {brand && !brands.some(b => b.name === brand) && (
                      <option value={brand}>{brand}</option>
                    )}
                    {brands.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                  {brandError && <p role="alert" className={styles.error} style={{ marginTop: '6px' }}>{brandError} <button type="button" onClick={() => setMetadataRevision(value => value + 1)}>Thử lại</button></p>}
                </>}
              </div>

              <div className={`${styles.formField} ${styles.fullWidth}`}>
                <label htmlFor="product-category-product-type">Loại hàng hóa</label>
                {readOnly ? <input id="product-category-product-type" className="farmshift-form-control" value={productType || '—'} readOnly /> : <>
                  <select
                    id="product-category-product-type"
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
                      <option key={pt.id} value={pt.name}>{pt.name}</option>
                    ))}
                  </select>
                  {productTypeError && <p role="alert" className={styles.error} style={{ marginTop: '6px' }}>{productTypeError} <button type="button" onClick={() => setMetadataRevision(value => value + 1)}>Thử lại</button></p>}
                </>}
              </div>

              <div className={`${styles.formField} ${styles.fullWidth}`}>
                <label htmlFor="product-category-description">Mô tả</label>
                <textarea id="product-category-description" className="farmshift-form-control" rows={2} placeholder="Nhập mô tả tên hàng hóa" value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} readOnly={readOnly} disabled={saving} />
              </div>
            </div>
          )}
        </div>
        <footer className={styles.footer}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>{readOnly ? 'Đóng' : 'Hủy bỏ'}</button>
          {!readOnly && canEdit && <button type="submit" className={`farmshift-btn ${deleting ? styles.deleteButton : 'farmshift-btn-mint'}`} disabled={saving || (!deleting && (loadingWarehouses || !!warehouseError || !warehouses.length))} aria-busy={saving}>{saving ? 'Đang xử lý...' : deleting ? 'Xóa tên hàng hóa' : 'Lưu tên hàng hóa'}</button>}
        </footer>
      </form>
    </section>
  </dialog>;
}

export const ProductCategoriesView = () => {
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
    listProductCategories().then(data => { if (!cancelled) setCategories(Array.isArray(data) ? data : []); })
      .catch(error => { if (!cancelled) setError(errorMessage(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  const needle = query.trim().toLocaleLowerCase('vi');
  const safeCategories = Array.isArray(categories) ? categories : [];
  const filtered = safeCategories.filter(category => [category.name, category.description, category.warehouseName, category.specification, category.brand, category.productType].some(value => value?.toLocaleLowerCase('vi').includes(needle)));
  const open = (mode, category) => { setModal({ mode, category }); };

  return <div className={`farmshift-card ${styles.card}`}>
    <div className={styles.toolbar}>
      <div className={styles.heading}><span className={styles.headingIcon}><Package size={21} /></span><div><h2>Tên hàng hóa</h2><p>Quản lý tên và thông tin các loại hàng hóa</p></div></div>
      {canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => open('create')}><Plus size={16} />Thêm tên hàng hóa</button>}
    </div>
    <div className={styles.searchRow}>
      <div className={styles.search}><Search size={17} /><input aria-label="Tìm tên hàng hóa" placeholder="Tìm theo tên, quy cách, nhãn hiệu..." value={query} onChange={event => setQuery(event.target.value)} /></div>
      {!loading && !error && <span className={styles.total}>{filtered.length} hàng hóa</span>}
    </div>
    {error ? <div role="alert" className={styles.empty}><p>{error}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> :
      <div className="farmshift-table-container" style={{ border: 0 }}>
        <table className={`farmshift-table ${styles.table}`}>
          <thead><tr><th>Tên hàng hóa</th><th>Đơn vị</th><th>Nhãn hiệu</th><th>Loại hàng hóa</th><th>Kho lưu trữ</th><th>Mô tả</th><th>Thao tác</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className={styles.empty} role="status">Đang tải tên hàng hóa...</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className={styles.empty}>{query ? 'Không tìm thấy tên hàng hóa phù hợp.' : 'Chưa có tên hàng hóa nào. Thêm tên hàng hóa đầu tiên để bắt đầu.'}</td></tr> :
              filtered.map(category => <tr key={category.id}>
                <td><strong>{category.name}</strong></td>
                <td>{category.specification || '—'}</td>
                <td>{category.brand || '—'}</td>
                <td>{category.productType || '—'}</td>
                <td>{category.warehouseName || 'Chưa chọn kho'}</td>
                <td className={styles.description}>{category.description || '—'}</td>
                <td><div className={styles.actions}>
                  <button type="button" className={styles.iconButton} onClick={() => open('view', category)} aria-label={`Xem ${category.name}`} title="Xem chi tiết"><Eye size={16} /></button>
                  {canEdit && <><button type="button" className={styles.iconButton} onClick={() => open('edit', category)} aria-label={`Sửa ${category.name}`} title="Chỉnh sửa"><Pencil size={16} /></button>
                    <button type="button" className={`${styles.iconButton} ${styles.danger}`} onClick={() => open('delete', category)} aria-label={`Xóa ${category.name}`} title="Xóa tên hàng hóa"><Trash2 size={16} /></button></>}
                </div></td>
              </tr>)}
          </tbody>
        </table>
      </div>}
    {modal && <CategoryDialog key={`${modal.mode}-${modal.category?.id || 'new'}`} {...modal} canEdit={canEdit} onClose={() => setModal(null)} onSaved={message => { setModal(null); showToast(message, 'success'); setRevision(value => value + 1); }} />}
  </div>;
};
