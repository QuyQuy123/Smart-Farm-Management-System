import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Package, X } from 'lucide-react';
import { listBrands } from '../../services/brandService';
import { listMeasurementUnits } from '../../services/measurementUnitService';
import { createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../services/inventoryItemService';
import { fileService } from '../../services/fileService';
import styles from './WarehouseCategoriesView.module.css';

const formatPrice = value => {
  const [integer, fraction] = value.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraction === undefined ? '' : `,${fraction}`);
};
const parsePrice = value => {
  const clean = value.replace(/[.\s]/g, '');
  if (!/^\d*(,\d{0,2})?$/.test(clean)) return null;
  if (!clean) return '';
  const [integer, fraction] = clean.split(',');
  const digits = (integer || '0').replace(/^0+(?=\d)/, '');
  return digits + (fraction === undefined ? '' : `.${fraction}`);
};

export const InventoryItemDialog = ({ mode, item, warehouse, onClose, onSaved }) => {
  const dialog = useRef(null);
  const [name, setName] = useState(item?.name || '');
  const [brandId, setBrandId] = useState(String(item?.brandId || ''));
  const [unitId, setUnitId] = useState(String(item?.unitId || ''));
  const [units, setUnits] = useState([]);
  const [price, setPrice] = useState(String(item?.price ?? ''));
  const [imageUrl, setImageUrl] = useState(item?.imageUrl || '');
  const [file, setFile] = useState(null), [preview, setPreview] = useState('');
  const [brands, setBrands] = useState([]);
  const brandOptions = useMemo(() => {
    const unique = new Map();
    for (const brand of brands) {
      const key = String(brand.name || '').normalize('NFC').trim().toLocaleLowerCase('vi');
      if (!key) continue;
      // Retain the selected database ID when editing, even if another group has the same brand name.
      if (!unique.has(key) || String(brand.id) === brandId) unique.set(key, brand);
    }
    return [...unique.values()];
  }, [brands, brandId]);
  const readOnly = mode === 'view', deleting = mode === 'delete';
  const [loading, setLoading] = useState(!readOnly && !deleting), [metadataError, setMetadataError] = useState('');
  const [revision, setRevision] = useState(0), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const title = { create: 'Tạo hàng hóa', edit: 'Chỉnh sửa hàng hóa', view: 'Chi tiết hàng hóa', delete: 'Xóa hàng hóa' }[mode];
  useEffect(() => {
    const element = dialog.current, overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (readOnly || deleting) return;
    let cancelled = false;
    setLoading(true); setMetadataError('');
    Promise.all([listBrands(), listMeasurementUnits()]).then(([brands, units]) => {
      if (!cancelled) { setBrands(brands); setUnits(units); }
    }).catch(() => { if (!cancelled) setMetadataError('Không tải được đơn vị tính hoặc nhãn hiệu. Vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [readOnly, deleting, revision, warehouse.id]);
  const submit = async event => {
    event.preventDefault(); if (saving) return;
    if (!deleting && (loading || metadataError || !name.trim())) { setError('Vui lòng nhập tên hàng hóa.'); return; }
    if (!deleting && !units.some(unit => String(unit.id) === unitId)) { setError('Vui lòng chọn đơn vị tính.'); return; }
    if (!deleting && (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) < 0 || !Number.isFinite(Number(price)))) { setError('Giá tiền phải là số không âm, tối đa 2 số thập phân.'); return; }
    setSaving(true); setError('');
    try {
      if (deleting) await deleteInventoryItem(item.id);
      else {
        let savedImage = imageUrl;
        if (file) {
          savedImage = await fileService.uploadFile(file, 'products');
          if (typeof savedImage !== 'string' || !savedImage) throw new Error('Không tải được ảnh hàng hóa.');
          setImageUrl(savedImage); setFile(null);
        }
        const payload = { warehouseId: warehouse.id, name: name.trim(), unitId: Number(unitId), brandId: brandId ? Number(brandId) : null, price, imageUrl: savedImage || null };
        if (mode === 'edit') await updateInventoryItem(item.id, payload); else await createInventoryItem(payload);
      }
      onSaved(deleting ? 'Đã xóa hàng hóa.' : 'Đã lưu hàng hóa thành công.');
    } catch (error) { setError(error.response?.data?.message || error.message || 'Không lưu được hàng hóa. Vui lòng thử lại.'); setSaving(false); }
  };
  const selectFile = event => {
    const selected = event.target.files?.[0]; event.target.value = '';
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(selected.type) || selected.size > 5 * 1024 * 1024) { setError('Chọn ảnh JPEG, PNG hoặc GIF tối đa 5MB.'); return; }
    setFile(selected); setError('');
  };
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="inventory-item-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className={`${styles.modal} ${!deleting ? styles.modalWide : ''}`}>
      <header className={styles.modalHeader}><h2 id="inventory-item-title">{title}</h2><button type="button" className={styles.iconButton} disabled={saving} aria-label="Đóng" onClick={onClose}><X size={20} /></button></header>
      <form onSubmit={submit}><div className={styles.modalBody}>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {deleting ? <p>Bạn muốn xóa hàng hóa <strong>{item.name}</strong> khỏi kho {warehouse.name}?</p> : <>
          <p style={{ marginBottom: '16px', color: '#71818a', fontSize: '14.5px' }}>{warehouse.name}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{ width: '84px', height: '84px', borderRadius: '12px', background: '#edf7f4', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {preview || imageUrl ? <img src={preview || imageUrl} alt="Ảnh hàng hóa" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={30} color="#008577" />}
            </div>
            {!readOnly && <div><label htmlFor="inventory-image" className="farmshift-btn farmshift-btn-mint" style={{ cursor: 'pointer', fontSize: '13.5px', padding: '6px 10px' }}><Camera size={15} />Chọn ảnh</label><input id="inventory-image" type="file" accept="image/jpeg,image/png,image/gif" onChange={selectFile} disabled={saving} style={{ display: 'none' }} />
              {(file || imageUrl) && <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={saving} style={{ marginLeft: '6px', fontSize: '13.5px' }} onClick={() => { setFile(null); setImageUrl(''); }}>Bỏ ảnh</button>}
              <p style={{ fontSize: '12.5px', color: '#71818a', marginTop: '6px' }}>JPEG, PNG, GIF · tối đa 5MB</p></div>}
          </div>
          <div className={styles.formGrid}>
          <div className={styles.formField}>
          <label htmlFor="inventory-product">Tên hàng hóa {!readOnly && <span className={styles.required}>*</span>}</label>
          <input id="inventory-product" className="farmshift-form-control" placeholder="Nhập tên hàng hóa" maxLength={150} required value={name} onChange={event => setName(event.target.value)} readOnly={readOnly} disabled={saving} />
          </div>
          <div className={styles.formField}>
          <label htmlFor="inventory-unit">Đơn vị {!readOnly && <span className={styles.required}>*</span>}</label>
          {readOnly ? <input id="inventory-unit" className="farmshift-form-control" value={item.unitName || 'Chưa chọn đơn vị'} readOnly /> : <select id="inventory-unit" className="farmshift-form-control" required value={unitId} onChange={event => setUnitId(event.target.value)} disabled={saving || loading || !!metadataError}>
            <option value="">{loading ? 'Đang tải đơn vị tính...' : 'Chọn đơn vị tính'}</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>)}
          </select>}
          {!readOnly && !loading && !metadataError && !units.length && <p className={styles.error}>Chưa có đơn vị tính. Vui lòng thêm tại Thiết lập danh mục → Đơn vị tính.</p>}
          </div>
          <div className={styles.formField}>
          <label htmlFor="inventory-price">Giá tiền (đ) {!readOnly && <span className={styles.required}>*</span>}</label>
          <input id="inventory-price" type="text" inputMode="decimal" className="farmshift-form-control" placeholder="Ví dụ: 320.000" value={formatPrice(price)} onChange={event => { const parsed = parsePrice(event.target.value); if (parsed !== null) setPrice(parsed); }} required readOnly={readOnly} disabled={saving} />
          </div>
          <div className={styles.formField}>
          <label htmlFor="inventory-stock">Tồn kho</label><input id="inventory-stock" className="farmshift-form-control" value={item?.stock ?? 0} readOnly />
          </div>
          <div className={styles.formField}>
          <label htmlFor="inventory-brand">Nhãn hiệu</label>
          {readOnly ? <input id="inventory-brand" className="farmshift-form-control" value={item.brandName || 'Chưa chọn nhãn hiệu'} readOnly /> : <select id="inventory-brand" className="farmshift-form-control" value={brandId} onChange={event => setBrandId(event.target.value)} disabled={saving || loading || !!metadataError}><option value="">Chọn nhãn hiệu (không bắt buộc)</option>{brandOptions.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>}
          </div>
          </div>
          {metadataError && <p role="alert" className={styles.error}>{metadataError}<button type="button" onClick={() => setRevision(value => value + 1)}>Thử lại</button></p>}
        </>}
      </div><footer className={styles.footer}><button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={saving} onClick={onClose}>{readOnly ? 'Đóng' : 'Hủy bỏ'}</button>
        {!readOnly && <button type="submit" className={`farmshift-btn ${deleting ? styles.deleteButton : 'farmshift-btn-mint'}`} disabled={saving || (!deleting && (loading || !!metadataError || !units.length))} aria-busy={saving}>{saving ? 'Đang xử lý...' : deleting ? 'Xóa hàng hóa' : 'Lưu hàng hóa'}</button>}
      </footer></form>
    </section>
  </dialog>;
};
