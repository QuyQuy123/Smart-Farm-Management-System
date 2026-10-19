import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MeasurementUnitsView } from '../features/farmshift/MeasurementUnitsView';
import * as service from '../services/measurementUnitService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../services/measurementUnitService', () => ({ listMeasurementUnits: vi.fn(), createMeasurementUnit: vi.fn(), updateMeasurementUnit: vi.fn(), deleteMeasurementUnit: vi.fn() }));
let items;
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

describe('Measurement unit CRUD', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    items = [{ id: 1, code: 'KG', name: 'Kg', description: 'Thức ăn', itemCount: 0, createdAt: '2026-10-18T10:00:00' }];
    service.listMeasurementUnits.mockImplementation(async () => [...items]);
    service.createMeasurementUnit.mockImplementation(async data => { const item = { ...items[0], ...data, id: 2, code: 'BAO' }; items.push(item); return item; });
    service.updateMeasurementUnit.mockImplementation(async (id, data) => { items = items.map(item => item.id === id ? { ...item, ...data } : item); return items.find(item => item.id === id); });
    service.deleteMeasurementUnit.mockImplementation(async id => { items = items.filter(item => item.id !== id); });
  });

  it('creates, reads, edits, searches and deletes a category through the API', async () => {
    render(<MeasurementUnitsView />);
    await screen.findByText('Kg');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm đơn vị tính' }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên đơn vị/), { target: { value: 'Bao' } });
    fireEvent.change(within(dialog).getByLabelText(/Mã đơn vị/), { target: { value: 'BAO' } });
    fireEvent.change(within(dialog).getByLabelText('Mô tả'), { target: { value: 'Thuốc thú y' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu đơn vị' }));
    await screen.findByText('Bao');
    expect(service.createMeasurementUnit).toHaveBeenCalledWith({ code: 'BAO', name: 'Bao', description: 'Thuốc thú y' });
    expect(mocks.showToast).toHaveBeenCalledWith('Đã lưu đơn vị tính thành công.', 'success');
    expect(screen.queryByText('Đã lưu đơn vị tính thành công.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem Bao' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Tên đơn vị/)).toHaveAttribute('readonly');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Sửa Bao' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên đơn vị/), { target: { value: 'Bao lớn' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu đơn vị' }));
    await screen.findByText('Bao lớn');
    expect(service.updateMeasurementUnit).toHaveBeenCalledWith(2, { code: 'BAO', name: 'Bao lớn', description: 'Thuốc thú y' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm đơn vị tính' }), { target: { value: 'lớn' } });
    expect(screen.queryByText('Kg')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa Bao lớn' }));
    expect(service.deleteMeasurementUnit).not.toHaveBeenCalled();
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa đơn vị' }));
    await waitFor(() => expect(service.deleteMeasurementUnit).toHaveBeenCalledWith(2));
    await screen.findByText('Không tìm thấy đơn vị phù hợp.');
  });

  it('keeps the form open and shows server errors without claiming success', async () => {
    service.createMeasurementUnit.mockRejectedValue({ response: { data: { message: 'Tên đơn vị tính đã tồn tại.' } } });
    render(<MeasurementUnitsView />);
    await screen.findByText('Kg');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm đơn vị tính' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên đơn vị/), { target: { value: 'Kg' } });
    fireEvent.change(within(dialog).getByLabelText(/Mã đơn vị/), { target: { value: 'KG' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu đơn vị' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Tên đơn vị tính đã tồn tại.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lets workers view categories while hiding mutations', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    render(<MeasurementUnitsView />);
    await screen.findByText('Kg');
    expect(screen.queryByRole('button', { name: 'Thêm đơn vị tính' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Kg' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem Kg' })).toBeInTheDocument();
  });
});
