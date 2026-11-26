import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FarmingProgramsPanel } from '../features/farmshift/FarmingProgramsPanel';
import * as service from '../services/farmingProgramService';
import { listAllInventoryItems } from '../services/inventoryItemService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../services/farmingProgramService', () => ({
  listPrograms: vi.fn(),
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
  deleteProgram: vi.fn(),
  downloadProgramExcelTemplate: vi.fn(),
  exportProgramExcel: vi.fn(),
  importProgramExcel: vi.fn(),
}));
vi.mock('../services/inventoryItemService', () => ({ listAllInventoryItems: vi.fn(async () => [
  { id: 7, name: 'Higro 01', warehouseName: 'Kho cám', productType: 'Thức ăn chăn nuôi', unitName: 'Bao 25kg', unitContentQuantity: 25, unitContentUnit: 'KG', stock: 200 },
  { id: 6, name: 'Higro 02', warehouseName: 'Kho cám', productType: 'Thức ăn chăn nuôi', unitName: 'Bao 25kg', unitContentQuantity: 25, unitContentUnit: 'KG', stock: 90 },
  { id: 10, name: 'Men tiêu hóa', warehouseName: 'Kho thuốc', productType: 'Thuốc thú y', unitName: 'Gói 1kg', unitContentQuantity: 1, unitContentUnit: 'KG', stock: 9 },
  { id: 11, name: 'Thuốc úm', warehouseName: 'Kho thuốc', productType: 'Thuốc thú y', unitName: 'Gói 100g', unitContentQuantity: 1, unitContentUnit: 'PACK', stock: 20 },
  { id: 8, name: 'Lasota', warehouseName: 'Kho thuốc', productType: 'Thuốc thú y', unitName: 'Lọ 1000 liều', unitContentQuantity: 1000, unitContentUnit: 'DOSE', stock: 5 },
  { id: 9, name: 'Thùng carton', warehouseName: 'Kho vật tư', productType: '', unitName: 'Thùng', unitContentQuantity: null, unitContentUnit: null, stock: 3 },
]) }));

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

const gaTa = () => ({
  id: 1, code: 'CT0001', name: 'Gà ta 90 ngày', breed: 'Gà ta', durationDays: 90, targetWeightMin: 1.8, targetWeightMax: 2.3,
  description: 'Quy trình 90 ngày chuẩn', activeFlockCount: 2, steps: [
    { id: 11, category: 'FEED', name: 'Cám mảnh', dayFrom: 1, dayTo: 30, quantity: 25, unit: 'g/con/ngày', mealsPerDay: 4, feedInputMode: 'BAGS_PER_1000_BIRDS', bagWeightKg: 25, bagsPer1000Birds: 30 },
    { id: 12, category: 'FEED', name: 'Cám phát triển', dayFrom: 31, dayTo: 60, quantity: 83.333, unit: 'g/con/ngày', mealsPerDay: 3, feedInputMode: 'BAGS_PER_1000_BIRDS', bagWeightKg: 25, bagsPer1000Birds: 100 },
    { id: 13, category: 'VACCINE', name: 'Gumboro', dayFrom: 8, dayTo: 8, method: 'DRINKING_WATER', quantity: 1, unit: 'liều/con' },
    { id: 14, category: 'VACCINE', name: 'Đậu gà', dayFrom: 12, dayTo: 12, method: 'WING_WEB' },
    { id: 15, category: 'DRINKING_MEDICINE', name: 'Thuốc úm', dayFrom: 1, dayTo: 7, method: 'HAND_DRINKER', quantity: 0.5, unit: 'gói/1000 con' },
    { id: 16, category: 'CARE_PROCEDURE', name: 'Làm mỏ lần 1', dayFrom: 16, dayTo: 16, method: 'PROCEDURE' },
  ],
});
let programs;

describe('Farming programs by breed', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    programs = [gaTa()];
    service.listPrograms.mockImplementation(async () => [...programs]);
    service.createProgram.mockImplementation(async body => {
      programs.push({ ...body, id: 2, code: 'CT0002', activeFlockCount: 0, steps: body.steps.map((step, i) => ({ ...step, id: 100 + i })) });
    });
  });

  it('lists feed names from all warehouses once, even when pack conversion is not configured', async () => {
    listAllInventoryItems.mockResolvedValueOnce([
      { id: 30, name: 'Cám GT2', warehouseName: 'Kho cám khu A', stock: 100 },
      { id: 31, name: 'Cám GT2', warehouseName: 'Kho cám khu B', stock: 200 },
      { id: 32, name: 'Cám GT3', warehouseName: 'Kho cám mới', stock: 0 },
      { id: 33, name: 'Thuốc A', warehouseName: 'Kho thuốc', stock: 5 },
    ]);
    render(<FarmingProgramsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo chương trình' }));
    const select = await screen.findByRole('combobox', { name: 'Loại cám dòng 1' });
    await waitFor(() => expect(select).toBeEnabled());
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['Chọn loại cám', 'Cám GT2', 'Cám GT3']);
    fireEvent.change(select, { target: { value: 'Cám GT2' } });
    expect(select).toHaveValue('Cám GT2');
  });

  it('shows a breed program with drinking medicine, bags/1000 birds feed, procedures and day-of-age lookup', async () => {
    render(<FarmingProgramsPanel />);
    expect(await screen.findByRole('heading', { name: /Gà ta 90 ngày/ })).toBeInTheDocument();
    expect(screen.getByText('90 ngày · 1,8–2,3 kg')).toBeInTheDocument();
    expect(screen.getByText('Đang dùng cho 2 đàn')).toBeInTheDocument();
    expect(screen.getByText('30 bao/1.000 con (≈ 25 g/con/ngày) · 4 cữ/ngày')).toBeInTheDocument();
    expect(screen.getByText('Bình xách tay · 0,5 gói/1000 con')).toBeInTheDocument();
    expect(screen.getByText('Làm mỏ lần 1')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Tra cứu theo ngày tuổi/), { target: { value: '8' } });
    expect(screen.getByText(/Lịch vắc-xin: Gumboro/)).toHaveTextContent('Cám định mức: Cám mảnh');
  });

  it('replaces Temperature tab with Drinking Medicine tab and supports bags/1000 birds conversion', async () => {
    programs = [];
    render(<FarmingProgramsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo chương trình' }));
    const dialog = await screen.findByRole('dialog');

    // Temperature tab must be hidden; Drinking Medicine tab must exist
    expect(within(dialog).queryByRole('tab', { name: /Nhiệt độ/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: /Lịch uống thuốc/ })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Tên chương trình/), { target: { value: 'Gà ta 90 ngày mới' } });
    fireEvent.change(within(dialog).getByLabelText(/Giống gà/), { target: { value: 'Gà ta' } });
    fireEvent.change(within(dialog).getByLabelText(/Thời gian nuôi/), { target: { value: '90' } });
    await waitFor(() => expect(within(dialog).getByLabelText('Loại cám dòng 1')).toBeEnabled());

    fireEvent.change(within(dialog).getByLabelText('Loại cám dòng 1'), { target: { value: 'Higro 01' } });
    fireEvent.change(within(dialog).getByLabelText('Đến ngày dòng 1'), { target: { value: '30' } });
    fireEvent.change(within(dialog).getByLabelText('Chế độ nhập dòng 1'), { target: { value: 'BAGS_PER_1000_BIRDS' } });
    fireEvent.change(within(dialog).getByLabelText('Bao/1000 con dòng 1'), { target: { value: '30' } });
    fireEvent.change(within(dialog).getByLabelText('Số cữ/ngày dòng 1'), { target: { value: '4' } });
    expect(within(dialog).getByText('≈ 25 g/con/ngày')).toBeInTheDocument();

    // Add drinking medicine step
    fireEvent.click(within(dialog).getByRole('tab', { name: /Lịch uống thuốc/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm dòng' }));
    fireEvent.change(within(dialog).getByLabelText('Thuốc uống / men / bổ dòng 2'), { target: { value: 'Thuốc úm' } });
    fireEvent.change(within(dialog).getByLabelText('Từ ngày dòng 2'), { target: { value: '1' } });
    fireEvent.change(within(dialog).getByLabelText('Đến ngày dòng 2'), { target: { value: '7' } });
    fireEvent.change(within(dialog).getByLabelText('Phương thức cấp dòng 2'), { target: { value: 'HAND_DRINKER' } });
    fireEvent.change(within(dialog).getByLabelText('Liều lượng dòng 2'), { target: { value: '0.5' } });
    fireEvent.change(within(dialog).getByLabelText('Đơn vị dòng 2'), { target: { value: 'gói/1000 con' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu chương trình' }));
    await waitFor(() => expect(service.createProgram).toHaveBeenCalledTimes(1));
    const body = service.createProgram.mock.calls[0][0];
    expect(body.steps).toEqual([
      expect.objectContaining({ category: 'FEED', name: 'Higro 01', dayFrom: 1, dayTo: 30, quantity: 25, feedInputMode: 'BAGS_PER_1000_BIRDS', bagsPer1000Birds: 30, bagWeightKg: 25, mealsPerDay: 4 }),
      expect.objectContaining({ category: 'DRINKING_MEDICINE', name: 'Thuốc úm', dayFrom: 1, dayTo: 7, method: 'HAND_DRINKER', quantity: 0.5, unit: 'gói/1000 con' }),
    ]);
  });

  it('validates Excel import errors by sheet/row/column and commits valid preview', async () => {
    render(<FarmingProgramsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nhập từ Excel' }));
    const dialog = await screen.findByRole('dialog');
    const fileInput = dialog.querySelector('#program-excel-file');

    // 1. Server returns structured cell errors (HTTP 422)
    service.importProgramExcel.mockRejectedValueOnce({
      response: {
        data: {
          message: 'File Excel có 1 lỗi cần chỉnh sửa.',
          data: {
            valid: false,
            errors: [{ sheet: 'CamDinhMuc', row: 2, column: 'DenNgay', message: 'Ngày kết thúc vượt quá thời gian nuôi.' }],
          },
        },
      },
    });
    const badFile = new File(['dummy'], 'bad.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    expect(await within(dialog).findByText('CamDinhMuc')).toBeInTheDocument();
    expect(within(dialog).getByText('DenNgay')).toBeInTheDocument();
    expect(within(dialog).getByText('Ngày kết thúc vượt quá thời gian nuôi.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Xác nhận lưu' })).toBeDisabled();

    // 2. Valid preview -> enable commit -> save
    service.importProgramExcel
      .mockResolvedValueOnce({
        valid: true,
        mode: 'preview',
        errors: [],
        preview: {
          name: 'CT Excel 90 ngày',
          breed: 'Gà ta',
          durationDays: 90,
          steps: [{ category: 'FEED', name: 'Cám mảnh', dayFrom: 1, dayTo: 30, quantity: 25, mealsPerDay: 4, feedInputMode: 'BAGS_PER_1000_BIRDS', bagsPer1000Birds: 30 }],
        },
      })
      .mockResolvedValueOnce({
        valid: true,
        mode: 'commit',
        errors: [],
        savedProgram: { id: 9, name: 'CT Excel 90 ngày' },
      });

    const goodFile = new File(['valid'], 'good.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [goodFile] } });
    expect(await within(dialog).findByText('CT Excel 90 ngày')).toBeInTheDocument();
    const commitBtn = within(dialog).getByRole('button', { name: 'Xác nhận lưu' });
    expect(commitBtn).toBeEnabled();
    fireEvent.click(commitBtn);

    await waitFor(() => expect(service.importProgramExcel).toHaveBeenLastCalledWith(goodFile, 'commit'));
    expect(mocks.showToast).toHaveBeenCalledWith('Đã nhập chương trình CT Excel 90 ngày từ Excel.', 'success');
  });

  it('flags overlapping feed rations and steps beyond the rearing period', async () => {
    render(<FarmingProgramsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Từ ngày dòng 2'), { target: { value: '25' } });
    fireEvent.change(within(dialog).getByLabelText(/Thời gian nuôi/), { target: { value: '50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu chương trình' }));
    expect(await within(dialog).findByText('Ngày tuổi 60 vượt thời gian nuôi 50 ngày.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Thời gian nuôi/), { target: { value: '90' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu chương trình' }));
    expect(await within(dialog).findByText(/Bị chồng ngày với dòng ngày 1–30/)).toBeInTheDocument();
    expect(service.updateProgram).not.toHaveBeenCalled();
  });

  it('lets other roles read and export programs without editing or importing', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    render(<FarmingProgramsPanel />);
    await screen.findByRole('heading', { name: /Gà ta 90 ngày/ });
    expect(screen.queryByRole('button', { name: 'Tạo chương trình' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nhập từ Excel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xuất Excel' })).toBeInTheDocument();
  });
});
