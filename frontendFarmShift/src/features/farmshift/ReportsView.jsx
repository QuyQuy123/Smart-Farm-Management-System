// src/features/farmshift/ReportsView.jsx
// Báo cáo & Thống kê toàn diện trang trại chuẩn FarmShift (Hạch toán Lãi/Lỗ, Biểu đồ SVG tương tác & 8 phân hệ)
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileSpreadsheet, RefreshCw, Search, Calendar, TrendingUp, TrendingDown,
  Package, Warehouse, Wallet, Scale, ArrowLeftRight, Activity,
  ShoppingCart, ReceiptText, CheckCircle2, ChevronLeft, ChevronRight,
  Printer, Filter, ArrowUpRight, RotateCcw, MoreVertical
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useNotification } from '../../context/NotificationContext';
import { getReportSummary } from '../../services/reportService';
import { getFarm } from '../../services/farmService';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { useViewport } from '../../hooks/useViewport';
import { ResponsiveDataTable } from '../../components/common/ResponsiveDataTable';
import styles from './ReportsView.module.css';
import {
  CHART_COLORS,
  EMPTY_REPORT,
  SALES_STATUS_LABELS,
  TAB_CLUSTERS,
  VALID_TAB_IDS,
  addItemToUnitMap,
  buildCsvDocument,
  classifyItemCategory,
  classifyPurchaseStatus,
  detectPresetFromDates,
  fmtDate,
  fmtDateTime,
  fmtNum,
  fmtVnd,
  formatUnitMap,
  getIsoDate,
  getPresetRange,
  getTabLabel,
  matchesAreaFilter,
  matchesBarnFilter,
  matchesInventoryCategory,
  normalizeReportData,
  shortMoney,
} from './reports/reportUtils';
import {
  ActivityVisualRow,
  CostStructureDonutChart,
  CycleProfitBarChart,
  FcrComparisonChart,
  HarvestAreaDonutChart,
  HarvestRevenueChart,
  InternalStockVisualRow,
  InventoryProportionDonutChart,
  PurchaseStructureDonutChart,
  SalesPaymentDonutChart,
  WarehouseVisualPanel,
  WeightAndAdgChart,
} from './reports/ReportCharts';

export const ReportsView = () => {
  const notification = useNotification();
  const showToast = notification?.showToast || (() => { });
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = VALID_TAB_IDS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'summary';
  const initialFrom = searchParams.get('from') || '';
  const initialTo = searchParams.get('to') || '';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(initialTo);
  const [preset, setPreset] = useState(() => detectPresetFromDates(initialFrom, initialTo));
  const [searchTerm, setSearchTerm] = useState('');

  // Multi-dimensional filters
  const [areaFilter, setAreaFilter] = useState(() => searchParams.get('area') || 'ALL');
  const [barnFilter, setBarnFilter] = useState(() => searchParams.get('barn') || 'ALL');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'ALL');

  const [salesStatusFilter, setSalesStatusFilter] = useState('ALL');
  const [purchasePaymentFilter, setPurchasePaymentFilter] = useState('ALL');
  const [activityModuleFilter, setActivityModuleFilter] = useState('ALL');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('ALL');
  const [inventoryWarehouseFilter, setInventoryWarehouseFilter] = useState('ALL');
  const [inventoryPieMode, setInventoryPieMode] = useState('capital');

  const [farmName, setFarmName] = useState('Trang trại FarmShift');
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

  // Sync primary report tab and dimensions to URL query params for reload/share persistence
  useEffect(() => {
    const next = new URLSearchParams();
    if (activeTab !== 'summary') next.set('tab', activeTab);
    if (dateFrom) next.set('from', dateFrom);
    if (dateTo) next.set('to', dateTo);
    if (areaFilter !== 'ALL') next.set('area', areaFilter);
    if (barnFilter !== 'ALL') next.set('barn', barnFilter);
    if (statusFilter !== 'ALL') next.set('status', statusFilter);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, dateFrom, dateTo, areaFilter, barnFilter, statusFilter, searchParams, setSearchParams]);

  const resetAllPages = useCallback(() => {
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
  }, []);

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
    getFarm()
      .then((info) => {
        if (!cancelled && info?.name) setFarmName(info.name);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    let lastTriggerAt = Date.now();
    const triggerBackgroundRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastTriggerAt < 1000) return;
      lastTriggerAt = now;
      setRefreshNonce((n) => n + 1);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerBackgroundRefresh();
      }
    };
    window.addEventListener('focus', triggerBackgroundRefresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', triggerBackgroundRefresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setErrorMsg('');
    setRefreshNonce((n) => n + 1);
  };

  useRealtimeRefresh(
    [
      '/reports', '/purchases', '/sales', '/sales-orders', '/internal-stock',
      '/cycles', '/flocks', '/journal', '/today-tasks', '/daily-plans', '/daily-plan',
      '/inventory-items', '/inventory', '/work-tasks', '/barns', '/farm-areas', '/areas', '/debts',
    ],
    () => setRefreshNonce((n) => n + 1)
  );

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

  const clearDimensionFilters = () => {
    setAreaFilter('ALL');
    setBarnFilter('ALL');
    setStatusFilter('ALL');
    setSearchTerm('');
    setSalesStatusFilter('ALL');
    setPurchasePaymentFilter('ALL');
    setActivityModuleFilter('ALL');
    setInventoryCategoryFilter('ALL');
    setInventoryWarehouseFilter('ALL');
    resetAllPages();
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

  const growthLookup = useMemo(() => {
    const byId = new Map();
    const byCode = new Map();
    for (const g of growthReport.cycles) {
      if (g.cycleId != null) byId.set(g.cycleId, g);
      if (g.cycleCode) byCode.set(g.cycleCode, g);
    }
    return { byId, byCode };
  }, [growthReport.cycles]);

  const barnIdByCycleId = useMemo(() => {
    const map = new Map();
    for (const c of farmSummary.cycles) {
      if (c.cycleId != null && c.barnId != null) {
        map.set(c.cycleId, c.barnId);
      }
    }
    return map;
  }, [farmSummary.cycles]);

  const enrichedCycles = useMemo(() => {
    return farmSummary.cycles.map((c) => {
      const gm = growthLookup.byId.get(c.cycleId) || growthLookup.byCode.get(c.cycleCode);
      const chickCost = Number(c.chickCost || 0);
      const feedCost = Number(c.feedCost || 0);
      const otherCost = Number(c.otherCost || 0);
      const hasSeparateMedicine =
        (c.medicineCost !== undefined && c.medicineCost !== null)
        || (c.otherDirectCost !== undefined && c.otherDirectCost !== null);
      const medicineCost = Number(c.medicineCost || 0);
      const otherDirectCost = hasSeparateMedicine ? Number(c.otherDirectCost || 0) : otherCost;
      const revenue = Number(c.revenue || 0);
      const totalCost = Number(c.totalCost || 0);
      const profit = c.profit !== undefined && c.profit !== null ? Number(c.profit) : revenue - totalCost;
      const fcr = c.fcr !== undefined && c.fcr !== null ? Number(c.fcr) : gm?.fcr ?? null;
      const avgWeightKg = c.avgWeightKg !== undefined && c.avgWeightKg !== null ? Number(c.avgWeightKg) : gm?.avgWeightKg ?? null;
      const harvestedWeightKg = Number(c.harvestedWeightKg || 0);
      const biomassKg = c.biomassKg !== undefined && c.biomassKg !== null
        ? Number(c.biomassKg)
        : (avgWeightKg !== null && Number(c.currentQuantity || 0) > 0
            ? Number((avgWeightKg * Number(c.currentQuantity)).toFixed(1))
            : 0);
      const producedKg = biomassKg + harvestedWeightKg;
      const costPerKg = c.costPerKg !== undefined && c.costPerKg !== null
        ? Number(c.costPerKg)
        : (producedKg > 0 && totalCost > 0 ? Math.round(totalCost / producedKg) : null);
      const avgSellingPricePerKg = harvestedWeightKg > 0 && revenue > 0 ? Math.round(revenue / harvestedWeightKg) : null;
      const isWip = c.status === 'ACTIVE' && revenue === 0 && totalCost > 0;

      return {
        ...c,
        chickCost,
        feedCost,
        otherCost,
        medicineCost,
        otherDirectCost,
        hasSeparateMedicine,
        hasCostBreakdown: chickCost + feedCost + otherCost > 0,
        revenue,
        totalCost,
        profit,
        marginPct: revenue > 0 ? (profit / revenue) * 100 : null,
        fcr,
        avgWeightKg,
        harvestedWeightKg,
        biomassKg,
        costPerKg,
        avgSellingPricePerKg,
        isWip,
      };
    });
  }, [farmSummary.cycles, growthLookup]);

  const areaOptions = useMemo(() => {
    const set = new Set();
    for (const c of farmSummary.cycles) if (c.areaName) set.add(c.areaName);
    for (const g of growthReport.cycles) if (g.areaName) set.add(g.areaName);
    for (const h of harvestReport.rows) if (h.areaName) set.add(h.areaName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [farmSummary.cycles, growthReport.cycles, harvestReport.rows]);

  const barnOptions = useMemo(() => {
    const map = new Map();
    const collect = (row) => {
      if (!row?.barnName) return;
      if (areaFilter !== 'ALL' && row.areaName !== areaFilter) return;
      if (!map.has(row.barnName)) {
        map.set(row.barnName, { barnName: row.barnName, areaName: row.areaName || '' });
      }
    };
    farmSummary.cycles.forEach(collect);
    growthReport.cycles.forEach(collect);
    harvestReport.rows.forEach(collect);
    return Array.from(map.values()).sort((a, b) => a.barnName.localeCompare(b.barnName, 'vi'));
  }, [farmSummary.cycles, growthReport.cycles, harvestReport.rows, areaFilter]);

  const q = searchTerm.trim().toLowerCase();
  const hasAnyLocalFilter =
    areaFilter !== 'ALL' ||
    barnFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    q !== '' ||
    salesStatusFilter !== 'ALL' ||
    purchasePaymentFilter !== 'ALL' ||
    activityModuleFilter !== 'ALL' ||
    inventoryCategoryFilter !== 'ALL' ||
    inventoryWarehouseFilter !== 'ALL';

  const hasCycleScopeFilter = areaFilter !== 'ALL' || barnFilter !== 'ALL' || statusFilter !== 'ALL' || q !== '';

  const matchesCycleDimensions = useCallback(
    (row) => {
      if (areaFilter !== 'ALL' && row.areaName !== areaFilter) return false;
      if (barnFilter !== 'ALL' && row.barnName !== barnFilter) return false;
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      return true;
    },
    [areaFilter, barnFilter, statusFilter]
  );

  const filteredCycles = useMemo(() => {
    return enrichedCycles.filter((c) => {
      if (!matchesCycleDimensions(c)) return false;
      if (!q) return true;
      return `${c.cycleCode} ${c.barnName} ${c.areaName} ${c.breed}`.toLowerCase().includes(q);
    });
  }, [enrichedCycles, matchesCycleDimensions, q]);

  const salesBaseOrders = useMemo(() => {
    return salesReport.orders.filter((o) => {
      const flockStr = String(o.flock || '');
      if (!matchesAreaFilter(o.areaName, flockStr, areaFilter)) return false;
      if (!matchesBarnFilter(o.barnName, flockStr, barnFilter)) return false;
      if (!q) return true;
      return `${o.code} ${o.customer} ${o.flock}`.toLowerCase().includes(q);
    });
  }, [salesReport.orders, areaFilter, barnFilter, q]);

  const filteredSales = useMemo(() => {
    if (salesStatusFilter === 'ALL') return salesBaseOrders;
    return salesBaseOrders.filter((o) => {
      if (salesStatusFilter === 'CREDIT') return o.status === 'CREDIT' || o.status === 'DEBT';
      return o.status === salesStatusFilter;
    });
  }, [salesBaseOrders, salesStatusFilter]);

  const purchasesBaseInvoices = useMemo(() => {
    return purchasesReport.invoices.filter((p) => {
      if (!matchesAreaFilter(p.areaName, p.warehouseSummary, areaFilter)) return false;
      if (!matchesBarnFilter(p.barnName, p.warehouseSummary, barnFilter)) return false;
      if (!q) return true;
      return `${p.code} ${p.supplier} ${p.warehouseSummary}`.toLowerCase().includes(q);
    });
  }, [purchasesReport.invoices, areaFilter, barnFilter, q]);

  const filteredPurchases = useMemo(() => {
    if (purchasePaymentFilter === 'ALL') return purchasesBaseInvoices;
    return purchasesBaseInvoices.filter((p) => classifyPurchaseStatus(p) === purchasePaymentFilter);
  }, [purchasesBaseInvoices, purchasePaymentFilter]);

  const inventorySearchItems = useMemo(() => {
    return inventoryReport.items
      .map((it) => ({
        ...it,
        _catMeta: classifyItemCategory(it),
      }))
      .filter((it) => {
        if (!matchesAreaFilter(it.areaName, it.warehouseName, areaFilter)) return false;
        if (!q) return true;
        return `${it.code} ${it.name} ${it.warehouseName}`.toLowerCase().includes(q);
      });
  }, [inventoryReport.items, areaFilter, q]);

  const filteredInventory = useMemo(() => {
    return inventorySearchItems.filter((it) => {
      if (inventoryWarehouseFilter !== 'ALL' && it.warehouseName !== inventoryWarehouseFilter) {
        return false;
      }
      if (!matchesInventoryCategory(it._catMeta.key, inventoryCategoryFilter)) {
        return false;
      }
      return true;
    });
  }, [inventorySearchItems, inventoryWarehouseFilter, inventoryCategoryFilter]);

  const filteredHarvest = useMemo(() => {
    return harvestReport.rows.filter((h) => {
      if (areaFilter !== 'ALL' && h.areaName !== areaFilter) return false;
      if (barnFilter !== 'ALL' && h.barnName !== barnFilter) return false;
      if (!q) return true;
      return `${h.cycleCode} ${h.barnName} ${h.areaName} ${h.breed}`.toLowerCase().includes(q);
    });
  }, [harvestReport.rows, areaFilter, barnFilter, q]);

  const filteredGrowth = useMemo(() => {
    return growthReport.cycles.filter((g) => {
      if (!matchesCycleDimensions(g)) return false;
      if (!q) return true;
      return `${g.cycleCode} ${g.barnName} ${g.areaName} ${g.breed}`.toLowerCase().includes(q);
    });
  }, [growthReport.cycles, matchesCycleDimensions, q]);

  const filteredInternal = useMemo(() => {
    return internalStockReport.items.filter((iv) => {
      const text = `${iv.sourceWarehouse} ${iv.targetDestination}`;
      if (!matchesAreaFilter(iv.areaName, text, areaFilter)) return false;
      if (!matchesBarnFilter(iv.barnName, iv.targetDestination, barnFilter)) return false;
      if (!q) return true;
      return `${iv.code} ${iv.itemName} ${iv.sourceWarehouse} ${iv.targetDestination} ${iv.categoryName}`.toLowerCase().includes(q);
    });
  }, [internalStockReport.items, areaFilter, barnFilter, q]);

  const activityBaseItems = useMemo(() => {
    return activityReport.items.filter((a) => {
      if (!matchesAreaFilter(a.areaName, a.detail, areaFilter)) return false;
      if (!matchesBarnFilter(a.barnName, a.detail, barnFilter)) return false;
      if (!q) return true;
      return `${a.actor} ${a.module} ${a.action} ${a.detail} ${a.referenceCode || ''}`.toLowerCase().includes(q);
    });
  }, [activityReport.items, areaFilter, barnFilter, q]);

  const activityModules = useMemo(() => {
    const mods = new Set(activityBaseItems.map((a) => a.module).filter(Boolean));
    return ['ALL', ...mods];
  }, [activityBaseItems]);

  const filteredActivities = useMemo(() => {
    if (activityModuleFilter === 'ALL') return activityBaseItems;
    return activityBaseItems.filter((a) => a.module === activityModuleFilter);
  }, [activityBaseItems, activityModuleFilter]);

  const summaryStats = useMemo(() => {
    const rowAgg = filteredCycles.reduce(
      (acc, c) => {
        acc.totalIn += Number(c.totalIn || 0);
        acc.harvested += Number(c.harvested || 0);
        acc.harvestedWeightKg += Number(c.harvestedWeightKg || 0);
        acc.deaths += Number(c.deaths || 0);
        acc.culls += Number(c.culls || 0);
        acc.currentLive += Number(c.currentQuantity || 0);
        if (c.status === 'ACTIVE') {
          acc.activeBarns += 1;
          acc.wipCost += Number(c.totalCost || 0);
          acc.wipRevenue += Number(c.revenue || 0);
        } else {
          acc.closedCycles += 1;
          acc.realizedProfit += Number(c.profit || 0);
        }
        acc.chickCost += Number(c.chickCost || 0);
        acc.feedCost += Number(c.feedCost || 0);
        acc.otherCost += Number(c.otherCost || 0);
        acc.medicineCost += Number(c.medicineCost || 0);
        acc.otherDirectCost += Number(c.otherDirectCost || 0);
        acc.totalCost += Number(c.totalCost || 0);
        acc.totalRevenue += Number(c.revenue || 0);
        acc.totalProfit += Number(c.profit || 0);
        if (Number(c.profit || 0) > 0) acc.profitableCycles += 1;
        return acc;
      },
      {
        totalIn: 0, harvested: 0, harvestedWeightKg: 0, deaths: 0, culls: 0, currentLive: 0,
        activeBarns: 0, closedCycles: 0, realizedProfit: 0, wipCost: 0, wipRevenue: 0,
        chickCost: 0, feedCost: 0, otherCost: 0, medicineCost: 0, otherDirectCost: 0,
        totalCost: 0, totalRevenue: 0, totalProfit: 0, profitableCycles: 0,
      }
    );

    const totalCost = hasCycleScopeFilter ? rowAgg.totalCost : Number(farmSummary.totalCost || rowAgg.totalCost);
    const totalRevenue = hasCycleScopeFilter ? rowAgg.totalRevenue : Number(farmSummary.totalRevenue || rowAgg.totalRevenue);
    const totalProfit = hasCycleScopeFilter ? rowAgg.totalProfit : Number(farmSummary.totalProfit ?? (totalRevenue - totalCost));
    const harvestedWeightKg = hasCycleScopeFilter
      ? rowAgg.harvestedWeightKg
      : Number(farmSummary.harvestedWeightKg || rowAgg.harvestedWeightKg);

    const realizedProfit = hasCycleScopeFilter
      ? rowAgg.realizedProfit
      : Number(farmSummary.realizedProfit ?? rowAgg.realizedProfit);
    const wipCost = hasCycleScopeFilter
      ? rowAgg.wipCost
      : Number(farmSummary.wipCost ?? rowAgg.wipCost);
    const closedCycles = hasCycleScopeFilter
      ? rowAgg.closedCycles
      : Number(farmSummary.closedCycles ?? rowAgg.closedCycles);

    const chickCost = hasCycleScopeFilter ? rowAgg.chickCost : Number(farmSummary.chickCost || rowAgg.chickCost);
    const feedCost = hasCycleScopeFilter ? rowAgg.feedCost : Number(farmSummary.feedCost || rowAgg.feedCost);
    const otherCost = hasCycleScopeFilter ? rowAgg.otherCost : Number(farmSummary.otherCost || rowAgg.otherCost);
    const medicineCost = hasCycleScopeFilter
      ? rowAgg.medicineCost
      : Number(farmSummary.medicineCost ?? rowAgg.medicineCost);
    const otherDirectCost = hasCycleScopeFilter
      ? rowAgg.otherDirectCost
      : Number(farmSummary.otherDirectCost ?? rowAgg.otherDirectCost);

    const totalIn = hasCycleScopeFilter ? rowAgg.totalIn : Number(farmSummary.totalIn || rowAgg.totalIn);
    const harvested = hasCycleScopeFilter ? rowAgg.harvested : Number(farmSummary.harvested || rowAgg.harvested);
    const deaths = hasCycleScopeFilter ? rowAgg.deaths : Number(farmSummary.deaths || rowAgg.deaths);
    const culls = hasCycleScopeFilter ? rowAgg.culls : Number(farmSummary.culls || rowAgg.culls);
    const currentLive = hasCycleScopeFilter ? rowAgg.currentLive : Number(farmSummary.currentLive || rowAgg.currentLive);
    const totalCycles = hasCycleScopeFilter ? filteredCycles.length : Number(farmSummary.totalCycles || filteredCycles.length);
    const activeBarns = hasCycleScopeFilter ? rowAgg.activeBarns : Number(farmSummary.activeBarns || rowAgg.activeBarns);

    const lossCount = deaths + culls;
    const survivalScopeBase = Math.max(totalIn, currentLive + harvested + lossCount);
    const lossRate = hasCycleScopeFilter
      ? (survivalScopeBase > 0 ? (lossCount * 100) / survivalScopeBase : 0)
      : Number(farmSummary.lossRate || 0);
    const survivalRate = hasCycleScopeFilter
      ? (survivalScopeBase > 0 ? Math.max(0, 100 - lossRate) : 100)
      : Number(farmSummary.survivalRate ?? 100);

    const fcrValues = filteredCycles.map((c) => c.fcr).filter((v) => v !== null && v !== undefined && Number.isFinite(v));
    const avgFcr = fcrValues.length
      ? fcrValues.reduce((s, v) => s + v, 0) / fcrValues.length
      : growthReport.avgFcr;

    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalIn,
      harvested,
      harvestedWeightKg,
      deaths,
      culls,
      lossCount,
      lossRate,
      survivalRate,
      currentLive,
      activeBarns,
      closedCycles,
      totalCycles,
      totalCost,
      totalRevenue,
      totalProfit,
      realizedProfit,
      wipCost,
      chickCost,
      feedCost,
      otherCost,
      medicineCost,
      otherDirectCost,
      profitMargin,
      profitableCycles: rowAgg.profitableCycles,
      avgFcr,
      rowTotals: rowAgg,
    };
  }, [filteredCycles, farmSummary, growthReport.avgFcr, hasCycleScopeFilter]);

  const topCustomers = useMemo(() => {
    const map = new Map();
    for (const o of filteredSales) {
      const key = o.customer || 'Khách lẻ';
      const prev = map.get(key) || { name: key, revenue: 0, debt: 0, count: 0 };
      prev.revenue += Number(o.totalAmount || 0);
      prev.debt += Number(o.debtAmount || 0);
      prev.count += 1;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filteredSales]);

  const topSuppliers = useMemo(() => {
    const map = new Map();
    for (const p of filteredPurchases) {
      if (String(p.stockStatus || '').toLowerCase() === 'đã hủy') continue;
      const key = p.supplier || 'Nhà cung cấp';
      const prev = map.get(key) || { name: key, amount: 0, debt: 0, count: 0 };
      prev.amount += Number(p.totalAmount || 0);
      prev.debt += Number(p.debtAmount || 0);
      prev.count += 1;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [filteredPurchases]);

  const warehouseSummary = useMemo(() => {
    const map = new Map();
    for (const it of inventorySearchItems) {
      const key = it.warehouseName || 'Kho chung';
      const prev = map.get(key) || { name: key, kind: it.warehouseKind || '', value: 0, skus: 0, unitMap: {} };
      if (!prev.kind && it.warehouseKind) prev.kind = it.warehouseKind;
      prev.value += Number(it.totalValue || 0);
      prev.skus += 1;
      addItemToUnitMap(prev.unitMap, it);
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [inventorySearchItems]);

  const inventoryAnalytics = useMemo(() => {
    const stockBreakdown = {
      FEED: { value: 0, count: 0, unitMap: {} },
      VACCINE: { value: 0, count: 0, unitMap: {} },
      MEDICINE: { value: 0, count: 0, unitMap: {} },
      GRAIN: { value: 0, count: 0, unitMap: {} },
      SUPPLY: { value: 0, count: 0, unitMap: {} },
    };

    for (const it of inventorySearchItems) {
      const key = it._catMeta?.key || 'SUPPLY';
      if (stockBreakdown[key]) {
        stockBreakdown[key].value += Number(it.totalValue || 0);
        stockBreakdown[key].count += 1;
        addItemToUnitMap(stockBreakdown[key].unitMap, it);
      }
    }

    return {
      stockBreakdown,
      totalCount: inventorySearchItems.length,
      feedAllCount: stockBreakdown.FEED.count + stockBreakdown.GRAIN.count,
      medVacCount: stockBreakdown.VACCINE.count + stockBreakdown.MEDICINE.count,
    };
  }, [inventorySearchItems]);

  const salesStats = useMemo(() => {
    const isScoped = areaFilter !== 'ALL' || barnFilter !== 'ALL' || salesStatusFilter !== 'ALL' || q !== '';
    let totalRevenue = 0;
    let paidAmount = 0;
    let debtAmount = 0;
    let totalWeightKg = 0;
    let totalQuantity = 0;
    for (const o of filteredSales) {
      totalRevenue += Number(o.totalAmount || 0);
      paidAmount += Number(o.paidAmount || 0);
      debtAmount += Number(o.debtAmount || 0);
      totalWeightKg += Number(o.totalWeight || 0);
      totalQuantity += Number(o.quantity || 0);
    }
    const rev = isScoped ? totalRevenue : Number(salesReport.totalRevenue || totalRevenue);
    const paid = isScoped ? paidAmount : Number(salesReport.paidAmount || paidAmount);
    const debt = isScoped ? debtAmount : Number(salesReport.debtAmount || debtAmount);
    const weight = isScoped ? totalWeightKg : Number(salesReport.totalWeightKg || totalWeightKg);
    const qty = isScoped ? totalQuantity : Number(salesReport.totalQuantity || totalQuantity);
    const orderCount = isScoped ? filteredSales.length : Number(salesReport.orderCount || filteredSales.length);
    const avgUnitPrice = isScoped
      ? (weight > 0 ? rev / weight : 0)
      : Number(salesReport.avgUnitPrice || (weight > 0 ? rev / weight : 0));
    const paidPct = rev > 0 ? Math.min(100, (paid / rev) * 100) : 0;

    const statusCounts = { ALL: salesBaseOrders.length, PAID: 0, PARTIAL: 0, CREDIT: 0 };
    for (const o of salesBaseOrders) {
      if (o.status === 'DEBT') statusCounts.CREDIT += 1;
      else if (statusCounts[o.status] !== undefined) statusCounts[o.status] += 1;
    }

    return {
      orderCount,
      totalRevenue: rev,
      paidAmount: paid,
      debtAmount: debt,
      totalWeightKg: weight,
      totalQuantity: qty,
      avgUnitPrice,
      paidPct,
      statusCounts,
      rowTotals: { totalRevenue, paidAmount, debtAmount, totalWeightKg, totalQuantity },
    };
  }, [filteredSales, salesBaseOrders, salesReport, areaFilter, barnFilter, salesStatusFilter, q]);

  const purchaseStats = useMemo(() => {
    const isScoped = areaFilter !== 'ALL' || barnFilter !== 'ALL' || purchasePaymentFilter !== 'ALL' || q !== '';
    let totalAmount = 0;
    let paidAmount = 0;
    let debtAmount = 0;
    let validCount = 0;
    let cancelledCount = 0;
    for (const p of filteredPurchases) {
      const isCancelled = String(p.stockStatus || '').toLowerCase() === 'đã hủy';
      if (isCancelled) {
        cancelledCount += 1;
      } else {
        validCount += 1;
        totalAmount += Number(p.totalAmount || 0);
        paidAmount += Number(p.paidAmount || 0);
        debtAmount += Number(p.debtAmount || 0);
      }
    }
    const amt = isScoped ? totalAmount : Number(purchasesReport.totalAmount || totalAmount);
    const paid = isScoped ? paidAmount : Number(purchasesReport.paidAmount || paidAmount);
    const debt = isScoped ? debtAmount : Number(purchasesReport.debtAmount || debtAmount);
    const invCount = isScoped ? validCount : Number(purchasesReport.invoiceCount || validCount);
    const cancCount = isScoped ? cancelledCount : Number(purchasesReport.cancelledCount || cancelledCount);
    const paidPct = amt > 0 ? Math.min(100, (paid / amt) * 100) : 0;

    const statusCounts = { ALL: purchasesBaseInvoices.length, PAID: 0, DEBT: 0, CANCELLED: 0 };
    for (const p of purchasesBaseInvoices) {
      const st = classifyPurchaseStatus(p);
      statusCounts[st] += 1;
    }

    return {
      invoiceCount: invCount,
      cancelledCount: cancCount,
      totalAmount: amt,
      paidAmount: paid,
      debtAmount: debt,
      paidPct,
      statusCounts,
      rowTotals: { totalAmount, paidAmount, debtAmount, validCount },
    };
  }, [filteredPurchases, purchasesBaseInvoices, purchasesReport, areaFilter, barnFilter, purchasePaymentFilter, q]);

  const inventoryStats = useMemo(() => {
    const isScoped =
      areaFilter !== 'ALL' ||
      inventoryWarehouseFilter !== 'ALL' ||
      inventoryCategoryFilter !== 'ALL' ||
      q !== '';
    let totalValue = 0;
    const unitMap = {};
    let feedGroupValue = 0;
    let feedGroupSkus = 0;
    const feedUnitMap = {};
    let medGroupValue = 0;
    let medGroupSkus = 0;
    const medUnitMap = {};

    for (const it of filteredInventory) {
      const val = Number(it.totalValue || 0);
      totalValue += val;
      addItemToUnitMap(unitMap, it);

      const catKey = it._catMeta?.key || 'SUPPLY';
      if (catKey === 'FEED' || catKey === 'GRAIN') {
        feedGroupValue += val;
        feedGroupSkus += 1;
        addItemToUnitMap(feedUnitMap, it);
      } else {
        medGroupValue += val;
        medGroupSkus += 1;
        addItemToUnitMap(medUnitMap, it);
      }
    }
    const effectiveValue = isScoped ? totalValue : Number(inventoryReport.totalValue || totalValue);
    const feedSharePct = totalValue > 0 ? (feedGroupValue / totalValue) * 100 : 0;
    const medSharePct = totalValue > 0 ? (medGroupValue / totalValue) * 100 : 0;
    return {
      totalSkus: isScoped ? filteredInventory.length : Number(inventoryReport.totalSkus || filteredInventory.length),
      totalValue: effectiveValue,
      filteredValue: totalValue,
      unitMap,
      feedGroupValue,
      feedGroupSkus,
      feedUnitMap,
      feedSharePct,
      medGroupValue,
      medGroupSkus,
      medUnitMap,
      medSharePct,
    };
  }, [
    filteredInventory,
    inventoryReport,
    areaFilter,
    inventoryWarehouseFilter,
    inventoryCategoryFilter,
    q,
  ]);

  const harvestStats = useMemo(() => {
    const isScoped = areaFilter !== 'ALL' || barnFilter !== 'ALL' || q !== '';
    let harvestEvents = 0;
    let totalHead = 0;
    let totalWeightKg = 0;
    let totalRevenue = 0;
    for (const h of filteredHarvest) {
      harvestEvents += Number(h.harvestEvents || 0);
      totalHead += Number(h.totalHead || 0);
      totalWeightKg += Number(h.totalWeightKg || 0);
      totalRevenue += Number(h.totalRevenue || 0);
    }
    const weight = isScoped ? totalWeightKg : Number(harvestReport.totalWeightKg || totalWeightKg);
    const head = isScoped ? totalHead : Number(harvestReport.totalHead || totalHead);
    const rev = isScoped ? totalRevenue : Number(harvestReport.totalRevenue || totalRevenue);
    const events = isScoped ? harvestEvents : Number(harvestReport.harvestEvents || harvestEvents);
    const avgUnitPrice = isScoped
      ? (weight > 0 ? rev / weight : 0)
      : Number(harvestReport.avgUnitPrice || (weight > 0 ? rev / weight : 0));
    const avgWeightPerBird = head > 0 ? weight / head : 0;

    return {
      harvestEvents: events,
      totalHead: head,
      totalWeightKg: weight,
      totalRevenue: rev,
      avgUnitPrice,
      avgWeightPerBird,
      rowTotals: { harvestEvents, totalHead, totalWeightKg, totalRevenue },
    };
  }, [filteredHarvest, harvestReport, areaFilter, barnFilter, q]);

  const growthStats = useMemo(() => {
    const isScoped = hasCycleScopeFilter;
    const fcrList = filteredGrowth.map((g) => Number(g.fcr)).filter((n) => Number.isFinite(n) && n > 0);
    const avgFcr = isScoped
      ? (fcrList.length ? fcrList.reduce((s, v) => s + v, 0) / fcrList.length : null)
      : (growthReport.avgFcr ?? (fcrList.length ? fcrList.reduce((s, v) => s + v, 0) / fcrList.length : null));
    const weightList = filteredGrowth.map((g) => Number(g.avgWeightKg)).filter((n) => Number.isFinite(n) && n > 0);
    const avgWeightKg = weightList.length ? weightList.reduce((s, v) => s + v, 0) / weightList.length : 0;
    const adgList = filteredGrowth.map((g) => Number(g.adgGrams)).filter((n) => Number.isFinite(n) && n > 0);
    const avgAdgGrams = adgList.length ? adgList.reduce((s, v) => s + v, 0) / adgList.length : 0;
    const totalFeedKg = filteredGrowth.reduce((s, g) => s + Number(g.feedKg || 0), 0);
    const totalGainKg = filteredGrowth.reduce((s, g) => s + Number(g.gainKg || 0), 0);
    const goodFcrCount = fcrList.filter((v) => v <= 2.3).length;

    return {
      avgFcr,
      avgWeightKg,
      avgAdgGrams,
      totalFeedKg,
      totalGainKg,
      goodFcrCount,
      fcrCount: fcrList.length,
    };
  }, [filteredGrowth, growthReport.avgFcr, hasCycleScopeFilter]);

  const internalStats = useMemo(() => {
    const isScoped = areaFilter !== 'ALL' || barnFilter !== 'ALL' || q !== '';
    let totalAmount = 0;
    const exportVouchers = new Set();
    const transferVouchers = new Set();
    const allVouchers = new Set();
    for (const iv of filteredInternal) {
      totalAmount += Number(iv.totalAmount || 0);
      const vKey = iv.voucherId ?? iv.code;
      allVouchers.add(vKey);
      if (iv.movementType === 'Chuyển kho') transferVouchers.add(vKey);
      else exportVouchers.add(vKey);
    }
    return {
      totalAmount: isScoped ? totalAmount : Number(internalStockReport.totalAmount || totalAmount),
      voucherCount: isScoped ? allVouchers.size : Number(internalStockReport.voucherCount || allVouchers.size),
      exportCount: isScoped ? exportVouchers.size : Number(internalStockReport.exportCount || exportVouchers.size),
      transferCount: isScoped ? transferVouchers.size : Number(internalStockReport.transferCount || transferVouchers.size),
      filteredAmount: totalAmount,
    };
  }, [filteredInternal, internalStockReport, areaFilter, barnFilter, q]);

  const activityStats = useMemo(() => {
    const staffActors = new Set();
    const partnerActors = new Set();
    let workLogCount = 0;
    let tradeStockCount = 0;
    for (const a of filteredActivities) {
      if (a.actor) {
        if (a.actor.startsWith('Nhập kho · ') || a.actor.startsWith('Xuất bán · ')) {
          partnerActors.add(a.actor);
        } else {
          staffActors.add(a.actor);
        }
      }
      if (a.module === 'Ghi nhật ký' || a.module === 'Đàn gia cầm') workLogCount += 1;
      else tradeStockCount += 1;
    }
    return {
      totalCount: filteredActivities.length,
      staffCount: staffActors.size,
      partnerCount: partnerActors.size,
      workLogCount,
      tradeStockCount,
    };
  }, [filteredActivities]);

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

  const tabCounts = {
    summary: filteredCycles.length || farmSummary.totalCycles,
    sales: filteredSales.length,
    purchases: filteredPurchases.length,
    inventory: filteredInventory.length,
    harvest: filteredHarvest.length,
    growth: filteredGrowth.length,
    internal: filteredInternal.length,
    activity: filteredActivities.length,
  };

  const periodLabel = dateFrom || dateTo
    ? `${dateFrom ? fmtDate(dateFrom) : '...'} -> ${dateTo ? fmtDate(dateTo) : 'Hiện tại'}`
    : 'Toàn thời gian';
  const scopeLabel = [
    areaFilter !== 'ALL' ? `Khu: ${areaFilter}` : null,
    barnFilter !== 'ALL' ? `Chuồng: ${barnFilter}` : null,
    statusFilter !== 'ALL' ? `Trạng thái: ${statusFilter}` : null,
    q ? `Từ khóa: "${q}"` : null,
  ].filter(Boolean).join(' · ') || 'Toàn trang trại';

  const handleExportExcel = () => {
    let headers;
    let rows;
    let footerRow = null;
    let filePrefix;
    let title;

    if (activeTab === 'summary') {
      filePrefix = 'Bao_cao_hach_toan_lai_lo_trang_trai';
      title = 'BÁO CÁO HẠCH TOÁN LÃI/LỖ & KỸ THUẬT THEO LỨA NUÔI';
      headers = [
        'Mã lứa', 'Chuồng', 'Khu', 'Giống gà', 'Trạng thái', 'Nhập đàn', 'Hao hụt',
        'Xuất bán', 'Hiện nuôi', 'Tỷ lệ sống (%)', 'CP Con giống (VND)', 'CP Cám (VND)',
        'CP Thuốc & Vắc-xin (VND)', 'CP Vận hành khác (VND)', 'Tổng chi phí (VND)',
        'Giá vốn/kg (VND)', 'Doanh thu (VND)', 'Lợi nhuận ròng (VND)', 'Biên LN (%)', 'FCR',
      ];
      rows = filteredCycles.map((c) => [
        c.cycleCode, c.barnName, c.areaName, c.breed,
        c.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã đóng',
        c.totalIn, Number(c.deaths || 0) + Number(c.culls || 0),
        c.harvested, c.currentQuantity, c.survivalRate,
        c.chickCost, c.feedCost,
        c.hasSeparateMedicine ? c.medicineCost : 0,
        c.hasSeparateMedicine ? c.otherDirectCost : c.otherCost,
        c.totalCost, c.costPerKg ?? '', c.revenue, c.profit,
        c.marginPct !== null ? Number(c.marginPct.toFixed(1)) : '',
        c.fcr ?? '',
      ]);
      footerRow = [
        'TỔNG CỘNG', `${filteredCycles.length} lứa`, '', '', '',
        summaryStats.rowTotals.totalIn,
        summaryStats.rowTotals.deaths + summaryStats.rowTotals.culls,
        summaryStats.rowTotals.harvested,
        summaryStats.rowTotals.currentLive,
        Number(summaryStats.survivalRate.toFixed(1)),
        summaryStats.rowTotals.chickCost,
        summaryStats.rowTotals.feedCost,
        summaryStats.rowTotals.medicineCost,
        summaryStats.rowTotals.otherDirectCost || summaryStats.rowTotals.otherCost,
        summaryStats.rowTotals.totalCost,
        '',
        summaryStats.rowTotals.totalRevenue,
        summaryStats.rowTotals.totalProfit,
        summaryStats.totalRevenue > 0 ? Number(((summaryStats.rowTotals.totalProfit / summaryStats.totalRevenue) * 100).toFixed(1)) : '',
        summaryStats.avgFcr ? Number(Number(summaryStats.avgFcr).toFixed(2)) : '',
      ];
    } else if (activeTab === 'sales') {
      filePrefix = 'Bao_cao_ban_hang';
      title = 'BÁO CÁO DOANH THU & CÔNG NỢ BÁN HÀNG';
      headers = ['Mã đơn', 'Ngày', 'Khách hàng', 'Đàn / Chuồng', 'Số con', 'Khối lượng (kg)', 'Đơn giá', 'Tổng tiền (VND)', 'Đã thu', 'Còn nợ', 'Trạng thái'];
      rows = filteredSales.map((o) => [
        o.code, o.date, o.customer, o.flock, o.quantity, o.totalWeight, o.unitPrice, o.totalAmount, o.paidAmount, o.debtAmount, SALES_STATUS_LABELS[o.status] || o.status,
      ]);
      footerRow = [
        'TỔNG CỘNG', `${filteredSales.length} đơn`, '', '',
        salesStats.rowTotals.totalQuantity,
        Number(salesStats.rowTotals.totalWeightKg.toFixed(1)),
        '',
        salesStats.rowTotals.totalRevenue,
        salesStats.rowTotals.paidAmount,
        salesStats.rowTotals.debtAmount,
        '',
      ];
    } else if (activeTab === 'purchases') {
      filePrefix = 'Bao_cao_nhap_hang';
      title = 'BÁO CÁO NHẬP HÀNG & CÔNG NỢ NHÀ CUNG CẤP';
      headers = ['Mã hóa đơn', 'Ngày', 'Nhà cung cấp', 'Kho / Chuồng', 'Tổng tiền (VND)', 'Đã trả', 'Còn nợ', 'Thanh toán', 'Trạng thái kho'];
      rows = filteredPurchases.map((p) => [
        p.code, p.date, p.supplier, p.warehouseSummary, p.totalAmount, p.paidAmount, p.debtAmount, p.paymentStatus, p.stockStatus,
      ]);
      footerRow = [
        'TỔNG CỘNG (HỢP LỆ)', `${purchaseStats.rowTotals.validCount} HĐ`, '', '',
        purchaseStats.rowTotals.totalAmount,
        purchaseStats.rowTotals.paidAmount,
        purchaseStats.rowTotals.debtAmount,
        '', '',
      ];
    } else if (activeTab === 'inventory') {
      filePrefix = 'Bao_cao_ton_kho';
      title = 'BÁO CÁO PHÂN BỔ SỐ LƯỢNG & GIÁ TRỊ TỒN KHO';
      const totalVal = inventoryStats.filteredValue || 0;
      headers = ['Mã hàng', 'Tên hàng hóa', 'Phân loại', 'Kho lưu trữ', 'ĐVT', 'Số lượng tồn', 'Đơn giá', 'Giá trị tồn (VND)', 'Tỷ trọng (%)'];
      rows = filteredInventory.map((i) => {
        const val = Number(i.totalValue || 0);
        const pct = totalVal > 0 ? Number(((val / totalVal) * 100).toFixed(2)) : 0;
        return [
          i.code,
          i.name,
          i._catMeta?.shortLabel || '',
          i.warehouseName,
          i.unitName,
          i.stock,
          i.unitPrice,
          i.totalValue,
          pct,
        ];
      });
      footerRow = [
        'TỔNG CỘNG',
        `${filteredInventory.length} mặt hàng`,
        '', '',
        formatUnitMap(inventoryStats.unitMap, { compact: false, maxItems: 6 }),
        '', '',
        inventoryStats.filteredValue,
        totalVal > 0 ? 100 : 0,
      ];
    } else if (activeTab === 'harvest') {
      filePrefix = 'Bao_cao_thu_hoach';
      title = 'BÁO CÁO SẢN LƯỢNG & DOANH THU THU HOẠCH';
      headers = ['Mã lứa', 'Chuồng', 'Giống gà', 'Số đợt xuất', 'Số con', 'Tổng kg', 'TB kg/con', 'Doanh thu (VND)', 'Giá TB/kg', 'Ngày xuất gần nhất'];
      rows = filteredHarvest.map((h) => [
        h.cycleCode, h.barnName, h.breed, h.harvestEvents, h.totalHead, h.totalWeightKg, h.avgWeightPerBird, h.totalRevenue, h.avgPricePerKg, h.lastHarvestDate || '',
      ]);
      footerRow = [
        'TỔNG CỘNG', `${filteredHarvest.length} lứa`, '',
        harvestStats.rowTotals.harvestEvents,
        harvestStats.rowTotals.totalHead,
        Number(harvestStats.rowTotals.totalWeightKg.toFixed(1)),
        Number(harvestStats.avgWeightPerBird.toFixed(2)),
        harvestStats.rowTotals.totalRevenue,
        Math.round(harvestStats.avgUnitPrice),
        '',
      ];
    } else if (activeTab === 'growth') {
      filePrefix = 'Bao_cao_tang_truong_FCR';
      title = 'BÁO CÁO TĂNG TRƯỞNG & HIỆU SUẤT CHĂN NUÔI (FCR)';
      headers = ['Mã lứa', 'Chuồng', 'Giống gà', 'Ngày tuổi', 'Cân TB (kg)', 'Tổng cám (kg)', 'Cám/con (kg)', 'Tăng trọng đàn (kg)', 'FCR', 'ADG (g/ngày)', 'Tỷ lệ sống (%)'];
      rows = filteredGrowth.map((g) => [
        g.cycleCode, g.barnName, g.breed, g.ageDays ?? '', g.avgWeightKg ?? '', g.feedKg, g.feedPerBirdKg ?? '', g.gainKg, g.fcr ?? '', g.adgGrams ?? '', g.survivalRate,
      ]);
      footerRow = [
        'TRUNG BÌNH / TỔNG', `${filteredGrowth.length} lứa`, '', '',
        growthStats.avgWeightKg > 0 ? Number(growthStats.avgWeightKg.toFixed(2)) : '',
        Number(growthStats.totalFeedKg.toFixed(1)),
        '',
        Number(growthStats.totalGainKg.toFixed(1)),
        growthStats.avgFcr ? Number(Number(growthStats.avgFcr).toFixed(2)) : '',
        growthStats.avgAdgGrams > 0 ? Number(growthStats.avgAdgGrams.toFixed(1)) : '',
        '',
      ];
    } else if (activeTab === 'internal') {
      filePrefix = 'Bao_cao_xuat_nhap_noi_bo';
      title = 'BÁO CÁO XUẤT NHẬP KHO NỘI BỘ';
      headers = ['Mã phiếu', 'Ngày', 'Loại', 'Hạng mục', 'Hàng hóa', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền (VND)', 'Kho xuất', 'Nơi nhận'];
      rows = filteredInternal.map((iv) => [
        iv.code, iv.movementDate, iv.movementType, iv.categoryName, iv.itemName, iv.unitName, iv.quantity, iv.unitPrice, iv.totalAmount, iv.sourceWarehouse, iv.targetDestination,
      ]);
      footerRow = [
        'TỔNG CỘNG', `${filteredInternal.length} dòng`, '', '', '', '', '', '',
        internalStats.filteredAmount, '', '',
      ];
    } else {
      filePrefix = 'Nhat_ky_hoat_dong';
      title = 'NHẬT KÝ HOẠT ĐỘNG NGHIỆP VỤ TRANG TRẠI';
      headers = ['Thời gian', 'Nhân sự', 'Phân hệ', 'Thao tác', 'Nội dung chi tiết', 'Chứng từ'];
      rows = filteredActivities.map((a) => [
        fmtDateTime(a.timestamp || a.date), a.actor, a.module, a.action, a.detail, a.referenceCode || '',
      ]);
    }

    if (!rows.length) {
      showToast('Chưa có dữ liệu trong mục báo cáo này để xuất.', 'warning');
      return;
    }

    const csv = buildCsvDocument({
      title,
      farmName,
      periodLabel,
      scopeLabel,
      headers,
      rows,
      footerRow,
    });
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

  const renderBarnLink = (barnName, barnId) => {
    if (barnId !== null && barnId !== undefined) {
      return (
        <Link to={`/barns/${barnId}`} className={styles.drilldownLink} title={`Xem chi tiết ${barnName}`}>
          <strong>{barnName}</strong>
          <ArrowUpRight size={13} />
        </Link>
      );
    }
    return <strong>{barnName}</strong>;
  };

  const renderActivityRefLink = (actItem) => {
    const code = actItem.referenceCode;
    if (!code) return <span className={styles.codeCell}>—</span>;
    if (actItem.module === 'Bán hàng') {
      return (
        <Link to={`/sales?tab=orders&search=${encodeURIComponent(code)}`} className={styles.drilldownLink} title={`Mở đơn bán ${code}`}>
          <span className={styles.codeCell}>{code}</span>
          <ArrowUpRight size={12} />
        </Link>
      );
    }
    if (actItem.module === 'Nhập hàng' && actItem.referenceId) {
      return (
        <Link to={`/purchases?invoice=${encodeURIComponent(actItem.referenceId)}`} className={styles.drilldownLink} title={`Mở hóa đơn ${code}`}>
          <span className={styles.codeCell}>{code}</span>
          <ArrowUpRight size={12} />
        </Link>
      );
    }
    if (actItem.module === 'Xuất nhập nội bộ') {
      return (
        <Link to={`/internal-stock?search=${encodeURIComponent(code)}`} className={styles.drilldownLink} title={`Mở phiếu nội bộ ${code}`}>
          <span className={styles.codeCell}>{code}</span>
          <ArrowUpRight size={12} />
        </Link>
      );
    }
    if ((actItem.module === 'Ghi nhật ký' || actItem.module === 'Đàn gia cầm') && actItem.referenceId) {
      return (
        <Link to={`/barns/${encodeURIComponent(actItem.referenceId)}`} className={styles.drilldownLink} title={`Mở chuồng lứa ${code}`}>
          <span className={styles.codeCell}>{code}</span>
          <ArrowUpRight size={12} />
        </Link>
      );
    }
    return <span className={styles.codeCell}>{code}</span>;
  };

  const { isMobile } = useViewport();
  const [mobileExportOpen, setMobileExportOpen] = useState(false);
  const mobileExportRef = useRef(null);

  useEffect(() => {
    if (!mobileExportOpen || !isMobile) return undefined;
    const handleOutside = (e) => {
      if (mobileExportRef.current && !mobileExportRef.current.contains(e.target)) {
        setMobileExportOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setMobileExportOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [mobileExportOpen, isMobile]);

  const activeClusterGroup = useMemo(
    () => TAB_CLUSTERS.find((group) => group.tabs.some((tab) => tab.id === activeTab)) || TAB_CLUSTERS[0],
    [activeTab]
  );

  return (
    <FarmShiftLayout
      pageTitle="Báo cáo & Thống kê Tài chính - Kỹ thuật"
      breadcrumbs={[{ label: 'Báo cáo & Thống kê' }]}
      actions={
        <div className={styles.reportActionsWrap}>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? styles.spin : ''} /> Làm mới
          </button>
          {isMobile ? (
            <div ref={mobileExportRef} className={styles.mobileExportMenuWrap}>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                aria-label="Tùy chọn xuất và in báo cáo"
                aria-expanded={mobileExportOpen}
                data-testid="reports-mobile-export-btn"
                onClick={() => setMobileExportOpen((prev) => !prev)}
              >
                <MoreVertical size={17} />
                <span>Xuất / In</span>
              </button>
              {mobileExportOpen && (
                <div className={styles.mobileExportDropdown} data-testid="reports-mobile-export-menu">
                  <button
                    type="button"
                    onClick={() => { setMobileExportOpen(false); handleExportExcel(); }}
                  >
                    <FileSpreadsheet size={15} /> Xuất Báo cáo Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMobileExportOpen(false); window.print(); }}
                  >
                    <Printer size={15} /> In báo cáo
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => window.print()}
              >
                <Printer size={15} /> In báo cáo
              </button>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-excel"
                onClick={handleExportExcel}
              >
                <FileSpreadsheet size={15} /> Xuất Báo cáo Excel
              </button>
            </>
          )}
        </div>
      }
    >
      {/* ── Print-Only Executive Header ───────────────────────────────────────── */}
      <div className={`${styles.printOnly} ${styles.printHeader}`}>
        <div className={styles.printFarmTitle}>{farmName}</div>
        <h2 className={styles.printReportTitle}>{getTabLabel(activeTab)}</h2>
        <div className={styles.printMeta}>
          <span>Kỳ báo cáo: <strong>{periodLabel}</strong></span>
          <span>Phạm vi: <strong>{scopeLabel}</strong></span>
          <span>Ngày kết xuất: <strong>{fmtDateTime(new Date().toISOString())}</strong></span>
        </div>
      </div>

      {/* ── Unified Period + Area/Barn/Status Filter Card ─────────────────────── */}
      <div className={styles.filterCard}>
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

        <div className={styles.dimensionFilterBar}>
          <div className={styles.dimensionGroup}>
            <span className={styles.presetLabel}>
              <Filter size={14} /> Phạm vi dữ liệu:
            </span>

            <select
              aria-label="Lọc theo khu nuôi"
              className={styles.selectFilter}
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                setBarnFilter('ALL');
                resetAllPages();
              }}
            >
              <option value="ALL">Tất cả khu nuôi</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>Khu: {area}</option>
              ))}
            </select>

            <select
              aria-label="Lọc theo chuồng"
              className={styles.selectFilter}
              value={barnFilter}
              onChange={(e) => {
                setBarnFilter(e.target.value);
                resetAllPages();
              }}
            >
              <option value="ALL">Tất cả chuồng nuôi</option>
              {barnOptions.map((b) => (
                <option key={b.barnName} value={b.barnName}>
                  {b.areaName ? `${b.barnName} (${b.areaName})` : `Chuồng: ${b.barnName}`}
                </option>
              ))}
            </select>

            <select
              aria-label="Lọc trạng thái lứa"
              className={styles.selectFilter}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                resetAllPages();
              }}
            >
              <option value="ALL">Tất cả trạng thái lứa</option>
              <option value="ACTIVE">Đang nuôi (ACTIVE)</option>
              <option value="CLOSED">Đã đóng (CLOSED)</option>
            </select>
          </div>

          {hasAnyLocalFilter && (
            <button type="button" className={styles.clearFilterBtn} onClick={clearDimensionFilters}>
              <RotateCcw size={13} /> Xóa bộ lọc
            </button>
          )}
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

      {/* ── Grouped Tabs Navigation (3 Functional Clusters, 8 Reports) ─────────── */}
      {isMobile ? (
        <div className={styles.mobileTabNav} data-testid="reports-mobile-tabs">
          <div className={styles.mobilePillRow} role="tablist" aria-label="Nhóm báo cáo">
            {TAB_CLUSTERS.map((group) => {
              const isSelected = group.cluster === activeClusterGroup.cluster;
              return (
                <button
                  key={group.cluster}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`${styles.mobileClusterPill} ${isSelected ? styles.mobileClusterPillActive : ''}`}
                  onClick={() => {
                    if (!isSelected && group.tabs[0]) setActiveTab(group.tabs[0].id);
                  }}
                >
                  {group.cluster}
                </button>
              );
            })}
          </div>
          <div className={styles.mobilePillRow} role="tablist" aria-label="Phân hệ báo cáo">
            {activeClusterGroup.tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`farmshift-tab-btn ${styles.tabBtn} ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                <span className={styles.tabCount}>{tabCounts[tab.id] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.tabClusterBar} role="tablist" aria-label="Phân hệ báo cáo">
          {TAB_CLUSTERS.map((group) => (
            <div key={group.cluster} className={styles.tabClusterGroup} role="presentation">
              <span className={styles.tabClusterLabel}>{group.cluster}</span>
              <div className={`farmshift-tabs ${styles.tabsWrap}`}>
                {group.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`farmshift-tab-btn ${styles.tabBtn} ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span>{tab.label}</span>
                    <span className={styles.tabCount}>{tabCounts[tab.id] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab 1: Tổng hợp toàn trại & Hạch toán Lãi/Lỗ ─────────────────────── */}
      {activeTab === 'summary' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Doanh thu xuất chuồng</span>
                <span className={styles.kpiIcon}><ShoppingCart size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                {fmtVnd(summaryStats.totalRevenue)}
              </div>
              <div className={styles.kpiSub}>
                {fmtNum(summaryStats.harvested)} con ({fmtNum(summaryStats.harvestedWeightKg, 1)} kg) · Hóa đơn bán: {fmtVnd(salesStats.totalRevenue)}
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng chi phí lứa nuôi</span>
                <span className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}><ReceiptText size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtVnd(summaryStats.totalCost)}</div>
              <div className={styles.kpiSub}>
                Giống: {shortMoney(summaryStats.chickCost)} · Cám: {shortMoney(summaryStats.feedCost)} · Khác: {shortMoney(summaryStats.otherCost)}
              </div>
            </div>

            <div className={`${styles.kpiCard} ${summaryStats.totalProfit >= 0 ? styles.kpiCardProfit : styles.kpiCardLoss}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Lợi nhuận ròng (Lãi/Lỗ)</span>
                <span className={`${styles.kpiIcon} ${summaryStats.totalProfit < 0 ? styles.kpiIconWarn : ''}`}>
                  {summaryStats.totalProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </span>
              </div>
              <div className={styles.kpiValueRow}>
                <span className={`${styles.kpiValue} ${summaryStats.totalProfit >= 0 ? styles.kpiValueAccent : styles.kpiValueWarn}`}>
                  {summaryStats.totalProfit >= 0 ? '+' : ''}{fmtVnd(summaryStats.totalProfit)}
                </span>
                <span className={`${styles.marginPill} ${summaryStats.totalProfit >= 0 ? styles.marginPositive : styles.marginNegative}`}>
                  Biên LN {fmtNum(summaryStats.profitMargin, 1)}%
                </span>
              </div>
              <div className={styles.kpiSub}>
                {summaryStats.profitableCycles}/{filteredCycles.length} lứa có lãi dương
                {summaryStats.closedCycles > 0 ? ` · Đã chốt: ${summaryStats.realizedProfit >= 0 ? '+' : ''}${shortMoney(summaryStats.realizedProfit)}` : ''}
                {summaryStats.wipCost > 0 ? ` · Vốn đang nuôi (WIP): ${shortMoney(summaryStats.wipCost)}` : ''}
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Quy mô đàn &amp; Kỹ thuật</span>
                <span className={styles.kpiIcon}><CheckCircle2 size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(summaryStats.currentLive)} con đang nuôi</div>
              <div className={styles.kpiSub}>
                Nhập {fmtNum(summaryStats.totalIn)} · Tỷ lệ sống {fmtNum(summaryStats.survivalRate, 1)}%
                {summaryStats.avgFcr ? ` · FCR TB ${fmtNum(summaryStats.avgFcr, 2)}` : ''}
              </div>
            </div>
          </div>

          <div className={styles.analyticsGrid}>
            <CycleProfitBarChart cycles={filteredCycles} />
            <CostStructureDonutChart
              chickCost={summaryStats.chickCost}
              feedCost={summaryStats.feedCost}
              otherCost={summaryStats.otherCost}
              medicineCost={summaryStats.medicineCost}
              otherDirectCost={summaryStats.otherDirectCost}
              totalCost={summaryStats.totalCost}
            />
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Bảng hạch toán Lãi/Lỗ &amp; Kỹ thuật chi tiết theo Lứa nuôi</h3>
                <span className={styles.sectionSubtitle}>
                  Bóc tách Con giống – Thức ăn – Thuốc/Vắc-xin – Chi phí khác &amp; Giá vốn/kg đối soát với Doanh thu thu hoạch
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
                    <th className={styles.numCell}>Nhập / Hiện nuôi</th>
                    <th className={styles.numCell}>Hao hụt / Sống</th>
                    <th className={styles.numCell}>CP Giống</th>
                    <th className={styles.numCell}>CP Cám</th>
                    <th className={styles.numCell}>Thuốc &amp; VX</th>
                    <th className={styles.numCell}>CP Khác</th>
                    <th className={styles.numCell}>Tổng chi phí</th>
                    <th className={styles.numCell}>Giá vốn/kg</th>
                    <th className={styles.numCell}>Doanh thu</th>
                    <th className={styles.numCell}>Lợi nhuận ròng</th>
                    <th className={styles.numCell}>FCR</th>
                  </tr>
                </thead>
                <tbody>
                  {cyclePaging.rows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className={styles.emptyRow}>
                        {loading ? 'Đang tổng hợp dữ liệu trang trại...' : 'Chưa có lứa nuôi phù hợp với bộ lọc.'}
                      </td>
                    </tr>
                  ) : cyclePaging.rows.map((c) => (
                    <tr key={c.cycleId}>
                      <td>
                        <span className={styles.codeCell}>{c.cycleCode}</span> · {renderBarnLink(c.barnName, c.barnId)}
                        <span className={styles.subText}>{c.areaName || 'Trang trại'} · Bắt đầu {fmtDate(c.startDate)}</span>
                      </td>
                      <td>{c.breed}</td>
                      <td>
                        <span className={c.status === 'ACTIVE' ? styles.mintBadge : styles.sageBadge}>
                          {c.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã đóng'}
                        </span>
                      </td>
                      <td className={styles.numCell}>
                        <strong>{fmtNum(c.currentQuantity)} con</strong>
                        <span className={styles.subText}>Nhập {fmtNum(c.totalIn)} · Xuất {fmtNum(c.harvested)}</span>
                      </td>
                      <td className={styles.numCell}>
                        <span className={Number(c.survivalRate) >= 95 ? styles.mintBadge : styles.warnBadge}>
                          {fmtNum(c.survivalRate, 1)}%
                        </span>
                        <span className={styles.subText}>Hao hụt {fmtNum(Number(c.deaths || 0) + Number(c.culls || 0))}</span>
                      </td>
                      <td className={styles.numCell}>{c.hasCostBreakdown ? fmtVnd(c.chickCost) : '—'}</td>
                      <td className={styles.numCell}>{c.hasCostBreakdown ? fmtVnd(c.feedCost) : '—'}</td>
                      <td className={styles.numCell}>{c.hasCostBreakdown && c.hasSeparateMedicine ? fmtVnd(c.medicineCost) : '—'}</td>
                      <td className={styles.numCell}>{c.hasCostBreakdown ? fmtVnd(c.otherDirectCost) : '—'}</td>
                      <td className={styles.numCell}><strong>{fmtVnd(c.totalCost)}</strong></td>
                      <td className={styles.numCell}>
                        {c.costPerKg ? (
                          <>
                            <strong>{fmtVnd(c.costPerKg)}</strong>
                            <span className={styles.subText}>/kg</span>
                          </>
                        ) : '—'}
                      </td>
                      <td className={`${styles.numCell} ${styles.positiveText}`}>
                        {fmtVnd(c.revenue)}
                        {c.avgSellingPricePerKg ? (
                          <span className={styles.subText}>TB {fmtVnd(c.avgSellingPricePerKg)}/kg</span>
                        ) : null}
                      </td>
                      <td className={styles.numCell}>
                        <span className={c.profit >= 0 ? styles.positiveText : c.isWip ? styles.kpiValueMuted : styles.negativeText}>
                          {c.profit >= 0 ? '+' : ''}{fmtVnd(c.profit)}
                        </span>
                        {c.isWip ? (
                          <div><span className={styles.wipPill}>Đang đầu tư (WIP)</span></div>
                        ) : c.marginPct !== null && (
                          <div>
                            <span className={`${styles.marginPill} ${c.profit >= 0 ? styles.marginPositive : styles.marginNegative}`}>
                              {fmtNum(c.marginPct, 1)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className={styles.numCell}>
                        {c.fcr !== null ? (
                          <span className={c.fcr <= 2.3 ? styles.mintBadge : styles.warnBadge}>{fmtNum(c.fcr, 2)}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filteredCycles.length > 0 && (
                  <tfoot>
                    <tr className={styles.tableFooterRow}>
                      <td colSpan={3}>Tổng cộng ({filteredCycles.length} lứa nuôi đang lọc)</td>
                      <td className={styles.numCell}>
                        {fmtNum(summaryStats.rowTotals.currentLive)} / {fmtNum(summaryStats.rowTotals.totalIn)} con
                      </td>
                      <td className={styles.numCell}>{fmtNum(summaryStats.rowTotals.deaths + summaryStats.rowTotals.culls)} con</td>
                      <td className={styles.numCell}>{fmtVnd(summaryStats.rowTotals.chickCost)}</td>
                      <td className={styles.numCell}>{fmtVnd(summaryStats.rowTotals.feedCost)}</td>
                      <td className={styles.numCell}>
                        {summaryStats.rowTotals.medicineCost > 0 ? fmtVnd(summaryStats.rowTotals.medicineCost) : '—'}
                      </td>
                      <td className={styles.numCell}>
                        {fmtVnd(summaryStats.rowTotals.otherDirectCost || summaryStats.rowTotals.otherCost)}
                      </td>
                      <td className={styles.numCell}>{fmtVnd(summaryStats.rowTotals.totalCost)}</td>
                      <td className={styles.numCell}>—</td>
                      <td className={`${styles.numCell} ${styles.positiveText}`}>{fmtVnd(summaryStats.rowTotals.totalRevenue)}</td>
                      <td className={`${styles.numCell} ${summaryStats.rowTotals.totalProfit >= 0 ? styles.positiveText : styles.negativeText}`}>
                        {summaryStats.rowTotals.totalProfit >= 0 ? '+' : ''}{fmtVnd(summaryStats.rowTotals.totalProfit)}
                      </td>
                      <td className={styles.numCell}>{summaryStats.avgFcr ? fmtNum(summaryStats.avgFcr, 2) : '—'}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {renderPager(cyclePaging, 'summary', 'lứa nuôi')}
          </div>
        </div>
      )}

      {/* ── Tab 2: Báo cáo bán hàng ────────────────────────────────────────────── */}
      {activeTab === 'sales' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng doanh thu bán gà</span>
                <span className={styles.kpiIcon}><ShoppingCart size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(salesStats.totalRevenue)}</div>
              <div className={styles.kpiSub}>{salesStats.orderCount} đơn xuất bán trong bộ lọc</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tiền đã thu &amp; Công nợ</span>
                <span className={styles.kpiIcon}><Wallet size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtVnd(salesStats.paidAmount)}</div>
              <div className={styles.kpiSub}>
                Còn phải thu: <strong className={Number(salesStats.debtAmount) > 0 ? styles.negativeText : ''}>{fmtVnd(salesStats.debtAmount)}</strong> ({fmtNum(salesStats.paidPct, 1)}% đã thu)
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng sản lượng xuất</span>
                <span className={styles.kpiIcon}><Scale size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(salesStats.totalWeightKg, 1)} kg</div>
              <div className={styles.kpiSub}>
                {fmtNum(salesStats.totalQuantity)} con · TB {fmtVnd(salesStats.avgUnitPrice)}/kg
              </div>
            </div>
          </div>

          <div className={styles.analyticsGridEqual}>
            <SalesPaymentDonutChart
              paidAmount={salesStats.paidAmount}
              debtAmount={salesStats.debtAmount}
              orders={salesBaseOrders}
              activeStatus={salesStatusFilter}
              onSelectStatus={(st) => {
                setSalesStatusFilter(st);
                setTabPage('sales', 1);
              }}
            />

            <section className={styles.chartCard} aria-label="Top khách hàng theo doanh thu">
              <div className={styles.chartHeader}>
                <div className={styles.chartTitleGroup}>
                  <h3 className={styles.chartTitle}><ShoppingCart size={16} color="#0284c7" /> Thương lái / Khách hàng nổi bật</h3>
                  <span className={styles.chartSubtitle}>Xếp theo tổng doanh thu và công nợ trong bộ lọc</span>
                </div>
              </div>
              {topCustomers.length === 0 ? (
                <p className={styles.chartEmpty}>Chưa có khách hàng phát sinh giao dịch.</p>
              ) : (
                <ul className={styles.rankedList}>
                  {topCustomers.map((c) => {
                    const maxC = topCustomers[0].revenue || 1;
                    return (
                      <li key={c.name} className={styles.rankedItem}>
                        <div className={styles.rankedItemTop}>
                          <span className={styles.rankedName}>{c.name} ({c.count} đơn)</span>
                          <span className={styles.rankedValue}>
                            {fmtVnd(c.revenue)}
                            {c.debt > 0 ? ` · Nợ ${shortMoney(c.debt)}` : ''}
                          </span>
                        </div>
                        <div className={styles.progressTrack}>
                          <div className={styles.progressFill} style={{ width: `${(c.revenue / maxC) * 100}%`, background: '#0284c7' }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Danh sách đơn xuất bán gà thịt thương phẩm</h3>
                <span className={styles.sectionSubtitle}>Dữ liệu đối chiếu thực tế từ phân hệ Quản lý bán hàng</span>
              </div>
              {renderSearchBar('Tìm mã đơn, khách hàng, chuồng...')}
            </div>

            <div className={styles.pillRow} role="group" aria-label="Lọc trạng thái thanh toán đơn bán">
              {[
                { key: 'ALL', label: 'Tất cả đơn bán', count: salesStats.statusCounts.ALL, color: null },
                { key: 'PAID', label: 'Đã thanh toán đủ', count: salesStats.statusCounts.PAID, color: '#007968' },
                { key: 'PARTIAL', label: 'Thanh toán một phần', count: salesStats.statusCounts.PARTIAL, color: '#0284c7' },
                { key: 'CREDIT', label: 'Ghi công nợ', count: salesStats.statusCounts.CREDIT, color: '#d97706' },
              ].map((pill) => {
                const isActive = salesStatusFilter === pill.key;
                return (
                  <button
                    key={pill.key}
                    type="button"
                    className={`${styles.filterPill} ${isActive ? styles.filterPillActive : ''}`}
                    onClick={() => {
                      setSalesStatusFilter(pill.key === salesStatusFilter ? 'ALL' : pill.key);
                      setTabPage('sales', 1);
                    }}
                  >
                    {pill.color && (
                      <i className={styles.pillDot} style={{ background: isActive ? '#ffffff' : pill.color }} />
                    )}
                    <span>{pill.label} ({pill.count})</span>
                  </button>
                );
              })}
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
                      <td>
                        <Link to={`/sales?tab=orders&search=${encodeURIComponent(o.code)}`} className={styles.drilldownLink}>
                          <span className={styles.codeCell}>{o.code}</span>
                          <ArrowUpRight size={12} />
                        </Link>
                      </td>
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
                {filteredSales.length > 0 && (
                  <tfoot>
                    <tr className={styles.tableFooterRow}>
                      <td colSpan={4}>Tổng cộng ({filteredSales.length} đơn bán đang lọc)</td>
                      <td className={styles.numCell}>
                        {fmtNum(salesStats.rowTotals.totalQuantity)} con ({fmtNum(salesStats.rowTotals.totalWeightKg, 1)} kg)
                      </td>
                      <td className={styles.numCell}>{fmtVnd(salesStats.rowTotals.totalRevenue)}</td>
                      <td className={`${styles.numCell} ${styles.positiveText}`}>{fmtVnd(salesStats.rowTotals.paidAmount)}</td>
                      <td className={`${styles.numCell} ${salesStats.rowTotals.debtAmount > 0 ? styles.negativeText : ''}`}>
                        {fmtVnd(salesStats.rowTotals.debtAmount)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {renderPager(salesPaging, 'sales', 'đơn bán')}
          </div>
        </div>
      )}

      {/* ── Tab 3: Báo cáo nhập hàng ───────────────────────────────────────────── */}
      {activeTab === 'purchases' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng giá trị nhập hàng</span>
                <span className={styles.kpiIcon}><ReceiptText size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtVnd(purchaseStats.totalAmount)}</div>
              <div className={styles.kpiSub}>
                {purchaseStats.invoiceCount} hóa đơn hợp lệ{purchaseStats.cancelledCount > 0 ? ` (${purchaseStats.cancelledCount} đã hủy)` : ''}
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Đã thanh toán NCC</span>
                <span className={styles.kpiIcon}><CheckCircle2 size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(purchaseStats.paidAmount)}</div>
              <div className={styles.kpiSub}>Đạt {fmtNum(purchaseStats.paidPct, 1)}% tổng giá trị hóa đơn</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Công nợ phải trả NCC</span>
                <span className={styles.kpiIcon}><Wallet size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${Number(purchaseStats.debtAmount) > 0 ? styles.kpiValueWarn : ''}`}>
                {fmtVnd(purchaseStats.debtAmount)}
              </div>
              <div className={styles.kpiSub}>Không tính hóa đơn đã hủy</div>
            </div>
          </div>

          <div className={styles.analyticsGridEqual}>
            <PurchaseStructureDonutChart
              paidAmount={purchaseStats.paidAmount}
              debtAmount={purchaseStats.debtAmount}
              invoices={filteredPurchases}
            />

            <section className={styles.chartCard} aria-label="Top nhà cung cấp theo giá trị nhập">
              <div className={styles.chartHeader}>
                <div className={styles.chartTitleGroup}>
                  <h3 className={styles.chartTitle}><ReceiptText size={16} color="#d97706" /> Nhà cung cấp chính theo Giá trị</h3>
                  <span className={styles.chartSubtitle}>Tổng hợp hóa đơn hợp lệ theo nhà cung cấp</span>
                </div>
              </div>
              {topSuppliers.length === 0 ? (
                <p className={styles.chartEmpty}>Chưa có hóa đơn hợp lệ từ nhà cung cấp.</p>
              ) : (
                <ul className={styles.rankedList}>
                  {topSuppliers.map((s) => {
                    const maxS = topSuppliers[0].amount || 1;
                    return (
                      <li key={s.name} className={styles.rankedItem}>
                        <div className={styles.rankedItemTop}>
                          <span className={styles.rankedName}>{s.name} ({s.count} HĐ)</span>
                          <span className={styles.rankedValue}>
                            {fmtVnd(s.amount)}
                            {s.debt > 0 ? ` · Nợ ${shortMoney(s.debt)}` : ''}
                          </span>
                        </div>
                        <div className={styles.progressTrack}>
                          <div className={styles.progressFill} style={{ width: `${(s.amount / maxS) * 100}%`, background: '#d97706' }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Chi tiết hóa đơn nhập hàng &amp; con giống</h3>
                <span className={styles.sectionSubtitle}>Theo nhà cung cấp và trạng thái nhập kho / chuồng</span>
              </div>
              {renderSearchBar('Tìm mã hóa đơn, nhà cung cấp, kho...')}
            </div>

            <div className={styles.pillRow} role="group" aria-label="Lọc trạng thái hóa đơn nhập hàng">
              {[
                { key: 'ALL', label: 'Tất cả hóa đơn', count: purchaseStats.statusCounts.ALL, color: null },
                { key: 'PAID', label: 'Đã tất toán', count: purchaseStats.statusCounts.PAID, color: '#007968' },
                { key: 'DEBT', label: 'Còn nợ NCC', count: purchaseStats.statusCounts.DEBT, color: '#d97706' },
                { key: 'CANCELLED', label: 'Đã hủy', count: purchaseStats.statusCounts.CANCELLED, color: '#dc2626' },
              ].map((pill) => {
                const isActive = purchasePaymentFilter === pill.key;
                return (
                  <button
                    key={pill.key}
                    type="button"
                    className={`${styles.filterPill} ${isActive ? styles.filterPillActive : ''}`}
                    onClick={() => {
                      setPurchasePaymentFilter(pill.key === purchasePaymentFilter ? 'ALL' : pill.key);
                      setTabPage('purchases', 1);
                    }}
                  >
                    {pill.color && (
                      <i className={styles.pillDot} style={{ background: isActive ? '#ffffff' : pill.color }} />
                    )}
                    <span>{pill.label} ({pill.count})</span>
                  </button>
                );
              })}
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
                        <td>
                          <Link to={`/purchases?invoice=${encodeURIComponent(p.id)}`} className={styles.drilldownLink}>
                            <span className={styles.codeCell}>{p.code}</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        </td>
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
                {filteredPurchases.length > 0 && (
                  <tfoot>
                    <tr className={styles.tableFooterRow}>
                      <td colSpan={4}>
                        Tổng cộng ({purchaseStats.rowTotals.validCount} hóa đơn hợp lệ đang lọc)
                      </td>
                      <td className={styles.numCell}>{fmtVnd(purchaseStats.rowTotals.totalAmount)}</td>
                      <td className={`${styles.numCell} ${styles.positiveText}`}>{fmtVnd(purchaseStats.rowTotals.paidAmount)}</td>
                      <td className={`${styles.numCell} ${purchaseStats.rowTotals.debtAmount > 0 ? styles.negativeText : ''}`}>
                        {fmtVnd(purchaseStats.rowTotals.debtAmount)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {renderPager(purchasePaging, 'purchases', 'hóa đơn')}
          </div>
        </div>
      )}

      {/* ── Tab 4: Báo cáo tồn kho ────────────────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Giá trị &amp; Quy mô tồn kho</span>
                <span className={styles.kpiIcon}><Warehouse size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(inventoryStats.totalValue)}</div>
              <div className={styles.kpiSub}>
                {inventoryStats.totalSkus} mặt hàng · {formatUnitMap(inventoryStats.unitMap, { compact: true, maxItems: 4 }) || '0 đơn vị'}
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Phân bổ Thức ăn &amp; Nguyên liệu</span>
                <span className={styles.kpiIcon}><Scale size={16} /></span>
              </div>
              <div className={styles.kpiValueRow}>
                <div className={styles.kpiValue}>{fmtVnd(inventoryStats.feedGroupValue)}</div>
                <span className={styles.kpiSharePill}>{fmtNum(inventoryStats.feedSharePct, 1)}%</span>
              </div>
              <div className={styles.kpiSub}>
                {formatUnitMap(inventoryStats.feedUnitMap, { compact: false, maxItems: 3 }) || '0 đơn vị'} · {inventoryStats.feedGroupSkus} mặt hàng
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Phân bổ Vắc-xin, Thuốc &amp; Vật tư</span>
                <span className={styles.kpiIcon}><Package size={16} /></span>
              </div>
              <div className={styles.kpiValueRow}>
                <div className={styles.kpiValue}>{fmtVnd(inventoryStats.medGroupValue)}</div>
                <span className={styles.kpiSharePill}>{fmtNum(inventoryStats.medSharePct, 1)}%</span>
              </div>
              <div className={styles.kpiSub}>
                {formatUnitMap(inventoryStats.medUnitMap, { compact: true, maxItems: 3 }) || '0 đơn vị'} · {inventoryStats.medGroupSkus} mặt hàng
              </div>
            </div>
          </div>

          <div className={styles.analyticsGridEqual}>
            <InventoryProportionDonutChart
              mode={inventoryPieMode}
              onModeChange={setInventoryPieMode}
              stockBreakdown={inventoryAnalytics.stockBreakdown}
              capitalStats={summaryStats}
              activeCategoryFilter={inventoryCategoryFilter}
              onSelectCategoryFilter={(catKey) => {
                setInventoryCategoryFilter(catKey);
                setTabPage('inventory', 1);
              }}
            />

            <WarehouseVisualPanel
              warehouses={warehouseSummary}
              stockBreakdown={inventoryAnalytics.stockBreakdown}
              selectedWarehouse={inventoryWarehouseFilter}
              onSelectWarehouse={(whName) => {
                setInventoryWarehouseFilter(whName);
                setTabPage('inventory', 1);
              }}
              activeCategoryFilter={inventoryCategoryFilter}
              onSelectCategoryFilter={(catKey) => {
                setInventoryCategoryFilter(catKey);
                setTabPage('inventory', 1);
              }}
            />
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Kiểm kê phân bổ &amp; số lượng tồn kho</h3>
                <span className={styles.sectionSubtitle}>Ảnh chụp số lượng thực tế, giá trị và tỷ trọng tại các kho trang trại</span>
              </div>
              {renderSearchBar('Tìm mã hàng, tên vật tư, kho...')}
            </div>

            <div className={styles.pillRow} role="group" aria-label="Lọc nhanh nhóm hàng tồn kho">
              {[
                { key: 'ALL', label: 'Tất cả vật tư', count: inventoryAnalytics.totalCount, color: null },
                { key: 'FEED', label: 'Cám công nghiệp', count: inventoryAnalytics.stockBreakdown.FEED.count, color: CHART_COLORS.feed },
                { key: 'VACCINE', label: 'Vắc-xin', count: inventoryAnalytics.stockBreakdown.VACCINE.count, color: CHART_COLORS.vaccine },
                { key: 'MEDICINE', label: 'Thuốc thú y', count: inventoryAnalytics.stockBreakdown.MEDICINE.count, color: CHART_COLORS.medicine },
                {
                  key: 'OTHER_MISC',
                  label: 'Ngũ cốc & Vật tư khác',
                  count: inventoryAnalytics.stockBreakdown.GRAIN.count + inventoryAnalytics.stockBreakdown.SUPPLY.count,
                  color: CHART_COLORS.grain,
                },
              ].map((pill) => {
                const isActive =
                  inventoryCategoryFilter === pill.key
                  || (pill.key === 'FEED' && inventoryCategoryFilter === 'FEED_ALL')
                  || ((pill.key === 'VACCINE' || pill.key === 'MEDICINE') && inventoryCategoryFilter === 'MED_VAC')
                  || (pill.key === 'MEDICINE' && inventoryCategoryFilter === 'MED_SUPPLY');
                return (
                  <button
                    key={pill.key}
                    type="button"
                    className={`${styles.filterPill} ${isActive ? styles.filterPillActive : ''}`}
                    onClick={() => {
                      setInventoryCategoryFilter(pill.key === inventoryCategoryFilter ? 'ALL' : pill.key);
                      setTabPage('inventory', 1);
                    }}
                  >
                    {pill.color && (
                      <i
                        className={styles.pillDot}
                        style={{ background: isActive ? '#ffffff' : pill.color }}
                      />
                    )}
                    <span>{pill.label} ({pill.count})</span>
                  </button>
                );
              })}

              {inventoryWarehouseFilter !== 'ALL' && (
                <button
                  type="button"
                  className={`${styles.filterPill} ${styles.filterPillActive}`}
                  onClick={() => {
                    setInventoryWarehouseFilter('ALL');
                    setTabPage('inventory', 1);
                  }}
                >
                  Kho: {inventoryWarehouseFilter} ×
                </button>
              )}
            </div>

            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className={`farmshift-table ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Mã hàng</th>
                    <th>Tên hàng hóa</th>
                    <th>Kho lưu trữ</th>
                    <th className={styles.numCell}>Tồn hiện tại</th>
                    <th className={styles.numCell}>Đơn giá</th>
                    <th className={styles.numCell}>Giá trị tồn</th>
                    <th className={styles.numCell}>Tỷ trọng</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryPaging.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyRow}>Không tìm thấy vật tư tồn kho phù hợp.</td>
                    </tr>
                  ) : inventoryPaging.rows.map((item) => {
                    const cat = item._catMeta || classifyItemCategory(item);
                    const val = Number(item.totalValue || 0);
                    const sharePct = inventoryStats.filteredValue > 0 ? (val / inventoryStats.filteredValue) * 100 : 0;
                    return (
                      <tr key={item.id}>
                        <td><span className={styles.codeCell}>{item.code}</span></td>
                        <td>
                          <strong>{item.name}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                            <span
                              className={styles.catTag}
                              style={{ background: cat.badgeBg, color: cat.badgeColor }}
                            >
                              {cat.shortLabel}
                            </span>
                            {item.productType && <span className={styles.subText} style={{ marginTop: 0 }}>{item.productType}</span>}
                          </div>
                        </td>
                        <td>{item.warehouseName}</td>
                        <td className={styles.numCell}>
                          <strong>{fmtNum(item.stock)} {item.unitName}</strong>
                        </td>
                        <td className={styles.numCell}>{fmtVnd(item.unitPrice)}</td>
                        <td className={styles.numCell}><strong>{fmtVnd(item.totalValue)}</strong></td>
                        <td className={styles.numCell}>
                          <div className={styles.miniStockWrap}>
                            <strong>{fmtNum(sharePct, 1)}%</strong>
                            <div className={styles.miniStockTrack}>
                              <div
                                className={styles.miniStockFill}
                                style={{
                                  width: `${Math.max(4, Math.min(100, sharePct))}%`,
                                  background: cat.color || '#007968',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filteredInventory.length > 0 && (
                  <tfoot>
                    <tr className={styles.tableFooterRow}>
                      <td colSpan={3}>
                        Tổng phân bổ ({filteredInventory.length} mặt hàng)
                      </td>
                      <td className={styles.numCell}>
                        {formatUnitMap(inventoryStats.unitMap, { compact: false, maxItems: 5 }) || '—'}
                      </td>
                      <td />
                      <td className={`${styles.numCell} ${styles.positiveText}`}>
                        {fmtVnd(inventoryStats.filteredValue)}
                      </td>
                      <td className={styles.numCell}>100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {renderPager(inventoryPaging, 'inventory', 'mặt hàng')}
          </div>
        </div>
      )}

      {/* ── Tab 5: Báo cáo thu hoạch ───────────────────────────────────────────── */}
      {activeTab === 'harvest' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Sản lượng thu hoạch</span>
                <span className={styles.kpiIcon}><Scale size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(harvestStats.totalWeightKg, 1)} kg</div>
              <div className={styles.kpiSub}>
                {fmtNum(harvestStats.totalHead)} con qua {harvestStats.harvestEvents} đợt xuất chuồng
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Doanh thu xuất chuồng</span>
                <span className={styles.kpiIcon}><TrendingUp size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(harvestStats.totalRevenue)}</div>
              <div className={styles.kpiSub}>Trên {filteredHarvest.length} lứa thu hoạch trong bộ lọc</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Đơn giá bình quân</span>
                <span className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}><Wallet size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtVnd(harvestStats.avgUnitPrice)}/kg</div>
              <div className={styles.kpiSub}>Giá xuất bán thương phẩm bình quân</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Biểu trọng xuất bán TB</span>
                <span className={styles.kpiIcon}><CheckCircle2 size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(harvestStats.avgWeightPerBird, 2)} kg/con</div>
              <div className={styles.kpiSub}>Trọng lượng bình quân khi xuất bán</div>
            </div>
          </div>

          <div className={styles.analyticsGridEqual}>
            <HarvestRevenueChart rows={filteredHarvest} />
            <HarvestAreaDonutChart rows={filteredHarvest} />
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Sản lượng xuất bán &amp; thu hoạch theo chuồng nuôi</h3>
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
                        <span className={styles.codeCell}>{h.cycleCode}</span> · {renderBarnLink(h.barnName, barnIdByCycleId.get(h.cycleId))}
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
                {filteredHarvest.length > 0 && (
                  <tfoot>
                    <tr className={styles.tableFooterRow}>
                      <td colSpan={2}>Tổng cộng ({filteredHarvest.length} lứa thu hoạch)</td>
                      <td className={styles.numCell}>{harvestStats.rowTotals.harvestEvents}</td>
                      <td className={styles.numCell}>{fmtNum(harvestStats.rowTotals.totalHead)} con</td>
                      <td className={styles.numCell}>{fmtNum(harvestStats.rowTotals.totalWeightKg, 1)} kg</td>
                      <td className={styles.numCell}>{fmtNum(harvestStats.avgWeightPerBird, 2)} kg</td>
                      <td className={styles.numCell}>{fmtVnd(harvestStats.avgUnitPrice)}</td>
                      <td className={`${styles.numCell} ${styles.positiveText}`}>
                        {fmtVnd(harvestStats.rowTotals.totalRevenue)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {renderPager(harvestPaging, 'harvest', 'lứa thu hoạch')}
          </div>
        </div>
      )}

      {/* ── Tab 6: Xu hướng lứa nuôi (FCR & Tăng trọng) ────────────────────────── */}
      {activeTab === 'growth' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>FCR bình quân trang trại</span>
                <span className={styles.kpiIcon}><TrendingUp size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                {growthStats.avgFcr !== null && growthStats.avgFcr !== undefined ? fmtNum(growthStats.avgFcr, 2) : '—'}
              </div>
              <div className={styles.kpiSub}>
                {growthStats.goodFcrCount}/{filteredGrowth.length} lứa đạt chuẩn FCR &le; 2,30
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Trọng lượng &amp; ADG TB</span>
                <span className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}><Scale size={16} /></span>
              </div>
              <div className={styles.kpiValue}>
                {growthStats.avgWeightKg > 0 ? `${fmtNum(growthStats.avgWeightKg, 2)} kg/con` : '—'}
              </div>
              <div className={styles.kpiSub}>
                Tốc độ tăng trọng TB: {growthStats.avgAdgGrams > 0 ? `${fmtNum(growthStats.avgAdgGrams, 1)} g/ngày` : '—'}
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng cám tiêu thụ lũy kế</span>
                <span className={styles.kpiIcon}><Package size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(growthStats.totalFeedKg, 0)} kg</div>
              <div className={styles.kpiSub}>Tổng lượng thức ăn đã xuất cho các lứa lọc</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng tăng trọng sinh khối</span>
                <span className={styles.kpiIcon}><CheckCircle2 size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(growthStats.totalGainKg, 1)} kg</div>
              <div className={styles.kpiSub}>Sinh khối đàn đang nuôi + sản lượng đã xuất</div>
            </div>
          </div>

          <div className={styles.analyticsGridEqual}>
            <FcrComparisonChart cycles={filteredGrowth} />
            <WeightAndAdgChart cycles={filteredGrowth} />
          </div>

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Hệ số chuyển đổi thức ăn (FCR) &amp; Tốc độ tăng trọng (ADG)</h3>
                <span className={styles.sectionSubtitle}>Tính từ lượng cám thực ăn, sinh khối cân mẫu và sản lượng xuất chuồng</span>
              </div>
              {renderSearchBar('Tìm mã lứa, chuồng, giống gà...')}
            </div>

            {growthPaging.rows.length === 0 ? (
              <div className={styles.emptyRow}>Chưa đủ dữ liệu cân mẫu hoặc nhật ký cám để phân tích FCR.</div>
            ) : (
              <>
                <div className={styles.growthGrid}>
                  {growthPaging.rows.map((g) => {
                    const weightPct = g.avgWeightKg && g.targetWeightKg
                      ? Math.min(100, (Number(g.avgWeightKg) / Number(g.targetWeightKg)) * 100)
                      : null;
                    const linkedBarnId = barnIdByCycleId.get(g.cycleId);
                    return (
                      <article key={g.cycleId} className={styles.growthCard}>
                        <div className={styles.growthCardHead}>
                          <div>
                            <div className={styles.growthMeta}>{g.cycleCode} · {g.ageDays ? `${g.ageDays} ngày tuổi` : 'Chưa rõ tuổi'}</div>
                            <div className={styles.growthBarn}>
                              {renderBarnLink(g.barnName, linkedBarnId)} — {g.breed}
                            </div>
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
                            <span className={Number(g.fcr) <= 2.3 ? styles.mintBadge : styles.warnBadge}>
                              {Number(g.fcr) <= 2.3 ? 'Hiệu quả tốt' : 'Cần theo dõi'}
                            </span>
                          )}
                        </div>

                        {weightPct !== null && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#516a64' }}>
                              <span>Tiến độ trọng lượng mục tiêu</span>
                              <strong>{fmtNum(weightPct, 0)}%</strong>
                            </div>
                            <div className={styles.progressTrack}>
                              <div className={styles.progressFill} style={{ width: `${weightPct}%`, background: '#007968' }} />
                            </div>
                          </div>
                        )}

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
                    );
                  })}
                </div>
                {renderPager(growthPaging, 'growth', 'lứa nuôi', [6, 9, 12, 24])}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 7: Báo cáo xuất nhập nội bộ ─────────────────────────────────────── */}
      {activeTab === 'internal' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng giá trị luân chuyển</span>
                <span className={styles.kpiIcon}><ArrowLeftRight size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(internalStats.totalAmount)}</div>
              <div className={styles.kpiSub}>{internalStats.voucherCount} phiếu xuất / chuyển nội bộ</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Phiếu xuất dùng / chuồng</span>
                <span className={styles.kpiIcon}><Package size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{internalStats.exportCount} phiếu</div>
              <div className={styles.kpiSub}>Chuyển giữa các kho: {internalStats.transferCount} phiếu</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Số dòng hàng luân chuyển</span>
                <span className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}><Warehouse size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{filteredInternal.length} dòng</div>
              <div className={styles.kpiSub}>Chi tiết vật tư xuất kho &amp; điều chuyển</div>
            </div>
          </div>

          <InternalStockVisualRow items={filteredInternal} />

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>Chi tiết luân chuyển vật tư nội bộ</h3>
                <span className={styles.sectionSubtitle}>Theo từng dòng hàng hóa xuất kho &amp; chuyển kho</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {renderSearchBar('Tìm mã phiếu, tên hàng, kho xuất, nơi nhận...')}
                <Link to="/internal-stock" className={styles.moduleNavLink}>
                  Mở kho nội bộ <ArrowUpRight size={14} />
                </Link>
              </div>
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
                      <td>
                        <Link to={`/internal-stock?search=${encodeURIComponent(iv.code)}`} className={styles.drilldownLink}>
                          <span className={styles.codeCell}>{iv.code}</span>
                          <ArrowUpRight size={12} />
                        </Link>
                      </td>
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
                {filteredInternal.length > 0 && (
                  <tfoot>
                    <tr className={styles.tableFooterRow}>
                      <td colSpan={6}>
                        Tổng giá trị luân chuyển ({filteredInternal.length} dòng vật tư đang lọc)
                      </td>
                      <td className={`${styles.numCell} ${styles.positiveText}`}>
                        {fmtVnd(internalStats.filteredAmount)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {renderPager(internalPaging, 'internal', 'dòng phiếu')}
          </div>
        </div>
      )}

      {/* ── Tab 8: Nhật ký hoạt động ───────────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className={styles.stack}>
          <div className={styles.kpiGrid}>
            <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Tổng thao tác ghi nhận</span>
                <span className={styles.kpiIcon}><Activity size={16} /></span>
              </div>
              <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                {fmtNum(activityStats.totalCount)} hoạt động
              </div>
              <div className={styles.kpiSub}>
                {activityStats.staffCount} nhân sự{activityStats.partnerCount > 0 ? ` · ${activityStats.partnerCount} đối tác` : ''} trong phạm vi lọc
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Nhật ký chuồng &amp; Đàn gia cầm</span>
                <span className={styles.kpiIcon}><CheckCircle2 size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(activityStats.workLogCount)} lượt</div>
              <div className={styles.kpiSub}>Xác nhận việc, vệ sinh, cân mẫu, hao hụt &amp; nhập/chuyển đàn</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Giao dịch Mua bán &amp; Kho</span>
                <span className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}><ReceiptText size={16} /></span>
              </div>
              <div className={styles.kpiValue}>{fmtNum(activityStats.tradeStockCount)} chứng từ</div>
              <div className={styles.kpiSub}>Hóa đơn bán hàng, nhập hàng &amp; xuất nhập kho nội bộ</div>
            </div>
          </div>

          <ActivityVisualRow
            items={activityBaseItems}
            activeModule={activityModuleFilter}
            onSelectModule={(mod) => {
              setActivityModuleFilter(mod);
              setTabPage('activity', 1);
            }}
          />

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitleGroup}>
                <h3 className={styles.sectionTitle}>
                  <Activity size={16} style={{ verticalAlign: '-2px', marginRight: '6px', color: '#007968' }} />
                  Nhật ký hoạt động nghiệp vụ toàn trang trại
                </h3>
                  <span className={styles.sectionSubtitle}>
                    Tổng hợp từ Bán hàng, Nhập hàng, Kho nội bộ, Việc hằng ngày, Cân mẫu &amp; Biến động đàn
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

            {isMobile ? (
              <div style={{ padding: '12px' }}>
                <ResponsiveDataTable
                  data={filteredActivities}
                  rowKey={item => item.id}
                  mode="timeline"
                  initialVisibleCount={40}
                  loadMoreStep={40}
                  getTimelineDate={item => fmtDate(item.date || item.timestamp) || 'Khác'}
                  emptyState="Chưa có hoạt động phù hợp trong kỳ báo cáo."
                  renderTimelineItem={(actItem) => {
                    const modStyle = actItem.module === 'Đàn gia cầm'
                      ? { background: '#fdf2f8', color: '#be185d' }
                      : actItem.module === 'Nhập hàng'
                        ? { background: '#eff6ff', color: '#0369a1' }
                        : actItem.module === 'Bán hàng'
                          ? { background: '#fffbeb', color: '#b45309' }
                          : actItem.module === 'Xuất nhập nội bộ'
                            ? { background: '#f5f3ff', color: '#6d28d9' }
                            : null;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className={styles.mintBadge} style={modStyle || undefined}>{actItem.module}</span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>{fmtDateTime(actItem.timestamp || actItem.date)}</span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#181d26' }}>{actItem.action}</div>
                        <div style={{ fontSize: '13.5px', color: '#42545c' }}>{actItem.detail}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                          <span>{actItem.actor}</span>
                          <span>{renderActivityRefLink(actItem)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            ) : (
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
                  ) : activityPaging.rows.map((actItem) => {
                    const modStyle = actItem.module === 'Đàn gia cầm'
                      ? { background: '#fdf2f8', color: '#be185d' }
                      : actItem.module === 'Nhập hàng'
                        ? { background: '#eff6ff', color: '#0369a1' }
                        : actItem.module === 'Bán hàng'
                          ? { background: '#fffbeb', color: '#b45309' }
                          : actItem.module === 'Xuất nhập nội bộ'
                            ? { background: '#f5f3ff', color: '#6d28d9' }
                            : null;
                    return (
                      <tr key={actItem.id}>
                        <td className={styles.dateCell}>{fmtDateTime(actItem.timestamp || actItem.date)}</td>
                        <td><strong>{actItem.actor}</strong></td>
                        <td>
                          <span className={styles.mintBadge} style={modStyle || undefined}>
                            {actItem.module}
                          </span>
                        </td>
                        <td>{actItem.action}</td>
                        <td>{actItem.detail}</td>
                        <td>{renderActivityRefLink(actItem)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
            {!isMobile && renderPager(activityPaging, 'activity', 'hoạt động', [15, 30, 50, 100])}
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
