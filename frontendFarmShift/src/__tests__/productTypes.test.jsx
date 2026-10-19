import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProductTypesView } from '../features/farmshift/ProductTypesView';
import * as service from '../services/productTypeService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../services/productTypeService', () => ({
  listProductTypes: vi.fn(),
  createProductType: vi.fn(),
  updateProductType: vi.fn(),
  deleteProductType: vi.fn(),
}));

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

describe('ProductTypes CRUD', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    items = [
      { id: 1, code: 'LH000001', name: 'Thức ăn chăn nuôi', description: 'Cám các loại', quantity: 120, createdAt: '2026-10-18T10:00:00' },
    ];
    service.listProductTypes.mockImplementation(async () => [...items]);
    service.createProductType.mockImplementation(async data => {
      const item = { ...data, id: 2, code: 'LH000002', createdAt: '2026-10-18T11:00:00' };
      items.push(item);
      return item;
    });
    service.updateProductType.mockImplementation(async (id, data) => {
      items = items.map(item => (item.id === id ? { ...item, ...data } : item));
      return items.find(item => item.id === id);
    });
    service.deleteProductType.mockImplementation(async id => {
      items = items.filter(item => item.id !== id);
    });
  });

  it('creates, reads, edits, searches, and deletes a product type without showing code on UI', async () => {
    render(<ProductTypesView />);
    await screen.findByText('Thức ăn chăn nuôi');

    // Verify LH000001 code is NOT displayed on UI
    expect(screen.queryByText('LH000001')).not.toBeInTheDocument();
    // Verify columns: Tên loại hàng, Mô tả, Số lượng, Ngày tạo
    expect(screen.getByText('Cám các loại')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('18/10/2026')).toBeInTheDocument();

    // Create
    fireEvent.click(screen.getByRole('button', { name: 'Thêm loại hàng hóa' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText(/LH\d+/)).not.toBeInTheDocument();
    // Verify quantity field is removed from the create pop up
    expect(within(dialog).queryByLabelText('Số lượng')).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Tên loại hàng/), { target: { value: 'Thuốc thú y' } });
    fireEvent.change(within(dialog).getByLabelText('Mô tả'), { target: { value: 'Kháng sinh & bổ trợ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu loại hàng' }));

    await screen.findByText('Thuốc thú y');
    expect(service.createProductType).toHaveBeenCalledWith({
      name: 'Thuốc thú y',
      description: 'Kháng sinh & bổ trợ',
      quantity: 0,
    });
    expect(mocks.showToast).toHaveBeenCalledWith('Đã lưu loại hàng hóa thành công.', 'success');
    expect(screen.queryByText('LH000002')).not.toBeInTheDocument();

    // View
    fireEvent.click(screen.getByRole('button', { name: 'Xem Thuốc thú y' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Tên loại hàng/)).toHaveAttribute('readonly');
    expect(within(dialog).getByLabelText('Số lượng')).toHaveAttribute('readonly');
    expect(within(dialog).queryByText(/LH\d+/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]);

    // Edit
    fireEvent.click(screen.getByRole('button', { name: 'Sửa Thuốc thú y' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Số lượng')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Tên loại hàng/), { target: { value: 'Dược phẩm thú y' } });
    fireEvent.change(within(dialog).getByLabelText('Số lượng'), { target: { value: '30' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu loại hàng' }));
    await screen.findByText('Dược phẩm thú y');
    expect(service.updateProductType).toHaveBeenCalledWith(2, {
      name: 'Dược phẩm thú y',
      description: 'Kháng sinh & bổ trợ',
      quantity: 30,
    });

    // Search
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm loại hàng hóa' }), { target: { value: 'Thức ăn' } });
    expect(screen.queryByText('Dược phẩm thú y')).not.toBeInTheDocument();
    expect(screen.getByText('Thức ăn chăn nuôi')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm loại hàng hóa' }), { target: { value: '' } });

    // Delete
    fireEvent.click(screen.getByRole('button', { name: 'Xóa Dược phẩm thú y' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText(/LH\d+/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa loại hàng' }));
    await waitFor(() => expect(service.deleteProductType).toHaveBeenCalledWith(2));
  });

  it('handles server errors cleanly without crashing', async () => {
    service.createProductType.mockRejectedValue({ response: { data: { message: 'Tên loại hàng đã tồn tại.' } } });
    render(<ProductTypesView />);
    await screen.findByText('Thức ăn chăn nuôi');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm loại hàng hóa' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên loại hàng/), { target: { value: 'Thức ăn chăn nuôi' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu loại hàng' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Tên loại hàng đã tồn tại.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('restricts worker role to read-only mode', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    render(<ProductTypesView />);
    await screen.findByText('Thức ăn chăn nuôi');
    expect(screen.queryByRole('button', { name: 'Thêm loại hàng hóa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Thức ăn chăn nuôi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa Thức ăn chăn nuôi' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem Thức ăn chăn nuôi' })).toBeInTheDocument();
  });
});
