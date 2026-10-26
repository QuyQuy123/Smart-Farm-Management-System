import { beforeEach, expect, it } from 'vitest';
import { readLocalSales, saveLocalSales } from '../services/localSalesStorage';

beforeEach(() => localStorage.clear());

it('restores saved invoices and keeps accounts separate', () => {
  const invoice = { id: 'so-1', code: 'BH000047', date: '2026-10-26', customer: 'Linh', flock: 'A - A1 - L1', quantity: 200, totalWeight: 590, unitPrice: 60000, totalAmount: 35400000, paidAmount: 35400000, note: '' };
  saveLocalSales('sales:owner', [invoice]);
  expect(readLocalSales('sales:owner')).toEqual([invoice]);
  expect(readLocalSales('sales:other')).toEqual([]);
});

it('handles malformed or incompatible stored data', () => {
  localStorage.setItem('sales', '{invalid');
  expect(readLocalSales('sales')).toEqual([]);
  localStorage.setItem('sales', JSON.stringify([null, { code: 'broken' }]));
  expect(readLocalSales('sales')).toEqual([]);
});
