import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FarmShiftLayout } from '../layouts/FarmShiftLayout';

const mocks = vi.hoisted(() => ({
  user: { email: 'test@farm.local', role: 'ROLE_FARM_OWNER' },
  unreadCount: 0,
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
    unreadCount: mocks.unreadCount,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearAllAlerts: vi.fn(),
    activeToast: null,
    setActiveToast: vi.fn(),
  }),
  formatNotificationTime: () => 'Vừa xong',
  renderNotificationContent: () => '',
}));

vi.mock('../services/farmService', () => ({
  getFarm: vi.fn().mockResolvedValue({ id: 1, name: 'Trang trại Miền Bình' }),
}));

describe('Role-Based Navigation Filtering in FarmShiftLayout', () => {
  it('renders all tabs and settings for ROLE_FARM_OWNER', () => {
    mocks.user = { email: 'owner@farm.local', role: 'ROLE_FARM_OWNER' };
    render(
      <MemoryRouter>
        <FarmShiftLayout pageTitle="Bảng tin">
          <div>Content</div>
        </FarmShiftLayout>
      </MemoryRouter>
    );

    // Nav items
    expect(screen.getByRole('link', { name: /Bảng tin/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Khu nuôi/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Việc hôm nay/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ghi nhật ký/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kho hàng hóa/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hóa đơn nhập hàng/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quản lý bán hàng/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sổ quỹ/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tài khoản & Nhân sự/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Báo cáo & Thống kê/i })).toBeInTheDocument();

    // Settings items
    expect(screen.getByRole('link', { name: /Thiết lập danh mục/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Thiết lập chăn nuôi/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Thiết lập chung/i })).toBeInTheDocument();
  });

  it('renders only accounting tabs and hides farm/worker/settings tabs for ROLE_ACCOUNTANT', () => {
    mocks.user = { email: 'accountant@farm.local', role: 'ROLE_ACCOUNTANT' };
    render(
      <MemoryRouter>
        <FarmShiftLayout pageTitle="Bảng tin">
          <div>Content</div>
        </FarmShiftLayout>
      </MemoryRouter>
    );

    // Accountant should see:
    expect(screen.getByRole('link', { name: /Bảng tin/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kho hàng hóa/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xuất nhập nội bộ/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hóa đơn nhập hàng/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quản lý bán hàng/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sổ quỹ/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Báo cáo & Thống kê/i })).toBeInTheDocument();

    // Accountant should NOT see worker/farm tabs or settings:
    expect(screen.queryByRole('link', { name: /Khu nuôi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Việc hôm nay/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ghi nhật ký/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Tài khoản & Nhân sự/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Thiết lập danh mục/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Thiết lập chăn nuôi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Thiết lập chung/i })).not.toBeInTheDocument();
  });

  it('renders only worker tabs and hides financial/accounting/settings tabs for ROLE_FARM_WORKER', () => {
    mocks.user = { email: 'worker@farm.local', role: 'ROLE_FARM_WORKER' };
    render(
      <MemoryRouter>
        <FarmShiftLayout pageTitle="Việc hôm nay">
          <div>Content</div>
        </FarmShiftLayout>
      </MemoryRouter>
    );

    // Worker should see:
    expect(screen.getByRole('link', { name: /Khu nuôi/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Việc hôm nay/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ghi nhật ký/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xuất nhập nội bộ/i })).toBeInTheDocument();

    // Worker should NOT see financial/accounting/management tabs:
    expect(screen.queryByRole('link', { name: /Bảng tin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Kho hàng hóa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Hóa đơn nhập hàng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Quản lý bán hàng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sổ quỹ/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Tài khoản & Nhân sự/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Báo cáo & Thống kê/i })).not.toBeInTheDocument();

    // Worker should NOT see settings:
    expect(screen.queryByRole('link', { name: /Thiết lập danh mục/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Thiết lập chăn nuôi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Thiết lập chung/i })).not.toBeInTheDocument();
  });
});

