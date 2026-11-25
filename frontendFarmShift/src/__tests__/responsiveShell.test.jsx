import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FarmShiftLayout } from '../layouts/FarmShiftLayout';
import { InternalStockView } from '../features/farmshift/InternalStockView';
import { PrintablePurchaseVoucher } from '../features/farmshift/PrintablePurchaseVoucher';

const mocks = vi.hoisted(() => ({
  user: { email: 'owner@farm.local', role: 'ROLE_FARM_OWNER', name: 'Chủ Trại' },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mocks.user,
    logout: vi.fn(),
  }),
}));

vi.mock('../context/NotificationContext', () => ({
  useNotification: () => ({
    alerts: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearAllAlerts: vi.fn(),
    activeToast: null,
    setActiveToast: vi.fn(),
    showToast: vi.fn(),
    notifPrefs: { inAppEnabled: true },
  }),
  formatNotificationTime: () => 'Vừa xong',
  renderNotificationContent: () => '',
}));

vi.mock('../services/farmService', () => ({
  getFarm: vi.fn().mockResolvedValue({ id: 1, name: 'Trang trại Miền Bình' }),
}));

vi.mock('../services/webPushClient', () => ({
  getNotificationPreferences: vi.fn().mockResolvedValue(null),
  registerServiceWorker: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/internalStockService', () => ({
  listInternalStockCategories: vi.fn().mockResolvedValue([
    { id: 1, movementType: 'EXPORT', name: 'Xuất hủy', isSystem: true, voucherCount: 1 },
  ]),
  createInternalStockCategory: vi.fn(),
  updateInternalStockCategory: vi.fn(),
  deleteInternalStockCategory: vi.fn(),
  listInternalStockVouchers: vi.fn().mockResolvedValue({
    content: [{
      id: 501,
      code: 'XK000001',
      movementType: 'EXPORT',
      categoryName: 'Xuất hủy',
      sourceWarehouseName: 'Kho Cám & Thức ăn',
      targetWarehouseName: null,
      cycleName: 'Lứa 1',
      totalAmount: 342000,
      createdBy: 'Trần Kế Toán',
      date: '2026-10-27',
      status: 'COMPLETED',
      items: [{ id: 1, inventoryItemId: 101, productName: 'Cám gà thịt', unitName: 'Bao 25kg', quantity: 1, unitPrice: 342000, amount: 342000 }],
    }],
    totalElements: 1,
    totalPages: 1,
  }),
  getInternalStockVoucher: vi.fn(),
  createInternalStockVoucher: vi.fn(),
  cancelInternalStockVoucher: vi.fn(),
  INTERNAL_STOCK_TYPES: { EXPORT: 'Xuất kho', TRANSFER: 'Chuyển kho' },
  INTERNAL_STOCK_STATUS: { COMPLETED: 'Đã hoàn thành', CANCELLED: 'Đã hủy' },
}));

vi.mock('../services/warehouseCategoryService', () => ({
  listWarehouseCategories: vi.fn().mockResolvedValue([{ id: 10, name: 'Kho Cám & Thức ăn' }]),
}));

vi.mock('../services/inventoryItemService', () => ({
  listInventoryItems: vi.fn().mockResolvedValue([]),
  listAllInventoryItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('../utils/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('Responsive App Shell (Bước 1 — Mobile, Tablet & Desktop)', () => {
  afterEach(() => {
    setViewportWidth(1280);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('preserves Desktop layout (>= 1025px) with no mobile bottom nav', () => {
    setViewportWidth(1280);
    mocks.user = { email: 'owner@farm.local', role: 'ROLE_FARM_OWNER', name: 'Chủ Trại' };

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <FarmShiftLayout pageTitle="Bảng tin">
          <div>Desktop Content</div>
        </FarmShiftLayout>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
    const sidebar = container.querySelector('#farmshift-primary-navigation');
    expect(sidebar).not.toHaveAttribute('aria-hidden', 'true');
    expect(sidebar.className).not.toContain('tablet-rail');
  });

  it('renders Tablet Mini Icon Rail (768px - 1024px) and opens Overlay Drawer on toggle', () => {
    setViewportWidth(768);
    mocks.user = { email: 'owner@farm.local', role: 'ROLE_FARM_OWNER', name: 'Chủ Trại' };

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <FarmShiftLayout pageTitle="Bảng tin">
          <div>Tablet Content</div>
        </FarmShiftLayout>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
    const sidebar = container.querySelector('#farmshift-primary-navigation');
    expect(sidebar.className).toContain('tablet-rail');
    expect(sidebar).not.toHaveAttribute('aria-hidden', 'true');

    // Open overlay drawer via header toggle
    const toggleBtn = screen.getByRole('button', { name: /Mở menu điều hướng/i });
    fireEvent.click(toggleBtn);
    expect(sidebar.className).toContain('mobile-open');
    expect(sidebar.className).not.toContain('tablet-rail');

    // Open AI Chatbot -> Tablet Overlay Drawer with backdrop
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    const aiWindow = screen.getByTestId('ai-chat-window');
    expect(aiWindow).toHaveAttribute('data-mode', 'tablet-drawer');
    expect(screen.getByTestId('ai-tablet-backdrop')).toBeInTheDocument();
    expect(screen.queryByTestId('expand-chat-btn')).not.toBeInTheDocument();

    // Clicking backdrop closes Tablet AI drawer
    fireEvent.click(screen.getByTestId('ai-tablet-backdrop'));
    expect(screen.queryByTestId('ai-chat-window')).not.toBeInTheDocument();
  });

  it('renders Mobile Bottom Nav (< 768px), compact header with back link, and full-screen AI Sheet', () => {
    setViewportWidth(390);
    mocks.user = { email: 'owner@farm.local', role: 'ROLE_FARM_OWNER', name: 'Chủ Trại' };

    const { container } = render(
      <MemoryRouter initialEntries={['/barns/1']}>
        <FarmShiftLayout
          pageTitle="Chuồng Nhà A1"
          breadcrumbs={[{ label: 'Khu nuôi', path: '/areas' }]}
        >
          <div>Mobile Content</div>
        </FarmShiftLayout>
      </MemoryRouter>
    );

    const bottomNav = screen.getByTestId('mobile-bottom-nav');
    expect(bottomNav).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Bảng tin' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Khu nuôi' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Việc hôm nay' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Kho' })).toBeInTheDocument();
    expect(within(bottomNav).getByTestId('mobile-more-btn')).toBeInTheDocument();

    // Compact topbar shows title as the single h1 (no duplicate page title in main)
    expect(screen.getByTestId('mobile-header-title')).toHaveTextContent('Chuồng Nhà A1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelector('.farmshift-page-title')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quay lại Khu nuôi/i })).toHaveAttribute('href', '/areas');

    // Desktop sidebar is hidden on mobile
    const sidebar = container.querySelector('#farmshift-primary-navigation');
    expect(sidebar).toHaveAttribute('aria-hidden', 'true');

    // Open "Thêm" drawer and verify aria-controls matches drawer id
    fireEvent.click(screen.getByTestId('mobile-more-btn'));
    const moreDrawer = screen.getByTestId('mobile-more-drawer');
    expect(moreDrawer).toBeInTheDocument();
    expect(moreDrawer).toHaveAttribute('id', 'mobile-more-drawer');
    expect(within(moreDrawer).getByRole('link', { name: /Hóa đơn nhập hàng/i })).toBeInTheDocument();
    expect(within(moreDrawer).getByRole('link', { name: /Báo cáo & Thống kê/i })).toBeInTheDocument();

    // Close "Thêm" drawer with Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('mobile-more-drawer')).not.toBeInTheDocument();

    // Open AI Chatbot -> Full-screen Mobile Sheet & hides launcher FAB
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    const aiWindow = screen.getByTestId('ai-chat-window');
    expect(aiWindow).toHaveAttribute('data-mode', 'mobile-sheet');
    expect(screen.queryByTestId('ai-chatbot-launcher')).not.toBeInTheDocument();
    expect(screen.queryByTestId('expand-chat-btn')).not.toBeInTheDocument();

    // Close AI Sheet restores launcher FAB
    fireEvent.click(screen.getByTestId('close-chat-btn'));
    expect(screen.getByTestId('ai-chatbot-launcher')).toBeInTheDocument();
  });

  it('strictly enforces RBAC in Mobile Bottom Nav and More Drawer for ROLE_FARM_WORKER', () => {
    setViewportWidth(375);
    mocks.user = { email: 'worker@farm.local', role: 'ROLE_FARM_WORKER', name: 'Công nhân' };

    render(
      <MemoryRouter initialEntries={['/today-tasks']}>
        <FarmShiftLayout pageTitle="Việc hôm nay">
          <div>Worker Mobile</div>
        </FarmShiftLayout>
      </MemoryRouter>
    );

    const bottomNav = screen.getByTestId('mobile-bottom-nav');
    expect(within(bottomNav).getByRole('link', { name: 'Việc hôm nay' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Nhật ký' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Khu nuôi' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Nội bộ' })).toBeInTheDocument();

    // Worker MUST NOT see financial/dashboard/inventory items
    expect(within(bottomNav).queryByRole('link', { name: /Bảng tin/i })).not.toBeInTheDocument();
    expect(within(bottomNav).queryByRole('link', { name: /Kho/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-more-btn'));
    const moreDrawer = screen.getByTestId('mobile-more-drawer');
    expect(within(moreDrawer).getByRole('link', { name: /Hồ sơ cá nhân/i })).toBeInTheDocument();
    expect(within(moreDrawer).queryByRole('link', { name: /Báo cáo/i })).not.toBeInTheDocument();
    expect(within(moreDrawer).queryByRole('link', { name: /Hóa đơn nhập/i })).not.toBeInTheDocument();
    expect(within(moreDrawer).queryByRole('link', { name: /Quản lý bán hàng/i })).not.toBeInTheDocument();
    expect(within(moreDrawer).queryByRole('link', { name: /Thiết lập/i })).not.toBeInTheDocument();
  });

  it('deduplicates repeated trailing breadcrumb labels', () => {
    setViewportWidth(1280);
    mocks.user = { email: 'owner@farm.local', role: 'ROLE_FARM_OWNER', name: 'Chủ Trại' };

    const { container } = render(
      <MemoryRouter initialEntries={['/inventory']}>
        <FarmShiftLayout
          pageTitle="Kho hàng hóa"
          breadcrumbs={[{ label: 'Kho hàng hóa' }]}
        >
          <div>Inventory</div>
        </FarmShiftLayout>
      </MemoryRouter>
    );

    const breadcrumbBar = container.querySelector('.farmshift-breadcrumbs');
    const occurrences = breadcrumbBar.textContent.match(/Kho hàng hóa/g) || [];
    expect(occurrences).toHaveLength(1);
  });

  it('highlights /internal-stock alias and query-based profile links in Mobile Nav', () => {
    setViewportWidth(390);
    mocks.user = { email: 'worker@farm.local', role: 'ROLE_FARM_WORKER', name: 'Công nhân' };

    const { unmount } = render(
      <MemoryRouter initialEntries={['/internal-stock']}>
        <FarmShiftLayout pageTitle="Xuất nhập nội bộ">
          <div>Internal Stock</div>
        </FarmShiftLayout>
      </MemoryRouter>
    );

    const internalLink = within(screen.getByTestId('mobile-bottom-nav')).getByRole('link', { name: 'Nội bộ' });
    expect(internalLink.className).toContain('bottomNavItemActive');
    unmount();

    mocks.user = { email: 'owner@farm.local', role: 'ROLE_FARM_OWNER', name: 'Chủ Trại' };
    render(
      <MemoryRouter initialEntries={['/account?tab=profile']}>
        <FarmShiftLayout pageTitle="Hồ sơ cá nhân">
          <div>Profile</div>
        </FarmShiftLayout>
      </MemoryRouter>
    );
    expect(screen.getByTestId('mobile-more-btn').className).toContain('bottomNavItemActive');
  });

  it('renders InternalStockView with the real FarmShiftLayout as a single h1 on Mobile (390px) and Desktop (1280px), including after print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    mocks.user = { email: 'owner@farm.local', role: 'ROLE_FARM_OWNER', name: 'Chủ Trại' };

    try {
      // Mobile (390px) on /transfers
      setViewportWidth(390);
      const { container, unmount } = render(
        <MemoryRouter initialEntries={['/transfers']}>
          <InternalStockView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('XK000001')).toBeInTheDocument();
      });

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByTestId('mobile-header-title')).toHaveTextContent('Xuất nhập nội bộ');
      expect(container.querySelector('.farmshift-page-title')).not.toBeInTheDocument();

      // Trigger print portal -> PrintableInternalVoucher must not add a second h1
      fireEvent.click(screen.getByRole('button', { name: /In phiếu/i }));
      await waitFor(() => {
        expect(document.getElementById('farmshift-printable-voucher')).toBeInTheDocument();
      });
      expect(document.querySelectorAll('h1')).toHaveLength(1);
      unmount();

      // Desktop (1280px) on /internal-stock alias
      setViewportWidth(1280);
      const desktopView = render(
        <MemoryRouter initialEntries={['/internal-stock']}>
          <InternalStockView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('XK000001')).toBeInTheDocument();
      });

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(desktopView.container.querySelector('.farmshift-page-title')).toHaveTextContent('Xuất nhập nội bộ');
      expect(screen.queryByTestId('mobile-header-title')).not.toBeInTheDocument();

      // Desktop sidebar highlights "Xuất nhập nội bộ" on /internal-stock alias too
      const sidebar = desktopView.container.querySelector('#farmshift-primary-navigation');
      const transferNavLink = within(sidebar).getByRole('link', { name: /Xuất nhập nội bộ/i });
      expect(transferNavLink.className).toContain('active');
    } finally {
      printSpy.mockRestore();
    }
  });

  it('keeps single h1 on Mobile when PrintablePurchaseVoucher preview and print portal are mounted inside FarmShiftLayout', () => {
    setViewportWidth(375);
    mocks.user = { email: 'owner@farm.local', role: 'ROLE_FARM_OWNER', name: 'Chủ Trại' };
    const sampleOrder = {
      id: 1,
      code: 'PN000001',
      supplier: 'NCC A',
      invoiceDate: '2026-10-27',
      totalAmount: 1000000,
      paidAmount: 500000,
      debtAmount: 500000,
      items: [{ id: 1, productName: 'Cám A', unitName: 'Bao', quantity: 2, unitPrice: 500000 }],
    };

    render(
      <MemoryRouter initialEntries={['/purchases']}>
        <FarmShiftLayout pageTitle="Hóa đơn nhập hàng">
          <PrintablePurchaseVoucher order={sampleOrder} onScreenPreview={true} />
          <PrintablePurchaseVoucher order={sampleOrder} />
        </FarmShiftLayout>
      </MemoryRouter>
    );

    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByTestId('mobile-header-title')).toHaveTextContent('Hóa đơn nhập hàng');
    expect(document.getElementById('farmshift-printable-voucher')).toBeInTheDocument();
  });
});
