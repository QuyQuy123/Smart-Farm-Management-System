import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SalesInvoiceTemplate } from '../features/farmshift/SalesInvoiceTemplate';
import { getSalesInvoice } from '../services/salesCustomerService';
vi.mock('../services/salesCustomerService', () => ({ getSalesInvoice: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); });
it('displays server creation date, configured seller and database buyer without old labels', async () => {
 getSalesInvoice.mockResolvedValue({ createdDate: '2026-10-27', order: { code: 'SALE001', quantity: 10, totalWeight: 20, unitPrice: 50000, totalAmount: 1000000, paidAmount: 300000, debtAmount: 700000 }, seller: { name: 'Trang trại kiểm thử', taxCode: 'SELLER01', address: 'Địa chỉ bên bán', phone: '0981234567', fax: '0241234567', bankAccount: '0123456789' }, buyer: { name: 'Nguyễn Văn A', taxCode: 'BUYER01', address: 'Địa chỉ khách hàng', paymentMethod: 'Chuyển khoản' } });
 render(<SalesInvoiceTemplate orderId="order-1" />);
 expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
 expect(getSalesInvoice).toHaveBeenCalledWith('order-1');
 expect(screen.getByText('Trang trại kiểm thử')).toBeInTheDocument();
 expect(screen.getByText('0123456789')).toBeInTheDocument();
 expect(screen.getByText('BUYER01')).toBeInTheDocument();
 expect(screen.getByText('Chuyển khoản')).toBeInTheDocument();
 expect(screen.getByText('Ngày 27 tháng 10 năm 2026')).toBeInTheDocument();
 expect(screen.queryByText('Liên 1: Lưu')).not.toBeInTheDocument();
 expect(screen.queryByText('Tên đơn vị:')).not.toBeInTheDocument();
 expect(screen.getByText('Gà thịt')).toBeInTheDocument();
 expect(screen.getByText('Số lượng: 10 con')).toBeInTheDocument();
 expect(screen.getByText('50.000 đ')).toBeInTheDocument();
 expect(screen.getAllByText('1.000.000 đ')).toHaveLength(2);
 expect(screen.getAllByText('Số tài khoản:')).toHaveLength(1);
 expect(screen.getByText('SALE001')).toBeInTheDocument();
 expect(screen.getByText('Đã thanh toán:').parentElement).toHaveTextContent('300.000 đ');
 expect(screen.getByText('Còn nợ:').parentElement).toHaveTextContent('700.000 đ');
});
it('shows a retrieval error and supports retry', async () => {
 getSalesInvoice.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ createdDate: '2026-10-27', seller: {}, buyer: {} });
 render(<SalesInvoiceTemplate orderId="order-2" />);
 expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được thông tin hóa đơn');
 fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
 expect(await screen.findByRole('article', { name: 'Hóa đơn bán hàng' })).toBeInTheDocument();
});

it('prints the loaded invoice without refetching and removes the print copy afterward', async () => {
 const invoice = { createdDate: '2026-10-27', order: { code: 'SALE-PRINT', quantity: 10, totalWeight: 20, unitPrice: 50000, totalAmount: 1000000, paidAmount: 300000, debtAmount: 700000 }, seller: { name: 'Seller' }, buyer: { name: 'Buyer' } };
 getSalesInvoice.mockResolvedValue(invoice);
 const ref = React.createRef(), ready = vi.fn();
 const print = vi.spyOn(window, 'print').mockImplementation(() => {});
 try {
  render(<SalesInvoiceTemplate ref={ref} orderId="print-order" onReady={ready} />);
  act(() => ref.current.print());
  expect(print).not.toHaveBeenCalled();
  await screen.findByText('SALE-PRINT');
  expect(ready).toHaveBeenLastCalledWith(true);
  act(() => ref.current.print());
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  const copy = document.body.querySelector('[data-sales-invoice-print]');
  expect(copy).toHaveTextContent('SALE-PRINT');
  expect(copy).toHaveTextContent('700.000 đ');
  expect(copy.parentElement).toBe(document.body);
  expect(getSalesInvoice).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new Event('afterprint')));
  expect(document.body.querySelector('[data-sales-invoice-print]')).toBeNull();
 } finally { print.mockRestore(); }
});
