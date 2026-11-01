import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyPlanCard } from '../features/farmshift/DailyPlanCard';
import { uniqueByName } from '../features/farmshift/farmAreaOptions';

describe('Chương trình nuôi chọn tên hàng, không chọn kho', () => {
  const lots = [
    { id: 1, name: 'Vắc-xin Gumboro', warehouseName: 'Kho thuốc chung' },
    { id: 7, name: 'Vắc-xin Gumboro ', warehouseName: 'Kho thuốc gà Mía' },
    { id: 9, name: 'Vắc-xin Lasota', warehouseName: 'Kho thuốc gà J' },
  ];

  it('shows each product name once even when several warehouses hold it', () => {
    expect(uniqueByName(lots).map(item => item.id)).toEqual([1, 9]);
  });

  it('keeps the lot already linked to the step', () => {
    expect(uniqueByName(lots, '7').map(item => item.id)).toEqual([7, 9]);
  });
});

describe('Phiếu việc hiện chi phí dự kiến theo giá trung bình', () => {
  const feed = {
    key: 'FEED:M1', category: 'FEED', name: 'Higro 02', meal: 1, mealsPerDay: 3, time: '07:00', method: null, doseText: '', plannedQuantity: 50,
    unit: 'kg', plannedStock: 2, stockUnit: 'Bao 25kg', inventoryItemId: 2, inventoryItemName: 'Higro 02', stockOnHand: 100, stockEnough: true,
    tempMin: null, tempMax: null, note: '', shares: [], done: null, averagePrice: 350000, plannedCost: 700000,
  };
  const plan = { cycleId: 1, barnName: 'Nhà A1', areaName: 'Khu Mía', date: '2026-11-01', headcount: 2500, flocks: [{ flockId: 1, ageDays: 20 }],
    tasks: [feed], doneCount: 0, doneCost: 0, plannedCost: 700000, warnings: [], assignedTasks: [] };

  it('shows the planned cost of a task and of the day to the owner', () => {
    render(<DailyPlanCard plan={plan} role="ROLE_FARM_OWNER" onConfirm={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText(/Dự kiến 700\.000đ/)).toHaveTextContent('giá TB 350.000đ/Bao 25kg');
    expect(screen.getByText('Dự kiến cả ngày: 700.000đ')).toBeInTheDocument();
  });

  it('shows no money to workers (the server sends no price)', () => {
    const workerPlan = { ...plan, plannedCost: null, doneCost: null, tasks: [{ ...feed, averagePrice: null, plannedCost: null }] };
    render(<DailyPlanCard plan={workerPlan} role="ROLE_FARM_WORKER" onConfirm={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.queryByText(/Dự kiến/)).not.toBeInTheDocument();
  });
});
