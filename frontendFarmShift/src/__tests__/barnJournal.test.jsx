import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BarnJournal } from '../features/farmshift/BarnJournal';
import * as plans from '../services/dailyPlanService';
import * as cycles from '../services/cycleService';
import { fileService } from '../services/fileService';

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), role: 'ROLE_FARM_OWNER' }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'u@farm.test', role: mocks.role } }) }));
vi.mock('../services/dailyPlanService', () => ({ getFarmDailyPlan: vi.fn() }));
vi.mock('../services/fileService', () => ({ fileService: { uploadFile: vi.fn() } }));
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

const plans_ = [
  { cycleId: 11, cycleCode: 'L01', barnId: 1, barnName: 'Nhà A1', areaName: 'Khu A', headcount: 5000, flocks: [{ ageDays: 20 }] },
  { cycleId: 12, cycleCode: 'L02', barnId: 3, barnName: 'Nhà B1', areaName: 'Khu B', headcount: 3000, flocks: [{ ageDays: 30 }, { ageDays: 28 }] },
];
const cycle = (quantity = 5000, deaths = 0) => ({
  cycle: { id: 11, code: 'L01' }, barn: { id: 1, name: 'Nhà A1', areaName: 'Khu A' },
  metrics: { ageDays: 20, currentQuantity: quantity, totalIn: 5000, deaths, culls: 0, lossRate: (deaths / 5000) * 100, avgWeightKg: 0.42 },
  flocks: [{ id: 21, code: 'F01', name: 'Gà Mía', quantity, status: 'ACTIVE' }],
  movements: deaths ? [{ id: 1, flockCode: 'F01', type: 'DEATH', movementDate: today, quantity: deaths, note: 'Bệnh',
    createdBy: 'a@farm.test', photoUrls: ['/img/losses/a.jpg'] }] : [],
  weightSamples: [
    { id: 2, date: daysAgo(9), quantity: 0.42, sampleSize: 30, note: null, createdBy: 'a@farm.test' },
    { id: 1, date: daysAgo(16), quantity: 0.28, sampleSize: 30, note: null, createdBy: 'a@farm.test' },
  ],
});

describe('Ghi nhật ký theo chuồng', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    plans.getFarmDailyPlan.mockResolvedValue(plans_);
    cycles.getCycle.mockResolvedValue(cycle());
  });

  it('lists running barns as simple cards and opens one', async () => {
    const onSelect = vi.fn();
    render(<BarnJournal mode="loss" selectedCycleId={null} onSelect={onSelect} />);
    const a1 = await screen.findByRole('button', { name: 'Ghi nhật ký Nhà A1' });
    expect(a1).toHaveTextContent('Khu A');
    expect(a1).toHaveTextContent('5.000 con');
    expect(a1).toHaveTextContent('20 ngày tuổi');
    expect(screen.getByRole('button', { name: 'Ghi nhật ký Nhà B1' })).toHaveTextContent('3.000 con');
    expect(cycles.getCycle).not.toHaveBeenCalled();

    fireEvent.click(a1);
    expect(onSelect).toHaveBeenCalledWith(11);
  });

  it('shows a worker only the barns assigned to them', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    plans.getFarmDailyPlan.mockResolvedValue([plans_[1]]);
    render(<BarnJournal mode="loss" selectedCycleId={null} onSelect={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Ghi nhật ký Nhà B1' })).toBeInTheDocument();
    expect(screen.queryByText('Nhà A1')).not.toBeInTheDocument();
  });

  it('tells a worker with no barns to ask for an assignment', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    plans.getFarmDailyPlan.mockResolvedValue([]);
    render(<BarnJournal mode="loss" selectedCycleId={null} onSelect={vi.fn()} />);
    expect(await screen.findByText(/chưa được phân công chuồng nào/)).toBeInTheDocument();
  });

  it('records deaths with a photo and refreshes the headcount', async () => {
    cycles.recordLoss.mockResolvedValue({});
    fileService.uploadFile.mockResolvedValue('/img/losses/a.jpg');
    const onSelect = vi.fn();
    render(<BarnJournal mode="loss" selectedCycleId={11} onSelect={onSelect} />);
    expect(await screen.findByRole('heading', { name: 'Nhà A1' })).toBeInTheDocument();
    expect(await screen.findByText('5.000', { selector: 'strong' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Số con/), { target: { value: '6000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ghi và trừ số con' }));
    expect(await screen.findByText('Đàn chỉ còn 5.000 con.')).toBeInTheDocument();
    expect(cycles.recordLoss).not.toHaveBeenCalled();

    const photo = new File(['x'], 'ga-chet.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Thêm ảnh đính kèm'), { target: { files: [photo] } });
    expect(await screen.findByAltText('Ảnh 1')).toBeInTheDocument();

    cycles.getCycle.mockResolvedValue(cycle(4995, 5));
    fireEvent.change(screen.getByLabelText(/^Số con/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bệnh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ghi và trừ số con' }));

    await waitFor(() => expect(cycles.recordLoss).toHaveBeenCalledWith(21,
      { type: 'DEATH', movementDate: today, quantity: 5, note: 'Bệnh', photoUrls: ['/img/losses/a.jpg'] }));
    expect(fileService.uploadFile).toHaveBeenCalledWith(photo, 'losses');
    expect(await screen.findByText('4.995', { selector: 'strong' })).toBeInTheDocument();
    const history = screen.getByRole('table');
    expect(within(history).getByText('Chết')).toBeInTheDocument();
    expect(within(history).getByAltText('Ảnh 1')).toHaveAttribute('src', '/img/losses/a.jpg');
    expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining('Đã ghi 5 con chết ở Nhà A1'), 'success');

    fireEvent.click(screen.getByRole('button', { name: /Tất cả chuồng/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('weighs a sample of birds: average is the total divided by the birds weighed', async () => {
    cycles.addWeightSample.mockResolvedValue(3);
    render(<BarnJournal mode="weight" selectedCycleId={11} onSelect={vi.fn()} />);
    expect(await screen.findByText('Đã 9 ngày chưa cân')).toBeInTheDocument();
    expect(screen.getByText('+140 g')).toBeInTheDocument();
    expect(screen.getByText('20 g')).toBeInTheDocument();
    expect(screen.queryByText('Nhập cân nặng TB')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Tổng khối lượng/), { target: { value: '15' } });
    expect(screen.getByText('0,5 kg/con')).toBeInTheDocument();
    expect(screen.getByText(/\+80 g so với lần cân/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ghi cân mẫu' }));

    await waitFor(() => expect(cycles.addWeightSample).toHaveBeenCalledWith(11, { sampleDate: today, avgWeightKg: 0.5, sampleSize: 30, note: null }));
    expect(mocks.showToast).toHaveBeenCalledWith('Đã ghi cân mẫu: trung bình 0,5 kg/con.', 'success');
  });

  it('lets the accountant read the journal without recording', async () => {
    mocks.role = 'ROLE_ACCOUNTANT';
    render(<BarnJournal mode="loss" selectedCycleId={11} onSelect={vi.fn()} />);
    expect(await screen.findByText('Lịch sử chết / loại thải')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ghi và trừ số con' })).not.toBeInTheDocument();
  });
});
