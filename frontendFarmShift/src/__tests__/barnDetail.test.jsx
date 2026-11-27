import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BarnDetailView } from '../features/farmshift/BarnDetailView';
import * as cycles from '../services/cycleService';
import * as areas from '../services/farmAreaService';
import * as programService from '../services/farmingProgramService';
import * as dailyPlan from '../services/dailyPlanService';
import * as workAssignment from '../services/workAssignmentService';
import * as supplierService from '../services/supplierService';
import * as diseaseService from '../services/cycleDiseaseService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn(), layoutProps: null }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({
  FarmShiftLayout: props => {
    mocks.layoutProps = props;
    return <main><h1>{props.pageTitle}</h1>{props.children}</main>;
  },
}));
vi.mock('../services/farmAreaService', () => ({ listBarns: vi.fn(), listFarmAreas: vi.fn(), FARM_AREAS_CHANGED: 'farm-areas-changed' }));
vi.mock('../services/farmingProgramService', () => ({ listPrograms: vi.fn() }));
vi.mock('../services/supplierService', () => ({ listSuppliers: vi.fn(), createSupplier: vi.fn(), updateSupplier: vi.fn(), deleteSupplier: vi.fn() }));
vi.mock('../services/productTypeService', () => ({ listProductTypes: vi.fn() }));
vi.mock('../services/dailyPlanService', () => ({
  getBarnDailyPlan: vi.fn(),
  confirmDailyTask: vi.fn(),
  undoDailyTask: vi.fn(),
  checkRoutineTask: vi.fn(),
  uncheckRoutineTask: vi.fn(),
}));
vi.mock('../services/workAssignmentService', () => ({
  setBarnRoutineTasks: vi.fn(),
}));
vi.mock('../services/cycleDiseaseService', () => ({
  listCycleDiseases: vi.fn(),
  listDiseaseMedicineSources: vi.fn(),
}));
vi.mock('../services/cycleService', () => ({
  getBarn: vi.fn(), listCycles: vi.fn(), startCycle: vi.fn(), getCycle: vi.fn(), getCloseCyclePreview: vi.fn(), closeCycle: vi.fn(), importFlock: vi.fn(),
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
    supplierService.listSuppliers.mockResolvedValue([{ id: 6, name: 'Giống Dabaco', productTypeName: 'Con giống' }]);
    cycles.transferFlock.mockResolvedValue({});
    cycles.startCycle.mockResolvedValue({ id: 70, cycleNumber: 1 });
    programService.listPrograms.mockResolvedValue([
      { id: 1, name: 'Gà Mía thương phẩm', breed: 'Gà Mía', durationDays: 90, steps: [] },
      { id: 2, name: 'Gà ta thả vườn', breed: 'Gà ta', durationDays: 105, steps: [] },
    ]);
    diseaseService.listCycleDiseases.mockResolvedValue([]);
    diseaseService.listDiseaseMedicineSources.mockResolvedValue([]);
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
    // Trang chuồng dùng bản gọn: ẩn liều lượng và phần chia theo đàn.
    expect(screen.queryByText(/H0004: 566,667 kg/)).not.toBeInTheDocument();
    expect(screen.getByText('Kho không đủ: còn 2 Gói 1kg')).toBeInTheDocument();
    expect(screen.getByText(/Kho chỉ còn 2 Gói 1kg Men tiêu hóa/)).toBeInTheDocument();
    expect(screen.getByText('Giữ 26 – 28 °C')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chọn thêm' })).not.toBeInTheDocument();
    // Animals remain, so the cycle cannot be closed yet.
    expect(screen.getByRole('button', { name: 'Kết thúc lứa nuôi' })).toBeDisabled();
  });

  it('opens the details of a loss with its note, recorder and attached photos', async () => {
    cycles.getCycle.mockResolvedValue({ ...detail(), movements: [
      { id: 91, flockId: 4, flockCode: 'H0004', flockName: 'MÍA-DABACO TRỐNG', type: 'DEATH', movementDate: iso(0), quantity: 1, weightKg: null,
        relatedFlockCode: null, note: 'Đè / ngạt', createdBy: 'mienbinh@smartfarm.com', photoUrls: ['/uploads/losses/a.jpg', '/uploads/losses/b.jpg'] },
      { id: 92, flockId: 4, flockCode: 'H0004', flockName: 'MÍA-DABACO TRỐNG', type: 'TRANSFER_OUT', movementDate: iso(-2), quantity: 1000, weightKg: 40,
        relatedFlockCode: 'H0020', note: null, createdBy: 'mienbinh@smartfarm.com', photoUrls: [] },
    ] });
    renderAt('/barns/2');
    fireEvent.click(await screen.findByRole('tab', { name: 'Hao hụt & chuyển đàn' }));
    fireEvent.click(screen.getByRole('button', { name: /^Chi tiết hao hụt \(chết\) ngày .* đàn H0004$/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Đè / ngạt')).toBeInTheDocument();
    expect(within(dialog).getByText('mienbinh@smartfarm.com')).toBeInTheDocument();
    expect(within(dialog).getByText('H0004 · MÍA-DABACO TRỐNG')).toBeInTheDocument();
    expect(within(dialog).getByText('Ảnh đính kèm (2)')).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Ảnh 1 của H0004' })).toHaveAttribute('src', '/uploads/losses/a.jpg');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xem ảnh 2' }));
    expect(within(dialog).getByRole('img', { name: 'Ảnh 2 của H0004' })).toHaveAttribute('src', '/uploads/losses/b.jpg');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' }).at(-1));

    // A transfer has no photos: the dialog says so and shows where the birds went.
    fireEvent.click(screen.getByRole('button', { name: /^Chi tiết chuyển đi ngày .* đàn H0004$/ }));
    const transfer = await screen.findByRole('dialog');
    expect(within(transfer).getByText(/sang đàn H0020/)).toBeInTheDocument();
    expect(within(transfer).getByText('Không có ảnh đính kèm.')).toBeInTheDocument();
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
    await within(dialog).findByRole('option', { name: /Giống Dabaco/ });
    fireEvent.change(field(dialog, /Nhà cung cấp con giống/), { target: { value: '6' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    expect(await within(dialog).findByText(/quá 3 ngày/)).toBeInTheDocument();
    expect(within(dialog).getByText('Chuồng chỉ còn chỗ cho 20.000 con.')).toBeInTheDocument();
    expect(cycles.importFlock).not.toHaveBeenCalled();

    fireEvent.change(field(dialog, /Ngày nhập/), { target: { value: iso(-14) } });
    fireEvent.change(field(dialog, /Số lượng nhập/), { target: { value: '5000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(cycles.importFlock).toHaveBeenCalledWith(20, {
      programId: 2, name: 'MÍA XÔ', gender: 'MIXED', importDate: iso(-14), ageAtImport: 1, quantity: 5000, avgWeight: 0.04, unitPrice: 11000,
      supplierId: 6, paymentStatus: 'Trả sau', note: '',
    }));
    expect(mocks.showToast).toHaveBeenCalledWith('Đã nhập đàn MÍA XÔ (5.000 con).', 'success');
  });

  it('splits only into empty barns that can hold the birds', async () => {
    areas.listBarns.mockResolvedValue([barn(2, 'Nhà A3', { activeCycleId: 20 }), barn(3, 'Nhà A2', { activeCycleId: 30, currentQuantity: 49000 }),
      barn(7, 'Nhà A4', { activeCycleId: null, currentQuantity: 0, capacity: 1000 })]);
    renderAt('/barns/2');
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển đàn H0004' }));
    const dialog = await screen.findByRole('dialog');
    const options = within(field(dialog, /Chuồng trống nhận đàn/)).getAllByRole('option').map(option => option.textContent);
    expect(options).toEqual(['Nhà A4 (Khu Mía Thịt) · chứa được 1.000 con']);
    // Nhập nhiều hơn sức chứa thì chuồng đó không còn là lựa chọn; giảm số con thì hiện lại và tự chọn.
    fireEvent.change(field(dialog, /Số con chuyển/), { target: { value: '2000' } });
    expect(within(field(dialog, /Chuồng trống nhận đàn/)).getAllByRole('option').map(option => option.textContent))
      .toEqual(['Không có chuồng trống đủ chỗ cho 2.000 con']);
    expect(cycles.transferFlock).not.toHaveBeenCalled();
    fireEvent.change(field(dialog, /Số con chuyển/), { target: { value: '800' } });
    expect(field(dialog, /Chuồng trống nhận đàn/).value).toBe('7');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(cycles.transferFlock).toHaveBeenCalledWith(4, expect.objectContaining({ targetBarnId: 7, quantity: 800 })));
  });

  it('asks to create a barn when no empty barn exists', async () => {
    areas.listBarns.mockResolvedValue([barn(2, 'Nhà A3', { activeCycleId: 20 }), barn(3, 'Nhà A2', { activeCycleId: 30 })]);
    renderAt('/barns/2');
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển đàn H0004' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Chưa có chuồng trống để tách đàn/)).toBeInTheDocument();
  });

  it('splits a flock in half into an empty barn and previews both barns', async () => {
    renderAt('/barns/2');
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển đàn H0004' }));
    const dialog = await screen.findByRole('dialog');
    const target = field(dialog, /Chuồng trống nhận đàn/);
    expect(within(target).getByRole('option', { name: /Nhà A4 .* chứa được/ })).toBeInTheDocument();
    fireEvent.change(target, { target: { value: '7' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Chia đôi' }));
    const quantity = Number(field(dialog, /Số con chuyển/).value);
    expect(quantity).toBeGreaterThan(0);

    const preview = within(dialog).getByLabelText('Xem trước sau khi chuyển');
    expect(preview).toHaveTextContent('Chuồng mới sẽ có');
    expect(preview).toHaveTextContent('Nhà A4');
    expect(preview).toHaveTextContent('tự mở lứa mới');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(cycles.transferFlock).toHaveBeenCalledWith(4, expect.objectContaining({ targetBarnId: 7, quantity })));
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining('Đã mở lứa mới'), 'success'));
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
    expect(await screen.findByText(/Xong lúc 06:30/)).toBeInTheDocument();
    expect(screen.queryByText(/owner@farm.test/)).not.toBeInTheDocument();
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
    // Cám ghi khi bấm Xong cữ ăn ở Việc hôm nay, không còn nút ghi tay ở Nhật ký.
    expect(screen.queryByRole('button', { name: 'Ghi cám' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Khoản chi bổ sung/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Doanh thu/ })).not.toBeInTheDocument();
  });

  it('shows accountants accounting and sales but not flock imports, losses, or restricted farm/task navigation links', async () => {
    mocks.role = 'ROLE_ACCOUNTANT';
    renderAt('/barns/2');
    await screen.findByText(/Lứa nuôi thứ 1, từ/);
    expect(screen.getByText('Hạch toán')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xuất bán H0004' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Doanh thu/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Lịch sử lứa nuôi/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Khoản chi bổ sung/ }));
    expect(screen.getByRole('button', { name: 'Thêm khoản chi' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nhập đàn' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ghi hao hụt H0004' })).not.toBeInTheDocument();

    // Accountant must NOT see AreaTabs, /areas/:id link, or /today-tasks link, and shortcuts must be disabled
    expect(screen.queryByRole('navigation', { name: 'Điều hướng khu nuôi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Khu Mía Thịt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mở tất cả chuồng' })).not.toBeInTheDocument();
    expect(mocks.layoutProps.showShortcuts).toBe(false);
    expect(mocks.layoutProps.breadcrumbs.map(b => b.path).filter(Boolean)).toEqual(['/dashboard', '/cycles/history']);
  });

  it('paginates and searches long feed records, and switches left info and detail section tabs cleanly', async () => {
    const manyFeeds = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      date: iso(-(i % 20)),
      label: i === 22 ? 'Cám đặc biệt Omega' : `Cám gà thịt số ${i + 1}`,
      quantity: 100 + i,
      amount: 1500000 + i * 1000,
      createdBy: 'congnhan@smartfarm.com',
    }));
    const manyExpenses = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      date: iso(-i),
      category: 'MEDICINE',
      amount: 50000 + i * 1000,
      note: `Thuốc đợt ${i + 1}`,
      createdBy: 'owner@farm.test',
    }));
    cycles.getCycle.mockResolvedValue({ ...detail(), feedRecords: manyFeeds, expenses: manyExpenses });
    renderAt('/barns/2');

    // Left card switches between Lứa nuôi and Chuồng metadata
    expect(await screen.findByText(/Lứa nuôi thứ 1, từ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Chuồng' }));
    expect(screen.getByText('Diện tích (m²)')).toBeInTheDocument();
    expect(screen.getByText('Sức chứa tối đa')).toBeInTheDocument();

    // Feed journal paginates at 10 rows per page by default
    expect(screen.getByText('Hiển thị 1–10 / 25 bản ghi')).toBeInTheDocument();
    expect(screen.getByText('Cám gà thịt số 1')).toBeInTheDocument();
    expect(screen.queryByText('Cám gà thịt số 11')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('Hiển thị 11–20 / 25 bản ghi')).toBeInTheDocument();
    expect(screen.getByText('Cám gà thịt số 11')).toBeInTheDocument();

    // Searching filters across all pages and resets to page 1
    fireEvent.change(screen.getByLabelText('Tìm kiếm trong nhật ký'), { target: { value: 'Omega' } });
    expect(screen.getByText('Hiển thị 1–1 / 1 bản ghi')).toBeInTheDocument();
    expect(screen.getByText('Cám đặc biệt Omega')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm nhật ký' }));
    expect(screen.getByText('Hiển thị 1–10 / 25 bản ghi')).toBeInTheDocument();

    // Switching Band 2 tabs works cleanly (including Sổ bệnh án & paginated Khoản chi bổ sung)
    fireEvent.click(screen.getByRole('tab', { name: /Sổ bệnh án/ }));
    expect(await screen.findByText('Chưa ghi nhận đợt bệnh nào trong lứa nuôi này.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Khoản chi bổ sung/ }));
    expect(screen.getByText('Hiển thị 1–10 / 12 bản ghi')).toBeInTheDocument();
    expect(screen.getByText('Thuốc đợt 1')).toBeInTheDocument();
    expect(screen.queryByText('Thuốc đợt 11')).not.toBeInTheDocument();
  });

  it('routes accountant error fallback to /cycles/history instead of /barns', async () => {
    mocks.role = 'ROLE_ACCOUNTANT';
    cycles.getBarn.mockRejectedValueOnce({ response: { status: 404 } });
    render(
      <MemoryRouter initialEntries={['/barns/999']}>
        <Routes>
          <Route path="/barns/:id" element={<BarnDetailView />} />
          <Route path="/cycles/history" element={<div>Trang lịch sử lứa nuôi</div>} />
        </Routes>
      </MemoryRouter>,
    );
    const backBtn = await screen.findByRole('button', { name: 'Về lịch sử lứa nuôi' });
    fireEvent.click(backBtn);
    expect(await screen.findByText('Trang lịch sử lứa nuôi')).toBeInTheDocument();
  });

  it('shows CloseCycleDialog with opened-feed disposition and area warehouse alert, then submits action', async () => {
    const emptyDetail = {
      ...detail(),
      cycle: { ...detail().cycle, currentQuantity: 0 },
      metrics: { ...detail().metrics, currentQuantity: 0 },
      openedFeeds: [{ id: 1, productId: 7, feedName: 'Higro 02', remainingKg: 15, remainingValue: 201000 }],
    };
    cycles.getCycle.mockResolvedValue(emptyDetail);
    cycles.getCloseCyclePreview.mockResolvedValue({
      cycleId: 20,
      cycleNumber: 1,
      barnId: 2,
      barnName: 'Nhà A3',
      areaId: 1,
      areaName: 'Khu Mía Thịt',
      remainingAnimals: 0,
      otherActiveCyclesInArea: 0,
      openedFeeds: [{ id: 1, productId: 7, feedName: 'Higro 02', warehouseName: 'Kho cám Khu Mía', unitName: 'Bao 25kg', remainingKg: 15, remainingValue: 201000 }],
      transferTargetCycles: [{ cycleId: 30, cycleCode: 'L000030', cycleNumber: 1, barnId: 3, barnName: 'Nhà A2', areaName: 'Khu J' }],
      areaWarehouseStocks: [{ warehouseId: 5, warehouseName: 'Kho cám Khu Mía', warehouseKind: 'FEED', productId: 7, productName: 'Higro 02', unitName: 'Bao 25kg', totalStock: 12, totalValue: 4020000 }],
    });
    cycles.closeCycle.mockResolvedValue({ id: 20, status: 'CLOSED' });

    renderAt('/barns/2');
    expect(await screen.findByTestId('barn-opened-feeds')).toHaveTextContent('Higro 02: 15 kg');

    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc lứa nuôi' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/Cám đang mở bao còn dư tại chuồng/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Chuồng cuối cùng trong Khu Mía Thịt/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Tạo phiếu Chuyển kho/ })).toHaveAttribute(
      'href',
      '/internal-stock?action=transfer&sourceWarehouseId=5',
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận kết thúc' }));
    await waitFor(() => expect(cycles.closeCycle).toHaveBeenCalledWith(20, expect.objectContaining({
      leftoverFeedAction: 'TRANSFER_TO_CYCLE',
      transferTargetCycleId: 30,
    })));
  });

  it('shows routine task quick-tick buttons even when an active cycle has zero flocks', async () => {
    const zeroFlockDetail = {
      ...detail(),
      cycle: { ...detail().cycle, currentQuantity: 0, initialQuantity: 0 },
      metrics: { ...detail().metrics, currentQuantity: 0, initialQuantity: 0 },
      flocks: [],
    };
    const todayIsoLocal = iso(0);
    const zeroFlockPlan = {
      cycleId: 20,
      barnId: 2,
      barnName: 'Nhà A3',
      areaName: 'Khu Mía Thịt',
      date: todayIsoLocal,
      headcount: 0,
      flocks: [],
      tasks: [],
      doneCount: 0,
      warnings: [],
      workers: [],
      assignedTasks: [],
      routineTasks: [
        { code: 'CHANGE_LITTER', title: 'Thay trấu', done: null },
        { code: 'CLEAN_FEEDERS', title: 'Vệ sinh máng', done: null },
        { code: 'WASH_BARN', title: 'Xịt rửa chuồng', done: null },
      ],
    };
    const checkedPlan = {
      ...zeroFlockPlan,
      routineTasks: [
        { code: 'CHANGE_LITTER', title: 'Thay trấu', done: { id: 1, doneBy: 'owner@farm.test', doneAt: `${todayIsoLocal}T08:00:00`, note: null } },
        ...zeroFlockPlan.routineTasks.slice(1),
      ],
    };
    cycles.getCycle.mockResolvedValue(zeroFlockDetail);
    dailyPlan.getBarnDailyPlan.mockResolvedValue(zeroFlockPlan);
    dailyPlan.checkRoutineTask.mockResolvedValue(checkedPlan);

    renderAt('/barns/2');
    const bar = await screen.findByTestId('routine-tasks-bar');
    expect(within(bar).getByRole('button', { name: 'Xong Thay trấu' })).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole('button', { name: 'Xong Thay trấu' }));
    await waitFor(() => expect(dailyPlan.checkRoutineTask).toHaveBeenCalledWith(20, { date: todayIsoLocal, taskCode: 'CHANGE_LITTER' }));
  });

  it('opens RoutineTasksSettingsDialog from BarnDetail, toggles multi-select tags, adds custom tag, and saves', async () => {
    const todayIsoLocal = iso(0);
    const initialPlan = {
      cycleId: 20,
      barnId: 2,
      barnName: 'Nhà A3',
      areaName: 'Khu Mía Thịt',
      date: todayIsoLocal,
      headcount: 0,
      flocks: [],
      tasks: [],
      doneCount: 0,
      warnings: [],
      workers: [],
      assignedTasks: [],
      routineTasks: [
        { code: 'CHANGE_LITTER', title: 'Thay trấu', done: null },
        { code: 'CLEAN_FEEDERS', title: 'Vệ sinh máng', done: null },
        { code: 'WASH_BARN', title: 'Xịt rửa chuồng', done: null },
      ],
    };
    const updatedPlan = {
      ...initialPlan,
      routineTasks: [
        { code: 'CLEAN_FEEDERS', title: 'Vệ sinh máng', done: null },
        { code: 'WASH_BARN', title: 'Xịt rửa chuồng', done: null },
        { code: 'FEED_AND_WATER', title: 'Cho ăn & uống', done: null },
        { code: 'CUSTOM:Kiểm tra nguồn nước uống', title: 'Kiểm tra nguồn nước uống', done: null },
      ],
    };
    dailyPlan.getBarnDailyPlan.mockResolvedValueOnce(initialPlan).mockResolvedValue(updatedPlan);
    workAssignment.setBarnRoutineTasks.mockResolvedValue([
      'CLEAN_FEEDERS',
      'WASH_BARN',
      'FEED_AND_WATER',
      'CUSTOM:Kiểm tra nguồn nước uống',
    ]);

    renderAt('/barns/2');
    const configBtn = await screen.findByRole('button', { name: 'Cài đặt việc hằng ngày của chuồng' });
    fireEvent.click(configBtn);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Cài đặt công việc hằng ngày (Cả chu kỳ)' })).toBeInTheDocument();

    // Toggle off an active tag, toggle on an inactive preset tag
    const litterTag = within(dialog).getByRole('button', { name: 'Thay trấu' });
    expect(litterTag).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(litterTag);
    expect(litterTag).toHaveAttribute('aria-pressed', 'false');

    const feedWaterTag = within(dialog).getByRole('button', { name: 'Cho ăn & uống' });
    expect(feedWaterTag).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(feedWaterTag);
    expect(feedWaterTag).toHaveAttribute('aria-pressed', 'true');

    // Add custom self-defined tag
    fireEvent.click(within(dialog).getByRole('button', { name: '+ Thêm việc khác tự định nghĩa' }));
    fireEvent.change(within(dialog).getByLabelText('Tên công việc hằng ngày tự định nghĩa'), {
      target: { value: 'Kiểm tra nguồn nước uống' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm' }));
    expect(within(dialog).getByRole('button', { name: 'Kiểm tra nguồn nước uống' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận & Áp dụng' }));
    await waitFor(() => expect(workAssignment.setBarnRoutineTasks).toHaveBeenCalledWith(2, [
      'CLEAN_FEEDERS',
      'WASH_BARN',
      'FEED_AND_WATER',
      'CUSTOM:Kiểm tra nguồn nước uống',
    ]));
    expect(mocks.showToast).toHaveBeenCalledWith('Đã cập nhật công việc hằng ngày cho Nhà A3.', 'success');
    const bar = await screen.findByTestId('routine-tasks-bar');
    expect(within(bar).getByRole('button', { name: 'Xong Kiểm tra nguồn nước uống' })).toBeInTheDocument();
  });
});
