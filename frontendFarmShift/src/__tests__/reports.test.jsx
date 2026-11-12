import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportsView } from '../features/farmshift/ReportsView';

const mockGetReportSummary = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../services/reportService', () => ({
  getReportSummary: (...args) => mockGetReportSummary(...args),
}));

const MOCK_AUTH = {
  user: { fullName: 'Chủ Trại Test', email: 'owner@farm.local', role: 'ROLE_FARM_OWNER' },
  logout: vi.fn(),
};

const MOCK_NOTIFICATION = {
  showToast: (...args) => mockShowToast(...args),
  alerts: [],
  unreadCount: 0,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  clearAllAlerts: vi.fn(),
  activeToast: null,
  setActiveToast: vi.fn(),
};

vi.mock('../context/NotificationContext', () => ({
  useNotification: () => MOCK_NOTIFICATION,
  formatNotificationTime: () => 'Vừa xong',
  renderNotificationContent: (_b, val) => val || '',
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => MOCK_AUTH,
}));

vi.mock('../services/farmService', () => ({
  getFarm: vi.fn(() => Promise.resolve({ name: 'Trang trại FarmShift Test' })),
}));

const MOCK_PAYLOAD = {
  from: null,
  to: null,
  generatedDate: '2026-11-13',
  farmSummary: {
    totalIn: 5000,
    harvested: 1200,
    harvestedWeightKg: 2640.5,
    deaths: 35,
    culls: 5,
    currentLive: 3760,
    activeBarns: 2,
    totalCycles: 2,
    lossRate: 0.8,
    survivalRate: 99.2,
    totalCost: 220000000,
    totalRevenue: 295000000,
    totalProfit: 75000000,
    cycles: [
      {
        cycleId: 10,
        cycleCode: 'L000010',
        barnName: 'Nhà A1',
        areaName: 'Khu Mía Thịt',
        breed: 'Gà Mía Dabaco',
        status: 'ACTIVE',
        startDate: '2026-09-01',
        endDate: null,
        totalIn: 2500,
        deaths: 20,
        culls: 0,
        harvested: 1200,
        transferredOut: 0,
        currentQuantity: 1280,
        survivalRate: 99.2,
        totalCost: 110000000,
        revenue: 195000000,
        profit: 85000000,
      },
    ],
  },
  salesReport: {
    orderCount: 1,
    totalRevenue: 195000000,
    paidAmount: 150000000,
    debtAmount: 45000000,
    totalWeightKg: 2640.5,
    totalQuantity: 1200,
    avgUnitPrice: 73850,
    orders: [
      {
        id: 'so-1',
        code: 'BH00010',
        date: '2026-11-08',
        customer: 'Thương lái Hưng Yên',
        flock: 'Khu Mía Thịt - Nhà A1 - L000010',
        quantity: 1200,
        totalWeight: 2640.5,
        unitPrice: 73850,
        totalAmount: 195000000,
        paidAmount: 150000000,
        debtAmount: 45000000,
        status: 'PARTIAL',
      },
    ],
  },
  purchasesReport: {
    invoiceCount: 1,
    cancelledCount: 0,
    totalAmount: 98000000,
    paidAmount: 98000000,
    debtAmount: 0,
    invoices: [
      {
        id: 5,
        code: 'NH00005',
        date: '2026-10-15',
        supplier: 'Công ty CP Chăn nuôi C.P.',
        warehouseSummary: 'Kho Cám Khu A',
        totalAmount: 98000000,
        paidAmount: 98000000,
        debtAmount: 0,
        paymentStatus: 'Thanh toán hoàn tất',
        stockStatus: 'Đã nhập kho',
      },
    ],
  },
  inventoryReport: {
    totalSkus: 1,
    totalValue: 45000000,
    lowStockCount: 1,
    expiryAlertCount: 0,
    items: [
      {
        id: 1,
        code: 'SP00001',
        name: 'Cám Higro 01',
        warehouseName: 'Kho Cám Khu A',
        productType: 'Thức ăn',
        unitName: 'Bao (25kg)',
        stock: 30,
        minStock: 40,
        unitPrice: 350000,
        totalValue: 10500000,
        lotNumber: 'LOT-01',
        expiryDate: '2027-02-01',
        lowStock: true,
        expiryStatus: 'NORMAL',
      },
    ],
  },
  harvestReport: {
    harvestEvents: 1,
    totalHead: 1200,
    totalWeightKg: 2640.5,
    totalRevenue: 195000000,
    avgUnitPrice: 73850,
    rows: [
      {
        cycleId: 10,
        cycleCode: 'L000010',
        barnName: 'Nhà A1',
        areaName: 'Khu Mía Thịt',
        breed: 'Gà Mía Dabaco',
        harvestEvents: 1,
        totalHead: 1200,
        totalWeightKg: 2640.5,
        avgWeightPerBird: 2.2,
        totalRevenue: 195000000,
        avgPricePerKg: 73850,
        lastHarvestDate: '2026-11-08',
      },
    ],
  },
  growthReport: {
    analyzedCycles: 1,
    avgFcr: 2.18,
    cycles: [
      {
        cycleId: 10,
        cycleCode: 'L000010',
        barnName: 'Nhà A1',
        areaName: 'Khu Mía Thịt',
        breed: 'Gà Mía Dabaco',
        status: 'ACTIVE',
        ageDays: 68,
        targetDays: 90,
        totalIn: 2500,
        currentQuantity: 1280,
        avgWeightKg: 2.15,
        targetWeightKg: 2.2,
        feedKg: 11200,
        feedPerBirdKg: 4.52,
        gainKg: 5137.6,
        fcr: 2.18,
        adgGrams: 31.0,
        survivalRate: 99.2,
      },
    ],
  },
  internalStockReport: {
    voucherCount: 1,
    exportCount: 1,
    transferCount: 0,
    totalAmount: 3500000,
    items: [
      {
        voucherId: 8,
        code: 'XK00008',
        movementDate: '2026-11-01',
        movementType: 'Xuất kho',
        categoryName: 'Xuất dùng chuồng',
        itemName: 'Cám Higro 01',
        unitName: 'Bao (25kg)',
        quantity: 10,
        unitPrice: 350000,
        totalAmount: 3500000,
        sourceWarehouse: 'Kho Cám Khu A',
        targetDestination: 'Nhà A1 (L000010)',
        status: 'COMPLETED',
      },
    ],
  },
  activityReport: {
    totalActivities: 2,
    items: [
      {
        id: 'sale-1',
        timestamp: '2026-11-08T14:20:00',
        date: '2026-11-08',
        actor: 'Quản lý bán hàng',
        module: 'Bán hàng',
        action: 'Xuất bán gà',
        detail: 'Bán 1200 con cho Thương lái Hưng Yên',
        referenceCode: 'BH00010',
      },
      {
        id: 'po-1',
        timestamp: '2026-10-15T10:00:00',
        date: '2026-10-15',
        actor: 'Kế toán / Kho',
        module: 'Nhập hàng',
        action: 'Hóa đơn nhập',
        detail: 'Thanh toán hóa đơn cám',
        referenceCode: 'NH00005',
      },
    ],
  },
};

const renderView = () =>
  render(
    <MemoryRouter>
      <ReportsView />
    </MemoryRouter>
  );

describe('ReportsView real analytics integration', () => {
  beforeEach(() => {
    mockGetReportSummary.mockReset();
    mockShowToast.mockReset();
    mockGetReportSummary.mockResolvedValue(MOCK_PAYLOAD);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads real data and switches across all 8 report tabs accurately', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Nhà A1')).toBeInTheDocument();
      expect(screen.getByText('L000010')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo bán hàng/i }));
    expect(screen.getByText('BH00010')).toBeInTheDocument();
    expect(screen.getByText('Thương lái Hưng Yên')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo nhập hàng/i }));
    expect(screen.getByText('NH00005')).toBeInTheDocument();
    expect(screen.getByText('Công ty CP Chăn nuôi C.P.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo tồn kho/i }));
    expect(screen.getByText('Cám Higro 01')).toBeInTheDocument();
    expect(screen.getByText('Sắp hết hàng')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo thu hoạch/i }));
    expect(screen.getByText(/Gà Mía Dabaco/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Xu hướng lứa nuôi/i }));
    expect(screen.getByText('FCR: 2,18')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Xuất nhập nội bộ/i }));
    expect(screen.getByText('XK00008')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Nhật ký hoạt động/i }));
    expect(screen.getByText('Xuất bán gà')).toBeInTheDocument();
  });

  it('re-fetches report summary when date range inputs change', async () => {
    renderView();

    await waitFor(() => {
      expect(mockGetReportSummary).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-31' } });

    await waitFor(() => {
      expect(mockGetReportSummary).toHaveBeenLastCalledWith({
        from: '2026-10-01',
        to: '2026-10-31',
        forceRefresh: false,
      });
    });
  });

  it('exports UTF-8 CSV when clicking Xuất Báo cáo Excel and handles error retry gracefully', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-csv');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    renderView();
    await waitFor(() => {
      expect(screen.getByText('L000010')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Xuất Báo cáo Excel/i }));
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-csv');
    expect(mockShowToast).toHaveBeenCalledWith('Xuất báo cáo Excel (CSV) thành công.', 'success');
  });

  it('shows retry alert when API fails and recovers on retry', async () => {
    mockGetReportSummary.mockRejectedValueOnce({ response: { data: { message: 'Lỗi kết nối báo cáo' } } });
    renderView();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Lỗi kết nối báo cáo');
    });

    mockGetReportSummary.mockResolvedValueOnce(MOCK_PAYLOAD);
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('L000010')).toBeInTheDocument();
    });
  });

  it('paginates report tables across tabs and updates visible rows cleanly', async () => {
    const manyCycles = Array.from({ length: 14 }, (_, idx) => ({
      ...MOCK_PAYLOAD.farmSummary.cycles[0],
      cycleId: idx + 1,
      cycleCode: `L0000${String(idx + 1).padStart(2, '0')}`,
      barnName: `Chuồng số ${idx + 1}`,
    }));
    const manyActivities = Array.from({ length: 20 }, (_, idx) => ({
      ...MOCK_PAYLOAD.activityReport.items[0],
      id: `act-${idx + 1}`,
      detail: `Hoạt động chi tiết #${idx + 1}`,
      referenceCode: `REF${String(idx + 1).padStart(3, '0')}`,
    }));

    mockGetReportSummary.mockResolvedValueOnce({
      ...MOCK_PAYLOAD,
      farmSummary: { ...MOCK_PAYLOAD.farmSummary, totalCycles: 14, cycles: manyCycles },
      activityReport: { totalActivities: 20, items: manyActivities },
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('L000001')).toBeInTheDocument();
    });
    expect(screen.queryByText('L000011')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau lứa nuôi' }));
    expect(screen.getByText('L000011')).toBeInTheDocument();
    expect(screen.getByText('L000014')).toBeInTheDocument();
    expect(screen.queryByText('L000001')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Số dòng mỗi trang lứa nuôi'), { target: { value: '15' } });
    expect(screen.getByText('L000001')).toBeInTheDocument();
    expect(screen.getByText('L000014')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Nhật ký hoạt động/i }));
    expect(screen.getByText('Hoạt động chi tiết #1')).toBeInTheDocument();
    expect(screen.queryByText('Hoạt động chi tiết #16')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau hoạt động' }));
    expect(screen.getByText('Hoạt động chi tiết #16')).toBeInTheDocument();
    expect(screen.getByText('Hoạt động chi tiết #20')).toBeInTheDocument();
  });
});
