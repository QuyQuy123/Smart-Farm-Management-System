import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TransfersView } from '../features/farmshift/TransfersView';
import * as service from '../services/transferCategoryService';
const mocks = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children }) => <div>{children}</div> }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ROLE_FARM_OWNER' } }) }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../services/transferCategoryService', () => ({ listTransferCategories: vi.fn(), createTransferCategory: vi.fn(), updateTransferCategory: vi.fn(), deleteTransferCategory: vi.fn(), TRANSFER_TYPES: { IMPORT: 'Nhập kho', EXPORT: 'Xuất kho', TRANSFER: 'Chuyển kho' } }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
let items;
beforeEach(() => {
 vi.clearAllMocks(); items = [];
 service.listTransferCategories.mockImplementation(async () => [...items]);
 service.createTransferCategory.mockImplementation(async data => { items.push({ ...data, id: 1, slipCount: 0, createdAt: '2026-10-19T10:20:30' }); });
 service.updateTransferCategory.mockImplementation(async (id, data) => { items = items.map(item => item.id === id ? { ...item, ...data } : item); });
 service.deleteTransferCategory.mockImplementation(async id => { items = items.filter(item => item.id !== id); });
});
describe('Transfer categories', () => {
 it('creates, reads, edits and deletes persisted categories without displaying codes', async () => {
  render(<TransfersView />);
  fireEvent.click(screen.getByRole('button', { name: 'Danh mục' }));
  await screen.findByText('Chưa có danh mục phiếu.');
  expect(screen.queryByRole('columnheader', { name: 'Mã danh mục' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }));
  let dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Loại phiếu/), { target: { value: 'Phiếu kiểm kê' } });
  fireEvent.change(within(dialog).getByLabelText(/Tên danh mục/), { target: { value: 'Kiểm kê' } });
  fireEvent.change(within(dialog).getByLabelText('Mô tả'), { target: { value: 'Ghi nhận kiểm kê' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu danh mục' }));
  await screen.findByRole('button', { name: 'Xem Kiểm kê' });
  expect(service.createTransferCategory).toHaveBeenCalledWith({ type: 'Phiếu kiểm kê', name: 'Kiểm kê', description: 'Ghi nhận kiểm kê' });
  fireEvent.click(screen.getByRole('button', { name: 'Xem Kiểm kê' }));
  dialog = screen.getByRole('dialog');
  expect(within(dialog).getByLabelText(/Tên danh mục/)).toHaveAttribute('readonly');
  fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Sửa Kiểm kê' }));
  dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Tên danh mục/), { target: { value: 'Xuất sử dụng' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu danh mục' }));
  await screen.findByRole('button', { name: 'Xóa Xuất sử dụng' });
  fireEvent.click(screen.getByRole('button', { name: 'Xóa Xuất sử dụng' }));
  expect(service.deleteTransferCategory).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xóa danh mục' }));
  await screen.findByText('Chưa có danh mục phiếu.');
  expect(mocks.showToast).toHaveBeenCalledWith('Đã xóa danh mục phiếu.', 'success');
 });
 it('shows loading failures and retries', async () => {
  service.listTransferCategories.mockRejectedValueOnce(new Error('offline'));
  render(<TransfersView />); fireEvent.click(screen.getByRole('button', { name: 'Danh mục' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh mục phiếu.');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await screen.findByText('Chưa có danh mục phiếu.');
 });
});
