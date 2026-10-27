import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FarmingProgramsPanel } from '../features/farmshift/FarmingProgramsPanel';
import * as service from '../services/farmingProgramService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../services/farmingProgramService', () => ({ listPrograms: vi.fn(), createProgram: vi.fn(), updateProgram: vi.fn(), deleteProgram: vi.fn() }));
vi.mock('../services/inventoryItemService', () => ({ listAllInventoryItems: vi.fn(async () => [
  { id: 7, name: 'Higro 01', warehouseName: 'Kho cám', productType: 'Thức ăn chăn nuôi', unitName: 'Bao 25kg', unitContentQuantity: 25, unitContentUnit: 'KG', stock: 200 },
  { id: 6, name: 'Higro 02', warehouseName: 'Kho cám', productType: 'Thức ăn chăn nuôi', unitName: 'Bao 25kg', unitContentQuantity: 25, unitContentUnit: 'KG', stock: 90 },
  { id: 10, name: 'Men tiêu hóa', warehouseName: 'Kho thuốc', productType: 'Thuốc thú y', unitName: 'Gói 1kg', unitContentQuantity: 1, unitContentUnit: 'KG', stock: 9 },
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
  id: 1, code: 'CT0001', name: 'Gà ta thả vườn', breed: 'Gà ta', durationDays: 105, targetWeightMin: 1.5, targetWeightMax: 2.2,
  description: 'Nuôi thả vườn 5 tháng', activeFlockCount: 2, steps: [
    { id: 11, category: 'FEED', name: 'Cám gà con', dayFrom: 1, dayTo: 21, quantity: 15, unit: 'g/con/ngày', mealsPerDay: 6 },
    { id: 12, category: 'FEED', name: 'Cám gà lớn', dayFrom: 22, dayTo: 105, quantity: 70, unit: 'g/con/ngày', mealsPerDay: 3 },
    { id: 13, category: 'VACCINE', name: 'Marek', dayFrom: 1, dayTo: 1, method: 'INJECTION', quantity: 1, unit: 'liều/con' },
    { id: 14, category: 'VACCINE', name: 'Đậu gà', dayFrom: 8, dayTo: 8, method: 'WING_WEB' },
    { id: 15, category: 'MEDICINE', name: 'Vitamin C', dayFrom: 1, dayTo: 7, method: 'MIX_WATER', quantity: 2, unit: 'g/lít nước' },
    { id: 16, category: 'TEMPERATURE', name: 'Úm tuần 2', dayFrom: 8, dayTo: 14, tempMin: 28, tempMax: 30 },
  ],
});
let programs;

describe('Farming programs by breed', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    programs = [gaTa()];
    service.listPrograms.mockImplementation(async () => [...programs]);
    service.createProgram.mockImplementation(async body => { programs.push({ ...body, id: 2, code: 'CT0002', activeFlockCount: 0, steps: body.steps.map((step, i) => ({ ...step, id: 100 + i })) }); });
  });

  it('shows a breed program with its sections and a day-of-age lookup', async () => {
    render(<FarmingProgramsPanel />);
    expect(await screen.findByRole('heading', { name: /Gà ta thả vườn/ })).toBeInTheDocument();
    expect(screen.getByText('105 ngày · 1,5–2,2 kg')).toBeInTheDocument();
    expect(screen.getByText('Đang dùng cho 2 đàn')).toBeInTheDocument();
    expect(screen.getByText('15 g/con/ngày · 6 cữ/ngày')).toBeInTheDocument();
    expect(screen.getByText('Chủng màng cánh')).toBeInTheDocument();
    expect(screen.getByText('28 – 30 °C')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Tra cứu theo ngày tuổi/), { target: { value: '8' } });
    expect(screen.getByText(/Lịch vắc-xin: Đậu gà/)).toHaveTextContent('Cám định mức: Cám gà con (15 g/con/ngày · 6 cữ/ngày)');
    expect(screen.getByText(/Lịch vắc-xin: Đậu gà/)).toHaveTextContent('Nhiệt độ: Úm tuần 2 (28 – 30 °C)');
  });

  it('creates a program with feed, vaccine and temperature rows and validates them first', async () => {
    programs = [];
    render(<FarmingProgramsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo chương trình' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên chương trình/), { target: { value: 'Gà ta thả vườn' } });
    fireEvent.change(within(dialog).getByLabelText(/Giống gà/), { target: { value: 'Gà ta' } });
    fireEvent.change(within(dialog).getByLabelText(/Thời gian nuôi/), { target: { value: '105' } });
    fireEvent.change(within(dialog).getByLabelText('Loại cám dòng 1'), { target: { value: 'Cám gà con' } });
    fireEvent.change(within(dialog).getByLabelText('Đến ngày dòng 1'), { target: { value: '21' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu chương trình' }));
    expect(await within(dialog).findByText('Cần định mức (g/con/ngày) lớn hơn 0 và số cữ ăn từ 1 đến 8.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('g/con/ngày dòng 1'), { target: { value: '15' } });
    fireEvent.change(within(dialog).getByLabelText('Số cữ/ngày dòng 1'), { target: { value: '6' } });
    // Only stock items whose pack size converts to the ration (kg for feed) can be linked.
    // The feed name is picked from stock: only feed items are suggested, filtered by what is typed, without stock levels.
    const feedName = within(dialog).getByLabelText('Loại cám dòng 1');
    fireEvent.change(feedName, { target: { value: 'higro' } });
    const suggestions = await screen.findByRole('listbox', { name: 'Gợi ý Loại cám dòng 1' });
    expect(within(suggestions).getAllByRole('option').map(option => option.textContent)).toEqual(['Higro 01Bao 25kg', 'Higro 02Bao 25kg']);
    expect(suggestions).not.toHaveTextContent(/tồn/);
    fireEvent.change(feedName, { target: { value: 'higro 01' } });
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByRole('option', { name: /Higro 01/ }));
    expect(feedName).toHaveValue('Higro 01');

    fireEvent.click(within(dialog).getByRole('tab', { name: /Lịch vắc-xin/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm dòng' }));
    fireEvent.change(within(dialog).getByLabelText('Tên vắc-xin dòng 2'), { target: { value: 'Đậu gà' } });
    fireEvent.change(within(dialog).getByLabelText('Từ ngày dòng 2'), { target: { value: '8' } });
    fireEvent.change(within(dialog).getByLabelText('Đến ngày dòng 2'), { target: { value: '8' } });
    fireEvent.change(within(dialog).getByLabelText('Cách dùng dòng 2'), { target: { value: 'WING_WEB' } });

    fireEvent.click(within(dialog).getByRole('tab', { name: /Nhiệt độ/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm dòng' }));
    fireEvent.change(within(dialog).getByLabelText('Giai đoạn dòng 3'), { target: { value: 'Úm tuần 1' } });
    fireEvent.change(within(dialog).getByLabelText('Đến ngày dòng 3'), { target: { value: '7' } });
    fireEvent.change(within(dialog).getByLabelText('Thấp nhất °C dòng 3'), { target: { value: '33' } });
    fireEvent.change(within(dialog).getByLabelText('Cao nhất °C dòng 3'), { target: { value: '31' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu chương trình' }));
    expect(await within(dialog).findByText('Nhiệt độ thấp nhất phải nhỏ hơn nhiệt độ cao nhất.')).toBeInTheDocument();
    expect(service.createProgram).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Thấp nhất °C dòng 3'), { target: { value: '31' } });
    fireEvent.change(within(dialog).getByLabelText('Cao nhất °C dòng 3'), { target: { value: '33' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu chương trình' }));

    await waitFor(() => expect(service.createProgram).toHaveBeenCalledTimes(1));
    const body = service.createProgram.mock.calls[0][0];
    expect(body).toMatchObject({ name: 'Gà ta thả vườn', breed: 'Gà ta', durationDays: 105, targetWeightMin: null });
    expect(body.steps).toEqual([
      expect.objectContaining({ category: 'FEED', name: 'Higro 01', dayFrom: 1, dayTo: 21, quantity: 15, mealsPerDay: 6, inventoryItemId: 7 }),
      expect.objectContaining({ category: 'VACCINE', name: 'Đậu gà', dayFrom: 8, dayTo: 8, method: 'WING_WEB', inventoryItemId: null }),
      expect.objectContaining({ category: 'TEMPERATURE', name: 'Úm tuần 1', dayFrom: 1, dayTo: 7, tempMin: 31, tempMax: 33 }),
    ]);
    expect(mocks.showToast).toHaveBeenCalledWith('Đã tạo chương trình Gà ta thả vườn.', 'success');
  });

  it('flags overlapping feed rations and steps beyond the rearing period', async () => {
    render(<FarmingProgramsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Từ ngày dòng 2'), { target: { value: '20' } });
    fireEvent.change(within(dialog).getByLabelText(/Thời gian nuôi/), { target: { value: '100' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu chương trình' }));
    expect(await within(dialog).findByText('Ngày tuổi 105 vượt thời gian nuôi 100 ngày.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Thời gian nuôi/), { target: { value: '105' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu chương trình' }));
    expect(await within(dialog).findByText(/Bị chồng ngày với dòng ngày 1–21/)).toBeInTheDocument();
    expect(service.updateProgram).not.toHaveBeenCalled();
  });

  it('lets other roles read programs without editing', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    render(<FarmingProgramsPanel />);
    await screen.findByRole('heading', { name: /Gà ta thả vườn/ });
    expect(screen.queryByRole('button', { name: 'Tạo chương trình' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument();
  });
});
