import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BarnDetailView } from '../features/farmshift/BarnDetailView';
import * as cycles from '../services/cycleService';
import * as areas from '../services/farmAreaService';
import * as programService from '../services/farmingProgramService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ pageTitle, children }) => <main><h1>{pageTitle}</h1>{children}</main> }));
vi.mock('../services/farmAreaService', () => ({ listBarns: vi.fn(), listFarmAreas: vi.fn(), FARM_AREAS_CHANGED: 'farm-areas-changed' }));
vi.mock('../services/farmingProgramService', () => ({ listPrograms: vi.fn() }));
vi.mock('../services/cycleService', () => ({
  getBarn: vi.fn(), listCycles: vi.fn(), startCycle: vi.fn(), getCycle: vi.fn(), closeCycle: vi.fn(), importFlock: vi.fn(),
  transferFlock: vi.fn(), recordLoss: vi.fn(), recordHarvest: vi.fn(), addFeedRecord: vi.fn(), deleteFeedRecord: vi.fn(),
  addWeightSample: vi.fn(), deleteWeightSample: vi.fn(), addExpense: vi.fn(), deleteExpense: vi.fn(),
}));

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

const iso = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const START = iso(-17);

const barn = (id, name, extra = {}) => ({
  id, code: `CH00000${id}`, areaId: 1, areaName: 'Khu Mía Thịt', name, status: 'ACTIVE',
  capacity: 50000, currentQuantity: 30000, areaM2: 1000, targetWeight: 2.3, description: '', activeCycleId: id * 10, ...extra,
});
const flock = (id, name, gender, quantity, unitPrice) => ({
  id, code: `H000${id}`, name, gender, sourceType: 'PURCHASE', sourceNote: 'Khác', importDate: START, ageAtImport: 1, currentAgeDays: 18,
  importQuantity: quantity, importAvgWeight: 0.04, importWeightKg: quantity * 0.04, unitPrice, quantity, status: 'ACTIVE',
});
const detail = () => ({
  cycle: { id: 20, code: 'L000020', barnId: 2, cycleNumber: 1, startDate: START, status: 'ACTIVE', note: '', totalIn: 30000, currentQuantity: 30000 },
  barn: barn(2, 'Nhà A3', { activeCycleId: 20 }),
  metrics: {
    dayOfCycle: 18, ageDays: 18, totalIn: 30000, currentQuantity: 30000, deaths: 0, culls: 0, harvestedQuantity: 0, transferredOut: 0,
    lossRate: 0, cullRate: 0, harvestRate: 0, avgWeightKg: 1.93, biomassKg: 57900, densityPerM2: 30, feedKg: 90000, weightGainKg: 56700,
    fcr: 1.59, harvestedWeightKg: 0, firstImportDate: START, importDeadline: iso(-14), capacity: 50000,
  },
  finance: {
    chickCost: 335000000, feedCost: 0, expenses: { ELECTRICITY: 0, WATER: 0, LABOR: 0, MEDICINE: 0, OTHER: 0 }, totalCost: 335000000,
    costPerKg: 5786, costPerHead: 11167, revenue: 0, profit: -335000000,
  },
  flocks: [flock(4, 'MÍA-DABACO TRỐNG', 'MALE', 20000, 11000), flock(5, 'MÍA-DABACO MÁI', 'FEMALE', 10000, 11500)],
  programs: [{ id: 1, code: 'CT0001', name: 'Gà Mía thương phẩm', breed: 'Gà Mía', durationDays: 90, description: '', activeFlockCount: 2, currentDay: 18, steps: [
    { id: 1, category: 'VACCINE', name: 'Gumboro lần 2', dayFrom: 17, dayTo: 17, method: 'MOUTH', quantity: 1, unit: 'liều/con', state: 'DONE' },
    { id: 2, category: 'VACCINE', name: 'Newcastle lần 2 (Lasota)', dayFrom: 21, dayTo: 21, method: 'EYE_NOSE', quantity: 1, unit: 'liều/con', state: 'UPCOMING' },
  ] }],
  movements: [], feedRecords: [], weightSamples: [], expenses: [],
  todayPlan: [{ flockId: 4, flockCode: 'H0004', flockName: 'MÍA-DABACO TRỐNG', programId: 1, programName: 'Gà Mía thương phẩm', ageDays: 18, quantity: 20000, items: [
    { category: 'FEED', name: 'Higro 02', quantity: 85, unit: 'g/con/ngày', mealsPerDay: 3, totalFeedKg: 1700, feedKgPerMeal: 566.7 },
    { category: 'MEDICINE', name: 'Men tiêu hóa', quantity: 2, unit: 'g/kg cám', method: 'MIX_FEED' },
    { category: 'TEMPERATURE', name: 'Gà lớn', tempMin: 26, tempMax: 28 },
  ] }],
});

const renderAt = path => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/barns/:id" element={<BarnDetailView />} /></Routes></MemoryRouter>);
const field = (dialog, label) => within(dialog).getByLabelText(label);

describe('Barn detail: farming cycle, flocks and journal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    const barns = [barn(2, 'Nhà A3', { activeCycleId: 20 }), barn(3, 'Nhà A2', { activeCycleId: 30, currentQuantity: 49000 }), barn(7, 'Nhà A4', { activeCycleId: null, currentQuantity: 0 })];
    areas.listBarns.mockResolvedValue(barns);
    areas.listFarmAreas.mockResolvedValue([{ id: 1, name: 'Khu Mía Thịt' }]);
    cycles.getBarn.mockImplementation(async id => barns.find(item => String(item.id) === String(id)));
    cycles.listCycles.mockResolvedValue([{ id: 20, barnId: 2, cycleNumber: 1, startDate: START, status: 'ACTIVE', totalIn: 30000 }]);
    cycles.getCycle.mockResolvedValue(detail());
    cycles.importFlock.mockResolvedValue({});
    cycles.transferFlock.mockResolvedValue({});
    cycles.startCycle.mockResolvedValue({ id: 70, cycleNumber: 1 });
    programService.listPrograms.mockResolvedValue([
      { id: 1, name: 'Gà Mía thương phẩm', breed: 'Gà Mía', durationDays: 90, steps: [] },
      { id: 2, name: 'Gà ta thả vườn', breed: 'Gà ta', durationDays: 105, steps: [] },
    ]);
  });

  it('shows technical indicators, flocks, programs and accounting for the running cycle', async () => {
    renderAt('/barns/2');
    expect(await screen.findByText(/Lứa nuôi thứ 1, từ/)).toBeInTheDocument();
    expect(screen.getByText('30 con/m²')).toBeInTheDocument();
    expect(screen.getByText('1,59')).toBeInTheDocument();
    expect(screen.getByText('5.786đ/kg')).toBeInTheDocument();
    expect(screen.getByText('11.167đ/con')).toBeInTheDocument();
    expect(screen.getByText('MÍA-DABACO TRỐNG')).toBeInTheDocument();
    expect(screen.getByText('-335.000.000đ')).toBeInTheDocument();
    expect(screen.getByText('Sắp tới')).toBeInTheDocument();
    // Today's plan follows each flock's breed program and age.
    expect(screen.getByText('85 g/con × 20.000 con = 1.700 kg/ngày · 3 cữ × 566,7 kg')).toBeInTheDocument();
    expect(screen.getByText('Trộn cám · 2 g/kg cám')).toBeInTheDocument();
    expect(screen.getByText('Giữ nhiệt độ chuồng 26 – 28 °C')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chọn thêm' })).not.toBeInTheDocument();
    // Animals remain, so the cycle cannot be closed yet.
    expect(screen.getByRole('button', { name: 'Kết thúc lứa nuôi' })).toBeDisabled();
  });

  it('enforces the 3-day import window and barn capacity before importing a flock', async () => {
    renderAt('/barns/2');
    fireEvent.click(await screen.findByRole('button', { name: 'Nhập đàn' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Chuồng còn chỗ cho 20.000 con/)).toBeInTheDocument();
    expect(within(field(dialog, /Chương trình nuôi/)).getAllByRole('option')).toHaveLength(2);
    fireEvent.change(field(dialog, /Chương trình nuôi/), { target: { value: '2' } });
    fireEvent.change(field(dialog, /Tên đàn/), { target: { value: 'MÍA XÔ' } });
    fireEvent.change(field(dialog, /Giới tính/), { target: { value: 'MIXED' } });
    fireEvent.change(field(dialog, /Ngày nhập/), { target: { value: iso(-13) } });
    fireEvent.change(field(dialog, /Số lượng nhập/), { target: { value: '25000' } });
    fireEvent.change(field(dialog, /Giá con giống/), { target: { value: '11000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    expect(await within(dialog).findByText(/quá 3 ngày/)).toBeInTheDocument();
    expect(within(dialog).getByText('Chuồng chỉ còn chỗ cho 20.000 con.')).toBeInTheDocument();
    expect(cycles.importFlock).not.toHaveBeenCalled();

    fireEvent.change(field(dialog, /Ngày nhập/), { target: { value: iso(-14) } });
    fireEvent.change(field(dialog, /Số lượng nhập/), { target: { value: '5000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(cycles.importFlock).toHaveBeenCalledWith(20, {
      programId: 2, name: 'MÍA XÔ', gender: 'MIXED', importDate: iso(-14), ageAtImport: 1, quantity: 5000, avgWeight: 0.04, unitPrice: 11000, sourceNote: '', note: '',
    }));
    expect(mocks.showToast).toHaveBeenCalledWith('Đã nhập đàn MÍA XÔ (5.000 con).', 'success');
  });

  it('transfers only to running barns with enough room', async () => {
    renderAt('/barns/2');
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển đàn H0004' }));
    const dialog = await screen.findByRole('dialog');
    const options = within(field(dialog, /Chuồng đích/)).getAllByRole('option').map(option => option.textContent);
    expect(options).toEqual(['Nhà A2 (Khu Mía Thịt) · còn 1.000 chỗ']);
    fireEvent.change(field(dialog, /Số con chuyển/), { target: { value: '2000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    expect(await within(dialog).findByText('Nhà A2 chỉ còn 1.000 chỗ.')).toBeInTheDocument();
    fireEvent.change(field(dialog, /Số con chuyển/), { target: { value: '800' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(cycles.transferFlock).toHaveBeenCalledWith(4, expect.objectContaining({ targetBarnId: 3, quantity: 800 })));
  });

  it('lets the owner declare a cycle on an empty barn', async () => {
    cycles.listCycles.mockResolvedValue([]);
    renderAt('/barns/7');
    expect(await screen.findByText('Chuồng chưa có lứa nuôi')).toBeInTheDocument();
    expect(cycles.getCycle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Khai báo lứa nuôi' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(field(dialog, /Ngày bắt đầu/), { target: { value: iso(1) } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    expect(await within(dialog).findByText('Ngày bắt đầu không được sau hôm nay.')).toBeInTheDocument();
    fireEvent.change(field(dialog, /Ngày bắt đầu/), { target: { value: iso(0) } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(cycles.startCycle).toHaveBeenCalledWith(7, { startDate: iso(0), hatchDate: null, note: '' }));
  });

  it('shows workers the daily journal actions but no costs or structural actions', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    cycles.getCycle.mockResolvedValue({ ...detail(), finance: null, expenses: null });
    renderAt('/barns/2');
    await screen.findByText(/Lứa nuôi thứ 1, từ/);
    expect(screen.queryByText('Hạch toán')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nhập đàn' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kết thúc lứa nuôi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất bán H0004' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghi hao hụt H0004' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ghi cám' })).toBeInTheDocument();
  });

  it('shows accountants accounting and sales but not flock imports or losses', async () => {
    mocks.role = 'ROLE_ACCOUNTANT';
    renderAt('/barns/2');
    await screen.findByText(/Lứa nuôi thứ 1, từ/);
    expect(screen.getByText('Hạch toán')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xuất bán H0004' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm khoản chi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nhập đàn' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ghi hao hụt H0004' })).not.toBeInTheDocument();
  });
});
