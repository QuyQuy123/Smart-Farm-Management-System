/** Group stock for display only; receipt IDs remain intact for stock operations. */
export function groupInventoryItems(items) {
  const groups = new Map();
  for (const item of items) {
    // Different units cannot be added together without an explicit conversion.
    const key = JSON.stringify([item.warehouseId, item.productId ?? item.name, item.unitId ?? item.unitName ?? '']);
    if (!groups.has(key)) groups.set(key, { key, lots: [] });
    groups.get(key).lots.push(item);
  }
  return [...groups.values()].map(group => {
    const lots = group.lots;
    const priced = lots.filter(lot => lot.receipt || Number(lot.stock) > 0);
    const priceSamples = priced.length ? priced : lots;
    const price = priceSamples.reduce((sum, lot) => sum + Number(lot.receipt?.price ?? lot.price ?? 0), 0) / priceSamples.length;
    const brands = [...new Set(lots.map(lot => lot.brandName).filter(Boolean))];
    return {
      ...lots[0],
      ...group,
      price,
      stock: lots.reduce((sum, lot) => sum + Number(lot.stock || 0), 0),
      imageUrl: lots.find(lot => lot.imageUrl)?.imageUrl,
      brandName: brands.join(', ')
    };
  });
}

/** Weight is derived from the item's own package specification; volume/dose units are not kg. */
export function inventoryStockKg(item) {
  const content = Number(item.unitContentQuantity);
  const stock = Number(item.stock);
  const factor = { KG: 1, G: 0.001 }[item.unitContentUnit];
  return factor && Number.isFinite(content) && content > 0 && Number.isFinite(stock)
    ? Math.round(stock * content * factor * 1e6) / 1e6 : null;
}

/** Splits packaged mass inventory stock into whole packages plus remainder weight (e.g. 25 bao + 1 bao lẻ 7,5 kg). */
export function splitPackagedStock(item) {
  if (!item || !['KG', 'G'].includes(item.unitContentUnit)) return null;
  const content = Number(item.unitContentQuantity);
  const stock = Number(item.stock);
  if (!Number.isFinite(content) || content <= 0 || !Number.isFinite(stock) || stock < 0) return null;
  const inGrams = item.unitContentUnit === 'G' && content < 1000;
  const remainderUnit = inGrams ? 'g' : 'kg';
  const unitPerPkg = inGrams ? content : (item.unitContentUnit === 'G' ? content * 0.001 : content);
  let whole = Math.floor(stock + 1e-9);
  const rawRemainder = (stock - whole) * unitPerPkg;
  let remainder = Math.round(rawRemainder * 10) / 10;
  if (remainder >= unitPerPkg) {
    whole += 1;
    remainder = 0;
  }
  const unitLabel = String(item.unitName || '').trim().split(/[\s(]/)[0].toLocaleLowerCase('vi') || 'bao';
  const remainderText = remainder > 0
    ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(remainder)} ${remainderUnit}`
    : '';
  return {
    whole,
    hasRemainder: remainder > 0,
    remainder,
    remainderUnit,
    remainderText,
    unitLabel,
  };
}

export function formatPackagedStock(item) {
  const breakdown = splitPackagedStock(item);
  if (!breakdown || !breakdown.hasRemainder) return null;
  const wholeText = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(breakdown.whole);
  return breakdown.whole > 0
    ? `${wholeText} ${breakdown.unitLabel} (1 ${breakdown.unitLabel} lẻ ${breakdown.remainderText})`
    : `1 ${breakdown.unitLabel} lẻ ${breakdown.remainderText}`;
}
