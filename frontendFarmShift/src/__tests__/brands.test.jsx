import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrandsView } from '../features/farmshift/BrandsView';
import * as service from '../services/brandService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../services/brandService', () => ({
  listBrands: vi.fn(),
  createBrand: vi.fn(),
  updateBrand: vi.fn(),
  deleteBrand: vi.fn(),
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

describe('Brands CRUD', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    items = [
      { id: 1, code: 'NH000001', name: 'Dabaco', productType: 'Con giống & Cám', quantity: 150, note: 'Gà giống J-Dabaco' },
    ];
    service.listBrands.mockImplementation(async () => [...items]);
    service.createBrand.mockImplementation(async data => {
      const item = { ...data, id: 2, code: 'NH000002' };
      items.push(item);
      return item;
    });
    service.updateBrand.mockImplementation(async (id, data) => {
      items = items.map(item => (item.id === id ? { ...item, ...data } : item));
      return items.find(item => item.id === id);
    });
    service.deleteBrand.mockImplementation(async id => {
      items = items.filter(item => item.id !== id);
    });
  });

  it('creates, reads, edits, searches, and deletes a brand via API without showing code on UI', async () => {
    render(<BrandsView />);
    await screen.findByText('Dabaco');

    // Verify NH000001 code is NOT displayed on UI
    expect(screen.queryByText('NH000001')).not.toBeInTheDocument();
    expect(screen.getByText('Con giống & Cám')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Gà giống J-Dabaco')).toBeInTheDocument();

    // Create
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhãn hiệu' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText(/NH\d+/)).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Tên nhãn hiệu/), { target: { value: 'C.P. Group' } });
    fireEvent.change(within(dialog).getByLabelText('Loại hàng hóa'), { target: { value: 'Thức ăn chăn nuôi' } });
    fireEvent.change(within(dialog).getByLabelText('Số lượng'), { target: { value: '200' } });
    fireEvent.change(within(dialog).getByLabelText('Ghi chú'), { target: { value: 'Dòng cám Higro' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu nhãn hiệu' }));

    await screen.findByText('C.P. Group');
    expect(service.createBrand).toHaveBeenCalledWith({
      name: 'C.P. Group',
      productType: 'Thức ăn chăn nuôi',
      quantity: 200,
      note: 'Dòng cám Higro',
    });
    expect(mocks.showToast).toHaveBeenCalledWith('Đã lưu nhãn hiệu thành công.', 'success');
    expect(screen.queryByText('NH000002')).not.toBeInTheDocument();

    // View
    fireEvent.click(screen.getByRole('button', { name: 'Xem C.P. Group' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Tên nhãn hiệu/)).toHaveAttribute('readonly');
    expect(within(dialog).getByLabelText('Số lượng')).toHaveAttribute('readonly');
    expect(within(dialog).queryByText(/NH\d+/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]);

    // Edit
    fireEvent.click(screen.getByRole('button', { name: 'Sửa C.P. Group' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên nhãn hiệu/), { target: { value: 'C.P. Việt Nam' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu nhãn hiệu' }));
    await screen.findByText('C.P. Việt Nam');
    expect(service.updateBrand).toHaveBeenCalledWith(2, {
      name: 'C.P. Việt Nam',
      productType: 'Thức ăn chăn nuôi',
      quantity: 200,
      note: 'Dòng cám Higro',
    });

    // Search
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm nhãn hiệu' }), { target: { value: 'Dabaco' } });
    expect(screen.queryByText('C.P. Việt Nam')).not.toBeInTheDocument();
    expect(screen.getByText('Dabaco')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm nhãn hiệu' }), { target: { value: '' } });

    // Delete
    fireEvent.click(screen.getByRole('button', { name: 'Xóa C.P. Việt Nam' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText(/NH\d+/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa nhãn hiệu' }));
    await waitFor(() => expect(service.deleteBrand).toHaveBeenCalledWith(2));
  });

  it('keeps the form open and displays server errors on conflict', async () => {
    service.createBrand.mockRejectedValue({ response: { data: { message: 'Tên nhãn hiệu đã tồn tại.' } } });
    render(<BrandsView />);
    await screen.findByText('Dabaco');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhãn hiệu' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên nhãn hiệu/), { target: { value: 'Dabaco' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu nhãn hiệu' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Tên nhãn hiệu đã tồn tại.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lets workers view brands while hiding create/edit/delete buttons', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    render(<BrandsView />);
    await screen.findByText('Dabaco');
    expect(screen.queryByRole('button', { name: 'Thêm nhãn hiệu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Dabaco' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa Dabaco' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem Dabaco' })).toBeInTheDocument();
  });
});
