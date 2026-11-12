import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CashbookView } from '../features/farmshift/CashbookView';
import * as cashbookService from '../services/cashbookService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_ACCOUNTANT', showToast: vi.fn() }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children, actions }) => <div>{actions}{children}</div> }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role, fullName: 'Trần Kế Toán' } }) }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../services/cashbookService', () => ({
  getCashbookSummary: vi.fn(),
  createCashFund: vi.fn(),
  updateCashFund: vi.fn(),
  deleteCashFund: vi.fn(),
  createCashTransaction: vi.fn(),
  updateCashTransaction: vi.fn(),
  deleteCashTransaction: vi.fn(),
  createCashFundTransfer: vi.fn()
}));

describe('CashbookView - Funds Management (FIN-07) & Payment Voucher Update (FIN-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    mocks.role = 'ROLE_ACCOUNTANT';
    cashbookService.getCashbookSummary.mockResolvedValue({
      totalRevenue: 10000000,
      totalExpense: 2500000,
      totalFundsBalance: 57500000,
      funds: [
        { id: 1, name: 'Quỹ Tiền Mặt', accountNo: '—', bank: 'Thủ quỹ', fundType: 'CASH', balance: 17500000, note: 'Chi tiêu hằng ngày', active: true },
        { id: 2, name: 'TK MB Bank', accountNo: '0987654321', bank: 'MB Bank', fundType: 'BANK', balance: 40000000, note: 'Tài khoản chính', active: true }
      ],
      transactions: [
        { id: 101, code: 'PC000099', date: '2026-10-15', type: 'Chi', category: 'Tiền lương công nhân', amount: 2500000, contact: 'Nhân sự', name: 'Nguyễn Văn Ba', fundId: 1, fund: 'Quỹ Tiền Mặt', creator: 'Trần Kế Toán', note: 'Ứng lương' }
      ],
      transfers: [
        { id: 201, code: 'CQ000010', date: '2026-10-12', from: 'TK MB Bank', to: 'Quỹ Tiền Mặt', amount: 5000000, fee: 0, note: 'Rút quỹ', creator: 'Trần Kế Toán' }
      ]
    });
    cashbookService.createCashFund.mockResolvedValue({ id: 3, name: 'Quỹ Agribank' });
    cashbookService.updateCashFund.mockResolvedValue({ id: 1, name: 'Quỹ Tiền Mặt Sửa' });
    cashbookService.deleteCashFund.mockResolvedValue(undefined);
    cashbookService.updateCashTransaction.mockResolvedValue({ id: 101, code: 'PC000099' });
    cashbookService.deleteCashTransaction.mockResolvedValue(undefined);
  });

  it('edits an existing payment voucher (FIN-08) and deletes a voucher', async () => {
    render(<MemoryRouter><CashbookView /></MemoryRouter>);
    await screen.findByText('PC000099');

    fireEvent.click(screen.getByRole('button', { name: 'Sửa phiếu PC000099' }));
    expect(await screen.findByText('Cập nhật phiếu chi')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Số tiền/i), { target: { value: '3000000' } });
    fireEvent.change(screen.getByLabelText(/Họ tên người nộp\/nhận/i), { target: { value: 'Nguyễn Văn Ba (Sửa)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cập nhật' }));

    await waitFor(() => expect(cashbookService.updateCashTransaction).toHaveBeenCalledWith(101, expect.objectContaining({
      type: 'Chi',
      amount: 3000000,
      name: 'Nguyễn Văn Ba (Sửa)',
      fundId: 1
    })));
    expect(mocks.showToast).toHaveBeenCalledWith('Đã cập nhật phiếu thu / chi và số dư quỹ.', 'success');

    fireEvent.click(screen.getByRole('button', { name: 'Xóa phiếu PC000099' }));
    await waitFor(() => expect(cashbookService.deleteCashTransaction).toHaveBeenCalledWith(101));
  });

  it('creates, updates and deletes cash funds in tab Nguồn quỹ tiền (FIN-07)', async () => {
    render(<MemoryRouter><CashbookView /></MemoryRouter>);
    await screen.findByText('PC000099');

    fireEvent.click(screen.getByRole('button', { name: /Nguồn quỹ tiền/i }));
    await screen.findByText('Quỹ Tiền Mặt');

    // Create new fund
    fireEvent.click(screen.getByRole('button', { name: /Thêm nguồn quỹ/i }));
    fireEvent.change(screen.getByLabelText(/Tên nguồn quỹ/i), { target: { value: 'Quỹ Agribank' } });
    fireEvent.change(screen.getByLabelText(/Ngân hàng \/ Đơn vị/i), { target: { value: 'Agribank' } });
    fireEvent.change(screen.getByLabelText(/Số tài khoản/i), { target: { value: '1500205999' } });
    fireEvent.change(screen.getByLabelText(/Số dư hiện tại/i), { target: { value: '12000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nguồn quỹ' }));

    await waitFor(() => expect(cashbookService.createCashFund).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Quỹ Agribank',
      bank: 'Agribank',
      accountNo: '1500205999',
      balance: 12000000
    })));

    // Edit existing fund
    fireEvent.click(screen.getByRole('button', { name: 'Sửa nguồn quỹ TK MB Bank' }));
    fireEvent.change(screen.getByLabelText(/Tên nguồn quỹ/i), { target: { value: 'TK MB Bank Chính' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nguồn quỹ' }));
    await waitFor(() => expect(cashbookService.updateCashFund).toHaveBeenCalledWith(2, expect.objectContaining({
      name: 'TK MB Bank Chính'
    })));

    // Delete fund
    fireEvent.click(screen.getByRole('button', { name: 'Xóa nguồn quỹ TK MB Bank' }));
    await waitFor(() => expect(cashbookService.deleteCashFund).toHaveBeenCalledWith(2));
  });
});

