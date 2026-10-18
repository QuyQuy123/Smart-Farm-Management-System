import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProductCategoriesView } from '../features/farmshift/ProductCategoriesView';
import * as service from '../services/productCategoryService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../services/productCategoryService', () => ({ listProductCategories: vi.fn(), createProductCategory: vi.fn(), updateProductCategory: vi.fn(), deleteProductCategory: vi.fn() }));
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

describe('Product category CRUD', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    items = [{ id: 1, code: 'HH000001', name: 'Kho cám', description: 'Thức ăn', itemCount: 0, createdAt: '2026-10-18T10:00:00' }];
    service.listProductCategories.mockImplementation(async () => [...items]);
    service.createProductCategory.mockImplementation(async data => { const item = { ...items[0], ...data, id: 2, code: 'HH000002' }; items.push(item); return item; });
    service.updateProductCategory.mockImplementation(async (id, data) => { items = items.map(item => item.id === id ? { ...item, ...data } : item); return items.find(item => item.id === id); });
    service.deleteProductCategory.mockImplementation(async id => { items = items.filter(item => item.id !== id); });
  });

  it('creates, reads, edits, searches and deletes a category through the API', async () => {
    render(<ProductCategoriesView />);
    await screen.findByText('Kho cám');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm danh mục hàng hóa' }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên danh mục/), { target: { value: 'Kho thuốc' } });
    fireEvent.change(within(dialog).getByLabelText('Mô tả'), { target: { value: 'Thuốc thú y' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu danh mục' }));
    await screen.findByText('Kho thuốc');
    expect(service.createProductCategory).toHaveBeenCalledWith({ name: 'Kho thuốc', description: 'Thuốc thú y' });
    expect(mocks.showToast).toHaveBeenCalledWith('Đã lưu danh mục hàng hóa thành công.', 'success');
    expect(screen.queryByText('Đã lưu danh mục hàng hóa thành công.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem Kho thuốc' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Tên danh mục/)).toHaveAttribute('readonly');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Sửa Kho thuốc' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên danh mục/), { target: { value: 'Kho vắc xin' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu danh mục' }));
    await screen.findByText('Kho vắc xin');
    expect(service.updateProductCategory).toHaveBeenCalledWith(2, { name: 'Kho vắc xin', description: 'Thuốc thú y' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm danh mục hàng hóa' }), { target: { value: 'vắc xin' } });
    expect(screen.queryByText('Kho cám')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa Kho vắc xin' }));
    expect(service.deleteProductCategory).not.toHaveBeenCalled();
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa danh mục' }));
    await waitFor(() => expect(service.deleteProductCategory).toHaveBeenCalledWith(2));
    await screen.findByText('Không tìm thấy danh mục phù hợp.');
  });

  it('keeps the form open and shows server errors without claiming success', async () => {
    service.createProductCategory.mockRejectedValue({ response: { data: { message: 'Tên danh mục hàng hóa đã tồn tại.' } } });
    render(<ProductCategoriesView />);
    await screen.findByText('Kho cám');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm danh mục hàng hóa' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên danh mục/), { target: { value: 'Kho cám' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu danh mục' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Tên danh mục hàng hóa đã tồn tại.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lets workers view categories while hiding mutations', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    render(<ProductCategoriesView />);
    await screen.findByText('Kho cám');
    expect(screen.queryByRole('button', { name: 'Thêm danh mục hàng hóa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Kho cám' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem Kho cám' })).toBeInTheDocument();
  });
});
