import React from 'react';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { CustomerContactsView } from '../features/farmshift/CustomerContactsView';
import * as service from '../services/customerContactService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../services/customerContactService', () => ({ listCustomerContacts: vi.fn(), createCustomerContact: vi.fn(), updateCustomerContact: vi.fn(), deleteCustomerContact: vi.fn() }));
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterAll(() => {
  if (show) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', show); else delete HTMLDialogElement.prototype.showModal;
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else delete HTMLDialogElement.prototype.close;
});
let items;
describe('Customer contacts CRUD and pagination', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.role = 'ROLE_FARM_OWNER';
    items = [{ id: 1, name: 'Khách hàng 1', phone: '0912345678', code: 'KH_HIDDEN' }];
    service.listCustomerContacts.mockImplementation(async (page, q) => {
      const filtered = items.filter(item => item.name.includes(q) || item.phone.includes(q));
      return { content: filtered.slice(page * 10, page * 10 + 10), totalElements: filtered.length, totalPages: Math.ceil(filtered.length / 10), page, size: 10 };
    });
    service.createCustomerContact.mockImplementation(async data => { items.push({ id: 2, ...data }); });
    service.updateCustomerContact.mockImplementation(async (id, data) => { items = items.map(item => item.id === id ? { ...item, ...data } : item); });
    service.deleteCustomerContact.mockImplementation(async id => { items = items.filter(item => item.id !== id); });
  });
  it('creates, reads, updates and deletes without exposing customer codes', async () => {
    render(<CustomerContactsView />);
    await screen.findByText('Khách hàng 1');
    expect(screen.queryByText('KH_HIDDEN')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Mã/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm khách hàng' }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên khách hàng/), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(within(dialog).getByLabelText(/Số điện thoại/), { target: { value: '0987654321' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu khách hàng' }));
    await screen.findByText('Nguyễn Văn A');
    expect(service.createCustomerContact).toHaveBeenCalledWith({ name: 'Nguyễn Văn A', phone: '0987654321' });
    expect(mocks.showToast).toHaveBeenCalledWith('Đã lưu khách hàng thành công.', 'success');
    fireEvent.click(screen.getByRole('button', { name: 'Xem Nguyễn Văn A' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Tên khách hàng')).toHaveAttribute('readonly');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa Nguyễn Văn A' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên khách hàng/), { target: { value: 'Nguyễn Văn B' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu khách hàng' }));
    await screen.findByText('Nguyễn Văn B');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa Nguyễn Văn B' }));
    expect(service.deleteCustomerContact).not.toHaveBeenCalled();
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa khách hàng' }));
    await waitFor(() => expect(screen.queryByText('Nguyễn Văn B')).not.toBeInTheDocument());
  });
  it('shows ten per page and returns to the previous page after deleting the only remaining row', async () => {
    items = Array.from({ length: 11 }, (_, i) => ({ id: i + 1, name: `Khách hàng ${i + 1}`, phone: '0912345678' }));
    render(<CustomerContactsView />);
    await screen.findByText('Khách hàng 10');
    expect(screen.queryByText('Khách hàng 11')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(11);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await screen.findByText('Khách hàng 11');
    expect(service.listCustomerContacts).toHaveBeenCalledWith(1, '');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa Khách hàng 11' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xóa khách hàng' }));
    await screen.findByText('Khách hàng 1');
    expect(screen.getByText('Trang 1 / 1')).toBeInTheDocument();
  });
  it('searches the server across all pages', async () => {
    items = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, name: `Khách hàng ${i + 1}`, phone: '0912345678' }));
    render(<CustomerContactsView />);
    await screen.findByText('Khách hàng 1');
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm khách hàng' }), { target: { value: 'Khách hàng 21' } });
    await screen.findByText('Khách hàng 21');
    expect(service.listCustomerContacts).toHaveBeenCalledWith(0, 'Khách hàng 21');
    expect(screen.getByText('Trang 1 / 1')).toBeInTheDocument();
  });
  it('hides write actions for workers', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    render(<CustomerContactsView />);
    await screen.findByText('Khách hàng 1');
    expect(screen.queryByRole('button', { name: 'Thêm khách hàng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Khách hàng 1' })).not.toBeInTheDocument();
  });
});
