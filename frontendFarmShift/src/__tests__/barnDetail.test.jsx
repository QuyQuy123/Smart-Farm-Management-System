import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BarnDetailView } from '../features/farmshift/BarnDetailView';
import * as cycles from '../services/cycleService';
import * as areas from '../services/farmAreaService';
import * as programService from '../services/farmingProgramService';
import * as dailyPlan from '../services/dailyPlanService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ pageTitle, children }) => <main><h1>{pageTitle}</h1>{children}</main> }));
vi.mock('../services/farmAreaService', () => ({ listBarns: vi.fn(), listFarmAreas: vi.fn(), FARM_AREAS_CHANGED: 'farm-areas-changed' }));
vi.mock('../services/farmingProgramService', () => ({ listPrograms: vi.fn() }));
vi.mock('../services/dailyPlanService', () => ({ getBarnDailyPlan: vi.fn(), confirmDailyTask: vi.fn(), undoDailyTask: vi.fn() }));
vi.mock('../services/cycleService', () => ({
  getBarn: vi.fn(), listCycles: vi.fn(), startCycle: vi.fn(), getCycle: vi.fn(), closeCycle: vi.fn(), importFlock: vi.fn(),
  transferFlock: vi.fn(), assignFlockProgram: vi.fn(), assignCycleProgram: vi.fn(), recordLoss: vi.fn(), recordHarvest: vi.fn(), addFeedRecord: vi.fn(), deleteFeedRecord: vi.fn(),
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
});
const task = (key, category, name, extra = {}) => ({
  key, category, name, meal: null, mealsPerDay: null, method: null, doseText: null, plannedQuantity: null, unit: null, plannedStock: null, stockUnit: null,
  inventoryItemId: null, inventoryItemName: null, stockOnHand: null, stockEnough: null, tempMin: null, tempMax: null, note: '', shares: [], done: null, ...extra,
});
// Today's work sheet: the per-bird program x the birds left in the barn (30.000), grouped for the whole barn.
const dayPlan = (done = null) => ({
  cycleId: 20, cycleCode: 'L000020', barnId: 2, barnName: 'Nhà A3', areaName: 'Khu Mía Thịt', date: iso(0), headcount: 30000,
  flocks: [{ flockId: 4, code: 'H0004', name: 'MÍA-DABACO TRỐNG', programName: 'Gà Mía thương phẩm', ageDays: 18, quantity: 20000 },
    { flockId: 5, code: 'H0005', name: 'MÍA-DABACO MÁI', programName: 'Gà Mía thương phẩm', ageDays: 18, quantity: 10000 }],
  tasks: [
    task('FEED:I7:M1', 'FEED', 'Higro 02', { meal: 1, mealsPerDay: 3, doseText: '85 g/con/ngày', plannedQuantity: 850, unit: 'kg', plannedStock: 34,
      stockUnit: 'Bao 25kg', inventoryItemId: 7, stockOnHand: 200, stockEnough: true, done,
      shares: [{ flockId: 4, flockCode: 'H0004', ageDays: 18, quantity: 20000, plannedQuantity: 566.667 },
        { flockId: 5, flockCode: 'H0005', ageDays: 18, quantity: 10000, plannedQuantity: 283.333 }] }),
    task('MEDICINE:I9', 'MEDICINE', 'Men tiêu hóa', { method: 'MIX_FEED', doseText: '2 g/kg cám', plannedQuantity: 5100, unit: 'g', plannedStock: 5.1,
      stockUnit: 'Gói 1kg', inventoryItemId: 9, stockOnHand: 2, stockEnough: false }),
    task('TEMPERATURE:Ngà lớn', 'TEMPERATURE', 'Gà lớn', { tempMin: 26, tempMax: 28 }),
  ],
  doneCount: done ? 1 : 0, doneCost: done ? 11390000 : 0, warnings: ['Kho chỉ còn 2 Gói 1kg Men tiêu hóa, các việc còn lại trong ngày cần 5,1.'],
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
    dailyPlan.getBarnDailyPlan.mockResolvedValue(dayPlan());
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
    // Key indicators are always visible; the rest open with "Xem thêm chỉ số".
    expect(screen.getByText('1,59')).toBeInTheDocument();
    expect(screen.getByText('Hao hụt 0 con (0%)')).toBeInTheDocument();
    expect(screen.queryByText('30 con/m²')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Xem thêm chỉ số/ }));
    expect(screen.getByText('30 con/m²')).toBeInTheDocument();
    expect(screen.getByText('5.786đ/kg')).toBeInTheDocument();
    expect(screen.getByText('11.167đ/con')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thu gọn/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('MÍA-DABACO TRỐNG')).toBeInTheDocument();
    expect(screen.getByText('-335.000.000đ')).toBeInTheDocument();
    expect(screen.getByText('Sắp tới')).toBeInTheDocument();
    // Today's work sheet for the whole barn: amount to take from stock, stock shortage and temperature band.
    expect(dailyPlan.getBarnDailyPlan).toHaveBeenCalledWith(20);
    expect(screen.getByText('850 kg = 34 Bao 25kg')).toBeInTheDocument();
    expect(screen.getByText('Kho không đủ: còn 2 Gói 1kg')).toBeInTheDocument();
    expect(screen.getByText(/Kho chỉ còn 2 Gói 1kg Men tiêu hóa/)).toBeInTheDocument();
    expect(screen.getByText('Giữ 26 – 28 °C')).toBeInTheDocument();
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

  it('lets the owner attach a breed program to all running flocks at once', async () => {
    cycles.assignCycleProgram.mockResolvedValue({});
    programService.listPrograms.mockResolvedValue([
      { id: 1, name: 'Gà Mía thương phẩm', breed: 'Gà Mía', durationDays: 90, steps: [] },
      { id: 3, name: 'Úm 7 ngày', breed: 'Gà Mía', durationDays: 7, steps: [] },
    ]);
    renderAt('/barns/2');
    fireEvent.click(await screen.findByRole('button', { name: 'Gắn chương trình' }));
    const dialog = await screen.findByRole('dialog');
    // "All running flocks" is the default, followed by each flock.
    expect(within(field(dialog, /Đàn đang nuôi/)).getAllByRole('option').map(option => option.textContent)[0]).toBe('Tất cả đàn đang nuôi (2 đàn)');
    expect(within(field(dialog, /Đàn đang nuôi/)).getAllByRole('option')).toHaveLength(3);
    // The flocks are 18 days old, so a 7-day program is rejected before calling the API.
    fireEvent.change(field(dialog, /Chương trình nuôi/), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    expect(await within(dialog).findByText(/vượt thời gian nuôi 7 ngày/)).toBeInTheDocument();
    expect(cycles.assignCycleProgram).not.toHaveBeenCalled();

    fireEvent.change(field(dialog, /Chương trình nuôi/), { target: { value: '1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(cycles.assignCycleProgram).toHaveBeenCalledWith(20, 1));
    expect(mocks.showToast).toHaveBeenCalledWith('Đã gắn chương trình Gà Mía thương phẩm cho 2 đàn đang nuôi.', 'success');
  });

  it('can still attach a program to a single flock', async () => {
    cycles.assignFlockProgram.mockResolvedValue({});
    renderAt('/barns/2');
    fireEvent.click(await screen.findByRole('button', { name: 'Gắn chương trình' }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(field(dialog, /Đàn đang nuôi/), { target: { value: '5' } });
    fireEvent.change(field(dialog, /Chương trình nuôi/), { target: { value: '1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(cycles.assignFlockProgram).toHaveBeenCalledWith(5, 1));
  });

  it('confirms a meal from the barn page and refreshes the journal and costs', async () => {
    const done = { id: 1, actualQuantity: 850, stockQuantity: 34, unitPrice: 335000, cost: 11390000, deviated: false, note: '',
      doneBy: 'owner@farm.test', doneAt: `${iso(0)}T06:30:00` };
    dailyPlan.confirmDailyTask.mockResolvedValue(dayPlan(done));
    renderAt('/barns/2');
    fireEvent.click(await screen.findByRole('button', { name: 'Xong Cữ 1/3 · Higro 02' }));
    await waitFor(() => expect(dailyPlan.confirmDailyTask).toHaveBeenCalledWith(20, { date: iso(0), taskKey: 'FEED:I7:M1' }));
    expect(await screen.findByText(/Xong lúc 06:30 · owner@farm.test/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hoàn tác Cữ 1/3 · Higro 02' })).toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith('Đã xác nhận: Higro 02.', 'success');
    await waitFor(() => expect(cycles.getCycle).toHaveBeenCalledTimes(2));

    // Feeding a different amount asks for the actual quantity and a reason; the server's message stays under the task.
    dailyPlan.confirmDailyTask.mockRejectedValueOnce({ response: { data: { message: 'Lượng thực tế lệch -50% so với kế hoạch (5.100 g). Vui lòng ghi lý do.' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Khác kế hoạch Men tiêu hóa' }));
    fireEvent.change(screen.getByLabelText(/Lượng thực tế/), { target: { value: '2550' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng ghi lý do');
    expect(dailyPlan.confirmDailyTask).toHaveBeenLastCalledWith(20, { date: iso(0), taskKey: 'MEDICINE:I9', actualQuantity: 2550, note: undefined });
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
