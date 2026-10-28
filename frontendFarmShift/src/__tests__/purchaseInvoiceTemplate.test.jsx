import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { PurchaseInvoiceTemplate } from '../features/farmshift/PurchaseInvoiceTemplate';
const order = { code: 'NH-TEST', supplier: 'Nhà cung cấp A', date: '2026-10-20', importedDate: '2026-10-21', stockStatus: 'Đã nhập kho', paymentStatus: 'Thanh toán một phần', referenceCode: 'REF-01', note: 'Đã chuyển khoản', tags: ['Cám'], discountAmount: 10000, otherCost: 5000, totalAmount: 195000, paidAmount: 50000, debtAmount: 145000, items: [{ id: 1, name: 'Cám A', qty: 2, unit: 'Bao', price: 50000, amount: 100000 }, { id: 2, name: 'Thuốc B', qty: 1, unit: 'Chai', price: 100000, amount: 100000 }] };
it('keeps all purchase details and exact stored totals in the document layout', () => {
 render(<PurchaseInvoiceTemplate order={order} supplier={{ address: 'Địa chỉ NCC', phone: '0981234567' }} />);
 expect(screen.getByRole('article', { name: 'Hóa đơn nhập hàng' })).toBeInTheDocument();
 for (const text of ['NH-TEST','Nhà cung cấp A','Ngày 20 tháng 10 năm 2026','Địa chỉ NCC','21/10/2026','REF-01','Đã chuyển khoản','Cám','Cám A','Thuốc B','Thanh toán một phần','Đã nhập kho']) expect(screen.getByText(text)).toBeInTheDocument();
 expect(screen.getByText('195.000 đ')).toBeInTheDocument();
 expect(screen.getByText('145.000 đ')).toBeInTheDocument();
 expect(screen.getByText('Đã thanh toán:').parentElement).toHaveTextContent('50.000 đ');
 expect(screen.getByText('Chiết khấu:').parentElement).toHaveTextContent('10.000 đ');
 expect(screen.getByText('Chi phí khác:').parentElement).toHaveTextContent('5.000 đ');
});
it('prints the same purchase document and removes the isolated print copy afterward', async () => {
 const ref = React.createRef();
 const print = vi.spyOn(window, 'print').mockImplementation(() => {});
 try {
  render(<PurchaseInvoiceTemplate ref={ref} order={order} />);
  act(() => ref.current.print());
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  const copy = document.body.querySelector('[data-purchase-invoice-print]');
  expect(copy).toHaveTextContent('NH-TEST'); expect(copy).toHaveTextContent('145.000 đ');
  expect(copy.parentElement).toBe(document.body);
  act(() => window.dispatchEvent(new Event('afterprint')));
  expect(document.body.querySelector('[data-purchase-invoice-print]')).toBeNull();
 } finally { print.mockRestore(); }
});
