import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
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
    chickCost: 60000000,
    feedCost: 140000000,
    otherCost: 20000000,
    cycles: [
      {
        cycleId: 10,
        cycleCode: 'L000010',
        barnId: 1,
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
        chickCost: 30000000,
        feedCost: 70000000,
        otherCost: 10000000,
        fcr: 2.18,
        avgWeightKg: 2.15,
      },
      {
        cycleId: 20,
        cycleCode: 'L000020',
        barnId: 2,
        barnName: 'Nhà B2',
        areaName: 'Khu Đồi',
        breed: 'Gà Ri Lạc Thủy',
        status: 'CLOSED',
        startDate: '2026-06-01',
        endDate: '2026-09-15',
        totalIn: 1500,
        deaths: 30,
        culls: 5,
        harvested: 1465,
        harvestedWeightKg: 2900,
        transferredOut: 0,
        currentQuantity: 0,
        survivalRate: 97.67,
        totalCost: 110000000,
        revenue: 100000000,
        profit: -10000000,
        chickCost: 25000000,
        feedCost: 75000000,
        otherCost: 10000000,
        medicineCost: 7000000,
        otherDirectCost: 3000000,
        fcr: 2.38,
        avgWeightKg: 1.98,
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
  inventoryReport: { totalSkus: 0, totalValue: 0, items: [] },
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
    analyzedCycles: 2,
    avgFcr: 2.28,
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
      {
        cycleId: 20,
        cycleCode: 'L000020',
        barnName: 'Nhà B2',
        areaName: 'Khu Đồi',
        breed: 'Gà Ri Lạc Thủy',
        status: 'CLOSED',
        ageDays: 106,
        targetDays: 105,
        totalIn: 1500,
        currentQuantity: 0,
        avgWeightKg: 1.98,
        targetWeightKg: 2.0,
        feedKg: 6900,
        feedPerBirdKg: 4.6,
        gainKg: 2900,
        fcr: 2.38,
        adgGrams: 18.7,
        survivalRate: 97.67,
      },
    ],
  },
  internalStockReport: { voucherCount: 0, exportCount: 0, transferCount: 0, totalAmount: 0, items: [] },
  activityReport: {
    totalActivities: 3,
    items: [
      {
        id: 'sale-1',
        timestamp: '2026-11-08T14:20:00',
        date: '2026-11-08',
        actor: 'Nguyễn Văn An',
        module: 'Bán hàng',
        action: 'Xuất bán gà',
        detail: 'Bán 1200 con tại Nhà A1',
        referenceCode: 'BH00010',
        barnName: 'Nhà A1',
        areaName: 'Khu Mía Thịt',
      },
      {
        id: 'po-1',
        timestamp: '2026-10-15T10:00:00',
        date: '2026-10-15',
        actor: 'Kế toán Bình',
        module: 'Nhập hàng',
        action: 'Hóa đơn nhập',
        detail: 'Thanh toán hóa đơn cám',
        referenceCode: 'NH00005',
        referenceId: '5',
      },
      {
        id: 'del-1',
        timestamp: '2026-10-12T09:00:00',
        date: '2026-10-12',
        actor: 'Nguyễn Văn An',
        module: 'Ghi nhật ký',
        action: 'Xóa bản ghi cám',
        detail: 'Xóa dòng nhập nhầm tại Nhà A1',
        referenceCode: 'L000010',
        barnName: 'Nhà A1',
        areaName: 'Khu Mía Thịt',
        referenceId: '1',
      },
    ],
  },
};

const renderView = (initialEntries = ['/reports']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <ReportsView />
    </MemoryRouter>
  );

describe('ReportsView refactored 4-tab analytics', () => {
  beforeEach(() => {
    mockGetReportSummary.mockReset();
    mockShowToast.mockReset();
    mockGetReportSummary.mockResolvedValue(MOCK_PAYLOAD);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders clean header without breadcrumbs or Làm mới button, and shows exactly 4 flat tabs', async () => {
    renderView();

    await waitFor(() => {
      expect(mockGetReportSummary).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
        forceRefresh: false,
      });
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Báo cáo & Thống kê');
    expect(document.querySelector('.farmshift-breadcrumbs')).toBeNull();
    expect(screen.queryByRole('button', { name: /Làm mới/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /In báo cáo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xuất Excel/i })).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Tổng quan Tài chính',
      'Hiệu suất & Lứa nuôi',
      'Mua bán & Công nợ',
      'Nhật ký hoạt động',
    ]);
    expect(screen.queryByRole('tab', { name: /Báo cáo tồn kho/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Xuất nhập nội bộ/i })).not.toBeInTheDocument();
  });

  it('defaults to Toàn thời gian with empty dates and auto-refetches on preset or custom date change', async () => {
    renderView();

    await waitFor(() => {
      expect(mockGetReportSummary).toHaveBeenCalledTimes(1);
    });

    const periodSelect = screen.getByLabelText('Kỳ báo cáo');
    expect(periodSelect).toHaveValue('all');
    expect(screen.getByLabelText('Từ ngày')).toHaveValue('');
    expect(screen.getByLabelText('Đến ngày')).toHaveValue('');
    expect(screen.getByText('Tất cả thời gian')).toBeInTheDocument();

    fireEvent.change(periodSelect, { target: { value: 'last30' } });
    await waitFor(() => {
      expect(mockGetReportSummary).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByLabelText('Từ ngày').value).not.toBe('');

    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-31' } });
    expect(periodSelect).toHaveValue('custom');

    await waitFor(() => {
      expect(mockGetReportSummary).toHaveBeenLastCalledWith({
        from: '2026-10-01',
        to: '2026-10-31',
        forceRefresh: false,
      });
    });
  });

  it('hides Biên LN 0,0% when totalRevenue is 0, syncs totalIn when live birds exist, and shows horizontal barn names with tooltip details', async () => {
    mockGetReportSummary.mockResolvedValueOnce({
      ...MOCK_PAYLOAD,
      farmSummary: {
        ...MOCK_PAYLOAD.farmSummary,
        totalIn: 0,
        harvested: 0,
        harvestedWeightKg: 0,
        currentLive: 2500,
        totalRevenue: 0,
        totalProfit: -110000000,
        cycles: [
          {
            ...MOCK_PAYLOAD.farmSummary.cycles[0],
            totalIn: 0,
            revenue: 0,
            profit: -110000000,
            harvested: 0,
            harvestedWeightKg: 0,
          },
        ],
      },
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('2.500 con đang nuôi')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Biên LN/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Nhập 2\.540/)).toBeInTheDocument();

    const barChart = screen.getByRole('region', { name: /Biểu đồ Doanh thu, Chi phí và Lợi nhuận theo chuồng/i });
    const axisLabels = Array.from(barChart.querySelectorAll('svg text')).map((el) => el.textContent);
    expect(axisLabels).toContain('Nhà A1');
    expect(axisLabels).not.toContain('Nhà A1 (L000010)');

    const barGroup = barChart.querySelector('g[tabindex="0"]');
    fireEvent.mouseEnter(barGroup);
    expect(screen.getByRole('status')).toHaveTextContent('Nhà A1 (L000010)');
  });

  it('switches to Hiệu suất & Lứa nuôi, filters CLOSED cycles, and opens read-only CycleSummaryDrawer on row click', async () => {
    renderView();

    await waitFor(() => {
      expect(mockGetReportSummary).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Hiệu suất & Lứa nuôi' }));
    expect(screen.getByText('L000010')).toBeInTheDocument();
    expect(screen.getByText('L000020')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Lọc trạng thái lứa'), { target: { value: 'CLOSED' } });
    expect(screen.queryByText('L000010')).not.toBeInTheDocument();
    expect(screen.getByText('L000020')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem tổng kết lứa L000020' }));
    const drawer = await screen.findByTestId('cycle-summary-drawer');
    expect(within(drawer).getByText('L000020 · Nhà B2')).toBeInTheDocument();
    expect(within(drawer).getByText('Tổng quan Tài chính')).toBeInTheDocument();
    expect(within(drawer).getByText('Chi phí thuốc & Lịch sử bệnh')).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: /Mở trang chuồng/i })).toHaveAttribute('href', '/barns/2?cycle=20');

    fireEvent.click(within(drawer).getByRole('button', { name: 'Đóng chi tiết lứa' }));
    expect(screen.queryByTestId('cycle-summary-drawer')).not.toBeInTheDocument();
  });

  it('switches between Bán hàng & Thu hoạch and Nhập hàng & Nhà cung cấp in Mua bán & Công nợ tab', async () => {
    renderView();

    await waitFor(() => {
      expect(mockGetReportSummary).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Mua bán & Công nợ' }));
    expect(screen.getByRole('link', { name: 'BH00010' })).toHaveAttribute('href', '/sales?tab=orders&search=BH00010');
    expect(screen.getByText('Thương lái Hưng Yên')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Nhập hàng & Nhà cung cấp' }));
    expect(screen.getByRole('link', { name: 'NH00005' })).toHaveAttribute('href', '/purchases?invoice=5');
    expect(screen.getByText('Công ty CP Chăn nuôi C.P.')).toBeInTheDocument();
  });

  it('filters Nhật ký hoạt động by actor, action type, and search text', async () => {
    renderView();

    await waitFor(() => {
      expect(mockGetReportSummary).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Nhật ký hoạt động' }));
    expect(screen.getByText('BH00010')).toBeInTheDocument();
    expect(screen.getByText('NH00005')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Lọc theo nhân sự thao tác'), { target: { value: 'Kế toán Bình' } });
    expect(screen.getByText('NH00005')).toBeInTheDocument();
    expect(screen.queryByText('BH00010')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Lọc theo nhân sự thao tác'), { target: { value: 'ALL' } });
    fireEvent.change(screen.getByLabelText('Lọc theo loại hành động'), { target: { value: 'DELETE' } });
    expect(screen.getByText('Xóa bản ghi cám')).toBeInTheDocument();
    expect(screen.queryByText('NH00005')).not.toBeInTheDocument();
  });

  it('exports contextual tab CSV and full report CSV via Xuất Excel dropdown', async () => {
    const capturedBlobs = [];
    const OriginalBlob = globalThis.Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation(function (parts, opts) {
      capturedBlobs.push(parts.join(''));
      return new OriginalBlob(parts, opts);
    });
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-csv');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    renderView();
    await waitFor(() => {
      expect(mockGetReportSummary).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Xuất tab đang xem' }));
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-csv');
    expect(capturedBlobs[0]).toContain('L000010');

    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Xuất toàn bộ báo cáo' }));
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(2);
    expect(capturedBlobs[1]).toContain('BÁO CÁO TỔNG HỢP TOÀN BỘ TRANG TRẠI');
    expect(capturedBlobs[1]).toContain('BH00010');
    expect(capturedBlobs[1]).toContain('NH00005');
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
      expect(screen.getByText('Doanh thu xuất chuồng')).toBeInTheDocument();
    });
  });

  it('collapses filters into MobileFilterSheet and displays active chips on mobile viewport', async () => {
    const prevWidth = window.innerWidth;
    window.innerWidth = 390;
    fireEvent(window, new Event('resize'));

    try {
      renderView(['/reports?area=Khu%20%C4%90%E1%BB%93i']);
      await waitFor(() => {
        expect(mockGetReportSummary).toHaveBeenCalledTimes(1);
      });

      expect(screen.getByTestId('mobile-filter-trigger')).toHaveTextContent('Bộ lọc (1)');
      expect(screen.getByLabelText('Bộ lọc đang áp dụng')).toHaveTextContent('Khu: Khu Đồi');

      fireEvent.click(screen.getByRole('button', { name: 'Bỏ lọc Khu: Khu Đồi' }));
      expect(screen.queryByLabelText('Bộ lọc đang áp dụng')).not.toBeInTheDocument();
    } finally {
      window.innerWidth = prevWidth;
      fireEvent(window, new Event('resize'));
    }
  });
});
