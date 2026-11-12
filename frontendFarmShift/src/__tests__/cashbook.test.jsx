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
  createCostAllocation: vi.fn(),
  updateCostAllocation: vi.fn(),
  deleteCostAllocation: vi.fn(),
  createFarmAsset: vi.fn(),
  updateFarmAsset: vi.fn(),
  deleteFarmAsset: vi.fn(),
  createPayroll: vi.fn(),
  updatePayroll: vi.fn(),
  payPayroll: vi.fn(),
  deletePayroll: vi.fn()
}));

describe('CashbookView - Single-Fund Auto-Synced Ledger, Assets & Payroll', () => {
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
        { id: 101, code: 'PC000005', date: '2026-10-15', type: 'Chi', category: 'Tiền lương công nhân', amount: 12500000, contact: 'Nhân sự', name: 'Nguyễn Văn Ba', fundId: 1, fund: 'Quỹ trang trại', creator: 'Trần Kế Toán', note: 'Trả lương CC0001', referenceInvoiceCode: 'CC0001' },
        { id: 100, code: 'PT000001', date: '2026-01-01', type: 'Thu', category: 'Nạp vốn / Góp vốn', amount: 1800000000, contact: 'Chủ trang trại', name: 'Chủ trang trại', fundId: 1, fund: 'Quỹ trang trại', creator: 'Admin', note: 'Góp vốn lưu động đầu năm', referenceInvoiceCode: null }
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
        { id: 3, name: 'Nạp vốn / Góp vốn', type: 'Thu', group: 'Vốn chủ sở hữu', note: '' },
        { id: 2, name: 'Tiền lương công nhân', type: 'Chi', group: 'Chi phí nhân công', note: '' },
        { id: 4, name: 'Rút vốn', type: 'Chi', group: 'Vốn chủ sở hữu', note: '' }
      ],
      staffOptions: [
        { id: 5, fullName: 'Trần Văn Bình', role: 'ROLE_FARM_WORKER' }
      ],
      cycleOptions: []
    });
    cashbookService.createCashFund.mockResolvedValue({ id: 2, name: 'Quỹ trang trại' });
    cashbookService.updateCashFund.mockResolvedValue({ id: 1, name: 'Quỹ trang trại cập nhật' });
    cashbookService.deleteCashFund.mockResolvedValue(undefined);
    cashbookService.createCashTransaction.mockResolvedValue({ id: 103, code: 'PT000003' });
    cashbookService.updateCashTransaction.mockResolvedValue({ id: 100, code: 'PT000001' });
    cashbookService.deleteCashTransaction.mockResolvedValue(undefined);
    cashbookService.createFarmAsset.mockResolvedValue({ id: 31, code: 'TS0002' });
    cashbookService.payPayroll.mockResolvedValue({ id: 20, code: 'CC0002', status: 'Đã thanh toán' });
  });

  it('keeps synced vouchers read-only while allowing manual capital deposit/withdrawal vouchers without internal transfers', async () => {
    render(<MemoryRouter><CashbookView /></MemoryRouter>);
    await screen.findByText('PT000002');
    expect(screen.getByText('PC000005')).toBeInTheDocument();
    expect(screen.getByText('PT000001')).toBeInTheDocument();

    // No internal fund transfer control or obsolete categories management tab in single-fund mode
    expect(screen.queryByRole('button', { name: /Chuyển quỹ nội bộ/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Loại phiếu thu \/ chi/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lập phiếu thu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lập phiếu chi/i })).toBeInTheDocument();

    // Single fund mode hides redundant fund filter dropdown
    expect(screen.queryByLabelText('Lọc theo nguồn quỹ')).not.toBeInTheDocument();

    // Auto-synced vouchers remain view-only in Cashbook, whereas manual vouchers can be edited/deleted
    expect(screen.queryByRole('button', { name: 'Sửa phiếu PT000002' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa phiếu PT000002' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa phiếu PT000001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa phiếu PT000001' })).toBeInTheDocument();

    expect(screen.getByRole('columnheader', { name: 'Chứng từ gốc' })).toBeInTheDocument();
    const refControl = screen.getByLabelText('Phiếu PT000002 liên kết chứng từ BH00001');
    const actionBtn = screen.getByRole('button', { name: 'Xem phiếu PT000002' });
    expect(refControl.closest('td')).not.toBe(actionBtn.closest('td'));

    fireEvent.click(actionBtn);
    expect(await screen.findByText(/phiếu tự động — chỉnh sửa tại chứng từ gốc/i)).toBeInTheDocument();
    expect(screen.getByText('08/11/2026')).toBeInTheDocument();
    expect(screen.getByText('Đối tượng giao dịch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mở đơn bán hàng/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chi tiết phiếu' }));

    // Create a capital deposit voucher directly via Lập phiếu thu (defaults cleanly to Nạp vốn / Góp vốn)
    fireEvent.click(screen.getByRole('button', { name: /Lập phiếu thu/i }));
    expect(screen.getByLabelText(/Loại thu \/ chi/i).value).toBe('Nạp vốn / Góp vốn');
    fireEvent.change(screen.getByLabelText(/Số tiền \(đ\)/i), { target: { value: '50000000' } });
    fireEvent.change(screen.getByLabelText(/Người nộp \/ nhận/i), { target: { value: 'Chủ trang trại' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiếu thu' }));

    await waitFor(() => expect(cashbookService.createCashTransaction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'Thu',
      category: 'Nạp vốn / Góp vốn',
      name: 'Chủ trang trại',
      amount: 50000000,
      fundId: 1
    })));
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

  it('adds a fixed asset in Tài sản & Khấu hao and disburses payroll automatically from Quỹ trang trại', async () => {
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
  });

  it('falls back to ledger tab on deprecated ?tab=transfers or ?tab=categories and honors ?type=Thu query filter', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/cashbook?tab=transfers&type=Thu']}>
        <CashbookView />
      </MemoryRouter>
    );

    await waitFor(() => expect(cashbookService.getCashbookSummary).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Thu' })
    ));
    expect(await screen.findByText('Nguyễn Văn Hùng')).toBeInTheDocument();
    expect(screen.getByText('PT000002')).toBeInTheDocument();
    expect(screen.getByLabelText('Lọc loại phiếu').value).toBe('Thu');
    expect(screen.queryByText(/Đồng bộ tự động:/i)).not.toBeInTheDocument();

    unmount();
    render(
      <MemoryRouter initialEntries={['/cashbook?tab=categories']}>
        <CashbookView />
      </MemoryRouter>
    );
    await waitFor(() => expect(cashbookService.getCashbookSummary).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ALL' })
    ));
    expect(await screen.findByText('Nguyễn Văn Hùng')).toBeInTheDocument();
    expect(screen.getByText('PT000002')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sổ quỹ thu chi/i })).toHaveClass('active');
  });

  it('paginates long ledger lists cleanly when transactions exceed page size', async () => {
    const manyTx = Array.from({ length: 22 }, (_, i) => ({
      id: 1000 - i,
      code: `PC${String(22 - i).padStart(6, '0')}`,
      date: '2026-11-10',
      type: 'Chi',
      category: 'Tiền thức ăn (Cám)',
      amount: 1000000,
      contact: 'Nhà cung cấp',
      name: `NCC Test ${22 - i}`,
      fundId: 1,
      fund: 'Quỹ trang trại',
      creator: 'Trần Kế Toán',
      note: `Giao dịch thứ ${22 - i}`,
      referenceInvoiceCode: `NH${String(22 - i).padStart(6, '0')}`
    }));

    cashbookService.getCashbookSummary.mockResolvedValueOnce({
      totalRevenue: 0,
      totalExpense: 22000000,
      totalFundsBalance: 0,
      funds: [
        { id: 1, name: 'Quỹ trang trại', accountNo: '0987654321', bank: 'MB Bank & Quỹ tiền mặt trại', fundType: 'BANK', balance: 0, note: '', active: true }
      ],
      transactions: manyTx,
      transfers: [],
      costAllocations: [],
      assets: [],
      payrolls: [],
      categories: [],
      staffOptions: [],
      cycleOptions: []
    });

    render(<MemoryRouter><CashbookView /></MemoryRouter>);
    await screen.findByText('PC000022');
    expect(screen.queryByText('PC000007')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau phiếu' }));
    expect(await screen.findByText('PC000007')).toBeInTheDocument();
    expect(screen.queryByText('PC000022')).not.toBeInTheDocument();
  });
});

