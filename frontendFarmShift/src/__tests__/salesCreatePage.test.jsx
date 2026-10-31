import React from 'react';
import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SalesView } from '../features/farmshift/SalesView';
import { extractWeightSlip, confirmWeightSlip } from '../services/weightSlipService';
import { createSalesOrder } from '../services/salesCustomerService';

vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children, actions }) => <main>{actions}{children}</main> }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'owner@test.local' } }) }));
vi.mock('../services/localSalesStorage', () => ({ readLocalSales: () => [] }));
vi.mock('../services/salesCustomerService', () => ({ listSalesCustomers: vi.fn(async () => []), listSalesOrders: vi.fn(async () => []), createSalesOrder: vi.fn(), updateSalesOrder: vi.fn() }));
vi.mock('../services/farmAreaService', () => ({ listBarns: async () => [{ id: 1, name: 'Chuồng A', areaName: 'Khu A' }] }));
vi.mock('../services/cycleService', () => ({ listCycles: async () => [{ id: 2, code: 'L000002' }] }));
vi.mock('../features/farmshift/SalesInvoiceTemplate', () => ({ SalesInvoiceTemplate: () => null }));
vi.mock('../services/weightSlipService', () => ({ extractWeightSlip: vi.fn(), confirmWeightSlip: vi.fn(), previewWeightSlip: vi.fn() }));
const objectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const revokeUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:weight-slip' });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
afterAll(() => {
  if (objectUrl) Object.defineProperty(URL, 'createObjectURL', objectUrl); else delete URL.createObjectURL;
  if (revokeUrl) Object.defineProperty(URL, 'revokeObjectURL', revokeUrl); else delete URL.revokeObjectURL;
});
beforeEach(() => {
  vi.clearAllMocks();
  extractWeightSlip.mockReset(); confirmWeightSlip.mockReset();
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

const ocrData = { isWeightSlip: true, customer: 'OCR Buyer', phone: '0912345678', address: 'Ha Noi', date: '2026-10-30',
  areaName: 'Khu A', barnName: 'Chuồng A', cycleCode: 'L000002', quantity: 100, totalWeight: 250, unitPrice: 60000, warnings: [], weighings: [] };
async function uploadSlip() {
  render(<MemoryRouter initialEntries={['/sales?tab=create']}><SalesView /></MemoryRouter>);
  const button = await screen.findByRole('button', { name: 'Bóc tách phiếu cân' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  const dialog = screen.getByRole('dialog', { name: 'Bóc tách phiếu cân' });
  const file = new File(['image'], 'phieu-can.png', { type: 'image/png' });
  fireEvent.change(within(dialog).getByLabelText('Tải ảnh hoặc PDF phiếu cân'), { target: { files: [file] } });
  return file;
}
it('reviews OCR beside the original, allows edits and confirms the document with the order', async () => {
  extractWeightSlip.mockResolvedValue(ocrData);
  confirmWeightSlip.mockImplementation(async body => ({ ...body, code: 'BH-OCR', totalAmount: body.totalWeight * body.unitPrice, weightSlipUrl: '/weigh-slips/test.png' }));
  const file = await uploadSlip();
  const buyer = await screen.findByDisplayValue('OCR Buyer');
  expect(screen.getByAltText('Ảnh phiếu cân gốc')).toHaveAttribute('src', 'blob:weight-slip');
  expect(createSalesOrder).not.toHaveBeenCalled();
  expect(confirmWeightSlip).not.toHaveBeenCalled();
  fireEvent.change(buyer, { target: { value: 'Buyer corrected' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận và lưu đơn bán' }));
  await waitFor(() => expect(confirmWeightSlip).toHaveBeenCalledWith(expect.objectContaining({ customer: 'Buyer corrected',
    quantity: 100, totalWeight: 250, unitPrice: 60000, status: 'DEBT', flock: 'Khu A - Chuồng A - L000002' }), file));
  await screen.findByText('BH-OCR');
  expect(screen.getByRole('link', { name: 'Xem phiếu cân BH-OCR' })).toHaveAttribute('href', '/weigh-slips/test.png');
});
it('keeps the editable OCR draft after a save failure and retries with the same order ID', async () => {
  extractWeightSlip.mockResolvedValue(ocrData);
  confirmWeightSlip.mockRejectedValueOnce(new Error('offline')).mockImplementation(async body => ({ ...body, code: 'BH-RETRY', totalAmount: body.totalWeight * body.unitPrice }));
  await uploadSlip(); await screen.findByDisplayValue('OCR Buyer');
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận và lưu đơn bán' }));
  await screen.findByRole('alert');
  expect(screen.getByDisplayValue('OCR Buyer')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận và lưu đơn bán' }));
  await screen.findByText('BH-RETRY');
  expect(confirmWeightSlip.mock.calls.at(-1)[0].id).toBe(confirmWeightSlip.mock.calls.at(-2)[0].id);
});
it('does not save when OCR fails', async () => {
  extractWeightSlip.mockRejectedValueOnce(new Error('OCR unavailable'));
  await uploadSlip();
  expect(await screen.findByRole('alert')).toHaveTextContent('OCR unavailable');
  expect(screen.getByRole('button', { name: 'Xác nhận và lưu đơn bán' })).toBeDisabled();
  expect(confirmWeightSlip).not.toHaveBeenCalled();
});
it('offers file upload when camera access is denied', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) } });
  try {
    render(<MemoryRouter initialEntries={['/sales?tab=create']}><SalesView /></MemoryRouter>);
    const button = await screen.findByRole('button', { name: 'Bóc tách phiếu cân' });
    await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
    fireEvent.click(screen.getByRole('tab', { name: 'Chụp ảnh trực tiếp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bật camera' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không mở được camera');
    expect(screen.getByRole('tab', { name: 'Tải file / Kéo thả' })).toBeEnabled();
  } finally {
    if (previous) Object.defineProperty(navigator, 'mediaDevices', previous); else delete navigator.mediaDevices;
  }
});
