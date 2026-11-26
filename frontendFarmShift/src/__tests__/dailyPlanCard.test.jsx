import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DailyPlanCard } from '../features/farmshift/DailyPlanCard';
import { todayIso } from '../features/farmshift/farmAreaOptions';

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
  it('rounds feed display in barn details without changing the confirmation amount', async () => {
    const feed = { ...plan.tasks[0], plannedQuantity: 56.955, plannedStock: 2.2782, stockUnit: 'Bao' };
    const current = { ...plan, tasks: [feed] };
    const onConfirm = vi.fn().mockResolvedValue(null);
    render(<DailyPlanCard compact plan={current} role="ROLE_FARM_OWNER" busyKey={null} onConfirm={onConfirm} onUndo={vi.fn()} />);
    expect(screen.getByText('57 kg = 2,3 Bao')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xong Cữ 1/3 · Higro 02' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(current, feed, {}));
    expect(feed.plannedQuantity).toBe(56.955);
  });
  it('sends the chosen warehouse source when more than one is available', async () => {
    const onConfirm = vi.fn().mockResolvedValue(null);
    const feed = { ...plan.tasks[0], stockSources: [
      { itemId: 7, warehouseName: 'Kho A', unitName: 'Bao', stock: 100 },
      { itemId: 8, warehouseName: 'Kho B', unitName: 'Bao', stock: 200 },
    ] };
    const current = { ...plan, tasks: [feed] };
    render(<DailyPlanCard plan={current} role="ROLE_FARM_OWNER" busyKey={null} onConfirm={onConfirm} onUndo={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: /Kho nguồn/ }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xong Cữ 1/3 · Higro 02' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(current, feed, { sourceItemId: 8 }));
  });
  it('full card shows the whole-barn amount only (mixed flocks share one feed) and records a different amount with a reason', async () => {
    const onConfirm = vi.fn().mockResolvedValueOnce('Lượng thực tế lệch -50% so với kế hoạch (5.100 g). Vui lòng ghi lý do.');
    render(<DailyPlanCard plan={plan} role="ROLE_FARM_OWNER" userEmail="owner@farm.test" busyKey={null} onConfirm={onConfirm} onUndo={vi.fn()} />);
    expect(screen.getByText('850 kg = 34 Bao 25kg')).toBeInTheDocument();
    expect(screen.queryByText(/H0004/)).not.toBeInTheDocument();
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

  it('matches worker email case-insensitively for task undo and assigned task actions', () => {
    const today = todayIso();
    const doneFeed = {
      ...plan.tasks[0],
      done: { id: 10, doneBy: 'Worker@Farm.Test', doneAt: `${today}T07:05:00`, actualQuantity: 850, deviated: false },
    };
    const assigned = {
      id: 77,
      title: 'Kiểm tra bạt che',
      note: '',
      dueTime: null,
      assignee: { id: 9, fullName: 'Công Nhân A', email: 'WORKER@FARM.TEST' },
      done: null,
    };

    render(
      <DailyPlanCard
        plan={{ ...plan, date: today, tasks: [doneFeed], assignedTasks: [assigned] }}
        role="ROLE_FARM_WORKER"
        userEmail="worker@farm.test"
        busyKey={null}
        onConfirm={vi.fn()}
        onUndo={vi.fn()}
        onConfirmAssigned={vi.fn()}
        onUndoAssigned={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Hoàn tác Cữ 1/3 · Higro 02' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xong Kiểm tra bạt che' })).toBeInTheDocument();
  });

  it('displays opened-bag strip and whole-bag warehouse guidance for FEED tasks', () => {
    const feedWithOpened = {
      ...plan.tasks[0],
      plannedQuantity: 40,
      openedFeedKg: 18,
      bagsToOpen: 1,
      plannedStock: 1,
    };
    const feedFromOpenedOnly = {
      ...plan.tasks[0],
      key: 'FEED:I7:M2',
      meal: 2,
      time: '11:00',
      plannedQuantity: 7,
      openedFeedKg: 10,
      bagsToOpen: 0,
      plannedStock: 0,
    };
    render(
      <DailyPlanCard
        plan={{
          ...plan,
          openedFeeds: [{ id: 1, productId: 7, feedName: 'Higro 02', remainingKg: 18 }],
          tasks: [feedWithOpened, feedFromOpenedOnly],
        }}
        role="ROLE_FARM_OWNER"
        userEmail="owner@farm.test"
        busyKey={null}
        onConfirm={vi.fn()}
        onUndo={vi.fn()}
      />,
    );

    expect(screen.getByTestId('opened-feed-strip')).toHaveTextContent('Cám đang mở bao tại chuồng:Higro 02: 18 kg');
    expect(screen.getByText('40 kg · dùng 18 kg đã mở + xuất 1 Bao 25kg')).toBeInTheDocument();
    expect(screen.getByText('7 kg · dùng cám đã mở tại chuồng (0 Bao 25kg)')).toBeInTheDocument();
  });

  it('renders routine task quick-tick buttons and calls onToggleRoutine on click', async () => {
    const onToggleRoutine = vi.fn().mockResolvedValue(null);
    const routineTasks = [
      { code: 'CHANGE_LITTER', title: 'Thay trấu', done: null },
      { code: 'CLEAN_FEEDERS', title: 'Vệ sinh máng', done: { id: 1, doneBy: 'worker@farm.test', doneAt: `${todayIso()}T07:00:00`, note: null } },
      { code: 'WASH_BARN', title: 'Xịt rửa chuồng', done: null },
    ];
    const current = { ...plan, date: todayIso(), tasks: [], routineTasks };
    render(
      <DailyPlanCard
        plan={current}
        role="ROLE_FARM_WORKER"
        userEmail="worker@farm.test"
        busyKey={null}
        onConfirm={vi.fn()}
        onUndo={vi.fn()}
        onToggleRoutine={onToggleRoutine}
      />,
    );

    const bar = screen.getByTestId('routine-tasks-bar');
    expect(bar).toHaveTextContent('Việc hằng ngày');
    expect(screen.getByText('1/3')).toBeInTheDocument();

    const changeLitterBtn = screen.getByRole('button', { name: /Thay trấu/ });
    expect(changeLitterBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(changeLitterBtn);
    await waitFor(() => expect(onToggleRoutine).toHaveBeenCalledWith(current, routineTasks[0]));

    const cleanFeedersBtn = screen.getByRole('button', { name: /Vệ sinh máng/ });
    expect(cleanFeedersBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(cleanFeedersBtn);
    await waitFor(() => expect(onToggleRoutine).toHaveBeenCalledWith(current, routineTasks[1]));
  });
});
