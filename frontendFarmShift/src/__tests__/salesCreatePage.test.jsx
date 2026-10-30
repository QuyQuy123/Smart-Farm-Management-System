import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SalesView } from '../features/farmshift/SalesView';
import { createSalesOrder } from '../services/salesCustomerService';

vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children, actions }) => <main>{actions}{children}</main> }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'owner@test.local' } }) }));
vi.mock('../services/localSalesStorage', () => ({ readLocalSales: () => [] }));
vi.mock('../services/salesCustomerService', () => ({ listSalesCustomers: vi.fn(async () => []), listSalesOrders: vi.fn(async () => []), createSalesOrder: vi.fn(), updateSalesOrder: vi.fn() }));
vi.mock('../services/farmAreaService', () => ({ listBarns: async () => [{ id: 1, name: 'Chuồng A', areaName: 'Khu A' }] }));
vi.mock('../services/cycleService', () => ({ listCycles: async () => [{ id: 2, code: 'L000002' }] }));
vi.mock('../features/farmshift/SalesInvoiceTemplate', () => ({ SalesInvoiceTemplate: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  createSalesOrder.mockImplementation(async body => ({ ...body, code: 'BH001', totalAmount: 1000 }));
});

it('opens the create form as page content and returns to the order list after saving', async () => {
  render(<MemoryRouter initialEntries={['/sales']}><SalesView /></MemoryRouter>);
  expect(screen.getAllByRole('button', { name: 'Tạo đơn bán hàng' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đơn bán hàng' }));
  const form = await screen.findByRole('region', { name: 'Tạo đơn bán hàng' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await within(form).findByRole('option', { name: 'Khu A - Chuồng A - L000002' });
  fireEvent.change(within(form).getAllByRole('textbox')[0], { target: { value: 'Người mua mới' } });
  fireEvent.change(within(form).getByLabelText(/Số điện thoại/), { target: { value: '0912345678' } });
  fireEvent.change(within(form).getByLabelText(/Địa chỉ/), { target: { value: 'Hà Nội' } });
  fireEvent.change(within(form).getAllByRole('combobox')[0], { target: { value: '2' } });
  fireEvent.change(within(form).getByPlaceholderText('VD: 1000'), { target: { value: '10' } });
  fireEvent.change(within(form).getByPlaceholderText('VD: 2150'), { target: { value: '20' } });
  fireEvent.change(within(form).getByPlaceholderText('VD: 78.000'), { target: { value: '50000' } });
  fireEvent.click(within(form).getByRole('button', { name: 'Lưu đơn bán' }));
  await waitFor(() => expect(createSalesOrder).toHaveBeenCalledWith(expect.objectContaining({ customer: 'Người mua mới', quantity: 10, totalWeight: 20, unitPrice: 50000 })));
  await screen.findByText('BH001');
  expect(screen.queryByRole('region', { name: 'Tạo đơn bán hàng' })).not.toBeInTheDocument();
});

it('supports a direct link to the create tab and cancellation without saving', async () => {
  render(<MemoryRouter initialEntries={['/sales?tab=create']}><SalesView /></MemoryRouter>);
  const form = await screen.findByRole('region', { name: 'Tạo đơn bán hàng' });
  fireEvent.click(within(form).getByRole('button', { name: 'Hủy' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Tạo đơn bán hàng' })).not.toBeInTheDocument());
  expect(createSalesOrder).not.toHaveBeenCalled();
});
