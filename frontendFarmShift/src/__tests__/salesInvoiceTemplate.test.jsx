import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SalesInvoiceTemplate } from '../features/farmshift/SalesInvoiceTemplate';
import { getSalesInvoice } from '../services/salesCustomerService';
vi.mock('../services/salesCustomerService', () => ({ getSalesInvoice: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); });
it('displays server creation date, configured seller and database buyer without old labels', async () => {
 getSalesInvoice.mockResolvedValue({ createdDate: '2026-10-27', seller: { name: 'Trang trại kiểm thử', taxCode: 'SELLER01', address: 'Địa chỉ bên bán', phone: '0981234567', fax: '0241234567', bankAccount: '0123456789' }, buyer: { name: 'Nguyễn Văn A', taxCode: 'BUYER01', address: 'Địa chỉ khách hàng', paymentMethod: 'Chuyển khoản' } });
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
});
it('shows a retrieval error and supports retry', async () => {
 getSalesInvoice.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ createdDate: '2026-10-27', seller: {}, buyer: {} });
 render(<SalesInvoiceTemplate orderId="order-2" />);
 expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được thông tin hóa đơn');
 fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
 expect(await screen.findByRole('article', { name: 'Hóa đơn bán hàng' })).toBeInTheDocument();
});
