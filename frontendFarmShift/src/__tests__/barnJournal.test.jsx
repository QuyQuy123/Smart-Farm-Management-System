import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BarnJournal } from '../features/farmshift/BarnJournal';
import * as plans from '../services/dailyPlanService';
import * as cycles from '../services/cycleService';

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../services/dailyPlanService', () => ({ getFarmDailyPlan: vi.fn() }));
vi.mock('../services/cycleService', () => ({ getCycle: vi.fn(), recordLoss: vi.fn(), addWeightSample: vi.fn() }));

const today = (() => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
})();
const daysAgo = days => {
  const date = new Date(`${today}T00:00:00`);
  date.setDate(date.getDate() - days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const barns = [
  { cycleId: 11, cycleCode: 'L01', barnName: 'Nhà A1', areaName: 'Khu Mía', headcount: 5000, flocks: [{ flockId: 21, ageDays: 20, quantity: 5000 }] },
  { cycleId: 12, cycleCode: 'L02', barnName: 'Nhà B1', areaName: 'Khu J', headcount: 3000, flocks: [{ flockId: 22, ageDays: 30, quantity: 3000 }] },
];
const cycle = (quantity = 5000, deaths = 0) => ({
  cycle: { id: 11, code: 'L01' }, barn: { id: 1, name: 'Nhà A1' },
  metrics: { currentQuantity: quantity, totalIn: 5000, deaths, culls: 0, lossRate: (deaths / 5000) * 100, avgWeightKg: 0.42 },
  flocks: [{ id: 21, code: 'F01', name: 'Gà Mía', quantity, status: 'ACTIVE' }],
  movements: deaths ? [{ id: 1, flockCode: 'F01', type: 'DEATH', movementDate: today, quantity: deaths, note: 'Bệnh', createdBy: 'a@farm.test' }] : [],
  weightSamples: [
    { id: 2, date: daysAgo(9), quantity: 0.42, sampleSize: 30, note: null, createdBy: 'a@farm.test' },
    { id: 1, date: daysAgo(16), quantity: 0.28, sampleSize: 30, note: null, createdBy: 'a@farm.test' },
  ],
});

describe('Nhật ký theo chuồng', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    plans.getFarmDailyPlan.mockResolvedValue(barns);
    cycles.getCycle.mockResolvedValue(cycle());
  });

  it('records deaths for the chosen barn and refreshes the headcount', async () => {
    cycles.recordLoss.mockResolvedValue({});
    render(<BarnJournal mode="loss" selectedCycleId={null} onSelect={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Nhà A1' })).toBeInTheDocument();
    expect(await screen.findByText('5.000', { selector: 'strong' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Số con/), { target: { value: '6000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ghi và trừ số con' }));
    expect(await screen.findByText('Đàn chỉ còn 5.000 con.')).toBeInTheDocument();
    expect(cycles.recordLoss).not.toHaveBeenCalled();

    cycles.getCycle.mockResolvedValue(cycle(4995, 5));
    fireEvent.change(screen.getByLabelText(/^Số con/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bệnh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ghi và trừ số con' }));

    await waitFor(() => expect(cycles.recordLoss).toHaveBeenCalledWith(21, { type: 'DEATH', movementDate: today, quantity: 5, note: 'Bệnh' }));
    expect(await screen.findByText('4.995', { selector: 'strong' })).toBeInTheDocument();
    const history = screen.getByRole('table');
    expect(within(history).getByText('Chết')).toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining('Đã ghi 5 con chết ở Nhà A1'), 'success');
  });

  it('works out the average from the total weighed and shows the gain', async () => {
    cycles.addWeightSample.mockResolvedValue(3);
    render(<BarnJournal mode="weight" selectedCycleId={null} onSelect={vi.fn()} />);
    expect(await screen.findByText('Đã 9 ngày chưa cân')).toBeInTheDocument();
    expect(screen.getByText('+140 g')).toBeInTheDocument();
    expect(screen.getByText('20 g')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Tổng khối lượng/), { target: { value: '15' } });
    expect(screen.getByText('0,5 kg/con')).toBeInTheDocument();
    expect(screen.getByText(/\+80 g so với lần cân/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ghi cân mẫu' }));

    await waitFor(() => expect(cycles.addWeightSample).toHaveBeenCalledWith(11, { sampleDate: today, avgWeightKg: 0.5, sampleSize: 30, note: null }));
    expect(mocks.showToast).toHaveBeenCalledWith('Đã ghi cân mẫu: trung bình 0,5 kg/con.', 'success');
  });

  it('switches barn from the picker', async () => {
    const onSelect = vi.fn();
    render(<BarnJournal mode="loss" selectedCycleId={null} onSelect={onSelect} />);
    fireEvent.click(await screen.findByRole('button', { name: /Nhà B1/ }));
    expect(onSelect).toHaveBeenCalledWith(12);
  });

  it('tells a worker with no barns to ask for an assignment', async () => {
    plans.getFarmDailyPlan.mockResolvedValue([]);
    render(<BarnJournal mode="loss" selectedCycleId={null} onSelect={vi.fn()} />);
    expect(await screen.findByText(/công nhân chỉ thấy chuồng được chủ trại phân công/)).toBeInTheDocument();
  });
});
