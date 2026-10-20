import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodayTasksView } from '../features/farmshift/TodayTasksView';
import * as service from '../services/dailyPlanService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_WORKER', email: 'worker@farm.test', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role, email: mocks.email } }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ pageTitle, children }) => <main><h1>{pageTitle}</h1>{children}</main> }));
vi.mock('../services/dailyPlanService', () => ({ getFarmDailyPlan: vi.fn(), confirmDailyTask: vi.fn(), undoDailyTask: vi.fn() }));

const today = (() => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
})();
const yesterday = (() => {
  const date = new Date(`${today}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
})();

const meal = (meal, done = null) => ({
  key: `FEED:I7:M${meal}`, category: 'FEED', name: 'Higro 02', meal, mealsPerDay: 2, method: null, doseText: '80 g/con/ngày', plannedQuantity: 100,
  unit: 'kg', plannedStock: 4, stockUnit: 'Bao 25kg', inventoryItemId: 7, inventoryItemName: 'Higro 02', stockOnHand: 50, stockEnough: true,
  tempMin: null, tempMax: null, note: '', shares: [], done,
});
const plan = (cycleId, barnName, tasks) => ({
  cycleId, cycleCode: `L0000${cycleId}`, barnId: cycleId, barnName, areaName: 'Khu Gà Hồ', date: today, headcount: 2500,
  flocks: [{ flockId: cycleId, code: 'H0001', name: 'Trống', programName: 'Gà Mía', ageDays: 11, quantity: 2500 }],
  tasks, doneCount: tasks.filter(task => task.done).length, doneCost: null, warnings: [],
});
const mine = { id: 1, actualQuantity: 100, stockQuantity: 4, unitPrice: null, cost: null, deviated: false, note: '', doneBy: 'worker@farm.test', doneAt: `${today}T06:00:00` };
const someoneElse = { ...mine, id: 2, doneBy: 'other@farm.test' };

const renderView = () => render(<MemoryRouter><TodayTasksView /></MemoryRouter>);
const openBarn = async name => {
  fireEvent.click(await screen.findByRole('button', { name: `Mở việc chuồng ${name}` }));
  return screen.findByRole('region', { name: `Phiếu việc ${name}` });
};

describe('Việc hôm nay: workers follow the plan and only tick tasks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_WORKER';
    service.getFarmDailyPlan.mockResolvedValue([
      plan(10, 'Chuồng 1', [meal(1, mine), meal(2)]),
      plan(20, 'Chuồng 2', [meal(1, someoneElse), meal(2)]),
    ]);
  });

  it('lists the barns first and opens the tasks of one barn on click', async () => {
    renderView();
    const card = await screen.findByRole('button', { name: 'Mở việc chuồng Chuồng 1' });
    expect(service.getFarmDailyPlan).toHaveBeenCalledWith(today);
    expect(screen.getByText(/2\/4/)).toBeInTheDocument();
    expect(within(card).getByText('Còn 1 việc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở việc chuồng Chuồng 2' })).toBeInTheDocument();
    // No task is shown until a barn is opened.
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    const first = await openBarn('Chuồng 1');
    expect(screen.queryByRole('region', { name: 'Phiếu việc Chuồng 2' })).not.toBeInTheDocument();
    expect(within(first).getAllByText('100 kg = 4 Bao 25kg')).toHaveLength(2);
    expect(within(first).getByText(/Xong lúc 06:00 · worker@farm.test/)).toBeInTheDocument();
    expect(screen.queryByText(/Chi phí đã ghi/)).not.toBeInTheDocument();
    // A worker can undo only what they ticked themselves today.
    expect(within(first).getByRole('button', { name: 'Hoàn tác Cữ 1/2 · Higro 02' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Ẩn việc đã xong'));
    expect(within(first).queryByText(/Xong lúc/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tất cả chuồng' }));
    const second = await openBarn('Chuồng 2');
    expect(within(second).queryByRole('button', { name: /Hoàn tác/ })).not.toBeInTheDocument();
  });

  it('ticks a task with one tap and replaces only that barn', async () => {
    service.confirmDailyTask.mockResolvedValue(plan(20, 'Chuồng 2', [meal(1, someoneElse), meal(2, mine)]));
    renderView();
    const second = await openBarn('Chuồng 2');
    fireEvent.click(within(second).getByRole('button', { name: 'Xong Cữ 2/2 · Higro 02' }));
    await waitFor(() => expect(service.confirmDailyTask).toHaveBeenCalledWith(20, { date: today, taskKey: 'FEED:I7:M2' }));
    expect(await screen.findByText(/3\/4/)).toBeInTheDocument();
    expect(within(second).getByText('2/2')).toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith('Đã xác nhận: Higro 02.', 'success');
  });

  it('shows the server reason under the task when the stock is short', async () => {
    service.confirmDailyTask.mockRejectedValue({ response: { data: { message: 'Kho chỉ còn 1 Bao 25kg Higro 02, cần 4. Hãy nhập kho trước khi xác nhận.' } } });
    renderView();
    const first = await openBarn('Chuồng 1');
    fireEvent.click(within(first).getByRole('button', { name: 'Xong Cữ 2/2 · Higro 02' }));
    expect(await within(first).findByRole('alert')).toHaveTextContent('Kho chỉ còn 1 Bao 25kg Higro 02');
  });

  it('goes back a day to catch up and cannot go into the future', async () => {
    renderView();
    await screen.findByRole('button', { name: 'Mở việc chuồng Chuồng 1' });
    expect(screen.getByRole('button', { name: 'Ngày sau' })).toBeDisabled();
    service.getFarmDailyPlan.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Ngày trước' }));
    await waitFor(() => expect(service.getFarmDailyPlan).toHaveBeenLastCalledWith(yesterday));
    expect(await screen.findByText(/Không có chuồng nào đang nuôi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hôm nay' })).toBeInTheDocument();
  });
});
