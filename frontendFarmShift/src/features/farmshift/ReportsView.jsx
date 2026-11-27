// src/features/farmshift/ReportsView.jsx
// Báo cáo & Thống kê FarmShift (4 tab phẳng, 1 thanh bộ lọc hợp nhất & component tách module)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronDown,
  FileSpreadsheet,
  MoreVertical,
  Printer,
  RotateCcw,
  X,
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useNotification } from '../../context/NotificationContext';
import { getReportSummary } from '../../services/reportService';
import { getFarm } from '../../services/farmService';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { useViewport } from '../../hooks/useViewport';
import { MobileFilterSheet } from '../../components/common/MobileFilterSheet';
import styles from './ReportsView.module.css';
import {
  EMPTY_REPORT,
  REPORT_TABS,
  SALES_STATUS_LABELS,
  buildCsvDocument,
  classifyPurchaseStatus,
  csvCell,
  detectPresetFromDates,
  fmtDate,
  fmtDateTime,
  getIsoDate,
  getPresetRange,
  getTabLabel,
  matchesAreaFilter,
  matchesBarnFilter,
  normalizeReportData,
  resolveReportTab,
} from './reports/reportUtils';
import { FinancialOverviewTab } from './reports/FinancialOverviewTab';
import { PerformanceCyclesTab } from './reports/PerformanceCyclesTab';
import { TradeAndDebtTab } from './reports/TradeAndDebtTab';
import { ActivityLogTab } from './reports/ActivityLogTab';

const PERIOD_OPTIONS = [
  { key: 'all', label: 'Toàn thời gian' },
  { key: 'month', label: 'Tháng này' },
  { key: 'last30', label: '30 ngày gần nhất' },
  { key: 'quarter', label: 'Quý này' },
  { key: 'year', label: 'Năm nay' },
  { key: 'custom', label: 'Tùy chọn' },
];

export const ReportsView = () => {
  const notification = useNotification();
  const showToast = notification?.showToast || (() => {});
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile } = useViewport();

  const initialResolved = resolveReportTab(searchParams.get('tab'));
  const initialSub = searchParams.get('sub');
  const initialFrom = searchParams.get('from') || '';
  const initialTo = searchParams.get('to') || '';

  const [activeTab, setActiveTab] = useState(initialResolved.tab);
  const [tradeSubTab, setTradeSubTab] = useState(
    initialSub === 'purchases' || initialResolved.tradeSubTab === 'purchases' ? 'purchases' : 'sales'
  );
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(initialTo);
  const [preset, setPreset] = useState(() => detectPresetFromDates(initialFrom, initialTo));

  const [areaFilter, setAreaFilter] = useState(() => searchParams.get('area') || 'ALL');
  const [barnFilter, setBarnFilter] = useState(() => searchParams.get('barn') || 'ALL');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [salesStatusFilter, setSalesStatusFilter] = useState('ALL');
  const [purchasePaymentFilter, setPurchasePaymentFilter] = useState('ALL');

  const [farmName, setFarmName] = useState('Trang trại FarmShift');
  const [report, setReport] = useState(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    const next = new URLSearchParams();
    if (activeTab !== 'financial') next.set('tab', activeTab);
    if (activeTab === 'trade' && tradeSubTab !== 'sales') next.set('sub', tradeSubTab);
    if (dateFrom) next.set('from', dateFrom);
    if (dateTo) next.set('to', dateTo);
    if (areaFilter !== 'ALL') next.set('area', areaFilter);
    if (barnFilter !== 'ALL') next.set('barn', barnFilter);
    if (statusFilter !== 'ALL') next.set('status', statusFilter);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, tradeSubTab, dateFrom, dateTo, areaFilter, barnFilter, statusFilter, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    getFarm()
      .then((info) => {
        if (!cancelled && info?.name) setFarmName(info.name);
      })
      .catch(() => {});
    return () => { cancelled = true; };
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
        setHasLoadedOnce(true);
        setErrorMsg('');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err?.response?.data?.message || 'Không thể tải dữ liệu báo cáo từ máy chủ.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
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
      if (document.visibilityState === 'visible') triggerBackgroundRefresh();
    };
    window.addEventListener('focus', triggerBackgroundRefresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', triggerBackgroundRefresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useRealtimeRefresh(
    [
      '/reports', '/purchases', '/sales', '/sales-orders', '/internal-stock',
      '/cycles', '/flocks', '/journal', '/today-tasks', '/daily-plans', '/daily-plan',
      '/inventory-items', '/inventory', '/work-tasks', '/barns', '/farm-areas', '/areas', '/debts',
    ],
    () => setRefreshNonce((n) => n + 1)
  );

  useEffect(() => {
    if (!exportMenuOpen && !mobileMenuOpen) return undefined;
    const handleOutside = (e) => {
      if (exportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
      if (mobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setExportMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [exportMenuOpen, mobileMenuOpen]);

  const handleSelectPreset = (key) => {
    setPreset(key);
    if (key === 'custom') return;
    const range = getPresetRange(key);
    setLoading(true);
    setErrorMsg('');
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const handleDateChange = (field, value) => {
    setPreset('custom');
    setLoading(true);
    setErrorMsg('');
    if (field === 'from') setDateFrom(value);
    else setDateTo(value);
  };

  const handleResetAllFilters = () => {
    setPreset('all');
    if (dateFrom || dateTo) setLoading(true);
    setDateFrom('');
    setDateTo('');
    setAreaFilter('ALL');
    setBarnFilter('ALL');
    setStatusFilter('ALL');
    setSearchTerm('');
    setSalesStatusFilter('ALL');
    setPurchasePaymentFilter('ALL');
  };

  const handleRetry = () => {
    setLoading(true);
    setErrorMsg('');
    setRefreshNonce((n) => n + 1);
  };

  const {
    farmSummary,
    salesReport,
    purchasesReport,
    harvestReport,
    growthReport,
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

  const harvestLookup = useMemo(() => {
    const byId = new Map();
    const byCode = new Map();
    for (const h of harvestReport.rows) {
      if (h.cycleId != null) byId.set(h.cycleId, h);
      if (h.cycleCode) byCode.set(h.cycleCode, h);
    }
    return { byId, byCode };
  }, [harvestReport.rows]);

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
      const diseaseMedicineCost = Number(c.diseaseMedicineCost || 0);
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
        diseaseMedicineCost,
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

  const filteredGrowth = useMemo(() => {
    return growthReport.cycles.filter((g) => {
      if (!matchesCycleDimensions(g)) return false;
      if (!q) return true;
      return `${g.cycleCode} ${g.barnName} ${g.areaName} ${g.breed}`.toLowerCase().includes(q);
    });
  }, [growthReport.cycles, matchesCycleDimensions, q]);

  const filteredHarvest = useMemo(() => {
    return harvestReport.rows.filter((h) => {
      if (areaFilter !== 'ALL' && h.areaName !== areaFilter) return false;
      if (barnFilter !== 'ALL' && h.barnName !== barnFilter) return false;
      if (statusFilter !== 'ALL') {
        const cycleMatch = enrichedCycles.find((c) => c.cycleId === h.cycleId || c.cycleCode === h.cycleCode);
        if (cycleMatch && cycleMatch.status !== statusFilter) return false;
      }
      if (!q) return true;
      return `${h.cycleCode} ${h.barnName} ${h.areaName} ${h.breed}`.toLowerCase().includes(q);
    });
  }, [harvestReport.rows, enrichedCycles, areaFilter, barnFilter, statusFilter, q]);

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

  const activityBaseItems = useMemo(() => {
    return activityReport.items.filter((a) => {
      if (!matchesAreaFilter(a.areaName, a.detail, areaFilter)) return false;
      if (!matchesBarnFilter(a.barnName, a.detail, barnFilter)) return false;
      if (!q) return true;
      return `${a.actor} ${a.module} ${a.action} ${a.detail} ${a.referenceCode || ''}`.toLowerCase().includes(q);
    });
  }, [activityReport.items, areaFilter, barnFilter, q]);

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
        } else {
          acc.closedCycles += 1;
          acc.realizedProfit += Number(c.profit || 0);
        }
        acc.chickCost += Number(c.chickCost || 0);
        acc.feedCost += Number(c.feedCost || 0);
        acc.otherCost += Number(c.otherCost || 0);
        acc.medicineCost += Number(c.medicineCost || 0);
        acc.diseaseMedicineCost += Number(c.diseaseMedicineCost || 0);
        acc.otherDirectCost += Number(c.otherDirectCost || 0);
        acc.totalCost += Number(c.totalCost || 0);
        acc.totalRevenue += Number(c.revenue || 0);
        acc.totalProfit += Number(c.profit || 0);
        if (Number(c.profit || 0) > 0) acc.profitableCycles += 1;
        return acc;
      },
      {
        totalIn: 0, harvested: 0, harvestedWeightKg: 0, deaths: 0, culls: 0, currentLive: 0,
        activeBarns: 0, closedCycles: 0, realizedProfit: 0, wipCost: 0,
        chickCost: 0, feedCost: 0, otherCost: 0, medicineCost: 0, diseaseMedicineCost: 0, otherDirectCost: 0,
        totalCost: 0, totalRevenue: 0, totalProfit: 0, profitableCycles: 0,
      }
    );

    const totalCost = hasCycleScopeFilter ? rowAgg.totalCost : Number(farmSummary.totalCost || rowAgg.totalCost);
    const totalRevenue = hasCycleScopeFilter ? rowAgg.totalRevenue : Number(farmSummary.totalRevenue || rowAgg.totalRevenue);
    const totalProfit = hasCycleScopeFilter ? rowAgg.totalProfit : Number(farmSummary.totalProfit ?? (totalRevenue - totalCost));
    const harvestedWeightKg = hasCycleScopeFilter
      ? rowAgg.harvestedWeightKg
      : Number(farmSummary.harvestedWeightKg || rowAgg.harvestedWeightKg);
    const realizedProfit = hasCycleScopeFilter ? rowAgg.realizedProfit : Number(farmSummary.realizedProfit ?? rowAgg.realizedProfit);
    const wipCost = hasCycleScopeFilter ? rowAgg.wipCost : Number(farmSummary.wipCost ?? rowAgg.wipCost);
    const closedCycles = hasCycleScopeFilter ? rowAgg.closedCycles : Number(farmSummary.closedCycles ?? rowAgg.closedCycles);

    const chickCost = hasCycleScopeFilter ? rowAgg.chickCost : Number(farmSummary.chickCost || rowAgg.chickCost);
    const feedCost = hasCycleScopeFilter ? rowAgg.feedCost : Number(farmSummary.feedCost || rowAgg.feedCost);
    const otherCost = hasCycleScopeFilter ? rowAgg.otherCost : Number(farmSummary.otherCost || rowAgg.otherCost);
    const medicineCost = hasCycleScopeFilter ? rowAgg.medicineCost : Number(farmSummary.medicineCost ?? rowAgg.medicineCost);
    const diseaseMedicineCost = hasCycleScopeFilter
      ? rowAgg.diseaseMedicineCost
      : Number(farmSummary.diseaseMedicineCost ?? rowAgg.diseaseMedicineCost);
    const otherDirectCost = hasCycleScopeFilter
      ? rowAgg.otherDirectCost
      : Number(farmSummary.otherDirectCost ?? rowAgg.otherDirectCost);

    const totalIn = hasCycleScopeFilter ? rowAgg.totalIn : Number(farmSummary.totalIn || rowAgg.totalIn);
    const harvested = hasCycleScopeFilter ? rowAgg.harvested : Number(farmSummary.harvested || rowAgg.harvested);
    const deaths = hasCycleScopeFilter ? rowAgg.deaths : Number(farmSummary.deaths || rowAgg.deaths);
    const culls = hasCycleScopeFilter ? rowAgg.culls : Number(farmSummary.culls || rowAgg.culls);
    const currentLive = hasCycleScopeFilter ? rowAgg.currentLive : Number(farmSummary.currentLive || rowAgg.currentLive);

    const lossCount = deaths + culls;
    const survivalScopeBase = Math.max(totalIn, currentLive + harvested + lossCount);
    const lossRate = hasCycleScopeFilter
      ? (survivalScopeBase > 0 ? (lossCount * 100) / survivalScopeBase : 0)
      : Number(farmSummary.lossRate || 0);
    const survivalRate = hasCycleScopeFilter
      ? (survivalScopeBase > 0 ? Math.max(0, 100 - lossRate) : 100)
      : Number(farmSummary.survivalRate ?? 100);

    const fcrValues = filteredCycles.map((c) => c.fcr).filter((v) => v !== null && v !== undefined && Number.isFinite(v));
    const avgFcr = fcrValues.length ? fcrValues.reduce((s, v) => s + v, 0) / fcrValues.length : growthReport.avgFcr;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalIn,
      harvested,
      harvestedWeightKg,
      deaths,
      culls,
      lossCount,
      survivalRate,
      currentLive,
      closedCycles,
      totalCost,
      totalRevenue,
      totalProfit,
      realizedProfit,
      wipCost,
      chickCost,
      feedCost,
      otherCost,
      medicineCost,
      diseaseMedicineCost,
      otherDirectCost,
      profitMargin,
      profitableCycles: rowAgg.profitableCycles,
      avgFcr,
      rowTotals: rowAgg,
    };
  }, [filteredCycles, farmSummary, growthReport.avgFcr, hasCycleScopeFilter]);

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
    const orderCount = isScoped ? filteredSales.length : Number(salesReport.orderCount || filteredSales.length);
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
    for (const p of filteredPurchases) {
      if (String(p.stockStatus || '').toLowerCase() === 'đã hủy') continue;
      validCount += 1;
      totalAmount += Number(p.totalAmount || 0);
      paidAmount += Number(p.paidAmount || 0);
      debtAmount += Number(p.debtAmount || 0);
    }
    const amt = isScoped ? totalAmount : Number(purchasesReport.totalAmount || totalAmount);
    const paid = isScoped ? paidAmount : Number(purchasesReport.paidAmount || paidAmount);
    const debt = isScoped ? debtAmount : Number(purchasesReport.debtAmount || debtAmount);
    const invCount = isScoped ? validCount : Number(purchasesReport.invoiceCount || validCount);
    const paidPct = amt > 0 ? Math.min(100, (paid / amt) * 100) : 0;

    const statusCounts = { ALL: purchasesBaseInvoices.length, PAID: 0, DEBT: 0, CANCELLED: 0 };
    for (const p of purchasesBaseInvoices) {
      statusCounts[classifyPurchaseStatus(p)] += 1;
    }

    return {
      invoiceCount: invCount,
      totalAmount: amt,
      paidAmount: paid,
      debtAmount: debt,
      paidPct,
      statusCounts,
      rowTotals: { totalAmount, paidAmount, debtAmount, validCount },
    };
  }, [filteredPurchases, purchasesBaseInvoices, purchasesReport, areaFilter, barnFilter, purchasePaymentFilter, q]);

  const periodLabel = dateFrom || dateTo
    ? `${dateFrom ? fmtDate(dateFrom) : '...'} → ${dateTo ? fmtDate(dateTo) : 'Hiện tại'}`
    : 'Toàn thời gian';
  const scopeLabel = [
    areaFilter !== 'ALL' ? `Khu: ${areaFilter}` : null,
    barnFilter !== 'ALL' ? `Chuồng: ${barnFilter}` : null,
    statusFilter !== 'ALL' ? `Trạng thái: ${statusFilter === 'ACTIVE' ? 'Đang nuôi' : 'Đã kết thúc'}` : null,
    q ? `Từ khóa: "${q}"` : null,
  ].filter(Boolean).join(' · ') || 'Toàn trang trại';

  const activeFilterCount = [
    preset !== 'all' || dateFrom !== '' || dateTo !== '',
    areaFilter !== 'ALL',
    barnFilter !== 'ALL',
    statusFilter !== 'ALL',
  ].filter(Boolean).length;

  const activeFilterChips = [
    (preset !== 'all' || dateFrom || dateTo) && {
      key: 'period',
      label: periodLabel,
      onClear: () => handleSelectPreset('all'),
    },
    areaFilter !== 'ALL' && {
      key: 'area',
      label: `Khu: ${areaFilter}`,
      onClear: () => { setAreaFilter('ALL'); setBarnFilter('ALL'); },
    },
    barnFilter !== 'ALL' && {
      key: 'barn',
      label: `Chuồng: ${barnFilter}`,
      onClear: () => setBarnFilter('ALL'),
    },
    statusFilter !== 'ALL' && {
      key: 'status',
      label: statusFilter === 'ACTIVE' ? 'Đang nuôi' : 'Đã kết thúc',
      onClear: () => setStatusFilter('ALL'),
    },
  ].filter(Boolean);

  const buildTabDataset = (targetTab, sub = tradeSubTab) => {
    if (targetTab === 'financial' || targetTab === 'performance') {
      return {
        filePrefix: targetTab === 'financial' ? 'Bao_cao_tong_quan_tai_chinh' : 'Bao_cao_hieu_suat_lua_nuoi',
        title: targetTab === 'financial'
          ? 'BÁO CÁO TỔNG QUAN TÀI CHÍNH THEO LỨA NUÔI'
          : 'BÁO CÁO HIỆU SUẤT & LỨA NUÔI',
        headers: [
          'Mã lứa', 'Chuồng', 'Khu', 'Giống gà', 'Bắt đầu', 'Kết thúc', 'Trạng thái',
          'Nhập đàn', 'Hiện nuôi', 'Xuất bán', 'Tỷ lệ sống (%)', 'FCR',
          'CP Con giống (VND)', 'CP Cám (VND)', 'CP Thuốc & VX (VND)', 'Tổng chi phí (VND)',
          'Doanh thu (VND)', 'Lợi nhuận ròng (VND)',
        ],
        rows: filteredCycles.map((c) => [
          c.cycleCode, c.barnName, c.areaName, c.breed,
          c.startDate || '', c.endDate || '', c.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã kết thúc',
          c.totalIn, c.currentQuantity, c.harvested, c.survivalRate, c.fcr ?? '',
          c.chickCost, c.feedCost, c.hasSeparateMedicine ? c.medicineCost : c.otherCost,
          c.totalCost, c.revenue, c.profit,
        ]),
        footerRow: [
          'TỔNG CỘNG', `${filteredCycles.length} lứa`, '', '', '', '', '',
          summaryStats.rowTotals.totalIn, summaryStats.rowTotals.currentLive, summaryStats.rowTotals.harvested,
          Number(summaryStats.survivalRate.toFixed(1)),
          summaryStats.avgFcr ? Number(Number(summaryStats.avgFcr).toFixed(2)) : '',
          summaryStats.rowTotals.chickCost, summaryStats.rowTotals.feedCost,
          summaryStats.rowTotals.medicineCost || summaryStats.rowTotals.otherCost,
          summaryStats.rowTotals.totalCost, summaryStats.rowTotals.totalRevenue, summaryStats.rowTotals.totalProfit,
        ],
      };
    }
    if (targetTab === 'trade' && sub === 'sales') {
      return {
        filePrefix: 'Bao_cao_ban_hang',
        title: 'BÁO CÁO BÁN HÀNG & THU HOẠCH',
        headers: ['Mã đơn', 'Ngày', 'Khách hàng', 'Đàn / Chuồng', 'Số con', 'Khối lượng (kg)', 'Tổng tiền (VND)', 'Đã thu', 'Còn nợ', 'Trạng thái'],
        rows: filteredSales.map((o) => [
          o.code, o.date, o.customer, o.flock, o.quantity, o.totalWeight, o.totalAmount, o.paidAmount, o.debtAmount, SALES_STATUS_LABELS[o.status] || o.status,
        ]),
        footerRow: [
          'TỔNG CỘNG', `${filteredSales.length} đơn`, '', '',
          salesStats.rowTotals.totalQuantity, Number(salesStats.rowTotals.totalWeightKg.toFixed(1)),
          salesStats.rowTotals.totalRevenue, salesStats.rowTotals.paidAmount, salesStats.rowTotals.debtAmount, '',
        ],
      };
    }
    if (targetTab === 'trade' && sub === 'purchases') {
      return {
        filePrefix: 'Bao_cao_nhap_hang',
        title: 'BÁO CÁO NHẬP HÀNG & NHÀ CUNG CẤP',
        headers: ['Mã hóa đơn', 'Ngày', 'Nhà cung cấp', 'Kho / Chuồng', 'Tổng tiền (VND)', 'Đã trả', 'Còn nợ', 'Thanh toán', 'Trạng thái kho'],
        rows: filteredPurchases.map((p) => [
          p.code, p.date, p.supplier, p.warehouseSummary, p.totalAmount, p.paidAmount, p.debtAmount, p.paymentStatus, p.stockStatus,
        ]),
        footerRow: [
          'TỔNG CỘNG (HỢP LỆ)', `${purchaseStats.rowTotals.validCount} HĐ`, '', '',
          purchaseStats.rowTotals.totalAmount, purchaseStats.rowTotals.paidAmount, purchaseStats.rowTotals.debtAmount, '', '',
        ],
      };
    }
    return {
      filePrefix: 'Nhat_ky_hoat_dong',
      title: 'NHẬT KÝ HOẠT ĐỘNG NGHIỆP VỤ',
      headers: ['Thời gian', 'Nhân sự', 'Phân hệ', 'Thao tác', 'Nội dung chi tiết', 'Chứng từ'],
      rows: activityBaseItems.map((a) => [
        fmtDateTime(a.timestamp || a.date), a.actor, a.module, a.action, a.detail, a.referenceCode || '',
      ]),
      footerRow: null,
    };
  };

  const triggerCsvDownload = (csvContent, filename) => {
    const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = (mode = 'tab') => {
    setExportMenuOpen(false);
    setMobileMenuOpen(false);

    if (mode === 'all') {
      const sections = [
        buildTabDataset('financial'),
        buildTabDataset('trade', 'sales'),
        buildTabDataset('trade', 'purchases'),
        buildTabDataset('activity'),
      ].filter((sec) => sec.rows.length > 0);

      if (!sections.length) {
        showToast('Chưa có dữ liệu báo cáo để xuất.', 'warning');
        return;
      }

      const lines = [
        ['BÁO CÁO TỔNG HỢP TOÀN BỘ TRANG TRẠI', farmName].map(csvCell).join(','),
        ['Kỳ báo cáo', periodLabel].map(csvCell).join(','),
        ['Phạm vi lọc', scopeLabel].map(csvCell).join(','),
        ['Ngày xuất', fmtDateTime(new Date().toISOString())].map(csvCell).join(','),
        '',
      ];
      for (const sec of sections) {
        lines.push([sec.title].map(csvCell).join(','));
        lines.push(sec.headers.map(csvCell).join(','));
        sec.rows.forEach((r) => lines.push(r.map(csvCell).join(',')));
        if (sec.footerRow) lines.push(sec.footerRow.map(csvCell).join(','));
        lines.push('');
      }
      triggerCsvDownload(`\uFEFF${lines.join('\n')}`, `Bao_cao_toan_bo_${getIsoDate(new Date())}.csv`);
      showToast('Xuất toàn bộ báo cáo Excel (CSV) thành công.', 'success');
      return;
    }

    const ds = buildTabDataset(activeTab, tradeSubTab);
    if (!ds.rows.length) {
      showToast('Chưa có dữ liệu trong mục báo cáo này để xuất.', 'warning');
      return;
    }
    const csv = buildCsvDocument({
      title: ds.title,
      farmName,
      periodLabel,
      scopeLabel,
      headers: ds.headers,
      rows: ds.rows,
      footerRow: ds.footerRow,
    });
    triggerCsvDownload(csv, `${ds.filePrefix}_${getIsoDate(new Date())}.csv`);
    showToast('Xuất báo cáo Excel (CSV) thành công.', 'success');
  };

  const renderActivityRefLink = useCallback((actItem) => {
    const code = actItem.referenceCode;
    if (!code) return <span className={styles.codeCell}>—</span>;
    if (actItem.module === 'Bán hàng') {
      return (
        <Link to={`/sales?tab=orders&search=${encodeURIComponent(code)}`} className={styles.drilldownLink}>
          <span className={styles.codeCell}>{code}</span>
          <ArrowUpRight size={12} />
        </Link>
      );
    }
    if (actItem.module === 'Nhập hàng' && actItem.referenceId) {
      return (
        <Link to={`/purchases?invoice=${encodeURIComponent(actItem.referenceId)}`} className={styles.drilldownLink}>
          <span className={styles.codeCell}>{code}</span>
          <ArrowUpRight size={12} />
        </Link>
      );
    }
    if (actItem.module === 'Xuất nhập nội bộ') {
      return (
        <Link to={`/internal-stock?search=${encodeURIComponent(code)}`} className={styles.drilldownLink}>
          <span className={styles.codeCell}>{code}</span>
          <ArrowUpRight size={12} />
        </Link>
      );
    }
    if ((actItem.module === 'Ghi nhật ký' || actItem.module === 'Đàn gia cầm') && actItem.referenceId) {
      return (
        <Link to={`/barns/${encodeURIComponent(actItem.referenceId)}`} className={styles.drilldownLink}>
          <span className={styles.codeCell}>{code}</span>
          <ArrowUpRight size={12} />
        </Link>
      );
    }
    return <span className={styles.codeCell}>{code}</span>;
  }, []);

  const filterControls = (
    <div className={styles.singleFilterRow}>
      <label className={styles.filterControlGroup}>
        <span className={styles.filterControlLabel}>Kỳ báo cáo</span>
        <select
          aria-label="Kỳ báo cáo"
          className={styles.selectFilter}
          value={preset}
          onChange={(e) => handleSelectPreset(e.target.value)}
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </label>

      <div className={styles.dateRangeCompact}>
        <label className={styles.dateField}>
          <span>Từ</span>
          <input
            type="date"
            aria-label="Từ ngày"
            placeholder="Tất cả thời gian"
            className={styles.dateInput}
            value={dateFrom}
            onChange={(e) => handleDateChange('from', e.target.value)}
          />
        </label>
        <span className={styles.dateDash}>–</span>
        <label className={styles.dateField}>
          <span>Đến</span>
          <input
            type="date"
            aria-label="Đến ngày"
            placeholder="Tất cả thời gian"
            className={styles.dateInput}
            value={dateTo}
            onChange={(e) => handleDateChange('to', e.target.value)}
          />
        </label>
        {!dateFrom && !dateTo && <span className={styles.allTimeHint}>Tất cả thời gian</span>}
      </div>

      <select
        aria-label="Lọc theo khu nuôi"
        className={styles.selectFilter}
        value={areaFilter}
        onChange={(e) => {
          setAreaFilter(e.target.value);
          setBarnFilter('ALL');
        }}
      >
        <option value="ALL">Tất cả khu nuôi</option>
        {areaOptions.map((area) => (
          <option key={area} value={area}>{area}</option>
        ))}
      </select>

      <select
        aria-label="Lọc theo chuồng"
        className={styles.selectFilter}
        value={barnFilter}
        onChange={(e) => setBarnFilter(e.target.value)}
      >
        <option value="ALL">Tất cả chuồng nuôi</option>
        {barnOptions.map((b) => (
          <option key={b.barnName} value={b.barnName}>
            {b.areaName ? `${b.barnName} (${b.areaName})` : b.barnName}
          </option>
        ))}
      </select>

      <select
        aria-label="Lọc trạng thái lứa"
        className={styles.selectFilter}
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="ALL">Tất cả trạng thái</option>
        <option value="ACTIVE">Đang nuôi</option>
        <option value="CLOSED">Đã kết thúc</option>
      </select>

      {activeFilterCount > 0 && !isMobile && (
        <button type="button" className={styles.clearFilterBtn} onClick={handleResetAllFilters}>
          <RotateCcw size={13} /> Đặt lại
        </button>
      )}
    </div>
  );

  return (
    <FarmShiftLayout
      pageTitle="Báo cáo & Thống kê"
      hideBreadcrumbs
      actions={
        <div className={styles.reportActionsWrap}>
          {isMobile ? (
            <div ref={mobileMenuRef} className={styles.mobileExportMenuWrap}>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                aria-label="Tùy chọn xuất và in báo cáo"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                <MoreVertical size={17} />
                <span>Xuất / In</span>
              </button>
              {mobileMenuOpen && (
                <div className={styles.mobileExportDropdown}>
                  <button type="button" onClick={() => handleExportExcel('tab')}>
                    <FileSpreadsheet size={15} /> Xuất tab đang xem
                  </button>
                  <button type="button" onClick={() => handleExportExcel('all')}>
                    <FileSpreadsheet size={15} /> Xuất toàn bộ báo cáo
                  </button>
                  <button type="button" onClick={() => { setMobileMenuOpen(false); window.print(); }}>
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
              <div ref={exportMenuRef} className={styles.exportDropdownWrap}>
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-excel"
                  aria-haspopup="menu"
                  aria-expanded={exportMenuOpen}
                  onClick={() => setExportMenuOpen((prev) => !prev)}
                >
                  <FileSpreadsheet size={15} /> Xuất Excel <ChevronDown size={14} />
                </button>
                {exportMenuOpen && (
                  <div className={styles.exportDropdownMenu} role="menu" aria-label="Tùy chọn xuất Excel">
                    <button type="button" role="menuitem" onClick={() => handleExportExcel('tab')}>
                      Xuất tab đang xem
                    </button>
                    <button type="button" role="menuitem" onClick={() => handleExportExcel('all')}>
                      Xuất toàn bộ báo cáo
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      }
    >
      {/* ── Print-Only Header ─────────────────────────────────────────────────── */}
      <div className={`${styles.printOnly} ${styles.printHeader}`}>
        <div className={styles.printFarmTitle}>{farmName}</div>
        <h2 className={styles.printReportTitle}>{getTabLabel(activeTab)}</h2>
        <div className={styles.printMeta}>
          <span>Kỳ báo cáo: <strong>{periodLabel}</strong></span>
          <span>Phạm vi: <strong>{scopeLabel}</strong></span>
          <span>Ngày kết xuất: <strong>{fmtDateTime(new Date().toISOString())}</strong></span>
        </div>
      </div>

      {/* ── Single-Row Filter Bar (Desktop) / Bottom Sheet + Chips (Mobile) ────── */}
      <div className={styles.filterCard}>
        <MobileFilterSheet
          activeCount={activeFilterCount}
          title="Bộ lọc báo cáo"
          onReset={handleResetAllFilters}
        >
          {filterControls}
        </MobileFilterSheet>

        {isMobile && activeFilterChips.length > 0 && (
          <div className={styles.activeChipsBar} aria-label="Bộ lọc đang áp dụng">
            {activeFilterChips.map((chip) => (
              <span key={chip.key} className={styles.activeChip}>
                <span>{chip.label}</span>
                <button type="button" aria-label={`Bỏ lọc ${chip.label}`} onClick={chip.onClear}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className={`${styles.statusBanner} ${styles.errorBanner}`} role="alert">
          <span>{errorMsg}</span>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            onClick={handleRetry}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* ── Flat 4-Tab Navigation ─────────────────────────────────────────────── */}
      <div className={styles.flatTabBar} role="tablist" aria-label="Phân hệ báo cáo">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.flatTabBtn} ${activeTab === tab.id ? styles.flatTabBtnActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Smooth Thin Refetch Indicator ─────────────────────────────────────── */}
      {loading && (
        <div className={styles.refetchTrack} role="status" aria-label="Đang cập nhật dữ liệu báo cáo">
          <div className={styles.refetchBar} />
        </div>
      )}

      {!hasLoadedOnce && loading ? (
        <div className={styles.initialLoadingBox}>Đang tải dữ liệu báo cáo...</div>
      ) : (
        <>
          {activeTab === 'financial' && (
            <FinancialOverviewTab
              summaryStats={summaryStats}
              filteredCycles={filteredCycles}
            />
          )}

          {activeTab === 'performance' && (
            <PerformanceCyclesTab
              filteredCycles={filteredCycles}
              filteredGrowth={filteredGrowth}
              filteredHarvest={filteredHarvest}
              growthLookup={growthLookup}
              harvestLookup={harvestLookup}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          )}

          {activeTab === 'trade' && (
            <TradeAndDebtTab
              subTab={tradeSubTab}
              onSubTabChange={setTradeSubTab}
              salesStats={salesStats}
              purchaseStats={purchaseStats}
              filteredSales={filteredSales}
              filteredPurchases={filteredPurchases}
              salesStatusFilter={salesStatusFilter}
              onSalesStatusFilterChange={setSalesStatusFilter}
              purchasePaymentFilter={purchasePaymentFilter}
              onPurchasePaymentFilterChange={setPurchasePaymentFilter}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityLogTab
              activityBaseItems={activityBaseItems}
              renderActivityRefLink={renderActivityRefLink}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          )}
        </>
      )}
    </FarmShiftLayout>
  );
};
