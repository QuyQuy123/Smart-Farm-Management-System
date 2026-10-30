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
    return { ...lots[0], ...group, price, stock: lots.reduce((sum, lot) => sum + Number(lot.stock || 0), 0),
      imageUrl: lots.find(lot => lot.imageUrl)?.imageUrl, brandName: brands.join(', ') };
  });
}
