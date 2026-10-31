import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DailyPlanCard } from '../features/farmshift/DailyPlanCard';

const task = (key, category, name, extra = {}) => ({
  key, category, name, meal: null, mealsPerDay: null, method: null, doseText: null, plannedQuantity: null, unit: null, plannedStock: null, stockUnit: null,
  inventoryItemId: null, stockOnHand: null, stockEnough: null, tempMin: null, tempMax: null, note: '', shares: [], done: null, ...extra,
});
const plan = {
  cycleId: 20, barnName: 'Nhà A3', areaName: 'Khu Mía Thịt', date: '2026-10-29', headcount: 30000, warnings: [], doneCount: 0, doneCost: 0,
  flocks: [{ flockId: 4, code: 'H0004', ageDays: 18, quantity: 20000 }, { flockId: 5, code: 'H0005', ageDays: 18, quantity: 10000 }],
  tasks: [
    task('FEED:I7:M1', 'FEED', 'Higro 02', { meal: 1, mealsPerDay: 3, time: '07:00', doseText: '85 g/con/ngày', plannedQuantity: 850, unit: 'kg',
      plannedStock: 34, stockUnit: 'Bao 25kg', stockOnHand: 200, stockEnough: true,
      shares: [{ flockId: 4, flockCode: 'H0004', plannedQuantity: 566.667 }, { flockId: 5, flockCode: 'H0005', plannedQuantity: 283.333 }] }),
    task('MEDICINE:I9', 'MEDICINE', 'Men tiêu hóa', { doseText: '2 g/kg cám', plannedQuantity: 5100, unit: 'g', plannedStock: 5.1, stockUnit: 'Gói 1kg',
      stockOnHand: 2, stockEnough: false }),
  ],
};

describe('DailyPlanCard', () => {
  it('full card shows dose, per-flock split and records a different amount with a reason', async () => {
    const onConfirm = vi.fn().mockResolvedValueOnce('Lượng thực tế lệch -50% so với kế hoạch (5.100 g). Vui lòng ghi lý do.');
    render(<DailyPlanCard plan={plan} role="ROLE_FARM_OWNER" userEmail="owner@farm.test" busyKey={null} onConfirm={onConfirm} onUndo={vi.fn()} />);
    expect(screen.getByText('850 kg = 34 Bao 25kg')).toBeInTheDocument();
    expect(screen.getByText(/H0004: 566,667 kg, H0005: 283,333 kg/)).toBeInTheDocument();
    expect(screen.getByText('Kho không đủ: còn 2 Gói 1kg')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Khác kế hoạch Men tiêu hóa' }));
    fireEvent.change(screen.getByLabelText(/Lượng thực tế/), { target: { value: '2550' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng ghi lý do');
    expect(onConfirm).toHaveBeenLastCalledWith(plan, plan.tasks[1], { actualQuantity: 2550, note: undefined });
  });

  it('compact card keeps the layout but hides dose and per-flock split', async () => {
    const onConfirm = vi.fn().mockResolvedValue(null);
    render(<DailyPlanCard compact plan={plan} role="ROLE_FARM_OWNER" userEmail="owner@farm.test" busyKey={null} onConfirm={onConfirm} onUndo={vi.fn()} />);
    expect(screen.getByText('850 kg = 34 Bao 25kg')).toBeInTheDocument();
    expect(screen.getByText('Kho không đủ: còn 2 Gói 1kg')).toBeInTheDocument();
    expect(screen.queryByText(/H0004/)).not.toBeInTheDocument();
    expect(screen.queryByText(/85 g\/con\/ngày/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Khác kế hoạch Men tiêu hóa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xong Cữ 1/3 · Higro 02' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(plan, plan.tasks[0], {}));
  });

  it('hides "Giao cho" when the task goes to the only person in charge of the barn', () => {
    const hang = { id: 9, fullName: 'Nông Thị Hằng', email: 'hang@farm.test' };
    const ba = { id: 4, fullName: 'Nguyễn Văn Ba', email: 'ba@farm.test' };
    const assigned = { id: 5, title: 'Thay trấu ướt', note: '', dueTime: '08:00:00', assignee: hang, done: null };
    const { rerender } = render(<DailyPlanCard compact plan={{ ...plan, workers: [hang], assignedTasks: [assigned] }} role="ROLE_FARM_OWNER"
      userEmail="owner@farm.test" busyKey={null} onConfirm={vi.fn()} onUndo={vi.fn()} onConfirmAssigned={vi.fn()} onUndoAssigned={vi.fn()} />);
    expect(screen.getByText('Phụ trách: Nông Thị Hằng')).toBeInTheDocument();
    expect(screen.queryByText(/Giao cho/)).not.toBeInTheDocument();

    rerender(<DailyPlanCard compact plan={{ ...plan, workers: [hang, ba], assignedTasks: [assigned] }} role="ROLE_FARM_OWNER"
      userEmail="owner@farm.test" busyKey={null} onConfirm={vi.fn()} onUndo={vi.fn()} onConfirmAssigned={vi.fn()} onUndoAssigned={vi.fn()} />);
    expect(screen.getByText('Giao cho Nông Thị Hằng')).toBeInTheDocument();
  });
});
