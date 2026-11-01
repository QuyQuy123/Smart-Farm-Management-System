import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BarnDetailView } from '../features/farmshift/BarnDetailView';
import * as cycles from '../services/cycleService';
import * as areas from '../services/farmAreaService';
import * as programService from '../services/farmingProgramService';
import * as dailyPlan from '../services/dailyPlanService';
import * as supplierService from '../services/supplierService';
import * as productTypeService from '../services/productTypeService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ pageTitle, children }) => <main><h1>{pageTitle}</h1>{children}</main> }));
vi.mock('../services/farmAreaService', () => ({ listBarns: vi.fn(), listFarmAreas: vi.fn(), FARM_AREAS_CHANGED: 'farm-areas-changed' }));
vi.mock('../services/farmingProgramService', () => ({ listPrograms: vi.fn() }));
vi.mock('../services/dailyPlanService', () => ({ getBarnDailyPlan: vi.fn(), confirmDailyTask: vi.fn(), undoDailyTask: vi.fn() }));
vi.mock('../services/supplierService', () => ({ listSuppliers: vi.fn(), createSupplier: vi.fn(), updateSupplier: vi.fn(), deleteSupplier: vi.fn() }));
vi.mock('../services/productTypeService', () => ({ listProductTypes: vi.fn() }));
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
const TODAY = iso(0);

const barn = { id: 2, code: 'CH000002', areaId: 1, areaName: 'Khu J Thịt', name: 'Nhà B1', status: 'ACTIVE', capacity: 5000, currentQuantity: 0,
  areaM2: 600, targetWeight: 2.3, description: '', activeCycleId: 20 };
const supplierFlock = { id: 4, code: 'H0004', name: 'J-DABACO TRỐNG', gender: 'MALE', sourceType: 'PURCHASE', sourceNote: 'Giống Dabaco', importDate: TODAY,
  ageAtImport: 1, currentAgeDays: 1, importQuantity: 3000, importAvgWeight: 0.04, importWeightKg: 120, unitPrice: 11500, quantity: 3000, status: 'ACTIVE',
  supplierId: 6, supplierName: 'Giống Dabaco', purchaseInvoiceId: 31, purchaseInvoiceCode: 'NH000031' };
const detail = flocks => ({
  cycle: { id: 20, code: 'L000020', barnId: 2, cycleNumber: 1, startDate: TODAY, status: 'ACTIVE', note: '', totalIn: 0, currentQuantity: 0 },
  barn,
  metrics: { dayOfCycle: 1, ageDays: flocks.length ? 1 : null, totalIn: 0, currentQuantity: 0, deaths: 0, culls: 0, harvestedQuantity: 0, transferredOut: 0,
    lossRate: 0, cullRate: 0, harvestRate: 0, avgWeightKg: null, biomassKg: null, densityPerM2: 0, feedKg: 0, weightGainKg: null, fcr: null,
    harvestedWeightKg: 0, firstImportDate: flocks.length ? TODAY : null, importDeadline: null, capacity: 5000 },
  finance: null, flocks, programs: [], movements: [], feedRecords: [], weightSamples: [], expenses: [],
});

const renderAt = path => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/barns/:id" element={<BarnDetailView />} /></Routes></MemoryRouter>);
const field = (dialog, label) => within(dialog).getByLabelText(label);

const openImport = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Nhập đàn' }));
  const dialog = await screen.findByRole('dialog', { name: 'Nhập đàn vào lứa' });
  await within(dialog).findByRole('option', { name: /Giống Dabaco/ });
  return dialog;
};

const fillFlock = dialog => {
  fireEvent.change(field(dialog, /Tên đàn/), { target: { value: 'J-DABACO TRỐNG' } });
  fireEvent.change(field(dialog, /Số lượng nhập/), { target: { value: '3000' } });
  fireEvent.change(field(dialog, /Giá con giống/), { target: { value: '11500' } });
};

describe('Nhập đàn: chọn nhà cung cấp và tự tạo hóa đơn nhập con giống', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    areas.listBarns.mockResolvedValue([barn]);
    areas.listFarmAreas.mockResolvedValue([{ id: 1, name: 'Khu J Thịt' }]);
    cycles.getBarn.mockResolvedValue(barn);
    cycles.listCycles.mockResolvedValue([{ id: 20, barnId: 2, cycleNumber: 1, startDate: TODAY, status: 'ACTIVE', totalIn: 0 }]);
    cycles.getCycle.mockResolvedValue(detail([]));
    dailyPlan.getBarnDailyPlan.mockResolvedValue(null);
    programService.listPrograms.mockResolvedValue([{ id: 1, name: 'Gà J-Dabaco thương phẩm', breed: 'Gà J-Dabaco', durationDays: 75, steps: [] }]);
    supplierService.listSuppliers.mockResolvedValue([{ id: 6, name: 'Giống Dabaco', productTypeName: 'Con giống' }]);
    productTypeService.listProductTypes.mockResolvedValue([{ id: 3, name: 'Con giống' }]);
    cycles.importFlock.mockResolvedValue(supplierFlock);
  });

  it('replaces the free-text source with a required supplier picker and has no create-program button', async () => {
    renderAt('/barns/2');
    const dialog = await openImport();
    expect(within(dialog).queryByLabelText(/Nguồn nhập/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Tạo chương trình/ })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/tự tạo hóa đơn nhập hàng/)).toBeInTheDocument();
    expect(field(dialog, /Thanh toán/)).toHaveValue('Trả sau');

    fillFlock(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    expect(await within(dialog).findByText('Vui lòng nhập nhà cung cấp con giống.')).toBeInTheDocument();
    expect(cycles.importFlock).not.toHaveBeenCalled();

    fireEvent.change(field(dialog, /Nhà cung cấp con giống/), { target: { value: '6' } });
    fireEvent.change(field(dialog, /Thanh toán/), { target: { value: 'Thanh toán hoàn tất' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(cycles.importFlock).toHaveBeenCalledWith(20, expect.objectContaining({
      name: 'J-DABACO TRỐNG', quantity: 3000, unitPrice: 11500, supplierId: 6, paymentStatus: 'Thanh toán hoàn tất',
    })));
    expect(cycles.importFlock.mock.calls[0][1]).not.toHaveProperty('sourceNote');
    expect(mocks.showToast).toHaveBeenCalledWith('Đã nhập đàn J-DABACO TRỐNG (3.000 con) và tạo hóa đơn nhập hàng NH000031.', 'success');
  });

  it('quick-adds a supplier with (+) and selects it without submitting the flock form', async () => {
    supplierService.createSupplier.mockResolvedValue({ id: 9, name: 'Trại giống Hòa Bình', productTypeName: 'Con giống' });
    renderAt('/barns/2');
    const dialog = await openImport();
    fillFlock(dialog);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm nhà cung cấp mới' }));
    const supplierDialog = await screen.findByRole('dialog', { name: 'Thêm nhà cung cấp' });
    await within(supplierDialog).findByRole('option', { name: 'Con giống' });
    fireEvent.change(within(supplierDialog).getByLabelText(/Đơn vị cung cấp/), { target: { value: 'Trại giống Hòa Bình' } });
    fireEvent.change(within(supplierDialog).getByLabelText(/Người đại diện/), { target: { value: 'Lê Văn Bình' } });
    fireEvent.change(within(supplierDialog).getByLabelText(/Số điện thoại/), { target: { value: '0912345678' } });
    fireEvent.change(within(supplierDialog).getByLabelText(/Nhóm nhà cung cấp/), { target: { value: '3' } });
    fireEvent.click(within(supplierDialog).getByRole('button', { name: 'Lưu nhà cung cấp' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Thêm nhà cung cấp' })).not.toBeInTheDocument());
    expect(supplierService.createSupplier).toHaveBeenCalledWith({ name: 'Trại giống Hòa Bình', representative: 'Lê Văn Bình', phone: '0912345678', productTypeId: 3 });
    expect(field(dialog, /Nhà cung cấp con giống/)).toHaveValue('9');
    expect(within(dialog).getByRole('option', { name: /Trại giống Hòa Bình/ })).toBeInTheDocument();
    // Lưu nhà cung cấp không được gửi luôn form nhập đàn.
    expect(cycles.importFlock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Nhập đàn vào lứa' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(cycles.importFlock).toHaveBeenCalledWith(20, expect.objectContaining({ supplierId: 9, paymentStatus: 'Trả sau' })));
  });

  it('shows the supplier on the flock and links the chick invoice only for roles that see costs', async () => {
    cycles.getCycle.mockResolvedValue(detail([supplierFlock]));
    const { unmount } = renderAt('/barns/2');
    // Bảng chỉ còn tên, ngày tuổi, tồn; nhà cung cấp và hóa đơn nằm trong Chi tiết đàn.
    fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết đàn H0004' }));
    const flockDialog = await screen.findByRole('dialog', { name: 'Đàn J-DABACO TRỐNG' });
    expect(within(flockDialog).getByText('Giống Dabaco')).toBeInTheDocument();
    expect(within(flockDialog).getByText('11.500đ/con')).toBeInTheDocument();
    expect(within(flockDialog).getByRole('link', { name: 'NH000031' })).toHaveAttribute('href', '/purchases?invoice=31');
    unmount();

    mocks.role = 'ROLE_FARM_WORKER';
    cycles.getCycle.mockResolvedValue(detail([{ ...supplierFlock, unitPrice: null, purchaseInvoiceId: null, purchaseInvoiceCode: null }]));
    renderAt('/barns/2');
    fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết đàn H0004' }));
    const workerDetail = await screen.findByRole('dialog', { name: 'Đàn J-DABACO TRỐNG' });
    expect(within(workerDetail).getByText('Giống Dabaco')).toBeInTheDocument();
    expect(within(workerDetail).queryByText('Giá con giống')).not.toBeInTheDocument();
    expect(within(workerDetail).queryByRole('link', { name: /NH/ })).not.toBeInTheDocument();
  });
});
