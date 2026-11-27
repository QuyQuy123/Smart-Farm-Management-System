import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listWarehouseCategories, WAREHOUSE_CATEGORIES_CHANGED } from '../../services/warehouseCategoryService';
import { sortWarehouseCategories } from '../../utils/warehouseCategoryOrder';
import { listInventoryItems } from '../../services/inventoryItemService';
import { INVENTORY_CHANGED } from '../../utils/inventoryEvents';
import { groupInventoryItems, inventoryStockKg } from '../../utils/inventoryGroups';
import { InventoryItemDialog } from './InventoryItemDialog';
import { filterWarehouses, warehouseAreas } from './farmAreaOptions';
import { AreaWarehouseFilter } from './AreaWarehouseFilter';
import { dataCache, getPersistedTab, setPersistedTab } from '../../services/dataCache';
import { useViewport } from '../../hooks/useViewport';
import { ResponsiveDataTable } from '../../components/common/ResponsiveDataTable';
import styles from './WarehouseCategoriesView.module.css';

const BREADCRUMBS = [{ label: 'Kho hàng hóa' }];
const money = (value) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)))} đ`;

export const InventoryView = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const { isMobile, isTablet } = useViewport();
  const canEdit = user?.role === 'ROLE_FARM_OWNER';
  const canSeeFinance = user?.role !== 'ROLE_FARM_WORKER';
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
  const [search, setSearch] = useState(''), [modal, setModal] = useState(null);
  // Lọc kho theo khu / loại kho; nếu phạm vi chỉ có 1 khu thì tự động chọn sẵn khu đó.
  const [areaFilter, setAreaFilter] = useState(() => {
    const initialList = cachedWarehouses ? sortWarehouseCategories(cachedWarehouses) : [];
    const initialAreas = warehouseAreas(initialList);
    return initialAreas.length === 1 ? { area: String(initialAreas[0][0]), kind: '' } : { area: '', kind: '' };
  });
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
        const areas = warehouseAreas(ordered);
        const areaKeys = new Set(areas.map(([areaKey]) => String(areaKey)));
        let nextFilter = null;
        setAreaFilter(prev => {
          const resolvedArea = areas.length === 1
            ? String(areas[0][0])
            : (prev.area && areaKeys.has(prev.area) ? prev.area : '');
          nextFilter = { area: resolvedArea, kind: prev.kind };
          return nextFilter.area === prev.area && nextFilter.kind === prev.kind ? prev : nextFilter;
        });
        const scoped = nextFilter ? filterWarehouses(ordered, nextFilter) : ordered;
        const visibleList = scoped.length > 0 ? scoped : ordered;
        setSelectedCategory(value => visibleList.some(category => category.id === value) ? value : visibleList[0]?.id ?? null);
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
      const isReconnect = event?.detail?.source === 'reconnect';
      const matchWarehouse = isReconnect || prefixes.some(p => p.includes('warehouse') || p.includes('purchases') || p.includes('farm-areas') || p.includes('areas'));
      const matchItems = isReconnect || prefixes.some(p =>
        p.includes('inventory') || p.includes('purchases') || p.includes('internal-stock')
        || p.includes('cycles') || p.includes('daily-plan') || p.includes('journal') || p.includes('today-tasks')
      );
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
    const cacheKey = `/inventory-items?includeReceipts=${canSeeFinance}&warehouseId=${selectedCategory}`;
    const cachedItems = dataCache.peek(cacheKey);
    if (cachedItems && Array.isArray(cachedItems)) {
      setItems(cachedItems);
    } else {
      setItems([]);
    }
    if (!selectedCategory) { setLoadingItems(false); return; }
    setLoadingItems(!cachedItems);
    listInventoryItems(selectedCategory, canSeeFinance).then(data => {
      if (!cancelled) {
        setItems(data);
        dataCache.set(cacheKey, data);
      }
    })
      .catch(error => { if (!cancelled) setItemError(error.response?.data?.message || 'Không tải được hàng hóa. Vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setLoadingItems(false); });
    return () => { cancelled = true; };
  }, [selectedCategory, itemsRevision, canSeeFinance]);

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
  const quantity = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 }).format(value);
  const stockQuantity = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
  const receiptDate = lot => {
    const value = lot.receipt?.importedDate;
    if (!value) return '—';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  const totalStockValue = filtered.reduce((sum, item) => sum + (Number(item.stock || 0) * Number(item.price || 0)), 0);
  const tableColSpan = (isTablet ? 6 : 8) - (canSeeFinance ? 0 : 1);
  const mobileSummaryItems = [
    { label: 'Mặt hàng', value: `${filtered.length}` },
    ...(canSeeFinance ? [{ label: 'Tổng giá trị tồn', value: money(totalStockValue), tone: 'teal' }] : []),
  ];

  return <FarmShiftLayout pageTitle="Kho hàng hóa" breadcrumbs={BREADCRUMBS}
    actions={canEdit && <button type="button" className="farmshift-btn farmshift-btn-mint" disabled={loadingCategories || !!categoryError || !warehouse} onClick={() => open('create')}><Plus size={16} />Tạo hàng hóa</button>}>
    {loadingCategories && <p role="status">Đang tải danh mục kho...</p>}
    {categoryError && <div role="alert" className={styles.error}>{categoryError}<button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setCategoryRevision(value => value + 1)}>Thử lại</button></div>}
    {!loadingCategories && !categoryError && !categories.length && <div className="farmshift-card" style={{ padding: '24px', marginBottom: '20px' }}>{canEdit ? <>Chưa có danh mục kho. <Link to="/catalog-settings">Thêm danh mục kho trong Thiết lập danh mục</Link> để bắt đầu.</> : 'Chưa có kho hàng hóa nào thuộc phạm vi chuồng/khu bạn phụ trách.'}</div>}
    {categories.length > 0 && <div className="farmshift-card" style={{ marginBottom: '12px', padding: 0 }}>
      <AreaWarehouseFilter warehouses={categories} value={areaFilter} onChange={changeAreaFilter} /></div>}
    <div className="farmshift-tabs" style={{ overflowX: 'auto' }}>{shownCategories.map(category => <button type="button" key={category.id} className={`farmshift-tab-btn ${category.id === selectedCategory ? 'active' : ''}`} onClick={() => { setSelectedCategory(category.id); setSearch(''); }}>{category.name}</button>)}</div>
    <div className={`farmshift-card ${styles.card}`}>
      <div className={styles.searchRow}><div className={styles.search}><Search size={17} /><input aria-label="Tìm hàng hóa" placeholder="Tìm theo tên hàng hóa, nhãn hiệu..." value={search} onChange={event => setSearch(event.target.value)} /></div>{!loadingItems && !itemError && <span className={styles.total}>{filtered.length} hàng hóa</span>}</div>
      {itemError ? <div role="alert" className={styles.empty}><p>{itemError}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setItemsRevision(value => value + 1)}>Tải lại hàng hóa</button></div> : isMobile ? (
        <div className={styles.mobileInvWrap}>
          <ResponsiveDataTable
            data={filtered}
            rowKey={item => item.key}
            mode="card-on-mobile"
            loading={loadingItems || loadingCategories}
            summaryItems={!loadingItems && !loadingCategories ? mobileSummaryItems : []}
            emptyState={search ? 'Không tìm thấy hàng hóa phù hợp.' : 'Chưa có hàng hóa thuộc danh mục kho này.'}
            renderMobileCard={(item) => {
              const isOpen = expanded.has(item.key);
              const kgVal = inventoryStockKg(item);
              const stockLabel = `${stockQuantity(item.stock)} ${item.unitName || ''}`.trim();
              return (
                <div className={styles.invMobileCard}>
                  <div className={styles.invMobileHeader} onClick={() => toggleHistory(item.key)}>
                    <div className={styles.invMobileTitleBlock}>
                      <strong>{item.name}</strong>
                      {item.brandName && <small>{item.brandName}</small>}
                    </div>
                    <span className={styles.count}>{stockLabel}</span>
                  </div>
                  <div className={styles.invMobileMetrics}>
                    <div>
                      <span>Tồn kho</span>
                      <strong>{stockLabel}{kgVal != null ? ` (${stockQuantity(kgVal)} kg)` : ''}</strong>
                    </div>
                    {canSeeFinance && (
                      <div>
                        <span>Giá trung bình</span>
                        <strong>{money(item.price)}</strong>
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <section id={`inventory-history-${item.id}`} className={styles.invMobileLots} aria-label={`Lịch sử nhập ${item.name}`}>
                      <div className={styles.invMobileLotsHead}>Các đợt nhập ({item.lots.length})</div>
                      {item.lots.map((lot, lotIndex) => (
                        <div key={lot.id} className={styles.invMobileLotRow}>
                          <div>
                            <strong>{receiptDate(lot)}</strong>
                            <div>{lot.receipt ? `${quantity(lot.receipt.quantity)} ${lot.receipt.unit || lot.unitName || ''}` : '—'}{canSeeFinance ? ` · ${money(lot.receipt?.price ?? lot.price)}` : ''}</div>
                          </div>
                          {actions(lot, `, dòng ${lotIndex + 1}`)}
                        </div>
                      ))}
                    </section>
                  )}
                  <div className={styles.invMobileFooter}>
                    <button
                      type="button"
                      className={styles.invMobileExpandBtn}
                      aria-expanded={isOpen}
                      aria-controls={`inventory-history-${item.id}`}
                      onClick={() => toggleHistory(item.key)}
                    >
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span>{isOpen ? 'Thu gọn đợt nhập' : `Xem ${item.lots.length} đợt nhập`}</span>
                    </button>
                    {item.lots.length === 1 && actions(item.lots[0])}
                  </div>
                </div>
              );
            }}
          />
        </div>
      ) : <div className="farmshift-table-container" style={{ border: 0 }}><table className={`farmshift-table ${styles.table}`}>
        <thead><tr>{!isTablet && <th>Ảnh</th>}<th>Tên hàng hóa</th>{canSeeFinance && <th>Giá trung bình</th>}<th>Tồn kho</th><th>Tồn kho (kg)</th><th>Đơn vị</th>{!isTablet && <th>Nhãn hiệu</th>}<th>Thao tác</th></tr></thead>
        <tbody>{loadingItems || loadingCategories ? <tr><td colSpan={tableColSpan} className={styles.empty} role="status">Đang tải hàng hóa...</td></tr> : !filtered.length ? <tr><td colSpan={tableColSpan} className={styles.empty}>{search ? 'Không tìm thấy hàng hóa phù hợp.' : 'Chưa có hàng hóa thuộc danh mục kho này.'}</td></tr> : filtered.map((item, index) => <Fragment key={item.key}>
        <tr>
          {!isTablet && <td><div className={styles.inventoryImage}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name} width={56} height={56} loading={index < 8 ? 'eager' : 'lazy'} decoding="async" /> : <Package size={25} color="#008577" />}</div></td>}
          <td><div className={styles.inventoryGroupName}><button type="button" className={styles.iconButton} aria-label={`${expanded.has(item.key) ? 'Thu gọn' : 'Mở'} lịch sử ${item.name}`} aria-expanded={expanded.has(item.key)} aria-controls={`inventory-history-${item.id}`} onClick={() => toggleHistory(item.key)}>{expanded.has(item.key) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button><strong>{item.name}</strong></div></td>
          {canSeeFinance && <td title="Trung bình cộng đơn giá các lần nhập">{money(item.price)}</td>}<td><span className={styles.count}>{stockQuantity(item.stock)}</span></td>
          <td title={inventoryStockKg(item) == null ? 'Chưa có quy cách khối lượng phù hợp' : `1 ${item.unitName || 'đơn vị'} = ${quantity(inventoryStockKg({ ...item, stock: 1 }))} kg`}>{inventoryStockKg(item) == null ? '—' : `${stockQuantity(inventoryStockKg(item))} kg`}</td>
          <td>{item.unitName || '—'}</td>{!isTablet && <td>{item.brandName || '—'}</td>}
          <td>{item.lots.length === 1 ? actions(item.lots[0]) : <button type="button" className={styles.iconButton} title="Xem lịch sử nhập" aria-label={`Xem ${item.name}`} onClick={() => toggleHistory(item.key)}><Eye size={16} /></button>}</td>
        </tr>
        {expanded.has(item.key) && <tr className={styles.inventoryHistoryRow}><td colSpan={tableColSpan}>
          <section id={`inventory-history-${item.id}`} className={styles.inventoryHistory} aria-label={`Lịch sử nhập ${item.name}`}>
            <h3>Lịch sử nhập — {item.name}</h3>
            <p>{canSeeFinance ? 'Giá trung bình = tổng đơn giá các lần nhập / số lần nhập. Tồn kho là tổng số lượng còn lại.' : 'Tồn kho là tổng số lượng còn lại của các đợt nhập trong kho.'}</p>
            <table className="farmshift-table"><thead><tr><th>Ngày nhập</th><th>Số lượng nhập</th>{canSeeFinance && <th>Đơn giá nhập</th>}<th>Thao tác</th></tr></thead>
              <tbody>{item.lots.map((lot, lotIndex) => <tr key={lot.id}>
                <td>{receiptDate(lot)}</td>
                <td>{lot.receipt ? `${quantity(lot.receipt.quantity)} ${lot.receipt.unit || lot.unitName || ''}` : '—'}</td>
                {canSeeFinance && <td>{money(lot.receipt?.price ?? lot.price)}</td>}
                <td>{actions(lot, `, dòng ${lotIndex + 1}`)}</td>
              </tr>)}</tbody>
            </table>
          </section>
        </td></tr>}
        </Fragment>)}</tbody>
      </table></div>}
    </div>
    {modal && <InventoryItemDialog key={`${modal.mode}-${modal.item?.id || 'new'}`} {...modal} canSeeFinance={canSeeFinance} onClose={() => setModal(null)} onSaved={text => { setModal(null); showToast(text, 'success'); setItemsRevision(value => value + 1); }} />}
  </FarmShiftLayout>;
};
