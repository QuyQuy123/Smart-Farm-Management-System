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
  createCashFundTransfer: vi.fn(),
  createCostAllocation: vi.fn(),
  updateCostAllocation: vi.fn(),
  deleteCostAllocation: vi.fn(),
  createFarmAsset: vi.fn(),
  updateFarmAsset: vi.fn(),
  deleteFarmAsset: vi.fn(),
  createPayroll: vi.fn(),
  updatePayroll: vi.fn(),
  payPayroll: vi.fn(),
  deletePayroll: vi.fn(),
  createCashCategory: vi.fn(),
  updateCashCategory: vi.fn(),
  deleteCashCategory: vi.fn()
}));

describe('CashbookView - Funds, Vouchers, Assets, Payroll & Categories', () => {
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
      ],
      costAllocations: [
        { id: 10, code: 'PB0001', cycleId: null, house: 'Nhà A1', cycle: 'LUA-01', type: 'Điện năng', amount: 1500000, source: 'PC000099', date: '2026-10-15', notes: 'Tiền điện' }
      ],
      assets: [
        { id: 30, code: 'TS0001', name: 'Quạt hút 1.2kW', cost: 24000000, months: 24, monthlyDep: 1000000, house: 'Nhà A1', purchaseDate: '2026-10-01', status: 'Đang trích khấu hao', note: '' }
      ],
      payrolls: [
        { id: 20, code: 'CC0002', accountId: null, employee: 'Trần Văn Bình', period: '2026-10', days: 25, rate: 350000, bonus: 800000, advance: 1500000, total: 9550000, paid: 5000000, remain: 3050000, status: 'Còn nợ lương', note: '' }
      ],
      categories: [
        { id: 1, name: 'Đơn bán gà', type: 'Thu', group: 'Doanh thu chính', note: '' },
        { id: 2, name: 'Tiền lương công nhân', type: 'Chi', group: 'Chi phí nhân công', note: '' }
      ],
      staffOptions: [
        { id: 5, fullName: 'Trần Văn Bình', role: 'ROLE_FARM_WORKER' }
      ],
      cycleOptions: []
    });
    cashbookService.createCashFund.mockResolvedValue({ id: 3, name: 'Quỹ Agribank' });
    cashbookService.updateCashFund.mockResolvedValue({ id: 1, name: 'Quỹ Tiền Mặt Sửa' });
    cashbookService.deleteCashFund.mockResolvedValue(undefined);
    cashbookService.updateCashTransaction.mockResolvedValue({ id: 101, code: 'PC000099' });
    cashbookService.deleteCashTransaction.mockResolvedValue(undefined);
    cashbookService.createFarmAsset.mockResolvedValue({ id: 31, code: 'TS0002' });
    cashbookService.payPayroll.mockResolvedValue({ id: 20, code: 'CC0002', status: 'Đã thanh toán' });
    cashbookService.createCashCategory.mockResolvedValue({ id: 3, name: 'Chi phí bảo trì' });
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

  it('locks auto-generated vouchers linked to source documents from direct edit/delete', async () => {
    const base = await cashbookService.getCashbookSummary();
    cashbookService.getCashbookSummary.mockResolvedValue({
      ...base,
      transactions: [
        ...base.transactions,
        { id: 102, code: 'PT000003', date: '2026-11-08', type: 'Thu', category: 'Đơn bán gà', amount: 200000000, contact: 'Khách hàng', name: 'Nguyễn Văn Hùng', fundId: 2, fund: 'TK MB Bank', creator: 'Trần Kế Toán', note: 'Thu tiền đơn bán gà BH00001', referenceInvoiceCode: 'BH00001' }
      ]
    });
    render(<MemoryRouter><CashbookView /></MemoryRouter>);
    await screen.findByText('PT000003');

    expect(screen.getByRole('button', { name: 'Sửa phiếu PC000099' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa phiếu PT000003' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa phiếu PT000003' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Phiếu PT000003 liên kết chứng từ BH00001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem phiếu PT000003' }));
    expect(await screen.findByText(/phiếu tự động — chỉnh sửa tại chứng từ gốc/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Chỉnh sửa/i })).not.toBeInTheDocument();
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

  it('adds a fixed asset in Tài sản & Khấu hao, disburses payroll atomically in Tiền công nhân viên, and adds a cash category', async () => {
    render(<MemoryRouter><CashbookView /></MemoryRouter>);
    await screen.findByText('PC000099');

    // Assets tab
    fireEvent.click(screen.getByRole('button', { name: /Tài sản & Khấu hao/i }));
    await screen.findByText('Quạt hút 1.2kW');
    fireEvent.click(screen.getByRole('button', { name: /Thêm tài sản/i }));
    fireEvent.change(screen.getByLabelText(/Tên tài sản/i), { target: { value: 'Máy phát điện 15kVA' } });
    fireEvent.change(screen.getByLabelText(/Nguyên giá/i), { target: { value: '60000000' } });
    fireEvent.change(screen.getByLabelText(/Số tháng khấu hao/i), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tài sản' }));

    await waitFor(() => expect(cashbookService.createFarmAsset).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Máy phát điện 15kVA',
      cost: 60000000,
      depreciationMonths: 60
    })));

    // Payroll disbursement tab
    fireEvent.click(screen.getByRole('button', { name: /Tiền công nhân viên/i }));
    await screen.findByText('Trần Văn Bình');
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lương CC0002' }));
    expect(await screen.findByText(/Chi trả lương · Trần Văn Bình/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chi lương' }));

    await waitFor(() => expect(cashbookService.payPayroll).toHaveBeenCalledWith(20, expect.objectContaining({
      amount: 3050000,
      cashFundId: 1
    })));

    // Categories tab
    fireEvent.click(screen.getByRole('button', { name: /Loại phiếu thu \/ chi/i }));
    await screen.findByText('Đơn bán gà');
    fireEvent.click(screen.getByRole('button', { name: /Thêm loại phiếu/i }));
    fireEvent.change(screen.getByLabelText(/Tên loại giao dịch/i), { target: { value: 'Chi phí bảo trì' } });
    fireEvent.change(screen.getByLabelText(/Nhóm chi phí/i), { target: { value: 'Chi phí vận hành' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại phiếu' }));

    await waitFor(() => expect(cashbookService.createCashCategory).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Chi phí bảo trì',
      costGroup: 'Chi phí vận hành'
    })));
  });
});

