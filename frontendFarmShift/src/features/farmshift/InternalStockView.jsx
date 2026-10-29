// src/features/farmshift/InternalStockView.jsx
// Xuất nhập nội bộ & Luân chuyển kho - Chuẩn Editorial SaaS & DESIGN.md
import React, { useEffect, useState, useId } from 'react';
import {
  ArrowLeftRight, Plus, Search, FileText, CheckCircle,
  AlertCircle, Printer, X, Trash2, Eye, Ban, RefreshCw,
  Warehouse, Calendar, Tag, ChevronLeft, ChevronRight, Layers, Pencil
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  listInternalStockCategories,
  createInternalStockCategory,
  updateInternalStockCategory,
  deleteInternalStockCategory,
  listInternalStockVouchers,
  getInternalStockVoucher,
  createInternalStockVoucher,
  cancelInternalStockVoucher,
  INTERNAL_STOCK_TYPES,
  INTERNAL_STOCK_STATUS
} from '../../services/internalStockService';
import { listWarehouseCategories } from '../../services/warehouseCategoryService';
import { listInventoryItems, listAllInventoryItems } from '../../services/inventoryItemService';
import { PrintableInternalVoucher } from './PrintableInternalVoucher';
import styles from './InternalStockView.module.css';

const MSG27 = 'Số lượng xuất kho vượt quá số lượng tồn kho khả dụng hiện tại.';

export const InternalStockView = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const isWorker = user?.role === 'ROLE_FARM_WORKER';
  const canMutate = user?.role === 'ROLE_FARM_OWNER' || user?.role === 'ROLE_ACCOUNTANT';

  // Tabs: 'create' | 'vouchers' | 'categories'
  const [activeTab, setActiveTab] = useState('vouchers');

  // Shared master data
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);

  // Tab 2: Vouchers List State
  const [vouchers, setVouchers] = useState([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterWarehouse, setFilterWarehouse] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Modals & Action States
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [printingVoucher, setPrintingVoucher] = useState(null);
  const [voucherToCancel, setVoucherToCancel] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null); // { mode: 'create'|'edit'|'view'|'delete', item }
  const [submitting, setSubmitting] = useState(false);

  // Tab 1: Create Voucher Form State
  const [voucherForm, setVoucherForm] = useState({
    movementType: 'EXPORT', // 'IMPORT' | 'EXPORT' | 'TRANSFER'
    categoryId: '',
    sourceWarehouseId: '',
    targetWarehouseId: '',
    farmingCycleId: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    items: [
      {
        inventoryItemId: '',
        productName: '',
        unitName: '',
        availableStock: 0,
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        note: '',
        error: ''
      }
    ]
  });

  const loadCategories = async () => {
    try {
      const data = await listInternalStockCategories();
      setCategories(data || []);
    } catch {
      showToast('Không tải được danh mục xuất nhập nội bộ.', 'error');
    }
  };

  const loadWarehouses = async () => {
    try {
      const data = await listWarehouseCategories();
      setWarehouses(data || []);
    } catch {
      // Ignored
    }
  };

  // Load master data on mount
  useEffect(() => {
    loadCategories();
    loadWarehouses();
  }, []);

  // Load available inventory items when sourceWarehouseId or movementType changes
  useEffect(() => {
    const fetchItems = async () => {
      try {
        if (voucherForm.movementType === 'IMPORT') {
          const items = await listAllInventoryItems();
          setAvailableItems(items || []);
        } else if (voucherForm.sourceWarehouseId) {
          const items = await listInventoryItems(voucherForm.sourceWarehouseId);
          setAvailableItems(items || []);
        } else {
          setAvailableItems([]);
        }
      } catch {
        setAvailableItems([]);
      }
    };
    fetchItems();
  }, [voucherForm.sourceWarehouseId, voucherForm.movementType]);

  const loadVouchers = async () => {
    setVouchersLoading(true);
    try {
      const res = await listInternalStockVouchers({
        page,
        size,
        search,
        movementType: filterType,
        categoryId: filterCategory,
        warehouseId: filterWarehouse,
        status: filterStatus,
        from: filterFrom,
        to: filterTo
      });
      setVouchers(res.content || []);
      setTotalElements(res.totalElements || 0);
      setTotalPages(res.totalPages || 1);
    } catch {
      showToast('Không tải được danh sách phiếu xuất nhập.', 'error');
    } finally {
      setVouchersLoading(false);
    }
  };

  // Load vouchers when filters or pagination change
  useEffect(() => {
    loadVouchers();
  }, [page, size, search, filterType, filterCategory, filterWarehouse, filterStatus, filterFrom, filterTo]);

  // ── Tab 1: Form Handlers ──────────────────────────────────────────
  const handleTypeChange = (type) => {
    // Reset category if not matching the new type
    const matchingCats = categories.filter(c => c.movementType === type);
    setVoucherForm(prev => ({
      ...prev,
      movementType: type,
      categoryId: matchingCats[0]?.id || '',
      sourceWarehouseId: type === 'IMPORT' ? '' : prev.sourceWarehouseId,
      targetWarehouseId: type === 'EXPORT' ? '' : prev.targetWarehouseId,
      items: [
        {
          inventoryItemId: '',
          productName: '',
          unitName: '',
          availableStock: 0,
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          note: '',
          error: ''
        }
      ]
    }));
  };

  const handleAddItemRow = () => {
    setVoucherForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          inventoryItemId: '',
          productName: '',
          unitName: '',
          availableStock: 0,
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          note: '',
          error: ''
        }
      ]
    }));
  };

  const handleRemoveItemRow = (index) => {
    if (voucherForm.items.length <= 1) return;
    setVoucherForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemSelect = (index, inventoryItemId) => {
    const selected = availableItems.find(it => String(it.id) === String(inventoryItemId));
    setVoucherForm(prev => {
      const updated = [...prev.items];
      if (selected) {
        const availableStock = Number(selected.stock || 0);
        const qty = Number(updated[index].quantity || 1);
        const price = Number(selected.price || 0);
        const isExceeding = (prev.movementType === 'EXPORT' || prev.movementType === 'TRANSFER') && qty > availableStock;
        updated[index] = {
          ...updated[index],
          inventoryItemId: selected.id,
          productId: selected.productId || selected.id,
          unitId: selected.unitId || null,
          productName: selected.productName || selected.name || '',
          unitName: selected.unitName || selected.unit || 'Kg',
          availableStock,
          unitPrice: price,
          amount: qty * price,
          error: isExceeding ? MSG27 : ''
        };
      } else {
        updated[index] = {
          ...updated[index],
          inventoryItemId: '',
          productName: '',
          unitName: '',
          availableStock: 0,
          unitPrice: 0,
          amount: 0,
          error: ''
        };
      }
      return { ...prev, items: updated };
    });
  };

  const handleQuantityChange = (index, value) => {
    const qty = Number(value);
    setVoucherForm(prev => {
      const updated = [...prev.items];
      const it = updated[index];
      const isExceeding = (prev.movementType === 'EXPORT' || prev.movementType === 'TRANSFER') && qty > it.availableStock;
      const unitPrice = Number(it.unitPrice || 0);
      updated[index] = {
        ...it,
        quantity: value,
        amount: qty * unitPrice,
        error: isExceeding ? MSG27 : ''
      };
      return { ...prev, items: updated };
    });
  };

  const handleUnitPriceChange = (index, value) => {
    const price = Number(value);
    setVoucherForm(prev => {
      const updated = [...prev.items];
      const it = updated[index];
      const qty = Number(it.quantity || 0);
      updated[index] = {
        ...it,
        unitPrice: value,
        amount: qty * price
      };
      return { ...prev, items: updated };
    });
  };

  const handleNoteChange = (index, value) => {
    setVoucherForm(prev => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], note: value };
      return { ...prev, items: updated };
    });
  };

  const hasItemErrors = voucherForm.items.some(it => !!it.error || !it.inventoryItemId || Number(it.quantity) <= 0);

  const totalQuantity = voucherForm.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const totalAmount = voucherForm.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const handleSubmitVoucher = async (e) => {
    e.preventDefault();
    if (!canMutate) {
      showToast('Bạn không có quyền lập phiếu xuất nhập kho.', 'error');
      return;
    }

    if (voucherForm.movementType === 'TRANSFER' && voucherForm.sourceWarehouseId === voucherForm.targetWarehouseId) {
      showToast('Kho xuất và kho nhập không được trùng nhau khi chuyển kho.', 'error');
      return;
    }

    if (hasItemErrors) {
      showToast('Vui lòng kiểm tra lại thông tin và số lượng hàng hóa.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        movementType: voucherForm.movementType,
        categoryId: Number(voucherForm.categoryId),
        sourceWarehouseId: voucherForm.sourceWarehouseId ? Number(voucherForm.sourceWarehouseId) : null,
        targetWarehouseId: voucherForm.targetWarehouseId ? Number(voucherForm.targetWarehouseId) : null,
        cycleId: voucherForm.farmingCycleId ? Number(voucherForm.farmingCycleId) : null,
        farmingCycleId: voucherForm.farmingCycleId ? Number(voucherForm.farmingCycleId) : null,
        movementDate: voucherForm.date,
        date: voucherForm.date,
        note: voucherForm.description || '',
        description: voucherForm.description || '',
        items: voucherForm.items.map(it => ({
          productId: Number(it.productId || it.inventoryItemId),
          inventoryItemId: Number(it.inventoryItemId),
          unitId: it.unitId ? Number(it.unitId) : null,
          quantity: Number(it.quantity),
          unitPrice: isWorker ? null : (it.unitPrice ? Number(it.unitPrice) : null),
          note: it.note || ''
        }))
      };

      const created = await createInternalStockVoucher(payload);
      showToast(`Đã tạo thành công phiếu ${created.code}!`, 'success');

      // Reset form and switch to vouchers list
      setVoucherForm({
        movementType: 'EXPORT',
        categoryId: '',
        sourceWarehouseId: '',
        targetWarehouseId: '',
        farmingCycleId: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        items: [
          {
            inventoryItemId: '',
            productName: '',
            unitName: '',
            availableStock: 0,
            quantity: 1,
            unitPrice: 0,
            amount: 0,
            note: '',
            error: ''
          }
        ]
      });
      loadVouchers();
      setActiveTab('vouchers');
      setSelectedVoucher(created);
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể tạo phiếu xuất nhập.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Tab 2: Cancel Voucher ─────────────────────────────────────────
  const handleConfirmCancelVoucher = async () => {
    if (!voucherToCancel) return;
    setSubmitting(true);
    try {
      await cancelInternalStockVoucher(voucherToCancel.id);
      showToast(`Đã hủy phiếu ${voucherToCancel.code}. Tồn kho đã được hoàn lại.`, 'success');
      setVoucherToCancel(null);
      if (selectedVoucher?.id === voucherToCancel.id) {
        setSelectedVoucher(null);
      }
      loadVouchers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể hủy phiếu.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Print Voucher Handler ─────────────────────────────────────────
  const handlePrint = (voucher) => {
    setPrintingVoucher(voucher);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Filter categories by selected movementType for Tab 1
  const filteredCategoriesForCreate = categories.filter(c => c.movementType === voucherForm.movementType);

  return (
    <FarmShiftLayout
      pageTitle="Xuất nhập nội bộ"
      breadcrumbs={[{ label: 'Xuất nhập nội bộ' }]}
    >
      <div className={styles.container}>
        {/* ── Page Header ── */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h1>Xuất nhập nội bộ</h1>
            <p className={styles.subtitle}>
              Quản lý điều chuyển thức ăn, vắc-xin, thuốc và vật tư trong nội bộ trang trại
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className="farmshift-btn farmshift-btn-secondary"
              onClick={() => {
                loadCategories();
                loadVouchers();
              }}
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={15} /> Làm mới
            </button>
            {canMutate && activeTab === 'vouchers' && (
              <button
                type="button"
                className="farmshift-btn farmshift-btn-mint"
                onClick={() => setActiveTab('create')}
              >
                <Plus size={16} /> Tạo phiếu mới
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className={styles.tabsNav}>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'create' ? styles.active : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <Plus size={16} /> Tạo phiếu
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'vouchers' ? styles.active : ''}`}
            onClick={() => setActiveTab('vouchers')}
          >
            <ArrowLeftRight size={16} /> Danh sách phiếu ({totalElements})
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'categories' ? styles.active : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            <Layers size={16} /> Danh mục lý do ({categories.length})
          </button>
        </div>

        {/* ── Tab 1: Tạo phiếu Form ── */}
        {activeTab === 'create' && (
          <div className={styles.card}>
            <form onSubmit={handleSubmitVoucher} className={styles.formBody}>
              {/* Loại phiếu */}
              <div className={styles.sectionHeader}>
                <ArrowLeftRight size={18} color="#059669" /> 1. Chọn loại phiếu xuất nhập
              </div>

              <div className={styles.movementTypePills}>
                <button
                  type="button"
                  className={`${styles.typePill} ${voucherForm.movementType === 'EXPORT' ? styles.selectedExport : ''}`}
                  onClick={() => handleTypeChange('EXPORT')}
                >
                  Xuất kho (Tiêu hao / Xuất hủy)
                </button>
                <button
                  type="button"
                  className={`${styles.typePill} ${voucherForm.movementType === 'TRANSFER' ? styles.selectedTransfer : ''}`}
                  onClick={() => handleTypeChange('TRANSFER')}
                >
                  Chuyển kho nội bộ
                </button>
              </div>

              {/* Thông tin chứng từ */}
              <div className={styles.sectionHeader}>
                <FileText size={18} color="#059669" /> 2. Thông tin chứng từ &amp; Lý do
              </div>

              <div className={styles.formGrid}>
                {/* Danh mục lý do theo loại phiếu */}
                <div className={styles.formGroup}>
                  <label htmlFor="voucher-category">
                    {voucherForm.movementType === 'EXPORT'
                      ? 'Lý do xuất kho'
                      : voucherForm.movementType === 'IMPORT'
                      ? 'Lý do nhập kho'
                      : 'Lý do chuyển kho'} <span className={styles.required}>*</span>
                  </label>
                  <select
                    id="voucher-category"
                    required
                    value={voucherForm.categoryId}
                    onChange={e => setVoucherForm({ ...voucherForm, categoryId: e.target.value })}
                  >
                    <option value="">
                      {voucherForm.movementType === 'EXPORT'
                        ? '-- Chọn lý do xuất kho --'
                        : voucherForm.movementType === 'IMPORT'
                        ? '-- Chọn lý do nhập kho --'
                        : '-- Chọn lý do chuyển kho --'}
                    </option>
                    {filteredCategoriesForCreate.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kho xuất (Bắt buộc với EXPORT & TRANSFER) */}
                {(voucherForm.movementType === 'EXPORT' || voucherForm.movementType === 'TRANSFER') && (
                  <div className={styles.formGroup}>
                    <label htmlFor="voucher-source-warehouse">
                      Kho xuất <span className={styles.required}>*</span>
                    </label>
                    <select
                      id="voucher-source-warehouse"
                      required
                      value={voucherForm.sourceWarehouseId}
                      onChange={e => setVoucherForm({ ...voucherForm, sourceWarehouseId: e.target.value })}
                    >
                      <option value="">-- Chọn kho xuất --</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Kho nhập (Bắt buộc với IMPORT & TRANSFER) */}
                {(voucherForm.movementType === 'IMPORT' || voucherForm.movementType === 'TRANSFER') && (
                  <div className={styles.formGroup}>
                    <label htmlFor="voucher-target-warehouse">
                      Kho nhập <span className={styles.required}>*</span>
                    </label>
                    <select
                      id="voucher-target-warehouse"
                      required
                      value={voucherForm.targetWarehouseId}
                      onChange={e => setVoucherForm({ ...voucherForm, targetWarehouseId: e.target.value })}
                    >
                      <option value="">-- Chọn kho nhập --</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Ngày thực hiện */}
                <div className={styles.formGroup}>
                  <label htmlFor="voucher-date">
                    Ngày thực hiện <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="voucher-date"
                    type="date"
                    required
                    value={voucherForm.date}
                    onChange={e => setVoucherForm({ ...voucherForm, date: e.target.value })}
                  />
                </div>

                {/* Diễn giải / Lý do */}
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="voucher-desc">Diễn giải / Lý do</label>
                  <textarea
                    id="voucher-desc"
                    rows={2}
                    placeholder="Nhập lý do xuất nhập hoặc ghi chú..."
                    value={voucherForm.description}
                    onChange={e => setVoucherForm({ ...voucherForm, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Chi tiết hàng hóa */}
              <div className={styles.sectionHeader}>
                <Warehouse size={18} color="#059669" /> 3. Danh sách hàng hóa, vật tư
              </div>

              <div className={styles.itemsSection}>
                <div className={styles.itemsTableContainer}>
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                        <th style={{ minWidth: '220px' }}>Hàng hóa / Vật tư</th>
                        <th style={{ width: '90px', textAlign: 'center' }}>ĐVT</th>
                        <th style={{ width: '130px' }}>Số lượng</th>
                        {!isWorker && <th style={{ width: '140px', textAlign: 'right' }}>Đơn giá (đ)</th>}
                        {!isWorker && <th style={{ width: '150px', textAlign: 'right' }}>Thành tiền (đ)</th>}
                        <th style={{ minWidth: '150px' }}>Ghi chú</th>
                        <th style={{ width: '50px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {voucherForm.items.map((it, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td>
                            <select
                              required
                              value={it.inventoryItemId}
                              onChange={e => handleItemSelect(idx, e.target.value)}
                              aria-label={`Chọn hàng hóa dòng ${idx + 1}`}
                            >
                              <option value="">-- Chọn hàng hóa --</option>
                              {availableItems.map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.productName || item.name} ({item.unitName || item.unit || 'Kg'}) - Lô #{item.id}{!isWorker && ` - ${Number(item.price || 0).toLocaleString('vi-VN')} đ`} - Tồn: {Number(item.stock || 0).toLocaleString('vi-VN')}
                                </option>
                              ))}
                            </select>
                            {it.inventoryItemId && (voucherForm.movementType === 'EXPORT' || voucherForm.movementType === 'TRANSFER') && (
                              <div className={styles.stockIndicator}>
                                Khả dụng: {it.availableStock.toLocaleString('vi-VN')} {it.unitName}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', color: '#4b5563', fontWeight: 500 }}>
                            {it.unitName || '—'}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              required
                              className={it.error ? styles.inputError : ''}
                              value={it.quantity}
                              onChange={e => handleQuantityChange(idx, e.target.value)}
                              aria-label={`Số lượng dòng ${idx + 1}`}
                            />
                            {it.error && (
                              <span role="alert" className={styles.stockError}>
                                {it.error}
                              </span>
                            )}
                          </td>
                          {!isWorker && (
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={it.unitPrice}
                                onChange={e => handleUnitPriceChange(idx, e.target.value)}
                                style={{ textAlign: 'right' }}
                                aria-label={`Đơn giá dòng ${idx + 1}`}
                              />
                            </td>
                          )}
                          {!isWorker && (
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#047857' }}>
                              {(Number(it.amount) || 0).toLocaleString('vi-VN')}
                            </td>
                          )}
                          <td>
                            <input
                              type="text"
                              placeholder="Ghi chú dòng..."
                              value={it.note}
                              onChange={e => handleNoteChange(idx, e.target.value)}
                              aria-label={`Ghi chú dòng ${idx + 1}`}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {voucherForm.items.length > 1 && (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                onClick={() => handleRemoveItemRow(idx)}
                                title="Xóa dòng này"
                                aria-label={`Xóa dòng ${idx + 1}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.addItemRow}>
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    onClick={handleAddItemRow}
                  >
                    <Plus size={15} /> Thêm hàng hóa
                  </button>
                </div>
              </div>

              {/* Tổng cộng & Nút Submit */}
              <div className={styles.summaryStrip}>
                <div className={styles.summaryValues}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Tổng mặt hàng:</span>
                    <strong>{voucherForm.items.length} mặt hàng</strong>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Tổng số lượng:</span>
                    <strong>{totalQuantity.toLocaleString('vi-VN')}</strong>
                  </div>
                  {!isWorker && (
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Tổng giá trị xuất/nhập:</span>
                      <span className={styles.summaryAmount}>
                        {totalAmount.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    onClick={() => setActiveTab('vouchers')}
                    disabled={submitting}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="farmshift-btn farmshift-btn-mint"
                    disabled={submitting || hasItemErrors}
                  >
                    {submitting ? 'Đang lưu phiếu...' : 'Lưu & Tạo phiếu'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── Tab 2: Danh sách phiếu xuất nhập ── */}
        {activeTab === 'vouchers' && (
          <div className={styles.card}>
            {/* Toolbar Filters */}
            <div className={styles.toolbar}>
              <div className={styles.filterRow}>
                {/* Tìm kiếm */}
                <div className={styles.searchInput}>
                  <Search size={16} color="#9ca3af" />
                  <input
                    type="text"
                    placeholder="Tìm theo mã phiếu, ghi chú, người lập..."
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                  />
                  {search && (
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={() => setSearch('')}
                    >
                      <X size={14} color="#9ca3af" />
                    </button>
                  )}
                </div>

                {/* Lọc loại phiếu */}
                <select
                  className={styles.filterSelect}
                  value={filterType}
                  onChange={e => {
                    setFilterType(e.target.value);
                    setPage(0);
                  }}
                  aria-label="Lọc theo loại phiếu"
                >
                  <option value="ALL">Tất cả loại phiếu</option>
                  <option value="IMPORT">Nhập kho</option>
                  <option value="EXPORT">Xuất kho</option>
                  <option value="TRANSFER">Chuyển kho</option>
                </select>

                {/* Lọc danh mục */}
                <select
                  className={styles.filterSelect}
                  value={filterCategory}
                  onChange={e => {
                    setFilterCategory(e.target.value);
                    setPage(0);
                  }}
                  aria-label="Lọc theo danh mục"
                >
                  <option value="ALL">Tất cả danh mục</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {/* Lọc kho */}
                <select
                  className={styles.filterSelect}
                  value={filterWarehouse}
                  onChange={e => {
                    setFilterWarehouse(e.target.value);
                    setPage(0);
                  }}
                  aria-label="Lọc theo kho"
                >
                  <option value="ALL">Tất cả kho hàng</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>

                {/* Lọc trạng thái */}
                <select
                  className={styles.filterSelect}
                  value={filterStatus}
                  onChange={e => {
                    setFilterStatus(e.target.value);
                    setPage(0);
                  }}
                  aria-label="Lọc theo trạng thái"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="COMPLETED">Đã hoàn thành</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              {/* Hàng lọc ngày */}
              <div className={styles.filterRow}>
                <div className={styles.dateInput}>
                  <span>Từ ngày:</span>
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={e => {
                      setFilterFrom(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <div className={styles.dateInput}>
                  <span>Đến ngày:</span>
                  <input
                    type="date"
                    value={filterTo}
                    onChange={e => {
                      setFilterTo(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>

                {(search || filterType !== 'ALL' || filterCategory !== 'ALL' || filterWarehouse !== 'ALL' || filterStatus !== 'ALL' || filterFrom || filterTo) && (
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => {
                      setSearch('');
                      setFilterType('ALL');
                      setFilterCategory('ALL');
                      setFilterWarehouse('ALL');
                      setFilterStatus('ALL');
                      setFilterFrom('');
                      setFilterTo('');
                      setPage(0);
                    }}
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>

            {/* Vouchers Table */}
            <div className="farmshift-table-container">
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Loại phiếu</th>
                    <th>Danh mục</th>
                    <th>Kho xuất</th>
                    <th>Kho nhập</th>
                    <th>Tổng giá trị</th>
                    <th>Người lập</th>
                    <th>Ngày lập</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchersLoading ? (
                    <tr>
                      <td colSpan={10} className={styles.emptyState}>
                        Đang tải danh sách phiếu...
                      </td>
                    </tr>
                  ) : vouchers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={styles.emptyState}>
                        Chưa có phiếu xuất nhập nội bộ.
                      </td>
                    </tr>
                  ) : (
                    vouchers.map(v => (
                      <tr key={v.id}>
                        <td>
                          <strong style={{ fontFamily: 'monospace', color: '#047857' }}>
                            {v.code}
                          </strong>
                        </td>
                        <td>
                          <span
                            className={`${styles.badge} ${
                              v.movementType === 'IMPORT'
                                ? styles.badgeImport
                                : v.movementType === 'EXPORT'
                                ? styles.badgeExport
                                : styles.badgeTransfer
                            }`}
                          >
                            {INTERNAL_STOCK_TYPES[v.movementType] || v.movementType}
                          </span>
                        </td>
                        <td>
                          <strong>{v.categoryName || '—'}</strong>
                          {(v.cycleCode || v.cycleName) && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                              {v.cycleCode || v.cycleName}
                            </div>
                          )}
                        </td>
                        <td>{v.sourceWarehouseName || '—'}</td>
                        <td>{v.targetWarehouseName || '—'}</td>
                        <td style={{ fontWeight: 600 }}>
                          {isWorker || v.totalAmount === null
                            ? '—'
                            : `${Number(v.totalAmount).toLocaleString('vi-VN')} đ`}
                        </td>
                        <td style={{ fontSize: '12.5px', color: '#4b5563' }}>
                          {v.createdBy || '—'}
                        </td>
                        <td style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          {v.movementDate || v.date}
                        </td>
                        <td>
                          <span
                            className={`${styles.badge} ${
                              v.status === 'COMPLETED'
                                ? styles.badgeCompleted
                                : styles.badgeCancelled
                            }`}
                          >
                            {INTERNAL_STOCK_STATUS[v.status] || v.status}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actions} style={{ justifyContent: 'center' }}>
                            {/* Xem chi tiết */}
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
                              onClick={() => setSelectedVoucher(v)}
                              title="Xem chi tiết"
                              aria-label={`Xem chi tiết ${v.code}`}
                            >
                              <Eye size={15} />
                            </button>

                            {/* In phiếu A4 */}
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => handlePrint(v)}
                              title="In phiếu A4"
                              aria-label={`In phiếu ${v.code}`}
                            >
                              <Printer size={15} />
                            </button>

                            {/* Hủy phiếu */}
                            {canMutate && v.status === 'COMPLETED' && (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                onClick={() => setVoucherToCancel(v)}
                                title="Hủy phiếu (Hoàn lại tồn kho)"
                                aria-label={`Hủy phiếu ${v.code}`}
                              >
                                <Ban size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <div>
                  Hiển thị trang <strong>{page + 1}</strong> / <strong>{totalPages}</strong> ({totalElements} phiếu)
                </div>
                <div className={styles.pageControls}>
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12.5px' }}
                    disabled={page === 0}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                  >
                    <ChevronLeft size={14} /> Trước
                  </button>
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12.5px' }}
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Sau <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: Quản lý danh mục lý do ── */}
        {activeTab === 'categories' && (
          <div className={styles.card}>
            <div className={styles.toolbar}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  {categories.length} danh mục lý do xuất nhập
                </span>
                {canMutate && (
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-mint"
                    onClick={() => setCategoryModal({ mode: 'create' })}
                  >
                    <Plus size={16} /> Thêm lý do mới
                  </button>
                )}
              </div>
            </div>

            <div className="farmshift-table-container">
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Loại phiếu</th>
                    <th>Tên lý do / Danh mục</th>
                    <th>Mô tả &amp; Hướng dẫn</th>
                    <th>Số phiếu</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyState}>
                        Chưa có danh mục lý do nào.
                      </td>
                    </tr>
                  ) : (
                    categories.map(cat => (
                      <tr key={cat.id}>
                        <td>
                          <span
                            className={`${styles.badge} ${
                              cat.movementType === 'IMPORT'
                                ? styles.badgeImport
                                : cat.movementType === 'EXPORT'
                                ? styles.badgeExport
                                : styles.badgeTransfer
                            }`}
                          >
                            {INTERNAL_STOCK_TYPES[cat.movementType] || cat.movementType}
                          </span>
                        </td>
                        <td>
                          <strong>{cat.name}</strong>
                          {cat.isSystem && (
                            <span className={`${styles.badge} ${styles.badgeSystem}`} style={{ marginLeft: '8px' }}>
                              Hệ thống
                            </span>
                          )}
                        </td>
                        <td style={{ color: '#4b5563', maxWidth: '350px' }}>
                          {cat.description || '—'}
                        </td>
                        <td style={{ fontWeight: 600 }}>{cat.voucherCount || 0}</td>
                        <td style={{ fontSize: '12.5px', color: '#6b7280' }}>
                          {cat.createdAt ? new Date(cat.createdAt).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td>
                          <div className={styles.actions} style={{ justifyContent: 'center' }}>
                            {canMutate && (
                              <>
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  onClick={() => setCategoryModal({ mode: 'edit', item: cat })}
                                  disabled={cat.isSystem}
                                  title={cat.isSystem ? 'Lý do mặc định của hệ thống không thể sửa' : `Sửa ${cat.name}`}
                                  aria-label={`Sửa ${cat.name}`}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                  onClick={() => setCategoryModal({ mode: 'delete', item: cat })}
                                  disabled={cat.isSystem || (cat.voucherCount && cat.voucherCount > 0)}
                                  title={
                                    cat.isSystem
                                      ? 'Lý do mặc định của hệ thống không thể xóa'
                                      : cat.voucherCount > 0
                                      ? 'Đã có phiếu sử dụng lý do này, không thể xóa'
                                      : `Xóa ${cat.name}`
                                  }
                                  aria-label={`Xóa ${cat.name}`}
                                >
                                  <Trash2 size={15} />
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
          </div>
        )}

        {/* ── Modal: Chi tiết phiếu xuất nhập ── */}
        {selectedVoucher && (
          <dialog className={styles.dialog} open>
            <div className={styles.modal} role="dialog" aria-labelledby="voucher-detail-title">
              <header className={styles.modalHeader}>
                <h2 id="voucher-detail-title">
                  Chi tiết phiếu {selectedVoucher.code}
                </h2>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setSelectedVoucher(null)}
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </header>

              <div className={styles.modalBody}>
                {/* Thông tin phiếu */}
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <label>Loại phiếu</label>
                    <span
                      className={`${styles.badge} ${
                        selectedVoucher.movementType === 'IMPORT'
                          ? styles.badgeImport
                          : selectedVoucher.movementType === 'EXPORT'
                          ? styles.badgeExport
                          : styles.badgeTransfer
                      }`}
                    >
                      {INTERNAL_STOCK_TYPES[selectedVoucher.movementType] || selectedVoucher.movementType}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <label>Trạng thái</label>
                    <span
                      className={`${styles.badge} ${
                        selectedVoucher.status === 'COMPLETED'
                          ? styles.badgeCompleted
                          : styles.badgeCancelled
                      }`}
                    >
                      {INTERNAL_STOCK_STATUS[selectedVoucher.status] || selectedVoucher.status}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <label>Danh mục</label>
                    <strong>{selectedVoucher.categoryName || '—'}</strong>
                  </div>
                  <div className={styles.infoItem}>
                    <label>Ngày thực hiện</label>
                    <strong>{selectedVoucher.movementDate || selectedVoucher.date}</strong>
                  </div>
                  <div className={styles.infoItem}>
                    <label>Kho xuất</label>
                    <strong>{selectedVoucher.sourceWarehouseName || '—'}</strong>
                  </div>
                  <div className={styles.infoItem}>
                    <label>Kho nhập</label>
                    <strong>{selectedVoucher.targetWarehouseName || '—'}</strong>
                  </div>
                  {(selectedVoucher.cycleCode || selectedVoucher.cycleName) && (
                    <div className={styles.infoItem}>
                      <label>Lứa nuôi</label>
                      <strong>{selectedVoucher.cycleCode || selectedVoucher.cycleName}</strong>
                    </div>
                  )}
                  <div className={styles.infoItem}>
                    <label>Người lập phiếu</label>
                    <strong>{selectedVoucher.createdBy || '—'}</strong>
                  </div>
                </div>

                {(selectedVoucher.note || selectedVoucher.description) && (
                  <div style={{ fontSize: '13px', color: '#4b5563', background: '#f9fafb', padding: '10px 14px', borderLeft: '3px solid #059669', borderRadius: '4px' }}>
                    <strong>Diễn giải:</strong> {selectedVoucher.note || selectedVoucher.description}
                  </div>
                )}

                {/* Bảng hàng hóa */}
                <div className={styles.itemsTableContainer}>
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                        <th>Hàng hóa / Vật tư</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>ĐVT</th>
                        <th style={{ width: '90px', textAlign: 'center' }}>Số lượng</th>
                        {!isWorker && selectedVoucher.totalAmount !== null && (
                          <>
                            <th style={{ width: '120px', textAlign: 'right' }}>Đơn giá (đ)</th>
                            <th style={{ width: '130px', textAlign: 'right' }}>Thành tiền (đ)</th>
                          </>
                        )}
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedVoucher.items || []).map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td><strong>{it.productName || 'Hàng hóa'}</strong></td>
                          <td style={{ textAlign: 'center' }}>{it.unitName || '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>
                            {Number(it.quantity || 0).toLocaleString('vi-VN')}
                          </td>
                          {!isWorker && selectedVoucher.totalAmount !== null && (
                            <>
                              <td style={{ textAlign: 'right' }}>
                                {it.unitPrice !== null ? Number(it.unitPrice).toLocaleString('vi-VN') : '—'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#047857' }}>
                                {it.amount !== null ? Number(it.amount).toLocaleString('vi-VN') : '—'}
                              </td>
                            </>
                          )}
                          <td style={{ fontSize: '12px', color: '#6b7280' }}>
                            {it.note || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <footer className={styles.modalFooter}>
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setSelectedVoucher(null)}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-mint"
                  onClick={() => handlePrint(selectedVoucher)}
                >
                  <Printer size={16} /> In phiếu A4
                </button>
              </footer>
            </div>
          </dialog>
        )}

        {/* ── Modal: Hủy phiếu xác nhận ── */}
        {voucherToCancel && (
          <dialog className={styles.dialog} open>
            <div className={styles.modal} role="dialog" aria-labelledby="cancel-voucher-title" style={{ maxWidth: '480px' }}>
              <header className={styles.modalHeader}>
                <h2 id="cancel-voucher-title" style={{ color: '#dc2626' }}>
                  Xác nhận hủy phiếu
                </h2>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setVoucherToCancel(null)}
                  disabled={submitting}
                >
                  <X size={18} />
                </button>
              </header>

              <div className={styles.modalBody}>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
                  Bạn có chắc chắn muốn hủy phiếu <strong>{voucherToCancel.code}</strong> (
                  {INTERNAL_STOCK_TYPES[voucherToCancel.movementType]})?
                </p>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', color: '#991b1b', lineHeight: 1.5 }}>
                  <AlertCircle size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
                  <strong>Lưu ý quan trọng:</strong> Hành động này sẽ hoàn lại toàn bộ số lượng tồn kho của các mặt hàng trong phiếu và chuyển trạng thái thành <em>Đã hủy</em>.
                </div>
              </div>

              <footer className={styles.modalFooter}>
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setVoucherToCancel(null)}
                  disabled={submitting}
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  className="farmshift-btn"
                  style={{ background: '#dc2626', color: '#ffffff', borderColor: '#b91c1c' }}
                  onClick={handleConfirmCancelVoucher}
                  disabled={submitting}
                >
                  {submitting ? 'Đang hủy...' : 'Xác nhận hủy phiếu'}
                </button>
              </footer>
            </div>
          </dialog>
        )}

        {/* ── Modal: Quản lý danh mục (Thêm / Sửa / Xem / Xóa) ── */}
        {categoryModal && (
          <CategoryFormModal
            modal={categoryModal}
            onClose={() => setCategoryModal(null)}
            onSaved={(msg) => {
              setCategoryModal(null);
              showToast(msg, 'success');
              loadCategories();
            }}
          />
        )}

        {/* Printable Voucher in DOM for window.print() */}
        {printingVoucher && (
          <PrintableInternalVoucher voucher={printingVoucher} />
        )}
      </div>
    </FarmShiftLayout>
  );
};

// Sub-component Modal for Category CRUD
function CategoryFormModal({ modal, onClose, onSaved }) {
  const { mode, item } = modal;
  const isView = mode === 'view';
  const isDelete = mode === 'delete';
  const isEdit = mode === 'edit';

  const [type, setType] = useState(item?.movementType || 'EXPORT');
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const namePlaceholder = type === 'EXPORT'
    ? 'Ví dụ: Xuất hao hụt kiểm kê, Xuất tiêm phòng dịch...'
    : type === 'IMPORT'
    ? 'Ví dụ: Nhập thừa sau kiểm kê, Nhập hoàn lại từ chuồng...'
    : 'Ví dụ: Chuyển sang kho đệm chuồng, Điều chuyển phân trại...';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!isDelete && !name.trim()) {
      setError('Vui lòng nhập tên lý do / danh mục.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isDelete) {
        await deleteInternalStockCategory(item.id);
        onSaved('Đã xóa lý do.');
      } else if (isEdit) {
        await updateInternalStockCategory(item.id, {
          movementType: type,
          name: name.trim(),
          description: description.trim()
        });
        onSaved('Đã cập nhật lý do.');
      } else {
        await createInternalStockCategory({
          movementType: type,
          name: name.trim(),
          description: description.trim()
        });
        onSaved('Đã tạo lý do mới thành công.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi lưu lý do.');
      setSaving(false);
    }
  };

  return (
    <dialog className={styles.dialog} open>
      <div className={styles.modal} role="dialog" aria-labelledby="cat-modal-title" style={{ maxWidth: '500px' }}>
        <header className={styles.modalHeader}>
          <h2 id="cat-modal-title">
            {isDelete
              ? 'Xác nhận xóa lý do'
              : isEdit
              ? 'Chỉnh sửa lý do xuất/nhập'
              : 'Thêm lý do xuất/nhập mới'}
          </h2>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && (
              <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>
                {error}
              </div>
            )}

            {isDelete ? (
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
                Bạn có chắc chắn muốn xóa lý do <strong>{item.name}</strong>?
              </p>
            ) : (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="cat-type">
                    Áp dụng cho loại phiếu <span className={styles.required}>*</span>
                  </label>
                  <select
                    id="cat-type"
                    required
                    value={type}
                    onChange={e => setType(e.target.value)}
                    disabled={isEdit || saving}
                  >
                    <option value="EXPORT">Xuất kho (Hàng xuất khỏi kho)</option>
                    <option value="IMPORT">Nhập kho (Hàng nhập thêm vào kho)</option>
                    <option value="TRANSFER">Chuyển kho (Luân chuyển nội bộ)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="cat-name">
                    Tên lý do xuất/nhập <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    required
                    maxLength={150}
                    placeholder={namePlaceholder}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="cat-desc">Mô tả &amp; Hướng dẫn áp dụng</label>
                  <textarea
                    id="cat-desc"
                    rows={3}
                    maxLength={1000}
                    placeholder="Giải thích khi nào thủ kho/kế toán nên chọn lý do này..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </>
            )}
          </div>

          <footer className={styles.modalFooter}>
            <button
              type="button"
              className="farmshift-btn farmshift-btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className={`farmshift-btn ${isDelete ? '' : 'farmshift-btn-mint'}`}
              style={isDelete ? { background: '#dc2626', color: '#ffffff', borderColor: '#b91c1c' } : {}}
              disabled={saving}
            >
              {saving ? 'Đang xử lý...' : isDelete ? 'Xóa lý do' : 'Lưu lý do'}
            </button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}
