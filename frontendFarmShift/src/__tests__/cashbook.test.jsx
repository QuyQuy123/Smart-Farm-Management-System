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

describe('CashbookView - Single-Fund Auto-Synced Ledger, Assets, Payroll & Categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    mocks.role = 'ROLE_ACCOUNTANT';
    cashbookService.getCashbookSummary.mockResolvedValue({
      totalRevenue: 200000000,
      totalExpense: 12500000,
      totalFundsBalance: 187500000,
      funds: [
        { id: 1, name: 'Quỹ trang trại', accountNo: '0987654321', bank: 'MB Bank & Quỹ tiền mặt trại', fundType: 'BANK', balance: 187500000, note: 'Quỹ tập trung toàn trang trại', active: true }
      ],
      transactions: [
        { id: 102, code: 'PT000002', date: '2026-11-08', type: 'Thu', category: 'Đơn bán gà', amount: 200000000, contact: 'Khách hàng', name: 'Nguyễn Văn Hùng', fundId: 1, fund: 'Quỹ trang trại', creator: 'Trần Kế Toán', note: 'Thu tiền đơn bán gà BH00001', referenceInvoiceCode: 'BH00001' },
        { id: 101, code: 'PC000005', date: '2026-10-15', type: 'Chi', category: 'Tiền lương công nhân', amount: 12500000, contact: 'Nhân sự', name: 'Nguyễn Văn Ba', fundId: 1, fund: 'Quỹ trang trại', creator: 'Trần Kế Toán', note: 'Trả lương CC0001', referenceInvoiceCode: 'CC0001' }
      ],
      transfers: [],
      costAllocations: [
        { id: 10, code: 'PB0001', cycleId: null, house: 'Nhà A1', cycle: 'LUA-01', type: 'Điện năng', amount: 1500000, source: 'PC000010', date: '2026-10-15', notes: 'Tiền điện' }
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
    cashbookService.createCashFund.mockResolvedValue({ id: 2, name: 'Quỹ trang trại' });
    cashbookService.updateCashFund.mockResolvedValue({ id: 1, name: 'Quỹ trang trại cập nhật' });
    cashbookService.deleteCashFund.mockResolvedValue(undefined);
    cashbookService.createFarmAsset.mockResolvedValue({ id: 31, code: 'TS0002' });
    cashbookService.payPayroll.mockResolvedValue({ id: 20, code: 'CC0002', status: 'Đã thanh toán' });
    cashbookService.createCashCategory.mockResolvedValue({ id: 3, name: 'Chi phí bảo trì' });
  });

  it('displays auto-synced ledger without manual voucher creation or internal fund transfer controls', async () => {
    render(<MemoryRouter><CashbookView /></MemoryRouter>);
    await screen.findByText('PT000002');
    expect(screen.getByText('PC000005')).toBeInTheDocument();

    // No manual receipt/payment buttons or internal fund transfer tab/button
    expect(screen.queryByRole('button', { name: /Lập phiếu thu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lập phiếu chi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Chuyển quỹ nội bộ/i })).not.toBeInTheDocument();

    // Single fund mode hides redundant fund filter dropdown
    expect(screen.queryByLabelText('Lọc theo nguồn quỹ')).not.toBeInTheDocument();

    // Synced vouchers are view-only in Cashbook and link back to their source document
    expect(screen.queryByRole('button', { name: /Sửa phiếu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xóa phiếu/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Phiếu PT000002 liên kết chứng từ BH00001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem phiếu PT000002' }));
    expect(await screen.findByText(/phiếu tự động — chỉnh sửa tại chứng từ gốc/i)).toBeInTheDocument();
  });

  it('edits single farm fund metadata in Nguồn quỹ tiền without exposing delete or extra fund creation', async () => {
    render(<MemoryRouter><CashbookView /></MemoryRouter>);
    await screen.findByText('PT000002');

    fireEvent.click(screen.getByRole('button', { name: /Nguồn quỹ tiền/i }));
    expect(await screen.findByRole('button', { name: 'Sửa nguồn quỹ Quỹ trang trại' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm nguồn quỹ/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa nguồn quỹ Quỹ trang trại' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sửa nguồn quỹ Quỹ trang trại' }));
    fireEvent.change(screen.getByLabelText(/Ngân hàng \/ Đơn vị/i), { target: { value: 'MB Bank & Két sắt trại' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nguồn quỹ' }));
    await waitFor(() => expect(cashbookService.updateCashFund).toHaveBeenCalledWith(1, expect.objectContaining({
      name: 'Quỹ trang trại',
      bank: 'MB Bank & Két sắt trại'
    })));
  });

  it('adds a fixed asset in Tài sản & Khấu hao, disburses payroll automatically from Quỹ trang trại, and adds a cash category', async () => {
    render(<MemoryRouter><CashbookView /></MemoryRouter>);
    await screen.findByText('PT000002');

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

    // Payroll disbursement tab uses single Quỹ trang trại read-only display
    fireEvent.click(screen.getByRole('button', { name: /Tiền công nhân viên/i }));
    await screen.findByText('Trần Văn Bình');
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lương CC0002' }));
    expect(await screen.findByText(/Chi trả lương · Trần Văn Bình/i)).toBeInTheDocument();
    expect(screen.getByText(/Quỹ trang trại \(187\.500\.000 đ\)/)).toBeInTheDocument();
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

  it('falls back to ledger tab on deprecated ?tab=transfers and honors ?type=Thu query filter', async () => {
    render(
      <MemoryRouter initialEntries={['/cashbook?tab=transfers&type=Thu']}>
        <CashbookView />
      </MemoryRouter>
    );

    await waitFor(() => expect(cashbookService.getCashbookSummary).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Thu' })
    ));
    expect(await screen.findByText('Nguyễn Văn Hùng')).toBeInTheDocument();
    expect(screen.getByText('PT000002')).toBeInTheDocument();
    expect(screen.getByText(/Đồng bộ tự động:/i)).toBeInTheDocument();
  });
});

