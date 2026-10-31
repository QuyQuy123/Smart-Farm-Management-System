import { describe, expect, it } from 'vitest';
import { groupInventoryItems } from '../utils/inventoryGroups';

describe('inventory summaries', () => {
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
