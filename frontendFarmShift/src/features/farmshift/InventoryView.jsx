import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, Package, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listWarehouseCategories, WAREHOUSE_CATEGORIES_CHANGED } from '../../services/warehouseCategoryService';
import { sortWarehouseCategories } from '../../utils/warehouseCategoryOrder';
import { listInventoryItems } from '../../services/inventoryItemService';
import { INVENTORY_CHANGED } from '../../utils/inventoryEvents';
import { groupInventoryItems, inventoryStockKg } from '../../utils/inventoryGroups';
import { InventoryItemDialog } from './InventoryItemDialog';
import { filterWarehouses } from './farmAreaOptions';
import { AreaWarehouseFilter } from './AreaWarehouseFilter';
import { dataCache, getPersistedTab, setPersistedTab } from '../../services/dataCache';
import styles from './WarehouseCategoriesView.module.css';

const BREADCRUMBS = [{ label: 'Kho hàng hóa' }];
const money = (value, minimumFractionDigits = 0) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits, maximumFractionDigits: 2 }).format(value);

export const InventoryView = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const cachedWarehouses = dataCache.peek('/warehouse-categories');
  const [selectedCategory, setSelectedCategoryState] = useState(() => {
    const saved = getPersistedTab('farmshift_inv_selected_cat', null);
    if (saved && cachedWarehouses?.some(c => c.id === Number(saved))) return Number(saved);
    return cachedWarehouses?.[0]?.id ?? null;
  });
  const setSelectedCategory = (catIdOrUpdater) => {
    setSelectedCategoryState(prev => {
      const next = typeof catIdOrUpdater === 'function' ? catIdOrUpdater(prev) : catIdOrUpdater;
      if (next) setPersistedTab('farmshift_inv_selected_cat', next);
      return next;
    });
  };
  const [lastWarehouseId, setLastWarehouseId] = useState(selectedCategory);
  const [categories, setCategories] = useState(() => (cachedWarehouses ? sortWarehouseCategories(cachedWarehouses) : []));
  const [loadingCategories, setLoadingCategories] = useState(() => !cachedWarehouses);
  const [categoryError, setCategoryError] = useState('');
  const [categoryRevision, setCategoryRevision] = useState(0);
  const [items, setItems] = useState([]), [loadingItems, setLoadingItems] = useState(false), [itemError, setItemError] = useState('');
  const [itemsRevision, setItemsRevision] = useState(0);
  const [expanded, setExpanded] = useState(new Set());
  const [search, setSearch] = useState(''), [alertFilter, setAlertFilter] = useState('ALL'), [modal, setModal] = useState(null);
  // Lọc kho theo khu / loại kho; kho đang mở không còn trong bộ lọc thì chuyển sang kho đầu tiên còn hiện.
  const [areaFilter, setAreaFilter] = useState({ area: '', kind: '' });
  const shownCategories = filterWarehouses(categories, areaFilter);
  const changeAreaFilter = next => {
    setAreaFilter(next);
    const list = filterWarehouses(categories, next);
    if (!list.some(category => category.id === selectedCategory)) { setSelectedCategory(list[0]?.id ?? null); setSearch(''); }
  };

  useEffect(() => {
    const refresh = () => setItemsRevision(value => value + 1);
    const onStorage = event => { if (event.key === INVENTORY_CHANGED) refresh(); };
    window.addEventListener(INVENTORY_CHANGED, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(INVENTORY_CHANGED, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

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
    const handleCacheInvalidated = (event) => {
      const prefixes = event?.detail?.prefixes || [];
      const matchWarehouse = prefixes.some(p => p.includes('warehouse') || p.includes('purchases') || p.includes('farm-areas') || p.includes('areas'));
      const matchItems = prefixes.some(p => p.includes('inventory') || p.includes('purchases') || p.includes('internal-stock'));
      if (matchWarehouse) {
        setCategoryRevision(r => r + 1);
      }
      if (matchItems) {
        setItemsRevision(r => r + 1);
      }
    };
    window.addEventListener('farmshift:cache-invalidated', handleCacheInvalidated);
    return () => window.removeEventListener('farmshift:cache-invalidated', handleCacheInvalidated);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setItemError('');
    if (lastWarehouseId !== selectedCategory) {
      setExpanded(new Set());
      setLastWarehouseId(selectedCategory);
    }
    const cachedItems = dataCache.peek(`/inventory-items?includeReceipts=true&warehouseId=${selectedCategory}`);
    if (cachedItems && Array.isArray(cachedItems)) {
      setItems(cachedItems);
    } else {
      setItems([]);
    }
    if (!selectedCategory) { setLoadingItems(false); return; }
    setLoadingItems(!cachedItems);
    listInventoryItems(selectedCategory, true).then(data => {
      if (!cancelled) {
        setItems(data);
        dataCache.set(`/inventory-items?includeReceipts=true&warehouseId=${selectedCategory}`, data);
      }
    })
      .catch(error => { if (!cancelled) setItemError(error.response?.data?.message || 'Không tải được hàng hóa. Vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setLoadingItems(false); });
    return () => { cancelled = true; };
  }, [selectedCategory, itemsRevision]);

  const warehouse = categories.find(category => category.id === selectedCategory);
  const needle = search.trim().toLocaleLowerCase('vi');
  const groupedItems = groupInventoryItems(items);
  const lowStockCount = groupedItems.filter(item => item.lowStock).length;
  const expiryAlertCount = groupedItems.filter(item => item.expiryStatus === 'EXPIRED' || item.expiryStatus === 'NEAR_EXPIRY').length;
  const totalAlertCount = groupedItems.filter(item => item.lowStock || item.expiryStatus === 'EXPIRED' || item.expiryStatus === 'NEAR_EXPIRY').length;
  const filtered = groupedItems.filter(item => {
    const matchText = [item.name, item.brandName, item.lotNumber].some(value => value?.toLocaleLowerCase('vi').includes(needle));
    if (!matchText) return false;
    if (alertFilter === 'LOW_STOCK') return item.lowStock;
    if (alertFilter === 'EXPIRY') return item.expiryStatus === 'EXPIRED' || item.expiryStatus === 'NEAR_EXPIRY';
    return true;
  });
  const formatDateVi = value => {
    if (!value) return '—';
    const [year, month, day] = String(value).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  };
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
  const quantity = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 }).format(value);
  const stockQuantity = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
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
    {categories.length > 0 && <div className="farmshift-card" style={{ marginBottom: '12px', padding: 0 }}>
      <AreaWarehouseFilter warehouses={categories} value={areaFilter} onChange={changeAreaFilter} /></div>}
    <div className="farmshift-tabs" style={{ overflowX: 'auto' }}>{shownCategories.map(category => <button type="button" key={category.id} className={`farmshift-tab-btn ${category.id === selectedCategory ? 'active' : ''}`} onClick={() => { setSelectedCategory(category.id); setSearch(''); setAlertFilter('ALL'); }}>{category.name}</button>)}</div>
    {!loadingItems && !itemError && totalAlertCount > 0 && (
      <div role="region" aria-label="Cảnh báo tồn kho" className="farmshift-card" style={{ marginBottom: '14px', padding: '12px 18px', background: '#fff8ec', borderColor: '#f6d69d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9a5400', fontSize: '14px' }}>
          <AlertTriangle size={18} color="#d97706" />
          <span>
            <strong>Cảnh báo kho:</strong>{' '}
            {lowStockCount > 0 && <span>{lowStockCount} mặt hàng dưới ngưỡng tối thiểu</span>}
            {lowStockCount > 0 && expiryAlertCount > 0 && ' · '}
            {expiryAlertCount > 0 && <span>{expiryAlertCount} mặt hàng sắp/đã hết hạn</span>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" className={`farmshift-btn ${alertFilter === 'ALL' ? 'farmshift-btn-mint' : 'farmshift-btn-secondary'}`} style={{ fontSize: '12.5px', padding: '4px 10px' }} onClick={() => setAlertFilter('ALL')}>Tất cả ({groupedItems.length})</button>
          {lowStockCount > 0 && <button type="button" className={`farmshift-btn ${alertFilter === 'LOW_STOCK' ? 'farmshift-btn-mint' : 'farmshift-btn-secondary'}`} style={{ fontSize: '12.5px', padding: '4px 10px' }} onClick={() => setAlertFilter('LOW_STOCK')}>Dưới ngưỡng tồn ({lowStockCount})</button>}
          {expiryAlertCount > 0 && <button type="button" className={`farmshift-btn ${alertFilter === 'EXPIRY' ? 'farmshift-btn-mint' : 'farmshift-btn-secondary'}`} style={{ fontSize: '12.5px', padding: '4px 10px' }} onClick={() => setAlertFilter('EXPIRY')}>Sắp / Đã hết hạn ({expiryAlertCount})</button>}
        </div>
      </div>
    )}
    <div className={`farmshift-card ${styles.card}`}>
      <div className={styles.searchRow}><div className={styles.search}><Search size={17} /><input aria-label="Tìm hàng hóa" placeholder="Tìm theo tên hàng hóa, nhãn hiệu, số lô..." value={search} onChange={event => setSearch(event.target.value)} /></div>{!loadingItems && !itemError && <span className={styles.total}>{filtered.length} hàng hóa</span>}</div>
      {itemError ? <div role="alert" className={styles.empty}><p>{itemError}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setItemsRevision(value => value + 1)}>Tải lại hàng hóa</button></div> : <div className="farmshift-table-container" style={{ border: 0 }}><table className={`farmshift-table ${styles.table}`}>
        <thead><tr><th>Ảnh</th><th>Tên hàng hóa</th><th>Giá trung bình</th><th>Tồn kho</th><th>Tồn kho (kg)</th><th>Đơn vị</th><th>Số lô / HSD</th><th>Nhãn hiệu</th><th>Thao tác</th></tr></thead>
        <tbody>{loadingItems || loadingCategories ? <tr><td colSpan={9} className={styles.empty} role="status">Đang tải hàng hóa...</td></tr> : !filtered.length ? <tr><td colSpan={9} className={styles.empty}>{search || alertFilter !== 'ALL' ? 'Không tìm thấy hàng hóa phù hợp.' : 'Chưa có hàng hóa thuộc danh mục kho này.'}</td></tr> : filtered.map((item, index) => <Fragment key={item.key}>
        <tr>
          <td><div className={styles.inventoryImage}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name} width={56} height={56} loading={index < 8 ? 'eager' : 'lazy'} decoding="async" /> : <Package size={25} color="#008577" />}</div></td>
          <td>
            <div className={styles.inventoryGroupName}><button type="button" className={styles.iconButton} aria-label={`${expanded.has(item.key) ? 'Thu gọn' : 'Mở'} lịch sử ${item.name}`} aria-expanded={expanded.has(item.key)} aria-controls={`inventory-history-${item.id}`} onClick={() => toggleHistory(item.key)}>{expanded.has(item.key) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button><strong>{item.name}</strong></div>
            {(item.lowStock || item.expiryStatus === 'EXPIRED' || item.expiryStatus === 'NEAR_EXPIRY') && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px', marginLeft: '40px' }}>
                {item.lowStock && <span className="farmshift-badge farmshift-badge-warning">Dưới ngưỡng (≥ {quantity(item.minStock)})</span>}
                {item.expiryStatus === 'EXPIRED' && <span className="farmshift-badge farmshift-badge-danger">Đã hết hạn</span>}
                {item.expiryStatus === 'NEAR_EXPIRY' && <span className="farmshift-badge farmshift-badge-warning">Sắp hết hạn</span>}
              </div>
            )}
          </td>
          <td title="Trung bình cộng đơn giá các lần nhập">{money(item.price, 2)}</td>
          <td>
            <span className={styles.count} style={item.lowStock ? { background: '#fff3cd', color: '#9a5400', fontWeight: 600 } : undefined}>{stockQuantity(item.stock)}</span>
            {item.minStock != null && <div style={{ fontSize: '12px', color: '#71818a', marginTop: '2px' }}>Tối thiểu: {quantity(item.minStock)}</div>}
          </td>
          <td title={inventoryStockKg(item) == null ? 'Chưa có quy cách khối lượng phù hợp' : `1 ${item.unitName || 'đơn vị'} = ${quantity(inventoryStockKg({ ...item, stock: 1 }))} kg`}>{inventoryStockKg(item) == null ? '—' : `${stockQuantity(inventoryStockKg(item))} kg`}</td>
          <td>{item.unitName || '—'}</td>
          <td>
            <div style={{ fontSize: '13px', color: '#182b31', fontFamily: 'monospace' }}>{item.lotNumber || '—'}</div>
            <div style={{ fontSize: '12.5px', color: item.expiryStatus === 'EXPIRED' ? '#c63030' : item.expiryStatus === 'NEAR_EXPIRY' ? '#b45309' : '#71818a' }}>
              {item.expiryDate ? `HSD: ${formatDateVi(item.expiryDate)}` : '—'}
            </div>
          </td>
          <td>{item.brandName || '—'}</td>
          <td>{item.lots.length === 1 ? actions(item.lots[0]) : <button type="button" className={styles.iconButton} title="Xem lịch sử nhập" aria-label={`Xem ${item.name}`} onClick={() => toggleHistory(item.key)}><Eye size={16} /></button>}</td>
        </tr>
        {expanded.has(item.key) && <tr className={styles.inventoryHistoryRow}><td colSpan={9}>
          <section id={`inventory-history-${item.id}`} className={styles.inventoryHistory} aria-label={`Lịch sử nhập ${item.name}`}>
            <h3>Lịch sử nhập — {item.name}</h3>
            <p>Giá trung bình = tổng đơn giá các lần nhập / số lần nhập. Tồn kho là tổng số lượng còn lại.</p>
            <table className="farmshift-table"><thead><tr><th>Ngày nhập</th><th>Số lô</th><th>Hạn sử dụng</th><th>Số lượng nhập</th><th>Đơn giá nhập</th><th>Thao tác</th></tr></thead>
              <tbody>{item.lots.map((lot, lotIndex) => <tr key={lot.id}>
                <td>{receiptDate(lot)}</td>
                <td style={{ fontFamily: 'monospace' }}>{lot.lotNumber || '—'}</td>
                <td>{lot.expiryDate ? formatDateVi(lot.expiryDate) : '—'}</td>
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
