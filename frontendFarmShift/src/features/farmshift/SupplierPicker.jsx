import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { listSuppliers } from '../../services/supplierService';
import { SupplierDialog } from './SuppliersView';
import styles from './AreasView.module.css';

/**
 * Ô chọn nhà cung cấp kèm nút (+) thêm nhanh. Dùng làm field.render của FormDialog: props là thuộc tính của ô chọn,
 * onPick(id) ghi giá trị. Nhà cung cấp vừa thêm được chọn ngay.
 */
export function SupplierPicker({ props, onPick, canCreate }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSuppliers().then(data => { if (!cancelled) setSuppliers(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setLoadError('Không tải được danh sách nhà cung cấp.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const saved = (_, supplier) => {
    setAdding(false);
    if (!supplier) return;
    setSuppliers(current => [...current.filter(item => item.id !== supplier.id), supplier].sort((a, b) => a.name.localeCompare(b.name, 'vi')));
    onPick(String(supplier.id));
  };

  return <>
    <div className={styles.pickerRow}>
      <select {...props} onChange={event => onPick(event.target.value)} disabled={props.disabled || loading}>
        <option value="">{loading ? 'Đang tải nhà cung cấp...' : loadError || (suppliers.length ? 'Chọn nhà cung cấp' : 'Chưa có nhà cung cấp, bấm + để thêm')}</option>
        {suppliers.map(supplier => <option key={supplier.id} value={String(supplier.id)}>{supplier.name}{supplier.productTypeName ? ` · ${supplier.productTypeName}` : ''}</option>)}
      </select>
      {canCreate && <button type="button" className={styles.pickerAdd} onClick={() => setAdding(true)} disabled={props.disabled}
        title="Thêm nhà cung cấp mới" aria-label="Thêm nhà cung cấp mới"><Plus size={18} /></button>}
    </div>
    {/* Form nằm ngoài form nhập đàn (portal) và chặn sự kiện submit để không gửi luôn form nhập đàn. */}
    {adding && createPortal(<div onSubmit={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <SupplierDialog mode="create" onClose={() => setAdding(false)} onSaved={saved} />
    </div>, document.body)}
  </>;
}
