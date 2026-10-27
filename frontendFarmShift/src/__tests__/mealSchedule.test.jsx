import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DailyPlanCard } from '../features/farmshift/DailyPlanCard';
import { MealScheduleDialog } from '../features/farmshift/MealScheduleDialog';
import * as farm from '../services/farmService';

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../services/farmService', () => ({ getFarm: vi.fn(), updateMealSchedule: vi.fn() }));

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterAll(() => {
  if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShow);
  else delete HTMLDialogElement.prototype.showModal;
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
  else delete HTMLDialogElement.prototype.close;
});

const task = (key, category, name, extra = {}) => ({
  key, category, name, meal: null, mealsPerDay: null, time: null, method: null, doseText: '', plannedQuantity: null, unit: null,
  plannedStock: null, stockUnit: null, inventoryItemId: null, inventoryItemName: null, stockOnHand: null, stockEnough: null,
  tempMin: null, tempMax: null, note: '', shares: [], done: null, ...extra,
});
const feed = (meal, time) => task(`FEED:M${meal}`, 'FEED', 'Higro 01', { meal, mealsPerDay: 3, time, plannedQuantity: 10, unit: 'kg' });
const plan = {
  cycleId: 1, barnName: 'Chuồng 3', areaName: 'Khu Gà Hồ', date: '2026-10-28', headcount: 2000,
  flocks: [{ flockId: 1, code: 'H1', ageDays: 8, quantity: 2000 }], doneCount: 0, doneCost: null, warnings: [], workers: [],
  tasks: [feed(2, '11:00'), feed(1, '07:00'), feed(3, '15:00'), task('VACCINE:1', 'VACCINE', 'Lasota', { plannedQuantity: 2000, unit: 'liều' })],
  assignedTasks: [{ id: 5, title: 'Rửa máng uống', note: '', dueTime: '09:30:00', assignee: { id: 9, fullName: 'Hằng', email: 'h@farm.test' }, done: null }],
};

describe('Phiếu việc dạng lịch theo giờ', () => {
  it('puts each meal at its time, other work under "Trong ngày", and timed assigned work in between', () => {
    render(<DailyPlanCard plan={plan} role="ROLE_FARM_OWNER" userEmail="o@farm.test" onConfirm={vi.fn()} onUndo={vi.fn()} onConfirmAssigned={vi.fn()} />);
    const schedule = screen.getByLabelText('Lịch việc trong ngày');
    const times = [...schedule.querySelectorAll('[class*=slotTime] strong')].map(node => node.textContent);
    expect(times).toEqual(['Trong ngày', '07:00', '09:30', '11:00', '15:00']);

    const slots = schedule.querySelectorAll('[class*=slot_]');
    expect(within(slots[0]).getByText('Lasota')).toBeInTheDocument();
    expect(within(slots[1]).getByText('Cữ 1/3 · Higro 01')).toBeInTheDocument();
    expect(within(slots[1]).getByText('Cữ 1')).toBeInTheDocument();
    expect(within(slots[2]).getByText('Việc được giao')).toBeInTheDocument();
    expect(within(slots[2]).getByText(/Rửa máng uống/)).toBeInTheDocument();
  });
});

describe('Cài giờ cho ăn', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    farm.getFarm.mockResolvedValue({ id: 1, firstMealTime: '07:00:00' });
    farm.updateMealSchedule.mockResolvedValue({});
  });

  it('previews 3 meals 4 hours apart and 4 meals 3 hours apart, then saves the first meal time', async () => {
    const onSaved = vi.fn();
    render(<MealScheduleDialog onClose={vi.fn()} onSaved={onSaved} />);
    const input = await screen.findByLabelText('Giờ cữ ăn đầu tiên');
    await waitFor(() => expect(input).toHaveValue('07:00'));
    const row = meals => screen.getByText(`${meals} cữ`).closest('tr');
    expect(row(3)).toHaveTextContent('4 tiếng');
    expect(row(3)).toHaveTextContent('07:0011:0015:00');
    expect(row(4)).toHaveTextContent('3 tiếng');
    expect(row(4)).toHaveTextContent('07:0010:0013:0016:00');

    fireEvent.change(input, { target: { value: '06:30' } });
    expect(row(3)).toHaveTextContent('06:3010:3014:30');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giờ cho ăn' }));
    await waitFor(() => expect(farm.updateMealSchedule).toHaveBeenCalledWith('06:30'));
    expect(onSaved).toHaveBeenCalled();
  });

  it('refuses a first meal outside 04:00–10:00', async () => {
    render(<MealScheduleDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    const input = await screen.findByLabelText('Giờ cữ ăn đầu tiên');
    await waitFor(() => expect(input).toHaveValue('07:00'));
    fireEvent.change(input, { target: { value: '11:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giờ cho ăn' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('từ 04:00 đến 10:00');
    expect(farm.updateMealSchedule).not.toHaveBeenCalled();
  });
});
