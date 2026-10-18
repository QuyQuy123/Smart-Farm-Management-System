import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SuppliersView } from '../features/farmshift/SuppliersView';
import * as service from '../services/supplierService';
import { listProductTypes } from '../services/productTypeService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../services/supplierService', () => ({ listSuppliers: vi.fn(), createSupplier: vi.fn(), updateSupplier: vi.fn(), deleteSupplier: vi.fn() }));
vi.mock('../services/productTypeService', () => ({ listProductTypes: vi.fn() }));
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterAll(() => {
  if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShow); else delete HTMLDialogElement.prototype.showModal;
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose); else delete HTMLDialogElement.prototype.close;
});
let items;
describe('Supplier CRUD', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.role = 'ROLE_FARM_OWNER';
    items = [{ id: 1, code: 'NCC_HIDDEN', name: 'Công ty A', representative: 'Nguyễn Văn A', phone: '0912345678', productTypeId: 10, productTypeName: 'Thuốc thú y', createdAt: '2026-10-18T12:00:01' }];
    service.listSuppliers.mockImplementation(async () => [...items]);
    listProductTypes.mockResolvedValue([{ id: 10, name: 'Thuốc thú y' }]);
    service.createSupplier.mockImplementation(async data => { const supplier = { ...items[0], ...data, id: 2 }; items.push(supplier); return supplier; });
    service.updateSupplier.mockImplementation(async (id, data) => { items = items.map(item => item.id === id ? { ...item, ...data } : item); });
    service.deleteSupplier.mockImplementation(async id => { items = items.filter(item => item.id !== id); });
  });
  it('creates, views, edits and deletes suppliers without displaying their internal code', async () => {
    render(<SuppliersView />);
    await screen.findByText('Công ty A');
    expect(screen.queryByText('NCC_HIDDEN')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Mã/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhà cung cấp' }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Đơn vị cung cấp/), { target: { value: 'Công ty B' } });
    fireEvent.change(within(dialog).getByLabelText(/Người đại diện/), { target: { value: 'Nguyễn Văn B' } });
    fireEvent.change(within(dialog).getByLabelText(/Số điện thoại/), { target: { value: '0987654321' } });
    await within(dialog).findByRole('option', { name: 'Thuốc thú y' });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: '10' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu nhà cung cấp' }));
    await screen.findByText('Công ty B');
    expect(service.createSupplier).toHaveBeenCalledWith({ name: 'Công ty B', representative: 'Nguyễn Văn B', phone: '0987654321', productTypeId: 10 });
    expect(mocks.showToast).toHaveBeenCalledWith('Đã lưu nhà cung cấp thành công.', 'success');
    fireEvent.click(screen.getByRole('button', { name: 'Xem Công ty B' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Nhóm nhà cung cấp')).toHaveValue('Thuốc thú y');
    expect(within(dialog).queryByText('NCC_HIDDEN')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa Công ty B' }));
    dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Thuốc thú y' });
    fireEvent.change(within(dialog).getByLabelText(/Đơn vị cung cấp/), { target: { value: 'Công ty C' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu nhà cung cấp' }));
    await screen.findByText('Công ty C');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa Công ty C' }));
    expect(service.deleteSupplier).not.toHaveBeenCalled();
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa nhà cung cấp' }));
    await waitFor(() => expect(screen.queryByText('Công ty C')).not.toBeInTheDocument());
    expect(service.deleteSupplier).toHaveBeenCalledWith(2);
  });
  it('disables saving when there are no product types to select', async () => {
    listProductTypes.mockResolvedValue([]);
    render(<SuppliersView />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhà cung cấp' }));
    await screen.findByText('Chưa có nhóm. Vui lòng thêm dữ liệu trong tab Loại hàng hóa trước.');
    expect(screen.getByRole('button', { name: 'Lưu nhà cung cấp' })).toBeDisabled();
  });
  it('allows workers to view but hides write actions', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    render(<SuppliersView />);
    await screen.findByText('Công ty A');
    expect(screen.queryByRole('button', { name: 'Thêm nhà cung cấp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Công ty A' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem Công ty A' })).toBeInTheDocument();
  });
});
