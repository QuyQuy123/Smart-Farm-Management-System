// src/features/farmshift/ReportsView.jsx
// Báo cáo & Thống kê toàn diện trang trại chuẩn FarmShift (9 phân hệ dữ liệu thực)
import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet, RefreshCw, Search, Calendar, TrendingUp,
  Package, Warehouse, Wallet, Scale, ArrowLeftRight, Activity,
  ShoppingCart, ReceiptText, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useNotification } from '../../context/NotificationContext';
import { getReportSummary } from '../../services/reportService';
import styles from './ReportsView.module.css';

const EMPTY_REPORT = {
  from: null,
  to: null,
  generatedDate: null,
  farmSummary: {
    totalIn: 0,
    harvested: 0,
    harvestedWeightKg: 0,
    deaths: 0,
    culls: 0,
    currentLive: 0,
    activeBarns: 0,
    totalCycles: 0,
    lossRate: 0,
    survivalRate: 100,
    totalCost: 0,
    totalRevenue: 0,
    totalProfit: 0,
    cycles: [],
  },
  salesReport: {
    orderCount: 0,
    totalRevenue: 0,
    paidAmount: 0,
    debtAmount: 0,
    totalWeightKg: 0,
    totalQuantity: 0,
    avgUnitPrice: 0,
    orders: [],
  },
  purchasesReport: {
    invoiceCount: 0,
    cancelledCount: 0,
    totalAmount: 0,
    paidAmount: 0,
    debtAmount: 0,
    invoices: [],
  },
  inventoryReport: {
    totalSkus: 0,
    totalValue: 0,
    lowStockCount: 0,
    expiryAlertCount: 0,
    items: [],
  },
  harvestReport: {
    harvestEvents: 0,
    totalHead: 0,
    totalWeightKg: 0,
    totalRevenue: 0,
    avgUnitPrice: 0,
    rows: [],
  },
  growthReport: {
    analyzedCycles: 0,
    avgFcr: null,
    cycles: [],
  },
  internalStockReport: {
    voucherCount: 0,
    exportCount: 0,
    transferCount: 0,
    totalAmount: 0,
    items: [],
  },
  activityReport: {
    totalActivities: 0,
    items: [],
  },
};

const normalizeReportData = (raw) => {
  if (!raw || typeof raw !== 'object') return EMPTY_REPORT;
  return {
    from: raw.from || null,
    to: raw.to || null,
    generatedDate: raw.generatedDate || null,
    farmSummary: { ...EMPTY_REPORT.farmSummary, ...(raw.farmSummary || {}), cycles: Array.isArray(raw.farmSummary?.cycles) ? raw.farmSummary.cycles : [] },
    salesReport: { ...EMPTY_REPORT.salesReport, ...(raw.salesReport || {}), orders: Array.isArray(raw.salesReport?.orders) ? raw.salesReport.orders : [] },
    purchasesReport: { ...EMPTY_REPORT.purchasesReport, ...(raw.purchasesReport || {}), invoices: Array.isArray(raw.purchasesReport?.invoices) ? raw.purchasesReport.invoices : [] },
    inventoryReport: { ...EMPTY_REPORT.inventoryReport, ...(raw.inventoryReport || {}), items: Array.isArray(raw.inventoryReport?.items) ? raw.inventoryReport.items : [] },
    harvestReport: { ...EMPTY_REPORT.harvestReport, ...(raw.harvestReport || {}), rows: Array.isArray(raw.harvestReport?.rows) ? raw.harvestReport.rows : [] },
    growthReport: { ...EMPTY_REPORT.growthReport, ...(raw.growthReport || {}), cycles: Array.isArray(raw.growthReport?.cycles) ? raw.growthReport.cycles : [] },
    internalStockReport: { ...EMPTY_REPORT.internalStockReport, ...(raw.internalStockReport || {}), items: Array.isArray(raw.internalStockReport?.items) ? raw.internalStockReport.items : [] },
    activityReport: { ...EMPTY_REPORT.activityReport, ...(raw.activityReport || {}), items: Array.isArray(raw.activityReport?.items) ? raw.activityReport.items : [] },
  };
};

const fmtNum = (val, digits = 0) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const fmtVnd = (val) => `${fmtNum(Math.round(Number(val || 0)))} đ`;

const fmtDate = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
};

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  const d = fmtDate(s);
  const timePart = s.length >= 16 ? s.slice(11, 16) : '';
  return timePart ? `${d} ${timePart}` : d;
};

const csvCell = (val) => {
  const str = val === null || val === undefined ? '' : String(val);
  return `"${str.replace(/"/g, '""')}"`;
};

const getIsoDate = (dateObj) => dateObj.toISOString().slice(0, 10);

const getPresetRange = (presetKey) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (presetKey === 'month') {
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0));
    return { from: getIsoDate(start), to: getIsoDate(end) };
  }
  if (presetKey === 'quarter') {
    const qStartMonth = Math.floor(m / 3) * 3;
    const start = new Date(Date.UTC(y, qStartMonth, 1));
    const end = new Date(Date.UTC(y, qStartMonth + 3, 0));
    return { from: getIsoDate(start), to: getIsoDate(end) };
  }
  if (presetKey === 'year') {
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return { from: '', to: '' };
};

const SALES_STATUS_LABELS = {
  PAID: 'Đã thanh toán đủ',
  PARTIAL: 'Thanh toán một phần',
  DEBT: 'Ghi công nợ',
};

const EXPIRY_LABELS = {
  NORMAL: 'Bình thường',
  NEAR_EXPIRY: 'Sắp hết hạn',
  EXPIRED: 'Đã hết hạn',
  NO_EXPIRY: 'Không HSD',
};

export const ReportsView = () => {
  const notification = useNotification();
  const showToast = notification?.showToast || (() => {});

  const [activeTab, setActiveTab] = useState('summary');
  const [preset, setPreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activityModuleFilter, setActivityModuleFilter] = useState('ALL');
  const [inventoryAlertOnly, setInventoryAlertOnly] = useState(false);

  const [pages, setPages] = useState({
    summary: 1,
    sales: 1,
    purchases: 1,
    inventory: 1,
    harvest: 1,
    growth: 1,
    internal: 1,
    activity: 1,
  });
  const [pageSizes, setPageSizes] = useState({
    summary: 10,
    sales: 10,
    purchases: 10,
    inventory: 10,
    harvest: 10,
    growth: 9,
    internal: 10,
    activity: 15,
  });

  const resetAllPages = () => {
    setPages({
      summary: 1,
      sales: 1,
      purchases: 1,
      inventory: 1,
      harvest: 1,
      growth: 1,
      internal: 1,
      activity: 1,
    });
  };

  const setTabPage = (key, nextPage) => {
    setPages((prev) => ({ ...prev, [key]: nextPage }));
  };

  const setTabPageSize = (key, nextSize) => {
    setPageSizes((prev) => ({ ...prev, [key]: nextSize }));
    setPages((prev) => ({ ...prev, [key]: 1 }));
  };

  const [report, setReport] = useState(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getReportSummary({
      from: dateFrom || undefined,
      to: dateTo || undefined,
      forceRefresh: refreshNonce > 0,
    })
      .then((payload) => {
        if (cancelled) return;
        setReport(normalizeReportData(payload));
        setErrorMsg('');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err?.response?.data?.message || 'Không thể tải dữ liệu báo cáo từ máy chủ.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, refreshNonce]);

  const handleRefresh = () => {
    setLoading(true);
    setErrorMsg('');
    setRefreshNonce((n) => n + 1);
  };

  const handleSelectPreset = (key) => {
    setPreset(key);
    const range = getPresetRange(key);
    resetAllPages();
    setLoading(true);
    setErrorMsg('');
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const handleDateChange = (field, value) => {
    setPreset('custom');
    resetAllPages();
    setLoading(true);
    setErrorMsg('');
    if (field === 'from') setDateFrom(value);
    else setDateTo(value);
  };

  const {
    farmSummary,
    salesReport,
    purchasesReport,
    inventoryReport,
    harvestReport,
    growthReport,
    internalStockReport,
    activityReport,
  } = report;

  const q = searchTerm.trim().toLowerCase();

  const filteredCycles = useMemo(() => {
    if (!q) return farmSummary.cycles;
    return farmSummary.cycles.filter((c) =>
      `${c.cycleCode} ${c.barnName} ${c.areaName} ${c.breed}`.toLowerCase().includes(q)
    );
  }, [farmSummary.cycles, q]);

  const filteredSales = useMemo(() => {
    if (!q) return salesReport.orders;
    return salesReport.orders.filter((o) =>
      `${o.code} ${o.customer} ${o.flock}`.toLowerCase().includes(q)
    );
  }, [salesReport.orders, q]);

  const filteredPurchases = useMemo(() => {
    if (!q) return purchasesReport.invoices;
    return purchasesReport.invoices.filter((p) =>
      `${p.code} ${p.supplier} ${p.warehouseSummary}`.toLowerCase().includes(q)
    );
  }, [purchasesReport.invoices, q]);

  const filteredInventory = useMemo(() => {
    return inventoryReport.items.filter((it) => {
      if (inventoryAlertOnly && !it.lowStock && it.expiryStatus !== 'EXPIRED' && it.expiryStatus !== 'NEAR_EXPIRY') {
        return false;
      }
      if (!q) return true;
      return `${it.code} ${it.name} ${it.warehouseName} ${it.lotNumber || ''}`.toLowerCase().includes(q);
    });
  }, [inventoryReport.items, inventoryAlertOnly, q]);

  const filteredHarvest = useMemo(() => {
    if (!q) return harvestReport.rows;
    return harvestReport.rows.filter((h) =>
      `${h.cycleCode} ${h.barnName} ${h.areaName} ${h.breed}`.toLowerCase().includes(q)
    );
  }, [harvestReport.rows, q]);

  const filteredGrowth = useMemo(() => {
    if (!q) return growthReport.cycles;
    return growthReport.cycles.filter((g) =>
      `${g.cycleCode} ${g.barnName} ${g.areaName} ${g.breed}`.toLowerCase().includes(q)
    );
  }, [growthReport.cycles, q]);

  const filteredInternal = useMemo(() => {
    if (!q) return internalStockReport.items;
    return internalStockReport.items.filter((iv) =>
      `${iv.code} ${iv.itemName} ${iv.sourceWarehouse} ${iv.targetDestination} ${iv.categoryName}`.toLowerCase().includes(q)
    );
  }, [internalStockReport.items, q]);

  const activityModules = useMemo(() => {
    const mods = new Set(activityReport.items.map((a) => a.module).filter(Boolean));
    return ['ALL', ...mods];
  }, [activityReport.items]);

  const filteredActivities = useMemo(() => {
    return activityReport.items.filter((a) => {
      if (activityModuleFilter !== 'ALL' && a.module !== activityModuleFilter) return false;
      if (!q) return true;
      return `${a.actor} ${a.module} ${a.action} ${a.detail} ${a.referenceCode || ''}`.toLowerCase().includes(q);
    });
  }, [activityReport.items, activityModuleFilter, q]);

  const paginateList = (items, currentPage, pageSize) => {
    const pagesCount = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), pagesCount);
    const start = (safePage - 1) * pageSize;
    return {
      rows: items.slice(start, start + pageSize),
      page: safePage,
      pages: pagesCount,
      total: items.length,
      pageSize,
      from: items.length === 0 ? 0 : start + 1,
      to: Math.min(items.length, start + pageSize),
    };
  };

  const renderPager = (paging, key, unitLabel, sizeOptions = [10, 15, 30, 50, 100]) => {
    if (paging.total <= 6 && paging.pages <= 1) return null;
    return (
      <div className={styles.pagerBar}>
        <span>
          Hiển thị <strong>{paging.from}–{paging.to}</strong> / <strong>{paging.total}</strong> {unitLabel}
        </span>
        <div className={styles.pagerControls}>
          <label className={styles.pagerSelectLabel}>
            Số dòng:
            <select
              className={styles.pagerSelect}
              aria-label={`Số dòng mỗi trang ${unitLabel}`}
              value={paging.pageSize}
              onChange={(e) => setTabPageSize(key, Number(e.target.value))}
            >
              {sizeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            style={{ padding: '5px 10px', fontSize: '13px' }}
            disabled={paging.page <= 1}
            onClick={() => setTabPage(key, paging.page - 1)}
            aria-label={`Trang trước ${unitLabel}`}
          >
            <ChevronLeft size={14} /> Trước
          </button>
          <span>Trang <strong>{paging.page}</strong> / {paging.pages}</span>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            style={{ padding: '5px 10px', fontSize: '13px' }}
            disabled={paging.page >= paging.pages}
            onClick={() => setTabPage(key, paging.page + 1)}
            aria-label={`Trang sau ${unitLabel}`}
          >
            Sau <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  const cyclePaging = paginateList(filteredCycles, pages.summary, pageSizes.summary);
  const salesPaging = paginateList(filteredSales, pages.sales, pageSizes.sales);
  const purchasePaging = paginateList(filteredPurchases, pages.purchases, pageSizes.purchases);
  const inventoryPaging = paginateList(filteredInventory, pages.inventory, pageSizes.inventory);
  const harvestPaging = paginateList(filteredHarvest, pages.harvest, pageSizes.harvest);
  const growthPaging = paginateList(filteredGrowth, pages.growth, pageSizes.growth);
  const internalPaging = paginateList(filteredInternal, pages.internal, pageSizes.internal);
  const activityPaging = paginateList(filteredActivities, pages.activity, pageSizes.activity);

  const handleExportExcel = () => {
    let headers;
    let rows;
    let filePrefix;

    if (activeTab === 'summary') {
      filePrefix = 'Bao_cao_tong_hop_trang_trai';
      headers = ['Mã lứa', 'Chuồng', 'Khu', 'Giống gà', 'Trạng thái', 'Nhập đàn', 'Hao hụt', 'Xuất bán', 'Hiện nuôi', 'Tỷ lệ sống (%)', 'Chi phí (VND)', 'Doanh thu (VND)', 'Lợi nhuận (VND)'];
      rows = filteredCycles.map((c) => [
        c.cycleCode, c.barnName, c.areaName, c.breed,
        c.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã đóng',
        c.totalIn, Number(c.deaths || 0) + Number(c.culls || 0),
        c.harvested, c.currentQuantity, c.survivalRate,
        c.totalCost, c.revenue, c.profit,
      ]);
    } else if (activeTab === 'sales') {
      filePrefix = 'Bao_cao_ban_hang';
      headers = ['Mã đơn', 'Ngày', 'Khách hàng', 'Đàn / Chuồng', 'Số con', 'Khối lượng (kg)', 'Đơn giá', 'Tổng tiền (VND)', 'Đã thu', 'Còn nợ', 'Trạng thái'];
      rows = filteredSales.map((o) => [
        o.code, o.date, o.customer, o.flock, o.quantity, o.totalWeight, o.unitPrice, o.totalAmount, o.paidAmount, o.debtAmount, SALES_STATUS_LABELS[o.status] || o.status,
      ]);
    } else if (activeTab === 'purchases') {
      filePrefix = 'Bao_cao_nhap_hang';
      headers = ['Mã hóa đơn', 'Ngày', 'Nhà cung cấp', 'Kho / Chuồng', 'Tổng tiền (VND)', 'Đã trả', 'Còn nợ', 'Thanh toán', 'Trạng thái kho'];
      rows = filteredPurchases.map((p) => [
        p.code, p.date, p.supplier, p.warehouseSummary, p.totalAmount, p.paidAmount, p.debtAmount, p.paymentStatus, p.stockStatus,
      ]);
    } else if (activeTab === 'inventory') {
      filePrefix = 'Bao_cao_ton_kho';
      headers = ['Mã hàng', 'Tên hàng hóa', 'Kho', 'Đơn vị', 'Tồn kho', 'Tối thiểu', 'Đơn giá', 'Giá trị tồn (VND)', 'Số lô', 'HSD', 'Cảnh báo'];
      rows = filteredInventory.map((i) => [
        i.code, i.name, i.warehouseName, i.unitName, i.stock, i.minStock ?? '', i.unitPrice, i.totalValue, i.lotNumber || '', i.expiryDate || '',
        i.lowStock ? 'Sắp hết hàng' : (EXPIRY_LABELS[i.expiryStatus] || ''),
      ]);
    } else if (activeTab === 'harvest') {
      filePrefix = 'Bao_cao_thu_hoach';
      headers = ['Mã lứa', 'Chuồng', 'Giống gà', 'Số đợt xuất', 'Số con', 'Tổng kg', 'TB kg/con', 'Doanh thu (VND)', 'Giá TB/kg', 'Ngày xuất gần nhất'];
      rows = filteredHarvest.map((h) => [
        h.cycleCode, h.barnName, h.breed, h.harvestEvents, h.totalHead, h.totalWeightKg, h.avgWeightPerBird, h.totalRevenue, h.avgPricePerKg, h.lastHarvestDate || '',
      ]);
    } else if (activeTab === 'growth') {
      filePrefix = 'Bao_cao_tang_truong_FCR';
      headers = ['Mã lứa', 'Chuồng', 'Giống gà', 'Ngày tuổi', 'Cân TB (kg)', 'Tổng cám (kg)', 'Cám/con (kg)', 'Tăng trọng đàn (kg)', 'FCR', 'ADG (g/ngày)', 'Tỷ lệ sống (%)'];
      rows = filteredGrowth.map((g) => [
        g.cycleCode, g.barnName, g.breed, g.ageDays ?? '', g.avgWeightKg ?? '', g.feedKg, g.feedPerBirdKg ?? '', g.gainKg, g.fcr ?? '', g.adgGrams ?? '', g.survivalRate,
      ]);
    } else if (activeTab === 'internal') {
      filePrefix = 'Bao_cao_xuat_nhap_noi_bo';
      headers = ['Mã phiếu', 'Ngày', 'Loại', 'Hạng mục', 'Hàng hóa', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền (VND)', 'Kho xuất', 'Nơi nhận'];
      rows = filteredInternal.map((iv) => [
        iv.code, iv.movementDate, iv.movementType, iv.categoryName, iv.itemName, iv.unitName, iv.quantity, iv.unitPrice, iv.totalAmount, iv.sourceWarehouse, iv.targetDestination,
      ]);
    } else {
      filePrefix = 'Nhat_ky_hoat_dong';
      headers = ['Thời gian', 'Nhân sự', 'Phân hệ', 'Thao tác', 'Nội dung chi tiết', 'Chứng từ'];
      rows = filteredActivities.map((a) => [
        fmtDateTime(a.timestamp || a.date), a.actor, a.module, a.action, a.detail, a.referenceCode || '',
      ]);
    }

    if (!rows.length) {
      showToast('Chưa có dữ liệu trong mục báo cáo này để xuất.', 'warning');
      return;
    }

    const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filePrefix}_${getIsoDate(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Xuất báo cáo Excel (CSV) thành công.', 'success');
  };

  const tabs = [
    { id: 'summary', label: 'Tổng hợp trang trại', count: farmSummary.totalCycles },
    { id: 'sales', label: 'Báo cáo bán hàng', count: salesReport.orderCount },
    { id: 'purchases', label: 'Báo cáo nhập hàng', count: purchasesReport.invoiceCount },
    { id: 'inventory', label: 'Báo cáo tồn kho', count: inventoryReport.totalSkus },
    { id: 'harvest', label: 'Báo cáo thu hoạch', count: harvestReport.harvestEvents },
    { id: 'growth', label: 'Xu hướng lứa nuôi (FCR)', count: growthReport.analyzedCycles },
    { id: 'internal', label: 'Xuất nhập nội bộ', count: internalStockReport.voucherCount },
    { id: 'activity', label: 'Nhật ký hoạt động', count: activityReport.totalActivities },
  ];

  const renderSearchBar = (placeholder, extraControls = null) => (
    <div className={styles.dateRangeGroup}>
      <div className={styles.searchWrap}>
        <Search size={15} className={styles.searchIcon} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            resetAllPages();
          }}
        />
      </div>
      {extraControls}
    </div>
  );

  return (
    <FarmShiftLayout
      pageTitle="Báo cáo & Phân tích chăn nuôi"
      breadcrumbs={[{ label: 'Báo cáo & Thống kê' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? styles.spin : ''} /> Làm mới
          </button>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-excel"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet size={15} /> Xuất Báo cáo Excel
          </button>
        </div>
      }
    >
      {/* ── Date Range Filter Bar ──────────────────────────── */}
      <div className={styles.filterBar}>
        <div className={styles.presetGroup}>
          <span className={styles.presetLabel}>
            <Calendar size={14} /> Kỳ báo cáo:
          </span>
          {[
            { key: 'all', label: 'Toàn thời gian' },
            { key: 'month', label: 'Tháng này' },
            { key: 'quarter', label: 'Quý này' },
            { key: 'year', label: 'Năm nay' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`${styles.presetBtn} ${preset === opt.key ? styles.presetBtnActive : ''}`}
              onClick={() => handleSelectPreset(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className={styles.dateRangeGroup}>
          <label className={styles.dateField}>
            <span>Từ</span>
            <input
              type="date"
              aria-label="Từ ngày"
              className={styles.dateInput}
              value={dateFrom}
              onChange={(e) => handleDateChange('from', e.target.value)}
            />
          </label>
          <label className={styles.dateField}>
            <span>Đến</span>
            <input
              type="date"
              aria-label="Đến ngày"
              className={styles.dateInput}
              value={dateTo}
              onChange={(e) => handleDateChange('to', e.target.value)}
            />
          </label>
        </div>
      </div>

      {errorMsg && (
        <div className={`${styles.statusBanner} ${styles.errorBanner}`} role="alert">
          <span>{errorMsg}</span>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            style={{ padding: '4px 12px', fontSize: '13px' }}
            onClick={handleRefresh}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* ── Tabs Navigation (All 9 Reports) ────────────────── */}
      <div className={`farmshift-tabs ${styles.tabsWrap}`} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`farmshift-tab-btn ${styles.tabBtn} ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <span className={styles.tabCount}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── Tab 1: Tổng hợp trang trại ───────────────────── */}
      {activeTab === 'summary' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng nhập đàn</span>
                <span className={styles.kpiIcon}><TrendingUp size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(farmSummary.totalIn)} con</div>
              <div className={styles.kpiSub}>
                {farmSummary.totalCycles} lứa nuôi ({farmSummary.activeBarns} chuồng đang nuôi)
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Đã xuất bán thịt</span>
                <span className={styles.kpiIcon}><ShoppingCart size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                {fmtNum(farmSummary.harvested)} con
              </div>
              <div className={styles.kpiSub}>{fmtNum(farmSummary.harvestedWeightKg, 1)} kg thương phẩm</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tỷ lệ nuôi sống</span>
                <span className={styles.kpiIcon}><CheckCircle2 size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                {fmtNum(farmSummary.survivalRate, 2)}%
              </div>
              <div className={styles.kpiSub}>
                Hao hụt: {fmtNum(Number(farmSummary.deaths || 0) + Number(farmSummary.culls || 0))} con ({fmtNum(farmSummary.lossRate, 2)}%)
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Đang nuôi hiện tại</span>
                <span className={styles.kpiIcon}><Scale size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(farmSummary.currentLive)} con</div>
              <div className={styles.kpiSub}>
                Lợi nhuận ước tính: <strong className={Number(farmSummary.totalProfit) >= 0 ? styles.positiveText : styles.negativeText}>{fmtVnd(farmSummary.totalProfit)}</strong>
              </div>
            </div>
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Hiệu quả chăn nuôi & hạch toán theo từng chuồng</h3>
                <span className={styles.sectionSubtitle}>
                  Tổng chi phí lứa: {fmtVnd(farmSummary.totalCost)} · Tổng doanh thu thu hoạch: {fmtVnd(farmSummary.totalRevenue)}
                </span>
              </div>
              {renderSearchBar('Tìm mã lứa, chuồng, khu, giống gà...')}
            </div>

            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className={`farmshift-table ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Mã lứa / Chuồng</th>
                    <th>Giống gà</th>
                    <th>Trạng thái</th>
                    <th className={styles.numCell}>Nhập đàn</th>
                    <th className={styles.numCell}>Hao hụt</th>
                    <th className={styles.numCell}>Xuất bán</th>
                    <th className={styles.numCell}>Hiện nuôi</th>
                    <th className={styles.numCell}>Tỷ lệ sống</th>
                    <th className={styles.numCell}>Chi phí lứa</th>
                    <th className={styles.numCell}>Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {cyclePaging.rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={styles.emptyRow}>
                        {loading ? 'Đang tổng hợp dữ liệu trang trại...' : 'Chưa có lứa nuôi phù hợp với bộ lọc.'}
                      </td>
                    </tr>
                  ) : cyclePaging.rows.map((c) => (
                    <tr key={c.cycleId}>
                      <td>
                        <span className={styles.codeCell}>{c.cycleCode}</span> · <strong>{c.barnName}</strong>
                        <span className={styles.subText}>{c.areaName || 'Trang trại'} · Bắt đầu {fmtDate(c.startDate)}</span>
                      </td>
                      <td>{c.breed}</td>
                      <td>
                        <span className={c.status === 'ACTIVE' ? styles.mintBadge : styles.sageBadge}>
                          {c.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã đóng'}
                        </span>
                      </td>
                      <td className={styles.numCell}>{fmtNum(c.totalIn)} con</td>
                      <td className={styles.numCell}>{fmtNum(Number(c.deaths || 0) + Number(c.culls || 0))} con</td>
                      <td className={styles.numCell}>{fmtNum(c.harvested)} con</td>
                      <td className={styles.numCell}><strong>{fmtNum(c.currentQuantity)} con</strong></td>
                      <td className={styles.numCell}>
                        <span className={Number(c.survivalRate) >= 95 ? styles.mintBadge : styles.warnBadge}>
                          {fmtNum(c.survivalRate, 1)}%
                        </span>
                      </td>
                      <td className={styles.numCell}>{fmtVnd(c.totalCost)}</td>
                      <td className={`${styles.numCell} ${styles.positiveText}`}>{fmtVnd(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPager(cyclePaging, 'summary', 'lứa nuôi')}
          </div>
        </div>
      )}

      {/* ── Tab 2: Báo cáo bán hàng ──────────────────────── */}
      {activeTab === 'sales' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng doanh thu bán gà</span>
                <span className={styles.kpiIcon}><ShoppingCart size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(salesReport.totalRevenue)}</div>
              <div className={styles.kpiSub}>{salesReport.orderCount} đơn xuất bán</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tiền đã thu</span>
                <span className={styles.kpiIcon}><Wallet size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtVnd(salesReport.paidAmount)}</div>
              <div className={styles.kpiSub}>Công nợ phải thu: {fmtVnd(salesReport.debtAmount)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng sản lượng xuất</span>
                <span className={styles.kpiIcon}><Scale size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(salesReport.totalWeightKg, 1)} kg</div>
              <div className={styles.kpiSub}>
                {fmtNum(salesReport.totalQuantity)} con · TB {fmtVnd(salesReport.avgUnitPrice)}/kg
              </div>
            </div>
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Danh sách đơn xuất bán gà thịt thương phẩm</h3>
                <span className={styles.sectionSubtitle}>Dữ liệu đối chiếu thực tế từ phân hệ Quản lý bán hàng</span>
              </div>
              {renderSearchBar('Tìm mã đơn, khách hàng, chuồng...')}
            </div>
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className={`farmshift-table ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Ngày xuất</th>
                    <th>Khách hàng</th>
                    <th>Khu / Chuồng / Đàn</th>
                    <th className={styles.numCell}>Số lượng</th>
                    <th className={styles.numCell}>Tổng tiền</th>
                    <th className={styles.numCell}>Đã thu</th>
                    <th className={styles.numCell}>Còn nợ</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {salesPaging.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={styles.emptyRow}>Chưa có đơn bán hàng trong kỳ báo cáo.</td>
                    </tr>
                  ) : salesPaging.rows.map((o) => (
                    <tr key={o.id}>
                      <td><span className={styles.codeCell}>{o.code}</span></td>
                      <td className={styles.dateCell}>{fmtDate(o.date)}</td>
                      <td><strong>{o.customer}</strong></td>
                      <td>{o.flock || '—'}</td>
                      <td className={styles.numCell}>
                        {fmtNum(o.quantity)} con
                        <span className={styles.subText}>{fmtNum(o.totalWeight, 1)} kg</span>
                      </td>
                      <td className={styles.numCell}><strong>{fmtVnd(o.totalAmount)}</strong></td>
                      <td className={`${styles.numCell} ${styles.positiveText}`}>{fmtVnd(o.paidAmount)}</td>
                      <td className={`${styles.numCell} ${Number(o.debtAmount) > 0 ? styles.negativeText : ''}`}>{fmtVnd(o.debtAmount)}</td>
                      <td>
                        <span className={o.status === 'PAID' ? styles.mintBadge : styles.warnBadge}>
                          {SALES_STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPager(salesPaging, 'sales', 'đơn bán')}
          </div>
        </div>
      )}

      {/* ── Tab 3: Báo cáo nhập hàng ─────────────────────── */}
      {activeTab === 'purchases' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng giá trị nhập hàng</span>
                <span className={styles.kpiIcon}><ReceiptText size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtVnd(purchasesReport.totalAmount)}</div>
              <div className={styles.kpiSub}>
                {purchasesReport.invoiceCount} hóa đơn hợp lệ{purchasesReport.cancelledCount > 0 ? ` (${purchasesReport.cancelledCount} đã hủy)` : ''}
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Đã thanh toán NCC</span>
                <span className={styles.kpiIcon}><CheckCircle2 size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(purchasesReport.paidAmount)}</div>
              <div className={styles.kpiSub}>Tổng tiền đã thanh toán nhà cung cấp</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Công nợ phải trả NCC</span>
                <span className={styles.kpiIcon}><Wallet size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${Number(purchasesReport.debtAmount) > 0 ? styles.kpiValueWarn : ''}`}>
                {fmtVnd(purchasesReport.debtAmount)}
              </div>
              <div className={styles.kpiSub}>Không tính hóa đơn đã hủy</div>
            </div>
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Chi tiết hóa đơn nhập hàng & con giống</h3>
                <span className={styles.sectionSubtitle}>Theo nhà cung cấp và trạng thái nhập kho / chuồng</span>
              </div>
              {renderSearchBar('Tìm mã hóa đơn, nhà cung cấp, kho...')}
            </div>
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className={`farmshift-table ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Ngày nhập</th>
                    <th>Nhà cung cấp</th>
                    <th>Kho / Nơi nhận</th>
                    <th className={styles.numCell}>Tổng tiền</th>
                    <th className={styles.numCell}>Đã trả</th>
                    <th className={styles.numCell}>Còn nợ</th>
                    <th>Thanh toán</th>
                    <th>Kho hàng</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasePaging.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={styles.emptyRow}>Chưa có hóa đơn nhập hàng trong kỳ báo cáo.</td>
                    </tr>
                  ) : purchasePaging.rows.map((p) => {
                    const isCancelled = String(p.stockStatus || '').toLowerCase() === 'đã hủy';
                    return (
                      <tr key={p.id}>
                        <td><span className={styles.codeCell}>{p.code}</span></td>
                        <td className={styles.dateCell}>{fmtDate(p.date)}</td>
                        <td><strong>{p.supplier}</strong></td>
                        <td>{p.warehouseSummary}</td>
                        <td className={styles.numCell}><strong>{fmtVnd(p.totalAmount)}</strong></td>
                        <td className={styles.numCell}>{fmtVnd(p.paidAmount)}</td>
                        <td className={`${styles.numCell} ${!isCancelled && p.debtAmount > 0 ? styles.negativeText : ''}`}>
                          {fmtVnd(p.debtAmount)}
                        </td>
                        <td>
                          <span className={String(p.paymentStatus).includes('hoàn tất') ? styles.mintBadge : styles.warnBadge}>
                            {p.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <span className={isCancelled ? styles.dangerBadge : styles.sageBadge}>
                            {p.stockStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {renderPager(purchasePaging, 'purchases', 'hóa đơn')}
          </div>
        </div>
      )}

      {/* ── Tab 4: Báo cáo tồn kho ───────────────────────── */}
      {activeTab === 'inventory' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Giá trị tồn kho hiện tại</span>
                <span className={styles.kpiIcon}><Warehouse size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(inventoryReport.totalValue)}</div>
              <div className={styles.kpiSub}>{inventoryReport.totalSkus} lô / mặt hàng tồn kho</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Sắp hết định mức</span>
                <span className={styles.kpiIcon}><AlertTriangle size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${inventoryReport.lowStockCount > 0 ? styles.kpiValueWarn : ''}`}>
                {inventoryReport.lowStockCount} mặt hàng
              </div>
              <div className={styles.kpiSub}>Tồn kho thực tế &le; mức tối thiểu</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Cảnh báo hạn sử dụng</span>
                <span className={styles.kpiIcon}><Package size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${inventoryReport.expiryAlertCount > 0 ? styles.kpiValueWarn : ''}`}>
                {inventoryReport.expiryAlertCount} lô
              </div>
              <div className={styles.kpiSub}>Sắp hết hạn hoặc đã quá hạn</div>
            </div>
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Kiểm kê tồn kho & định giá theo lô</h3>
                <span className={styles.sectionSubtitle}>Ảnh chụp số dư thực tế tại các kho trang trại</span>
              </div>
              {renderSearchBar(
                'Tìm mã hàng, tên vật tư, kho, số lô...',
                <label className={styles.dateField} style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={inventoryAlertOnly}
                    onChange={(e) => {
                      setInventoryAlertOnly(e.target.checked);
                      setTabPage('inventory', 1);
                    }}
                    style={{ width: 'auto', margin: 0, accentColor: '#019788' }}
                  />
                  <span>Chỉ hiện hàng cảnh báo</span>
                </label>
              )}
            </div>

            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className={`farmshift-table ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Mã hàng</th>
                    <th>Tên hàng hóa</th>
                    <th>Kho lưu trữ</th>
                    <th>Số lô / HSD</th>
                    <th className={styles.numCell}>Tồn hiện tại</th>
                    <th className={styles.numCell}>Đơn giá</th>
                    <th className={styles.numCell}>Giá trị tồn</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryPaging.rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.emptyRow}>Không tìm thấy vật tư tồn kho phù hợp.</td>
                    </tr>
                  ) : inventoryPaging.rows.map((item) => (
                    <tr key={item.id}>
                      <td><span className={styles.codeCell}>{item.code}</span></td>
                      <td>
                        <strong>{item.name}</strong>
                        {item.productType && <span className={styles.subText}>{item.productType}</span>}
                      </td>
                      <td>{item.warehouseName}</td>
                      <td>
                        {item.lotNumber || '—'}
                        {item.expiryDate && <span className={styles.subText}>HSD: {fmtDate(item.expiryDate)}</span>}
                      </td>
                      <td className={styles.numCell}>
                        <strong>{fmtNum(item.stock)} {item.unitName}</strong>
                        {item.minStock !== null && item.minStock !== undefined && (
                          <span className={styles.subText}>Tối thiểu: {fmtNum(item.minStock)}</span>
                        )}
                      </td>
                      <td className={styles.numCell}>{fmtVnd(item.unitPrice)}</td>
                      <td className={styles.numCell}><strong>{fmtVnd(item.totalValue)}</strong></td>
                      <td>
                        {item.lowStock ? (
                          <span className={styles.warnBadge}>Sắp hết hàng</span>
                        ) : item.expiryStatus === 'EXPIRED' ? (
                          <span className={styles.dangerBadge}>Hết hạn</span>
                        ) : item.expiryStatus === 'NEAR_EXPIRY' ? (
                          <span className={styles.warnBadge}>Cận hạn</span>
                        ) : (
                          <span className={styles.mintBadge}>Ổn định</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPager(inventoryPaging, 'inventory', 'mặt hàng')}
          </div>
        </div>
      )}

      {/* ── Tab 5: Báo cáo thu hoạch ─────────────────────── */}
      {activeTab === 'harvest' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Sản lượng thu hoạch</span>
                <span className={styles.kpiIcon}><Scale size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(harvestReport.totalWeightKg, 1)} kg</div>
              <div className={styles.kpiSub}>{fmtNum(harvestReport.totalHead)} con qua {harvestReport.harvestEvents} đợt xuất chuồng</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Doanh thu xuất chuồng</span>
                <span className={styles.kpiIcon}><TrendingUp size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(harvestReport.totalRevenue)}</div>
              <div className={styles.kpiSub}>Đơn giá bình quân: {fmtVnd(harvestReport.avgUnitPrice)} / kg</div>
            </div>
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Sản lượng xuất bán & thu hoạch theo chuồng nuôi</h3>
                <span className={styles.sectionSubtitle}>Tổng hợp trực tiếp từ nhật ký xuất bán tại chuồng</span>
              </div>
              {renderSearchBar('Tìm mã lứa, chuồng, giống gà...')}
            </div>

            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className={`farmshift-table ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Lứa / Chuồng</th>
                    <th>Giống gà</th>
                    <th className={styles.numCell}>Số đợt</th>
                    <th className={styles.numCell}>Số con</th>
                    <th className={styles.numCell}>Tổng cân (kg)</th>
                    <th className={styles.numCell}>TB kg/con</th>
                    <th className={styles.numCell}>Giá TB/kg</th>
                    <th className={styles.numCell}>Doanh thu</th>
                    <th>Xuất gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {harvestPaging.rows.length === 0 ? (
                    <tr><td colSpan={9} className={styles.emptyRow}>Chưa có dữ liệu thu hoạch trong kỳ báo cáo.</td></tr>
                  ) : harvestPaging.rows.map((h) => (
                    <tr key={h.cycleId}>
                      <td>
                        <span className={styles.codeCell}>{h.cycleCode}</span> · <strong>{h.barnName}</strong>
                        <span className={styles.subText}>{h.areaName}</span>
                      </td>
                      <td>{h.breed}</td>
                      <td className={styles.numCell}>{h.harvestEvents}</td>
                      <td className={styles.numCell}>{fmtNum(h.totalHead)} con</td>
                      <td className={styles.numCell}><strong>{fmtNum(h.totalWeightKg, 1)} kg</strong></td>
                      <td className={styles.numCell}>{fmtNum(h.avgWeightPerBird, 2)} kg</td>
                      <td className={styles.numCell}>{fmtVnd(h.avgPricePerKg)}</td>
                      <td className={`${styles.numCell} ${styles.positiveText}`}>{fmtVnd(h.totalRevenue)}</td>
                      <td className={styles.dateCell}>{fmtDate(h.lastHarvestDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPager(harvestPaging, 'harvest', 'lứa thu hoạch')}
          </div>
        </div>
      )}

      {/* ── Tab 7: Xu hướng lứa nuôi (FCR) ───────────────── */}
      {activeTab === 'growth' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>FCR bình quân trang trại</span>
                <span className={styles.kpiIcon}><TrendingUp size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                {growthReport.avgFcr !== null && growthReport.avgFcr !== undefined ? fmtNum(growthReport.avgFcr, 2) : '—'}
              </div>
              <div className={styles.kpiSub}>Trên {growthReport.analyzedCycles} lứa có dữ liệu tăng trọng & cám</div>
            </div>
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Hệ số chuyển đổi thức ăn (FCR) & Tốc độ tăng trọng (ADG)</h3>
                <span className={styles.sectionSubtitle}>Tính từ lượng cám thực ăn, sinh khối cân mẫu và sản lượng xuất chuồng</span>
              </div>
              {renderSearchBar('Tìm mã lứa, chuồng, giống gà...')}
            </div>

            {growthPaging.rows.length === 0 ? (
              <div className={styles.emptyRow}>Chưa đủ dữ liệu cân mẫu hoặc nhật ký cám để phân tích FCR.</div>
            ) : (
              <>
                <div className={styles.growthGrid}>
                  {growthPaging.rows.map((g) => (
                    <article key={g.cycleId} className={styles.growthCard}>
                      <div className={styles.growthCardHead}>
                        <div>
                          <div className={styles.growthMeta}>{g.cycleCode} · {g.ageDays ? `${g.ageDays} ngày tuổi` : 'Chưa rõ tuổi'}</div>
                          <div className={styles.growthBarn}>{g.barnName} — {g.breed}</div>
                        </div>
                        <span className={g.status === 'ACTIVE' ? styles.mintBadge : styles.sageBadge}>
                          {g.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã đóng'}
                        </span>
                      </div>

                      <div className={styles.fcrHeadline}>
                        <span className={styles.fcrValue}>
                          FCR: {g.fcr !== null && g.fcr !== undefined ? fmtNum(g.fcr, 2) : '—'}
                        </span>
                        {g.fcr !== null && g.fcr !== undefined && (
                          <span className={Number(g.fcr) <= 2.4 ? styles.mintBadge : styles.warnBadge}>
                            {Number(g.fcr) <= 2.4 ? 'Hiệu quả tốt' : 'Cần theo dõi'}
                          </span>
                        )}
                      </div>

                      <ul className={styles.growthMetrics}>
                        <li>
                          Trọng lượng TB
                          <strong>{g.avgWeightKg ? `${fmtNum(g.avgWeightKg, 2)} kg` : 'Chưa cân'}{g.targetWeightKg ? ` / ${fmtNum(g.targetWeightKg, 2)} kg` : ''}</strong>
                        </li>
                        <li>
                          Cám lũy kế / con
                          <strong>{g.feedPerBirdKg ? `${fmtNum(g.feedPerBirdKg, 2)} kg/con` : `${fmtNum(g.feedKg, 0)} kg`}</strong>
                        </li>
                        <li>
                          ADG bình quân
                          <strong>{g.adgGrams ? `${fmtNum(g.adgGrams, 1)} g/ngày` : '—'}</strong>
                        </li>
                        <li>
                          Tỷ lệ sống
                          <strong>{fmtNum(g.survivalRate, 1)}% ({fmtNum(g.currentQuantity)} con)</strong>
                        </li>
                      </ul>
                    </article>
                  ))}
                </div>
                {renderPager(growthPaging, 'growth', 'lứa nuôi', [6, 9, 12, 24])}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 8: Báo cáo xuất nhập nội bộ ─────────────── */}
      {activeTab === 'internal' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng giá trị luân chuyển</span>
                <span className={styles.kpiIcon}><ArrowLeftRight size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(internalStockReport.totalAmount)}</div>
              <div className={styles.kpiSub}>{internalStockReport.voucherCount} phiếu xuất / chuyển nội bộ</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Phiếu xuất dùng / chuồng</span>
                <span className={styles.kpiIcon}><Package size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{internalStockReport.exportCount} phiếu</div>
              <div className={styles.kpiSub}>Chuyển giữa các kho: {internalStockReport.transferCount} phiếu</div>
            </div>
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Chi tiết luân chuyển vật tư nội bộ</h3>
                <span className={styles.sectionSubtitle}>Theo từng dòng hàng hóa xuất kho & chuyển kho</span>
              </div>
              {renderSearchBar('Tìm mã phiếu, tên hàng, kho xuất, nơi nhận...')}
            </div>

            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className={`farmshift-table ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Ngày lập</th>
                    <th>Loại phiếu</th>
                    <th>Hàng hóa</th>
                    <th className={styles.numCell}>Số lượng</th>
                    <th className={styles.numCell}>Đơn giá</th>
                    <th className={styles.numCell}>Thành tiền</th>
                    <th>Kho xuất</th>
                    <th>Kho nhập / Nơi nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {internalPaging.rows.length === 0 ? (
                    <tr><td colSpan={9} className={styles.emptyRow}>Chưa phát sinh phiếu xuất nhập nội bộ trong kỳ.</td></tr>
                  ) : internalPaging.rows.map((iv, idx) => (
                    <tr key={`${iv.voucherId}-${idx}`}>
                      <td><span className={styles.codeCell}>{iv.code}</span></td>
                      <td className={styles.dateCell}>{fmtDate(iv.movementDate)}</td>
                      <td>
                        <span className={iv.movementType === 'Chuyển kho' ? styles.mintBadge : styles.sageBadge}>
                          {iv.movementType}
                        </span>
                      </td>
                      <td>
                        <strong>{iv.itemName}</strong>
                        <span className={styles.subText}>{iv.categoryName}</span>
                      </td>
                      <td className={styles.numCell}>{fmtNum(iv.quantity)} {iv.unitName}</td>
                      <td className={styles.numCell}>{fmtVnd(iv.unitPrice)}</td>
                      <td className={styles.numCell}><strong>{fmtVnd(iv.totalAmount)}</strong></td>
                      <td>{iv.sourceWarehouse}</td>
                      <td>{iv.targetDestination}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPager(internalPaging, 'internal', 'dòng phiếu')}
          </div>
        </div>
      )}

      {/* ── Tab 9: Nhật ký hoạt động ─────────────────────── */}
      {activeTab === 'activity' && (
        <div className="farmshift-card">
          <div className={styles.sectionToolbar}>
            <div className={styles.sectionTitleGroup}>
              <h3 className={styles.sectionTitle}>
                <Activity size={16} style={{ verticalAlign: '-2px', marginRight: '6px', color: '#007968' }} />
                Nhật ký hoạt động nghiệp vụ toàn trang trại
              </h3>
              <span className={styles.sectionSubtitle}>
                Tổng hợp thao tác thực từ Bán hàng, Nhập hàng, Kho nội bộ và Nhật ký công việc
              </span>
            </div>
            {renderSearchBar(
              'Tìm người thực hiện, nội dung, mã chứng từ...',
              <select
                aria-label="Lọc theo phân hệ"
                className={styles.selectFilter}
                value={activityModuleFilter}
                onChange={(e) => {
                  setActivityModuleFilter(e.target.value);
                  setTabPage('activity', 1);
                }}
              >
                {activityModules.map((m) => (
                  <option key={m} value={m}>{m === 'ALL' ? 'Tất cả phân hệ' : m}</option>
                ))}
              </select>
            )}
          </div>

          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className={`farmshift-table ${styles.compactTable}`}>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Phân hệ</th>
                  <th>Thao tác</th>
                  <th>Nội dung chi tiết</th>
                  <th>Mã chứng từ</th>
                </tr>
              </thead>
              <tbody>
                {activityPaging.rows.length === 0 ? (
                  <tr><td colSpan={6} className={styles.emptyRow}>Chưa có hoạt động phù hợp trong kỳ báo cáo.</td></tr>
                ) : activityPaging.rows.map((actItem) => (
                  <tr key={actItem.id}>
                    <td className={styles.dateCell}>{fmtDateTime(actItem.timestamp || actItem.date)}</td>
                    <td><strong>{actItem.actor}</strong></td>
                    <td><span className={styles.mintBadge}>{actItem.module}</span></td>
                    <td>{actItem.action}</td>
                    <td>{actItem.detail}</td>
                    <td><span className={styles.codeCell}>{actItem.referenceCode || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderPager(activityPaging, 'activity', 'hoạt động', [15, 30, 50, 100])}
        </div>
      )}
    </FarmShiftLayout>
  );
};
