// src/utils/selectFormatters.js
// Shared contextual formatters & numeric helpers aligned with farmshift_ux_ui_polish_playbook.md

/**
 * Strip non-digit characters to get raw integer string for currency inputs.
 * Preserves a leading '-' so negative entries are caught by form validation instead of silently flipping positive.
 */
export function parseCurrencyDigits(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return '';
    return String(Math.round(raw));
  }
  const str = String(raw).trimStart();
  const isNeg = str.startsWith('-');
  const digits = str.replace(/\D/g, '');
  if (!digits) return isNeg ? '-' : '';
  return isNeg ? `-${digits}` : digits;
}

/**
 * Format an integer / numeric string with Vietnamese dot thousand separators.
 * e.g. 52000 -> "52.000", "295000000" -> "295.000.000", "-10000" -> "-10.000", "" -> ""
 */
export function formatThousandsVi(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  const parsed = parseCurrencyDigits(raw);
  if (!parsed) return '';
  if (parsed === '-') return '-';
  const isNeg = parsed.startsWith('-');
  const digits = isNeg ? parsed.slice(1) : parsed;
  // Avoid leading zeros like "005" -> "5", keep single "0"
  const normalized = digits.replace(/^0+(?=\d)/, '');
  const formatted = normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNeg ? `-${formatted}` : formatted;
}

/**
 * Compact Vietnamese reading hint for amounts >= 1.000.000 đ.
 * e.g. 295100000 -> "295,1 triệu đồng", 1250000000 -> "1,25 tỷ đồng"
 */
export function formatShortVietnameseCurrency(raw) {
  const num = Number(parseCurrencyDigits(raw));
  if (!Number.isFinite(num) || num < 1_000_000) return '';

  if (num >= 1_000_000_000) {
    const billions = num / 1_000_000_000;
    const formatted = Number(billions.toFixed(2))
      .toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    return `${formatted} tỷ đồng`;
  }

  const millions = num / 1_000_000;
  const formatted = Number(millions.toFixed(1))
    .toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  return `${formatted} triệu đồng`;
}

/**
 * Normalize raw text input for QuantityInput.
 * - allowDecimal = false: digits only
 * - allowDecimal = true: digits + single decimal point (converts comma to dot)
 */
export function normalizeQuantityInput(raw, allowDecimal = false, allowNegative = false) {
  if (raw === null || raw === undefined) return '';
  let str = String(raw);
  const isNegative = allowNegative && str.trimStart().startsWith('-');
  if (allowDecimal) {
    str = str.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const firstDot = str.indexOf('.');
    if (firstDot !== -1) {
      str = str.slice(0, firstDot + 1) + str.slice(firstDot + 1).replace(/\./g, '');
    }
  } else {
    str = str.replace(/\D/g, '');
  }
  return isNegative ? `-${str}` : str;
}

/**
 * Format a numeric value cleanly in Vietnamese locale.
 */
export function formatQuantityVi(value, maxDecimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Determine whether a barn / cycle item has no active birds (empty).
 */
export function isBarnEmpty(barn) {
  if (!barn) return true;
  const headcount = Number(
    barn.current ?? barn.currentQuantity ?? barn.currentBirds ?? barn.headcount ?? barn.totalQuantity ?? barn.birdCount ?? 0
  );
  const hasCycle = Boolean(
    barn.activeCycleId || barn.activeCycleCode || barn.cycleCode || barn.batchCode || barn.status === 'ACTIVE'
  );
  return headcount <= 0 && !hasCycle;
}

/**
 * Sort barns for operational dropdowns: active barns first, empty barns last (unless emptyLast=false).
 */
export function sortBarnsForOperation(barns = [], { emptyLast = true } = {}) {
  if (!Array.isArray(barns)) return [];
  if (!emptyLast) return [...barns];
  return [...barns].sort((a, b) => {
    const aEmpty = isBarnEmpty(a) ? 1 : 0;
    const bEmpty = isBarnEmpty(b) ? 1 : 0;
    return aEmpty - bEmpty;
  });
}

/**
 * Format Barn/Cycle dropdown option text:
 * e.g. "Nhà A1 · L000004 (Còn 2.450 con · 38 ngày)"
 * or   "Nhà A2 · Trống (Chưa nhập đàn)"
 */
export function formatBarnOption(barn, cycle = null) {
  if (!barn) return '';
  const name = barn.name || barn.barnName || barn.code || `Chuồng #${barn.id ?? ''}`;
  const cycleCode =
    cycle?.code ||
    cycle?.cycleCode ||
    barn.activeCycleCode ||
    barn.cycleCode ||
    barn.batchCode ||
    '';
  const headcountRaw =
    cycle?.currentBirds ??
    cycle?.currentQuantity ??
    barn.current ??
    barn.currentQuantity ??
    barn.currentBirds ??
    barn.headcount ??
    barn.totalQuantity ??
    barn.birdCount;
  const headcount = Number(headcountRaw ?? 0);
  const ageDays =
    cycle?.ageDays ??
    cycle?.currentAgeDays ??
    barn.ageDays ??
    barn.currentAgeDays ??
    null;

  if (headcount <= 0 && !cycleCode) {
    const cap = Number(barn.capacity ?? barn.maxCapacity ?? 0);
    return cap > 0
      ? `${name} · Trống (Sức chứa ${cap.toLocaleString('vi-VN')} con)`
      : `${name} · Trống (Chưa nhập đàn)`;
  }

  const parts = [];
  if (Number.isFinite(headcount)) {
    parts.push(`Còn ${headcount.toLocaleString('vi-VN')} con`);
  }
  if (ageDays !== null && ageDays !== undefined && ageDays !== '') {
    parts.push(`${ageDays} ngày`);
  }
  const meta = parts.length > 0 ? ` (${parts.join(' · ')})` : '';
  return cycleCode ? `${name} · ${cycleCode}${meta}` : `${name}${meta}`;
}

/**
 * Format Inventory / Feed / Medicine dropdown option text:
 * e.g. "Cám CP 511 · Tồn: 45 bao"
 */
export function formatInventoryOption(item) {
  if (!item) return '';
  const name = item.name || item.itemName || item.productName || `Vật tư #${item.id ?? ''}`;
  const stockRaw = item.stock ?? item.availableStock ?? item.quantity ?? item.remainingStock;
  const unit = item.unit || item.unitName || '';
  if (stockRaw === null || stockRaw === undefined) {
    return unit ? `${name} (${unit})` : name;
  }
  const stockNum = Number(stockRaw);
  const stockStr = Number.isFinite(stockNum) ? formatQuantityVi(stockNum, 2) : String(stockRaw);
  const suffix = unit ? ` ${unit}` : '';
  return `${name} · Tồn: ${stockStr}${suffix}`;
}

/**
 * Compute live stock preview after an export / consumption action:
 * e.g. "Tồn hiện tại: 45 bao -> Sau khi xuất còn: 41 bao"
 */
export function formatStockAfterExport(currentStock, exportQty, unit = '') {
  const current = Number(currentStock);
  const qty = Number(exportQty);
  if (!Number.isFinite(current)) {
    return { text: '', remaining: null, isExceeded: false };
  }
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const remaining = Math.round((current - safeQty) * 1000) / 1000;
  const isExceeded = remaining < 0;
  const unitSuffix = unit ? ` ${unit}` : '';
  const currentStr = formatQuantityVi(current, 2);
  const remainStr = formatQuantityVi(Math.max(0, remaining), 2);
  const text = isExceeded
    ? `Tồn hiện tại: ${currentStr}${unitSuffix} · Vượt tồn kho ${formatQuantityVi(Math.abs(remaining), 2)}${unitSuffix}`
    : `Tồn hiện tại: ${currentStr}${unitSuffix} -> Sau khi xuất còn: ${remainStr}${unitSuffix}`;
  return { text, remaining, isExceeded };
}
