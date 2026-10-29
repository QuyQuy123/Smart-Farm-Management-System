import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listWarehouseCategories, WAREHOUSE_CATEGORIES_CHANGED } from '../../services/warehouseCategoryService';
import { sortWarehouseCategories } from '../../utils/warehouseCategoryOrder';
import { listInventoryItems } from '../../services/inventoryItemService';
import { groupInventoryItems } from '../../utils/inventoryGroups';
import { InventoryItemDialog } from './InventoryItemDialog';
import styles from './WarehouseCategoriesView.module.css';

const BREADCRUMBS = [{ label: 'Kho hàng hóa' }];
const money = (value, minimumFractionDigits = 0) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits, maximumFractionDigits: 2 }).format(value);

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
  const [expanded, setExpanded] = useState(new Set());
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
    const handleAiAction = (event) => {
      const action = event.detail;
      if (!action) return;
      if (action.executed || action.uiCommand === 'REFRESH_DATA') {
        setItemsRevision(r => r + 1);
      }
    };
    window.addEventListener('farmshift:ai-action', handleAiAction);
    return () => window.removeEventListener('farmshift:ai-action', handleAiAction);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setItems([]); setItemError(''); setExpanded(new Set());
    if (!selectedCategory) { setLoadingItems(false); return; }
    setLoadingItems(true);
    listInventoryItems(selectedCategory, true).then(data => { if (!cancelled) setItems(data); })
      .catch(error => { if (!cancelled) setItemError(error.response?.data?.message || 'Không tải được hàng hóa. Vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setLoadingItems(false); });
    return () => { cancelled = true; };
  }, [selectedCategory, itemsRevision]);

  const warehouse = categories.find(category => category.id === selectedCategory);
  const needle = search.trim().toLocaleLowerCase('vi');
  const filtered = groupInventoryItems(items).filter(item => [item.name, item.brandName].some(value => value?.toLocaleLowerCase('vi').includes(needle)));
  const open = (mode, item) => setModal({ mode, item, warehouse: { id: selectedCategory, name: warehouse.name } });

  const toggleHistory = key => setExpanded(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const actions = (item, suffix = '') => <div className={styles.actions}>
    <button type="button" className={styles.iconButton} title="Xem chi tiết" aria-label={`Xem ${item.name}${suffix}`} onClick={() => open('view', item)}><Eye size={16} /></button>
    {canEdit && <>
      <button type="button" className={styles.iconButton} title="Chỉnh sửa" aria-label={`Sửa ${item.name}${suffix}`} onClick={() => open('edit', item)}><Pencil size={16} /></button>
      <button type="button" className={`${styles.iconButton} ${styles.danger}`} title="Xóa hàng hóa" aria-label={`Xóa ${item.name}${suffix}`} onClick={() => open('delete', item)}><Trash2 size={16} /></button>
    </>}
  </div>;
  const quantity = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value);
  const receiptDate = lot => {
    const value = lot.receipt?.importedDate;
    if (!value) return '—';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  return <FarmShiftLayout pageTitle="Kho hàng hóa" breadcrumbs={BREADCRUMBS}
    actions={canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" disabled={loadingCategories || !!categoryError || !warehouse} onClick={() => open('create')}><Plus size={16} />Tạo hàng hóa</button>}>
    {loadingCategories && <p role="status">Đang tải danh mục kho...</p>}
    {categoryError && <div role="alert" className={styles.error}>{categoryError}<button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setCategoryRevision(value => value + 1)}>Thử lại</button></div>}
    {!loadingCategories && !categoryError && !categories.length && <div className="farmshift-card" style={{ padding: '24px', marginBottom: '20px' }}>Chưa có danh mục kho. <Link to="/catalog-settings">Thêm danh mục kho trong Thiết lập danh mục</Link> để bắt đầu.</div>}
    <div className="farmshift-tabs" style={{ overflowX: 'auto' }}>{categories.map(category => <button type="button" key={category.id} className={`farmshift-tab-btn ${category.id === selectedCategory ? 'active' : ''}`} onClick={() => { setSelectedCategory(category.id); setSearch(''); }}>{category.name}</button>)}</div>
    <div className={`farmshift-card ${styles.card}`}>
      <div className={styles.searchRow}><div className={styles.search}><Search size={17} /><input aria-label="Tìm hàng hóa" placeholder="Tìm theo tên hàng hóa, nhãn hiệu..." value={search} onChange={event => setSearch(event.target.value)} /></div>{!loadingItems && !itemError && <span className={styles.total}>{filtered.length} hàng hóa</span>}</div>
      {itemError ? <div role="alert" className={styles.empty}><p>{itemError}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setItemsRevision(value => value + 1)}>Tải lại hàng hóa</button></div> : <div className="farmshift-table-container" style={{ border: 0 }}><table className={`farmshift-table ${styles.table}`}>
        <thead><tr><th>Ảnh</th><th>Tên hàng hóa</th><th>Giá trung bình</th><th>Tồn kho</th><th>Đơn vị</th><th>Nhãn hiệu</th><th>Thao tác</th></tr></thead>
        <tbody>{loadingItems || loadingCategories ? <tr><td colSpan={7} className={styles.empty} role="status">Đang tải hàng hóa...</td></tr> : !filtered.length ? <tr><td colSpan={7} className={styles.empty}>{search ? 'Không tìm thấy hàng hóa phù hợp.' : 'Chưa có hàng hóa thuộc danh mục kho này.'}</td></tr> : filtered.map((item, index) => <Fragment key={item.key}>
        <tr>
          <td><div className={styles.inventoryImage}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name} width={56} height={56} loading={index < 8 ? 'eager' : 'lazy'} decoding="async" /> : <Package size={25} color="#008577" />}</div></td>
          <td><div className={styles.inventoryGroupName}><button type="button" className={styles.iconButton} aria-label={`${expanded.has(item.key) ? 'Thu gọn' : 'Mở'} lịch sử ${item.name}`} aria-expanded={expanded.has(item.key)} aria-controls={`inventory-history-${item.id}`} onClick={() => toggleHistory(item.key)}>{expanded.has(item.key) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button><strong>{item.name}</strong></div></td>
          <td title="Trung bình cộng đơn giá các lần nhập">{money(item.price, 2)}</td><td><span className={styles.count}>{quantity(item.stock)}</span></td><td>{item.unitName || '—'}</td><td>{item.brandName || '—'}</td>
          <td>{item.lots.length === 1 ? actions(item.lots[0]) : <button type="button" className={styles.iconButton} title="Xem lịch sử nhập" aria-label={`Xem ${item.name}`} onClick={() => toggleHistory(item.key)}><Eye size={16} /></button>}</td>
        </tr>
        {expanded.has(item.key) && <tr className={styles.inventoryHistoryRow}><td colSpan={7}>
          <section id={`inventory-history-${item.id}`} className={styles.inventoryHistory} aria-label={`Lịch sử nhập ${item.name}`}>
            <h3>Lịch sử nhập — {item.name}</h3>
            <p>Giá trung bình = tổng đơn giá các lần nhập / số lần nhập. Tồn kho là tổng số lượng còn lại.</p>
            <table className="farmshift-table"><thead><tr><th>Ngày nhập</th><th>Số lượng nhập</th><th>Đơn giá nhập</th><th>Thao tác</th></tr></thead>
              <tbody>{item.lots.map((lot, lotIndex) => <tr key={lot.id}>
                <td>{receiptDate(lot)}</td>
                <td>{lot.receipt ? `${quantity(lot.receipt.quantity)} ${lot.receipt.unit || lot.unitName || ''}` : '—'}</td>
                <td>{money(lot.receipt?.price ?? lot.price)}</td>
                <td>{actions(lot, `, dòng ${lotIndex + 1}`)}</td>
              </tr>)}</tbody>
            </table>
          </section>
        </td></tr>}
        </Fragment>)}</tbody>
      </table></div>}
    </div>
    {modal && <InventoryItemDialog key={`${modal.mode}-${modal.item?.id || 'new'}`} {...modal} onClose={() => setModal(null)} onSaved={text => { setModal(null); showToast(text, 'success'); setItemsRevision(value => value + 1); }} />}
  </FarmShiftLayout>;
};
