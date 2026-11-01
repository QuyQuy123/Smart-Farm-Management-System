import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodayTasksView } from '../features/farmshift/TodayTasksView';
import * as service from '../services/dailyPlanService';
import * as workService from '../services/workAssignmentService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_WORKER', email: 'worker@farm.test', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role, email: mocks.email } }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ pageTitle, children }) => <main><h1>{pageTitle}</h1>{children}</main> }));
vi.mock('../services/dailyPlanService', () => ({ getFarmDailyPlan: vi.fn(), confirmDailyTask: vi.fn(), undoDailyTask: vi.fn() }));
vi.mock('../services/workAssignmentService', () => ({ checkWorkTask: vi.fn(), uncheckWorkTask: vi.fn(), getWorkBoard: vi.fn() }));

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

  it('shows the tasks the owner gave this worker and ticks them in the barn', async () => {
    const given = { id: 31, barnId: 10, title: 'Rửa máng uống', note: 'Dùng nước sát trùng', startDate: today, endDate: today, dueTime: '07:30:00',
      assignee: { id: 5, fullName: 'Công nhân A', email: 'worker@farm.test' }, done: null };
    service.getFarmDailyPlan.mockResolvedValue([{ ...plan(10, 'Chuồng 1', [meal(1, mine)]), workers: [given.assignee], assignedTasks: [given] }]);
    workService.checkWorkTask.mockResolvedValue({ ...given, done: { doneBy: 'worker@farm.test', doneAt: `${today}T07:40:00`, note: '' } });
    renderView();
    // The barn list counts the given task too: 1 of 2 done.
    expect(await screen.findByText('Còn 1 việc')).toBeInTheDocument();
    const card = await openBarn('Chuồng 1');
    expect(within(card).getByText('Phụ trách: Công nhân A')).toBeInTheDocument();
    expect(within(card).getByText('Việc được giao')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Xong Rửa máng uống' }));
    await waitFor(() => expect(workService.checkWorkTask).toHaveBeenCalledWith(31, today));
    expect(await within(card).findByText(/Xong lúc 07:40 · worker@farm.test/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Hoàn tác Rửa máng uống' })).toBeInTheDocument();
  });

  it('gives the owner a Phân công tab inside Việc hôm nay, and workers do not see it', async () => {
    const { unmount } = renderView();
    await screen.findByRole('button', { name: 'Mở việc chuồng Chuồng 1' });
    expect(screen.queryByRole('tab', { name: /Phân công/ })).not.toBeInTheDocument();
    unmount();

    mocks.role = 'ROLE_FARM_OWNER';
    workService.getWorkBoard.mockResolvedValue({ date: today, workers: [], barns: [] });
    renderView();
    fireEvent.click(await screen.findByRole('tab', { name: /Phân công/ }));
    await waitFor(() => expect(workService.getWorkBoard).toHaveBeenCalledWith(today));
    expect(screen.getByRole('tab', { name: /Phân công/ })).toHaveAttribute('aria-selected', 'true');
    // Assignments can be planned ahead, unlike the work sheet.
    expect(screen.getByRole('button', { name: 'Ngày sau' })).not.toBeDisabled();
    // Tổng kết việc giao nằm trên thanh công cụ, cùng chỗ với tổng kết của tab Việc hôm nay.
    expect(await screen.findByText(/việc giao đã xong/)).toHaveTextContent('0/0 việc giao đã xong');
  });

  it('goes back a day to catch up and cannot go into the future', async () => {
    renderView();
    await screen.findByRole('button', { name: 'Mở việc chuồng Chuồng 1' });
    expect(screen.getByRole('button', { name: 'Ngày sau' })).toBeDisabled();
    service.getFarmDailyPlan.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Ngày trước' }));
    await waitFor(() => expect(service.getFarmDailyPlan).toHaveBeenLastCalledWith(yesterday));
    expect(await screen.findByText(/Bạn chưa được phân công chuồng nào/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hôm nay' })).toBeInTheDocument();
  });
});
