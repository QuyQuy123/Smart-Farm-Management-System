import { describe, expect, it } from 'vitest';
import { formatPackagedStock, groupInventoryItems, inventoryStockKg, splitPackagedStock } from '../utils/inventoryGroups';

describe('inventory summaries', () => {
  it('keeps package and kg balances consistent after feeding and undo', () => {
    const bag = { unitContentQuantity: 25, unitContentUnit: 'KG' };
    expect(inventoryStockKg({ ...bag, stock: 100 })).toBe(2500);
    expect(inventoryStockKg({ ...bag, stock: 97.72 })).toBe(2443);
    expect(inventoryStockKg({ ...bag, stock: 99.99996 })).toBe(2499.999);
    expect(inventoryStockKg({ stock: 2, unitContentQuantity: 500, unitContentUnit: 'G' })).toBe(1);
    expect(inventoryStockKg({ stock: 2, unitContentQuantity: 25, unitContentUnit: 'L' })).toBeNull();
    expect(inventoryStockKg({ stock: 2 })).toBeNull();
  });

  it('splits packaged mass stock into whole bags and partial bag weight', () => {
    const bag = { unitName: 'Bao (25kg)', unitContentQuantity: 25, unitContentUnit: 'KG' };
    expect(splitPackagedStock({ ...bag, stock: 29 })).toEqual({
      whole: 29, hasRemainder: false, remainder: 0, remainderUnit: 'kg', remainderText: '', unitLabel: 'bao',
    });
    expect(formatPackagedStock({ ...bag, stock: 29 })).toBeNull();
    expect(formatPackagedStock({ ...bag, stock: 5.3 })).toBe('5 bao (1 bao lẻ 7,5 kg)');
    expect(formatPackagedStock({ ...bag, stock: 0.3 })).toBe('1 bao lẻ 7,5 kg');
    expect(splitPackagedStock({ ...bag, stock: 99.99996 })).toEqual({
      whole: 100, hasRemainder: false, remainder: 0, remainderUnit: 'kg', remainderText: '', unitLabel: 'bao',
    });
    expect(formatPackagedStock({ unitName: 'Gói 50g', unitContentQuantity: 50, unitContentUnit: 'G', stock: 5.5 })).toBe('5 gói (1 gói lẻ 25 g)');
    expect(splitPackagedStock({ stock: 2, unitContentQuantity: 25, unitContentUnit: 'L' })).toBeNull();
    expect(formatPackagedStock({ stock: 2 })).toBeNull();
  });
  const base = { warehouseId: 1, productId: 10, name: 'Cám', unitId: 1 };
  it('averages receipt prices equally, including depleted receipts, using original invoice prices', () => {
    const result = groupInventoryItems([
      { ...base, id: 1, price: 500000, stock: 0, receipt: { price: 300000, quantity: 100 } },
      { ...base, id: 2, price: 400000, stock: 200, receipt: { price: 400000, quantity: 200 } },
      { ...base, id: 3, price: 999999, stock: 0 }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(350000);
    expect(result[0].stock).toBe(200);
    expect(result[0].lots).toHaveLength(3);
  });
  it('keeps warehouses and incompatible units separate', () => {
    expect(groupInventoryItems([
      { ...base, stock: 1 }, { ...base, warehouseId: 2, stock: 2 }, { ...base, unitId: 2, stock: 3 }
    ])).toHaveLength(3);
  });
  it('handles empty stock and catalogs without purchase receipts', () => {
    expect(groupInventoryItems([])).toEqual([]);
    const [group] = groupInventoryItems([{ ...base, price: 123000, stock: 0 }]);
    expect(group.price).toBe(123000);
    expect(group.stock).toBe(0);
  });
});
