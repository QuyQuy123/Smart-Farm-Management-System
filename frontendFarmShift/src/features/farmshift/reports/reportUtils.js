// src/features/farmshift/reports/reportUtils.js
// Tiện ích chuẩn hóa dữ liệu, định dạng số/tiền tệ, phân loại vật tư, lọc chính xác và xuất CSV báo cáo.

export const EMPTY_REPORT = {
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
    chickCost: 0,
    feedCost: 0,
    otherCost: 0,
    medicineCost: 0,
    otherDirectCost: 0,
    realizedProfit: null,
    wipCost: null,
    wipRevenue: null,
    closedCycles: null,
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

export const normalizeReportData = (raw) => {
  if (!raw || typeof raw !== 'object') return EMPTY_REPORT;
  return {
    from: raw.from || null,
    to: raw.to || null,
    generatedDate: raw.generatedDate || null,
    farmSummary: {
      ...EMPTY_REPORT.farmSummary,
      ...(raw.farmSummary || {}),
      cycles: Array.isArray(raw.farmSummary?.cycles) ? raw.farmSummary.cycles : [],
    },
    salesReport: {
      ...EMPTY_REPORT.salesReport,
      ...(raw.salesReport || {}),
      orders: Array.isArray(raw.salesReport?.orders) ? raw.salesReport.orders : [],
    },
    purchasesReport: {
      ...EMPTY_REPORT.purchasesReport,
      ...(raw.purchasesReport || {}),
      invoices: Array.isArray(raw.purchasesReport?.invoices) ? raw.purchasesReport.invoices : [],
    },
    inventoryReport: {
      ...EMPTY_REPORT.inventoryReport,
      ...(raw.inventoryReport || {}),
      items: Array.isArray(raw.inventoryReport?.items) ? raw.inventoryReport.items : [],
    },
    harvestReport: {
      ...EMPTY_REPORT.harvestReport,
      ...(raw.harvestReport || {}),
      rows: Array.isArray(raw.harvestReport?.rows) ? raw.harvestReport.rows : [],
    },
    growthReport: {
      ...EMPTY_REPORT.growthReport,
      ...(raw.growthReport || {}),
      cycles: Array.isArray(raw.growthReport?.cycles) ? raw.growthReport.cycles : [],
    },
    internalStockReport: {
      ...EMPTY_REPORT.internalStockReport,
      ...(raw.internalStockReport || {}),
      items: Array.isArray(raw.internalStockReport?.items) ? raw.internalStockReport.items : [],
    },
    activityReport: {
      ...EMPTY_REPORT.activityReport,
      ...(raw.activityReport || {}),
      items: Array.isArray(raw.activityReport?.items) ? raw.activityReport.items : [],
    },
  };
};

export const fmtNum = (val, digits = 0) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const fmtVnd = (val) => `${fmtNum(Math.round(Number(val || 0)))} đ`;

export const shortMoney = (val) => {
  const n = Number(val || 0);
  if (!Number.isFinite(n) || n === 0) return '0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}${fmtNum(abs / 1e9, 1)} tỷ`;
  if (abs >= 1e6) return `${sign}${fmtNum(abs / 1e6, 1)} tr`;
  if (abs >= 1e3) return `${sign}${fmtNum(abs / 1e3, 0)}k`;
  return `${sign}${fmtNum(abs, 0)}`;
};

export const shortQty = (val) => {
  const n = Number(val || 0);
  if (!Number.isFinite(n) || n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${fmtNum(n / 1e6, 1)}M`;
  if (abs >= 1e4) return `${fmtNum(n / 1e3, 1)}k`;
  return fmtNum(n, Number.isInteger(n) ? 0 : 1);
};

export const extractBaseUnit = (unitName) => {
  const raw = String(unitName || '').trim();
  if (!raw) return 'ĐVT';
  const head = raw.split(/[\s(]/)[0].trim();
  return head || raw;
};

export const addItemToUnitMap = (targetMap, item) => {
  const qty = Number(item?.stock || 0);
  if (!Number.isFinite(qty) || qty === 0) return;
  const unit = String(item?.unitName || '').trim() || 'ĐVT';
  targetMap[unit] = (targetMap[unit] || 0) + qty;
};

export const mergeUnitMaps = (...maps) => {
  const merged = {};
  for (const m of maps) {
    if (!m || typeof m !== 'object') continue;
    for (const [unit, qty] of Object.entries(m)) {
      const n = Number(qty || 0);
      if (Number.isFinite(n) && n !== 0) {
        merged[unit] = (merged[unit] || 0) + n;
      }
    }
  }
  return merged;
};

export const formatUnitMap = (unitMap, { compact = false, shortNumbers = false, maxItems = 3 } = {}) => {
  if (!unitMap || typeof unitMap !== 'object') return '';
  const entries = Object.entries(unitMap).filter(([, qty]) => Number(qty) > 0);
  if (!entries.length) return '';

  let normalized;
  if (compact) {
    // Only collapse to base unit when multiple detailed unit names share a prefix (e.g. Lọ 1000 liều + Lọ 100 liều -> Lọ)
    const grouped = new Map();
    const rawNamesPerBase = new Map();
    for (const [unit, qty] of entries) {
      const base = extractBaseUnit(unit);
      grouped.set(base, (grouped.get(base) || 0) + Number(qty));
      if (!rawNamesPerBase.has(base)) rawNamesPerBase.set(base, new Set());
      rawNamesPerBase.get(base).add(unit);
    }
    normalized = Array.from(grouped.entries()).map(([base, qty]) => {
      const variants = rawNamesPerBase.get(base);
      const label = variants.size === 1 ? Array.from(variants)[0] : base;
      return [label, qty];
    });
  } else {
    normalized = entries;
  }

  normalized.sort((a, b) => b[1] - a[1]);
  const visible = normalized.slice(0, maxItems);
  const parts = visible.map(([label, qty]) => {
    const qtyStr = shortNumbers ? shortQty(qty) : fmtNum(qty, Number.isInteger(qty) ? 0 : 1);
    return `${qtyStr} ${label}`;
  });
  if (normalized.length > maxItems) {
    parts.push(`+${normalized.length - maxItems} ĐVT`);
  }
  return parts.join(' · ');
};

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
};

export const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  const d = fmtDate(s);
  const timePart = s.length >= 16 ? s.slice(11, 16) : '';
  return timePart ? `${d} ${timePart}` : d;
};

export const csvCell = (val) => {
  const str = val === null || val === undefined ? '' : String(val);
  return `"${str.replace(/"/g, '""')}"`;
};

export const getIsoDate = (dateObj) => dateObj.toISOString().slice(0, 10);

export const getPresetRange = (presetKey) => {
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

export const detectPresetFromDates = (from, to) => {
  if (!from && !to) return 'all';
  for (const key of ['month', 'quarter', 'year']) {
    const range = getPresetRange(key);
    if (range.from === from && range.to === to) return key;
  }
  return 'custom';
};

export const niceTicks = (max, count = 4) => {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * pow).find((s) => s >= raw) || raw;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => +(i * step).toFixed(6));
};

export const CHART_COLORS = {
  revenue: '#007968',
  cost: '#0284c7',
  profitPos: '#10b981',
  profitNeg: '#dc2626',
  chick: '#d97706',
  feed: '#0284c7',
  vaccine: '#7c3aed',
  medicine: '#db2777',
  grain: '#14b8a6',
  supply: '#64748b',
  operating: '#10b981',
  other: '#7c3aed',
  fallback: '#64748b',
  grid: '#e5eeeb',
  axis: '#c3cfca',
};

export const INVENTORY_CATEGORY_META = {
  FEED: {
    key: 'FEED',
    label: 'Cám công nghiệp (Thức ăn)',
    shortLabel: 'Cám / Thức ăn',
    color: '#0284c7',
    badgeBg: '#eff6ff',
    badgeColor: '#0369a1',
  },
  VACCINE: {
    key: 'VACCINE',
    label: 'Vắc-xin phòng bệnh',
    shortLabel: 'Vắc-xin',
    color: '#7c3aed',
    badgeBg: '#f5f3ff',
    badgeColor: '#6d28d9',
  },
  MEDICINE: {
    key: 'MEDICINE',
    label: 'Thuốc thú y & Bổ trợ',
    shortLabel: 'Thuốc thú y',
    color: '#db2777',
    badgeBg: '#fdf2f8',
    badgeColor: '#be185d',
  },
  GRAIN: {
    key: 'GRAIN',
    label: 'Ngũ cốc & Nguyên liệu',
    shortLabel: 'Ngũ cốc',
    color: '#14b8a6',
    badgeBg: '#f0fdfa',
    badgeColor: '#0f766e',
  },
  SUPPLY: {
    key: 'SUPPLY',
    label: 'Vật tư & Sát trùng',
    shortLabel: 'Vật tư',
    color: '#64748b',
    badgeBg: '#f1f5f9',
    badgeColor: '#475569',
  },
};

export const classifyItemCategory = ({
  name = '',
  productType = '',
  warehouseName = '',
  warehouseKind = '',
  categoryName = '',
} = {}) => {
  const text = `${name} ${productType} ${categoryName}`.toLowerCase();
  const wh = `${warehouseName}`.toLowerCase();
  const kind = String(warehouseKind || '').toUpperCase();

  if (/(vắc[\s-]*xin|vac[\s-]*xin|vacxin|vaccine|lasota|newcastle|gumboro|marek|nd-ib|đậu gà|tụ huyết trùng|cúm gia cầm)/i.test(text)) {
    return INVENTORY_CATEGORY_META.VACCINE;
  }
  if (/(ngô hạt|ngô nghiền|ngô mảnh|bắp|thóc|lúa|cám gạo|đỗ tương|đậu tương|khô dầu|bột cá|mật rỉ|khoai|sắn)/i.test(text)) {
    return INVENTORY_CATEGORY_META.GRAIN;
  }
  if (/(sát trùng|khử trùng|tiêu độc|iodine|povidone|formol|vôi bột|trấu|đệm lót|máng ăn|máng uống|bóng sưởi|chụp sưởi|dụng cụ)/i.test(text)) {
    return INVENTORY_CATEGORY_META.SUPPLY;
  }
  if (
    /(cám|higro|de heus|cargill|proconco|jafa|greenfeed|guyomarc|thức ăn)/i.test(text)
    || ((kind === 'FEED' || wh.includes('cám')) && !/(thuốc|vắc|vac|vitamin|kháng sinh)/i.test(text))
  ) {
    return INVENTORY_CATEGORY_META.FEED;
  }
  if (
    /(thuốc|kháng sinh|vitamin|điện giải|men tiêu hóa|men sống|probiotic|bổ gan|giải độc|cầu trùng|amox|doxy|tylosin|enro|colistin|tiamulin|gluco|ade|b-complex|bcomplex)/i.test(text)
    || kind === 'MEDICINE'
    || wh.includes('thuốc')
    || text.includes('thú y')
  ) {
    return INVENTORY_CATEGORY_META.MEDICINE;
  }
  return INVENTORY_CATEGORY_META.SUPPLY;
};

export const buildDonutArcs = (segments, total, cx = 105, cy = 100, R = 76, r = 49) => {
  if (!(total > 0) || !segments.length) return [];
  let angle = -Math.PI / 2;
  return segments.map((seg) => {
    const startAngle = angle;
    const sweep = (seg.value / total) * Math.PI * 2;
    const endAngle = startAngle + sweep;
    angle = endAngle;
    const largeArc = sweep > Math.PI ? 1 : 0;
    const pt = (rad, a) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    const d =
      segments.length === 1
        ? `M${cx - R},${cy}A${R},${R} 0 1 1 ${cx + R},${cy}A${R},${R} 0 1 1 ${cx - R},${cy}M${cx - r},${cy}A${r},${r} 0 1 0 ${cx + r},${cy}A${r},${r} 0 1 0 ${cx - r},${cy}Z`
        : `M${pt(R, startAngle)}A${R},${R} 0 ${largeArc} 1 ${pt(R, endAngle)}L${pt(r, endAngle)}A${r},${r} 0 ${largeArc} 0 ${pt(r, startAngle)}Z`;
    return { ...seg, d, mid: (startAngle + endAngle) / 2, pct: (seg.value / total) * 100 };
  });
};

export const SALES_STATUS_LABELS = {
  PAID: 'Đã thanh toán đủ',
  PARTIAL: 'Thanh toán một phần',
  DEBT: 'Ghi công nợ',
  CREDIT: 'Ghi công nợ',
};

export const TAB_CLUSTERS = [
  {
    cluster: 'Hạch toán & Chăn nuôi',
    tabs: [
      { id: 'summary', label: 'Tổng hợp toàn trại' },
      { id: 'growth', label: 'Xu hướng lứa nuôi (FCR)' },
      { id: 'harvest', label: 'Báo cáo thu hoạch' },
    ],
  },
  {
    cluster: 'Mua bán & Công nợ',
    tabs: [
      { id: 'sales', label: 'Báo cáo bán hàng' },
      { id: 'purchases', label: 'Báo cáo nhập hàng' },
    ],
  },
  {
    cluster: 'Kho & Vận hành',
    tabs: [
      { id: 'inventory', label: 'Báo cáo tồn kho' },
      { id: 'internal', label: 'Xuất nhập nội bộ' },
      { id: 'activity', label: 'Nhật ký hoạt động' },
    ],
  },
];

export const VALID_TAB_IDS = TAB_CLUSTERS.flatMap((g) => g.tabs.map((t) => t.id));

export const getTabLabel = (tabId) => {
  for (const group of TAB_CLUSTERS) {
    const found = group.tabs.find((t) => t.id === tabId);
    if (found) return found.label;
  }
  return 'Báo cáo & Thống kê';
};

const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchTokenBoundary = (text, needle) => {
  if (!needle) return false;
  const rx = new RegExp(`(?:^|[\\s\\-·,(/])${escapeRegExp(needle)}(?:$|[\\s\\-·,)/])`, 'i');
  return rx.test(text);
};

export const matchesAreaFilter = (explicitArea, fallbackText, selectedArea) => {
  if (selectedArea === 'ALL') return true;
  const target = String(selectedArea || '').trim();
  if (!target) return true;
  if (explicitArea !== undefined && explicitArea !== null && String(explicitArea).trim() !== '') {
    const areas = String(explicitArea).split(',').map((s) => s.trim().toLowerCase());
    return areas.includes(target.toLowerCase());
  }
  const raw = String(fallbackText || '').trim();
  if (!raw) return false;
  const full = target.toLowerCase();
  const short = full.replace(/^khu\s+/i, '').trim();
  return matchTokenBoundary(raw, full) || (short.length > 0 && matchTokenBoundary(raw, short));
};

export const matchesBarnFilter = (explicitBarn, fallbackText, selectedBarn) => {
  if (selectedBarn === 'ALL') return true;
  const target = String(selectedBarn || '').trim();
  if (!target) return true;
  if (explicitBarn !== undefined && explicitBarn !== null && String(explicitBarn).trim() !== '') {
    return String(explicitBarn).trim().toLowerCase() === target.toLowerCase();
  }
  return matchTokenBoundary(String(fallbackText || ''), target);
};

export const matchesInventoryCategory = (catKey, filterKey) => {
  if (filterKey === 'ALL') return true;
  if (filterKey === 'FEED_ALL') return catKey === 'FEED' || catKey === 'GRAIN';
  if (filterKey === 'MED_VAC') return catKey === 'VACCINE' || catKey === 'MEDICINE';
  if (filterKey === 'MED_SUPPLY') return catKey === 'MEDICINE' || catKey === 'SUPPLY';
  if (filterKey === 'OTHER_MISC') return catKey === 'GRAIN' || catKey === 'SUPPLY';
  return catKey === filterKey;
};

export const classifyPurchaseStatus = (p) => {
  if (String(p.stockStatus || '').toLowerCase() === 'đã hủy') return 'CANCELLED';
  if (Number(p.debtAmount || 0) > 0) return 'DEBT';
  return 'PAID';
};

export const buildCsvDocument = ({ title, farmName, periodLabel, scopeLabel, headers, rows, footerRow = null }) => {
  const metaRows = [
    [title, farmName || 'Trang trại FarmShift'],
    ['Kỳ báo cáo', periodLabel],
    ['Phạm vi lọc', scopeLabel],
    ['Ngày xuất', fmtDateTime(new Date().toISOString())],
    [],
  ];
  const allRows = [
    ...metaRows.map((r) => r.map(csvCell).join(',')),
    headers.map(csvCell).join(','),
    ...rows.map((r) => r.map(csvCell).join(',')),
  ];
  if (footerRow) {
    allRows.push(footerRow.map(csvCell).join(','));
  }
  return '\uFEFF' + allRows.join('\n');
};
