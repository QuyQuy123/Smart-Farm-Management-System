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
    items: [
      {
        id: 1,
        code: 'SP00001',
        name: 'Cám Higro 01',
        warehouseName: 'Kho Cám Khu A',
        productType: 'Thức ăn',
        unitName: 'Bao (25kg)',
        stock: 30,
        unitPrice: 350000,
        totalValue: 10500000,
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

const renderView = (initialEntries = ['/reports']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
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
    expect(screen.getAllByText(/30 Bao \(25kg\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Sắp hết định mức/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cảnh báo hạn sử dụng/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Sắp hết hàng')).not.toBeInTheDocument();

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
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { });

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

  it('renders interactive SVG analytics charts, P&L breakdown, and drill-down barn links', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('L000010')).toBeInTheDocument();
    });

    // Interactive SVG charts present
    expect(screen.getByRole('region', { name: /Biểu đồ Doanh thu, Chi phí và Lợi nhuận theo chuồng/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Biểu đồ Cơ cấu chi phí chăn nuôi/i })).toBeInTheDocument();

    // Cost structure donut legend labels & percentages
    expect(screen.getByText('Con giống')).toBeInTheDocument();
    expect(screen.getByText('Thức ăn / Cám')).toBeInTheDocument();
    expect(screen.getByText('Thuốc, vắc-xin & CP khác')).toBeInTheDocument();

    // Hovering a bar group shows detailed P&L tooltip
    const barChart = screen.getByRole('region', { name: /Biểu đồ Doanh thu, Chi phí và Lợi nhuận theo chuồng/i });
    const barGroup = barChart.querySelector('g[tabindex="0"]');
    expect(barGroup).not.toBeNull();
    fireEvent.mouseEnter(barGroup);
    expect(screen.getByRole('status')).toHaveTextContent('Nhà A1 (L000010)');
    expect(screen.getByRole('status')).toHaveTextContent('Lợi nhuận ròng: +85.000.000 đ');

    // Drill-down link from barn name to /barns/1
    const barnLink = screen.getByRole('link', { name: /Nhà A1/i });
    expect(barnLink).toHaveAttribute('href', '/barns/1');

    // Switch to Growth tab and check FCR comparison SVG chart
    fireEvent.click(screen.getByRole('tab', { name: /Xu hướng lứa nuôi/i }));
    expect(screen.getByRole('region', { name: /Biểu đồ So sánh FCR theo chuồng/i })).toBeInTheDocument();
  });

  it('filters cycles by area and cycle status and recalculates P&L summary dynamically', async () => {
    mockGetReportSummary.mockResolvedValueOnce({
      ...MOCK_PAYLOAD,
      farmSummary: {
        ...MOCK_PAYLOAD.farmSummary,
        totalCycles: 2,
        cycles: [
          MOCK_PAYLOAD.farmSummary.cycles[0],
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
            transferredOut: 0,
            currentQuantity: 0,
            survivalRate: 97.67,
            totalCost: 110000000,
            revenue: 100000000,
            profit: -10000000,
            chickCost: 25000000,
            feedCost: 75000000,
            otherCost: 10000000,
            fcr: 2.38,
            avgWeightKg: 1.95,
          },
        ],
      },
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('L000010')).toBeInTheDocument();
      expect(screen.getByText('L000020')).toBeInTheDocument();
    });

    // Filter by Area = Khu Đồi
    fireEvent.change(screen.getByLabelText('Lọc theo khu nuôi'), { target: { value: 'Khu Đồi' } });
    expect(screen.queryByText('L000010')).not.toBeInTheDocument();
    expect(screen.getByText('L000020')).toBeInTheDocument();
    expect(screen.getAllByText('-10.000.000 đ').length).toBeGreaterThanOrEqual(1);

    // Clear filter and filter by status = ACTIVE
    fireEvent.click(screen.getByRole('button', { name: /Xóa bộ lọc/i }));
    expect(screen.getByText('L000010')).toBeInTheDocument();
    expect(screen.getByText('L000020')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Lọc trạng thái lứa'), { target: { value: 'ACTIVE' } });
    expect(screen.getByText('L000010')).toBeInTheDocument();
    expect(screen.queryByText('L000020')).not.toBeInTheDocument();
  });

  it('renders inventory proportion pie/donut chart with Gà/Cám/Vắc-xin toggle and category filtering', async () => {
    mockGetReportSummary.mockResolvedValueOnce({
      ...MOCK_PAYLOAD,
      farmSummary: {
        ...MOCK_PAYLOAD.farmSummary,
        medicineCost: 15000000,
        otherDirectCost: 5000000,
      },
      inventoryReport: {
        totalSkus: 3,
        totalValue: 40500000,
        items: [
          MOCK_PAYLOAD.inventoryReport.items[0],
          {
            id: 2,
            code: 'SP00002',
            name: 'Vắc-xin Lasota phòng Newcastle',
            warehouseName: 'Kho Thuốc Khu A',
            productType: 'Thuốc thú y',
            unitName: 'Lọ',
            stock: 50,
            unitPrice: 400000,
            totalValue: 20000000,
          },
          {
            id: 3,
            code: 'SP00003',
            name: 'Ngô hạt nghiền',
            warehouseName: 'Kho Cám Khu A',
            productType: 'Thức ăn',
            unitName: 'Kg',
            stock: 1000,
            unitPrice: 10000,
            totalValue: 10000000,
          },
        ],
      },
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('L000010')).toBeInTheDocument();
    });

    // Separate medicine slice appears on Summary tab when backend provides medicineCost / otherDirectCost
    expect(screen.getByText('Vắc-xin & Thuốc thú y')).toBeInTheDocument();
    expect(screen.getByText('Chi phí vận hành khác')).toBeInTheDocument();

    // Switch to Inventory tab and verify interactive Pie/Donut & Warehouse quantity/value allocation panel
    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo tồn kho/i }));
    expect(screen.getByText('Phân bổ Thức ăn & Nguyên liệu')).toBeInTheDocument();
    expect(screen.getByText('Phân bổ Vắc-xin, Thuốc & Vật tư')).toBeInTheDocument();
    expect(screen.queryByText(/Sắp hết định mức/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cảnh báo hạn sử dụng/i)).not.toBeInTheDocument();

    const pieSection = screen.getByRole('region', { name: /Biểu đồ Tròn Tỷ trọng Cám, Gà và Vắc-xin/i });
    expect(pieSection).toBeInTheDocument();
    expect(pieSection).toHaveTextContent('Thức ăn & Kho Cám');
    expect(pieSection).toHaveTextContent('Đàn gà & Con giống');
    expect(pieSection).toHaveTextContent('Vắc-xin & Thuốc thú y');

    const whSection = screen.getByRole('region', { name: /Phân bổ giá trị và số lượng tồn kho theo kho/i });
    expect(whSection).toBeInTheDocument();
    expect(whSection).toHaveTextContent('30 Bao (25kg)');
    expect(whSection).toHaveTextContent('1.000 Kg');
    expect(whSection).toHaveTextContent('50 Lọ');
    expect(whSection).not.toHaveTextContent('Cận hạn dùng');
    expect(whSection).not.toHaveTextContent('Dưới định mức');

    // Switch pie mode to stock breakdown (Trong kho) and verify both money & quantities
    fireEvent.click(screen.getByRole('button', { name: /Trong kho \(Vật tư\)/i }));
    expect(pieSection).toHaveTextContent('Cám công nghiệp (Thức ăn)');
    expect(pieSection).toHaveTextContent('SL: 30 Bao (25kg)');
    expect(pieSection).toHaveTextContent('Vắc-xin phòng bệnh');
    expect(pieSection).toHaveTextContent('SL: 50 Lọ');
    expect(pieSection).toHaveTextContent('Ngũ cốc & Nguyên liệu');
    expect(pieSection).toHaveTextContent('SL: 1.000 Kg');

    // Filter table by clicking Vắc-xin pill
    fireEvent.click(screen.getByRole('button', { name: /Vắc-xin \(1\)/i }));
    expect(screen.getByText('Vắc-xin Lasota phòng Newcastle')).toBeInTheDocument();
    expect(screen.queryByText('Cám Higro 01')).not.toBeInTheDocument();
    expect(screen.queryByText('Ngô hạt nghiền')).not.toBeInTheDocument();
  });

  it('renders interactive SVG Donut & Weight/ADG charts and status filter pills on Sales, Purchases, Harvest, and Growth tabs', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('L000010')).toBeInTheDocument();
    });

    // Sales tab: SVG Donut chart + status filter pills
    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo bán hàng/i }));
    const salesChart = screen.getByRole('region', { name: /Tiến độ thu tiền bán hàng/i });
    expect(salesChart).toBeInTheDocument();
    expect(salesChart).toHaveTextContent('Tiền đã thu thực tế');
    expect(salesChart).toHaveTextContent('Còn phải thu (Công nợ)');
    fireEvent.click(screen.getByRole('button', { name: /Đã thanh toán đủ \(0\)/i }));
    expect(screen.getByText('Chưa có đơn bán hàng trong kỳ báo cáo.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tất cả đơn bán \(1\)/i }));
    expect(screen.getByText('BH00010')).toBeInTheDocument();

    // Purchases tab: SVG Donut chart with mode switch (Thanh toán NCC vs Theo nhóm kho)
    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo nhập hàng/i }));
    const purChart = screen.getByRole('region', { name: /Tiến độ thanh toán nhà cung cấp/i });
    expect(purChart).toBeInTheDocument();
    expect(purChart).toHaveTextContent('Đã thanh toán NCC');
    fireEvent.click(screen.getByRole('button', { name: /Theo nhóm kho/i }));
    expect(purChart).toHaveTextContent('Kho Cám & Thức ăn (1 HĐ)');

    // Harvest tab: both Bar chart and Donut chart
    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo thu hoạch/i }));
    expect(screen.getByRole('region', { name: /Biểu đồ Doanh thu thu hoạch theo chuồng/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Biểu đồ Tỷ trọng thu hoạch theo chuồng/i })).toBeInTheDocument();

    // Growth tab: both FCR Comparison chart and Weight/ADG chart + 4 KPI cards
    fireEvent.click(screen.getByRole('tab', { name: /Xu hướng lứa nuôi/i }));
    expect(screen.getByRole('region', { name: /Biểu đồ So sánh FCR theo chuồng/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Biểu đồ Trọng lượng và ADG theo chuồng/i })).toBeInTheDocument();
    expect(screen.getByText('Tổng cám tiêu thụ lũy kế')).toBeInTheDocument();
    expect(screen.getByText('Tổng tăng trọng sinh khối')).toBeInTheDocument();
  });

  it('supports separated medicine/other costs, costPerKg, WIP badge, exact barn matching, filtered activity charts, drill-down links, URL sync, and structured CSV export', async () => {
    const capturedBlobs = [];
    const OriginalBlob = globalThis.Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation(function (parts, opts) {
      capturedBlobs.push(parts.join(''));
      return new OriginalBlob(parts, opts);
    });
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:enhanced-csv');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { });

    mockGetReportSummary.mockResolvedValueOnce({
      ...MOCK_PAYLOAD,
      farmSummary: {
        ...MOCK_PAYLOAD.farmSummary,
        harvestedWeightKg: 5000,
        realizedProfit: -10000000,
        wipCost: 110000000,
        closedCycles: 1,
        cycles: [
          {
            ...MOCK_PAYLOAD.farmSummary.cycles[0],
            revenue: 0,
            profit: -110000000,
            harvested: 0,
            harvestedWeightKg: 0,
            medicineCost: 6000000,
            otherDirectCost: 4000000,
            costPerKg: 39970,
          },
          {
            cycleId: 20,
            cycleCode: 'L000020',
            barnId: 2,
            barnName: 'Nhà A10',
            areaName: 'Khu Đồi',
            breed: 'Gà Ri',
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
            costPerKg: 37931,
            fcr: 2.38,
            avgWeightKg: 1.98,
          },
        ],
      },
      salesReport: {
        ...MOCK_PAYLOAD.salesReport,
        orders: [
          MOCK_PAYLOAD.salesReport.orders[0],
          {
            id: 'so-2',
            code: 'BH00020',
            date: '2026-11-09',
            customer: 'Thương lái Hà Nam',
            flock: 'Khu Đồi - Nhà A10 - L000020',
            quantity: 500,
            totalWeight: 1000,
            unitPrice: 70000,
            totalAmount: 70000000,
            paidAmount: 0,
            debtAmount: 70000000,
            status: 'DEBT',
            barnName: 'Nhà A10',
            areaName: 'Khu Đồi',
          },
        ],
      },
      activityReport: {
        totalActivities: 3,
        items: [
          {
            id: 'sale-1',
            timestamp: '2026-11-08T14:20:00',
            date: '2026-11-08',
            actor: 'Xuất bán · Thương lái Hưng Yên',
            module: 'Bán hàng',
            action: 'Xuất bán gà',
            detail: 'Bán cho Thương lái Hưng Yên tại Nhà A1',
            referenceCode: 'BH00010',
            barnName: 'Nhà A1',
            areaName: 'Khu Mía Thịt',
            referenceId: 'so-1',
          },
          {
            id: 'mov-1',
            timestamp: '2026-11-07T08:00:00',
            date: '2026-11-07',
            actor: 'Nguyễn Văn Ba',
            module: 'Đàn gia cầm',
            action: 'Nhập đàn giống',
            detail: 'Nhà A1 · Nhập 2.000 con (MÍA-DABACO XÔ)',
            referenceCode: 'L000010',
            barnName: 'Nhà A1',
            areaName: 'Khu Mía Thịt',
            referenceId: '1',
          },
          {
            id: 'po-1',
            timestamp: '2026-10-15T10:00:00',
            date: '2026-10-15',
            actor: 'Kế toán Bình',
            module: 'Nhập hàng',
            action: 'Hóa đơn nhập',
            detail: 'Nhập cho Nhà A10',
            referenceCode: 'NH00005',
            barnName: 'Nhà A10',
            areaName: 'Khu Đồi',
            referenceId: '5',
          },
        ],
      },
    });

    renderView(['/reports?tab=summary&barn=Nh%C3%A0%20A1']);

    await waitFor(() => {
      expect(screen.getByText('L000010')).toBeInTheDocument();
    });

    // Exact barn matching: Nhà A1 must NOT include Nhà A10
    expect(screen.queryByText('L000020')).not.toBeInTheDocument();
    expect(screen.getByText('39.970 đ')).toBeInTheDocument();
    expect(screen.getAllByText('6.000.000 đ').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('4.000.000 đ').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Đang đầu tư (WIP)')).toBeInTheDocument();
    expect(screen.getByText(/0 con \(0,0 kg\)/)).toBeInTheDocument();

    // CSV export includes metadata header + footer totals
    fireEvent.click(screen.getByRole('button', { name: /Xuất Báo cáo Excel/i }));
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:enhanced-csv');
    expect(capturedBlobs[0]).toContain('Trang trại FarmShift Test');
    expect(capturedBlobs[0]).toContain('TỔNG CỘNG');
    expect(capturedBlobs[0]).toContain('Giá vốn/kg (VND)');

    // Sales tab respects exact barn filter (BH00010 visible, BH00020 in Nhà A10 hidden) and has drill-down link
    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo bán hàng/i }));
    const saleLink = screen.getByRole('link', { name: 'BH00010' });
    expect(saleLink).toHaveAttribute('href', '/sales?tab=orders&search=BH00010');
    expect(screen.queryByText('BH00020')).not.toBeInTheDocument();

    // Purchases & Internal drill-down links
    fireEvent.click(screen.getByRole('tab', { name: /Báo cáo nhập hàng/i }));
    expect(screen.getByRole('button', { name: /Xóa bộ lọc/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Xóa bộ lọc/i }));
    expect(screen.getByRole('link', { name: 'NH00005' })).toHaveAttribute('href', '/purchases?invoice=5');

    fireEvent.click(screen.getByRole('tab', { name: /Xuất nhập nội bộ/i }));
    expect(screen.getByRole('link', { name: 'XK00008' })).toHaveAttribute('href', '/internal-stock?search=XK00008');

    // Activity chart & KPI distinguish staff vs partner actors dynamically and support Đàn gia cầm drill-down when filtered to Nhà A1
    fireEvent.change(screen.getByLabelText('Lọc theo chuồng'), { target: { value: 'Nhà A1' } });
    fireEvent.click(screen.getByRole('tab', { name: /Nhật ký hoạt động/i }));
    const actChart = screen.getByRole('region', { name: /Biểu đồ Phân bổ hoạt động theo phân hệ/i });
    expect(actChart).toHaveTextContent(/2\s*thao tác/);
    expect(actChart).toHaveTextContent('1 lượt');
    expect(screen.queryByText('Kế toán Bình')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'BH00010' })).toHaveAttribute('href', '/sales?tab=orders&search=BH00010');
    expect(screen.getByRole('link', { name: 'L000010' })).toHaveAttribute('href', '/barns/1');
    expect(screen.getByText(/1 nhân sự · 1 đối tác/i)).toBeInTheDocument();
  });
});
