const EXPIRY_RANK = { EXPIRED: 3, NEAR_EXPIRY: 2, NORMAL: 1, NONE: 0 };

function deriveExpiryStatus(expiryDate) {
  if (!expiryDate) return 'NONE';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(exp.getTime())) return 'NONE';
  const diffDays = Math.round((exp - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= 30) return 'NEAR_EXPIRY';
  return 'NORMAL';
}

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
    const totalStock = lots.reduce((sum, lot) => sum + Number(lot.stock || 0), 0);
    const minStock = lots.reduce((max, lot) => {
      const val = Number(lot.minStock);
      return Number.isFinite(val) && val > max ? val : max;
    }, 0) || null;
    const lowStock = Boolean(lots.some(lot => lot.lowStock) || (minStock != null && minStock > 0 && totalStock <= minStock));
    let worstExpiryStatus = 'NONE';
    let earliestExpiry = null;
    for (const lot of lots) {
      const status = lot.expiryStatus && lot.expiryStatus !== 'NONE' ? lot.expiryStatus : deriveExpiryStatus(lot.expiryDate);
      if ((EXPIRY_RANK[status] || 0) > (EXPIRY_RANK[worstExpiryStatus] || 0)) {
        worstExpiryStatus = status;
      }
      if (lot.expiryDate && (!earliestExpiry || lot.expiryDate < earliestExpiry)) {
        earliestExpiry = lot.expiryDate;
      }
    }
    const lotNumbers = [...new Set(lots.map(lot => lot.lotNumber).filter(Boolean))];
    return {
      ...lots[0],
      ...group,
      price,
      stock: totalStock,
      minStock,
      lowStock,
      expiryStatus: worstExpiryStatus,
      expiryDate: earliestExpiry,
      lotNumber: lotNumbers.join(', '),
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
