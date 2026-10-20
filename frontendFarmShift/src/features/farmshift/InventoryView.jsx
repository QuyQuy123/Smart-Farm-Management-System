import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, Package } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listWarehouseCategories, WAREHOUSE_CATEGORIES_CHANGED } from '../../services/warehouseCategoryService';
import { sortWarehouseCategories } from '../../utils/warehouseCategoryOrder';
import { listInventoryItems } from '../../services/inventoryItemService';
import { InventoryItemDialog } from './InventoryItemDialog';
import styles from './WarehouseCategoriesView.module.css';

const BREADCRUMBS = [{ label: 'Kho hàng hóa' }];
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(value);

export const InventoryView = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [categoryRevision, setCategoryRevision] = useState(0);
  const [items, setItems] = useState([]), [loadingItems, setLoadingItems] = useState(false), [itemError, setItemError] = useState('');
  const [itemsRevision, setItemsRevision] = useState(0);
  const [search, setSearch] = useState(''), [modal, setModal] = useState(null);

  useEffect(() => {
    let cancelled = false, requestId = 0;
    const load = async () => {
      const current = ++requestId;
      setLoadingCategories(true); setCategoryError('');
      try {
        const ordered = sortWarehouseCategories(await listWarehouseCategories());
        if (cancelled || current !== requestId) return;
        setCategories(ordered);
        setSelectedCategory(value => ordered.some(category => category.id === value) ? value : ordered[0]?.id ?? null);
        setItemsRevision(value => value + 1);
      } catch {
        if (!cancelled && current === requestId) setCategoryError('Không tải được danh mục kho. Vui lòng thử lại.');
      } finally {
        if (!cancelled && current === requestId) setLoadingCategories(false);
      }
    };
    const onStorage = event => { if (event.key === WAREHOUSE_CATEGORIES_CHANGED) load(); };
    load();
    window.addEventListener(WAREHOUSE_CATEGORIES_CHANGED, load);
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(WAREHOUSE_CATEGORIES_CHANGED, load);
      window.removeEventListener('storage', onStorage);
    };
  }, [categoryRevision]);

  useEffect(() => {
    let cancelled = false;
    setItems([]); setItemError('');
    if (!selectedCategory) { setLoadingItems(false); return; }
    setLoadingItems(true);
    listInventoryItems(selectedCategory).then(data => { if (!cancelled) setItems(data); })
      .catch(error => { if (!cancelled) setItemError(error.response?.data?.message || 'Không tải được hàng hóa. Vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setLoadingItems(false); });
    return () => { cancelled = true; };
  }, [selectedCategory, itemsRevision]);

  const warehouse = categories.find(category => category.id === selectedCategory);
  const needle = search.trim().toLocaleLowerCase('vi');
  const filtered = items.filter(item => [item.name, item.brandName].some(value => value?.toLocaleLowerCase('vi').includes(needle)));
  const open = (mode, item) => setModal({ mode, item, warehouse: { id: selectedCategory, name: warehouse.name } });

  return <FarmShiftLayout pageTitle="Kho hàng hóa" breadcrumbs={BREADCRUMBS}
    actions={canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" disabled={loadingCategories || !!categoryError || !warehouse} onClick={() => open('create')}><Plus size={16} />Tạo hàng hóa</button>}>
    {loadingCategories && <p role="status">Đang tải danh mục kho...</p>}
    {categoryError && <div role="alert" className={styles.error}>{categoryError}<button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setCategoryRevision(value => value + 1)}>Thử lại</button></div>}
    {!loadingCategories && !categoryError && !categories.length && <div className="farmshift-card" style={{ padding: '24px', marginBottom: '20px' }}>Chưa có danh mục kho. <Link to="/catalog-settings">Thêm danh mục kho trong Thiết lập danh mục</Link> để bắt đầu.</div>}
    <div className="farmshift-tabs" style={{ overflowX: 'auto' }}>{categories.map(category => <button type="button" key={category.id} className={`farmshift-tab-btn ${category.id === selectedCategory ? 'active' : ''}`} onClick={() => { setSelectedCategory(category.id); setSearch(''); }}>{category.name}</button>)}</div>
    <div className={`farmshift-card ${styles.card}`}>
      <div className={styles.searchRow}><div className={styles.search}><Search size={17} /><input aria-label="Tìm hàng hóa" placeholder="Tìm theo tên hàng hóa, nhãn hiệu..." value={search} onChange={event => setSearch(event.target.value)} /></div>{!loadingItems && !itemError && <span className={styles.total}>{filtered.length} hàng hóa</span>}</div>
      {itemError ? <div role="alert" className={styles.empty}><p>{itemError}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setItemsRevision(value => value + 1)}>Tải lại hàng hóa</button></div> : <div className="farmshift-table-container" style={{ border: 0 }}><table className={`farmshift-table ${styles.table}`}>
        <thead><tr><th>Ảnh</th><th>Tên hàng hóa</th><th>Giá tiền</th><th>Tồn kho</th><th>Đơn vị</th><th>Nhãn hiệu</th><th>Thao tác</th></tr></thead>
        <tbody>{loadingItems || loadingCategories ? <tr><td colSpan={7} className={styles.empty} role="status">Đang tải hàng hóa...</td></tr> : !filtered.length ? <tr><td colSpan={7} className={styles.empty}>{search ? 'Không tìm thấy hàng hóa phù hợp.' : 'Chưa có hàng hóa thuộc danh mục kho này.'}</td></tr> : filtered.map(item => <tr key={item.id}>
          <td><div className={styles.inventoryImage}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <Package size={25} color="#008577" />}</div></td>
          <td><strong>{item.name}</strong></td><td>{money(item.price)}</td><td><span className={styles.count}>{new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(item.stock)}</span></td><td>{item.unitName || '—'}</td><td>{item.brandName || '—'}</td>
          <td><div className={styles.actions}><button type="button" className={styles.iconButton} title="Xem chi tiết" aria-label={`Xem ${item.name}`} onClick={() => open('view', item)}><Eye size={16} /></button>{canEdit && <><button type="button" className={styles.iconButton} title="Chỉnh sửa" aria-label={`Sửa ${item.name}`} onClick={() => open('edit', item)}><Pencil size={16} /></button><button type="button" className={`${styles.iconButton} ${styles.danger}`} title="Xóa hàng hóa" aria-label={`Xóa ${item.name}`} onClick={() => open('delete', item)}><Trash2 size={16} /></button></>}</div></td>
        </tr>)}</tbody>
      </table></div>}
    </div>
    {modal && <InventoryItemDialog key={`${modal.mode}-${modal.item?.id || 'new'}`} {...modal} onClose={() => setModal(null)} onSaved={text => { setModal(null); showToast(text, 'success'); setItemsRevision(value => value + 1); }} />}
  </FarmShiftLayout>;
};
