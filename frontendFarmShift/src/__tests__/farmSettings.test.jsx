import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GeneralSettingsView } from '../features/farmshift/GeneralSettingsView';
import { getFarm, updateFarm } from '../services/farmService';
import { api } from '../utils/api';
import { dataCache } from '../services/dataCache';

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), role: 'ROLE_FARM_OWNER', email: 'owner@farm.test' }));
vi.mock('../services/farmService', () => ({ getFarm: vi.fn(), updateFarm: vi.fn() }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: mocks.role, email: mocks.email, name: 'Chủ trại Test' } }),
}));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children }) => <div>{children}</div> }));

const originalAdapter = api.defaults.adapter;
const farm = { name: 'Tên từ database', owner: 'Người đại diện', phone: '0987654321', scale: '100 con', address: 'Hà Nội', type: 'Gia cầm' };
const renderView = (initialEntry = '/general-settings') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <GeneralSettingsView />
  </MemoryRouter>
);

describe('Farm settings persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    dataCache.clearAll();
    mocks.role = 'ROLE_FARM_OWNER';
    mocks.email = 'owner@farm.test';
    getFarm.mockResolvedValue({ ...farm });
    api.defaults.adapter = vi.fn(async (config) => {
      if (config.url === '/push/status') {
        return { status: 200, statusText: 'OK', headers: {}, config, data: { hasActiveSubscription: false, deviceCount: 0 } };
      }
      if (config.url === '/push/preferences' && config.method === 'get') {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: { inAppEnabled: true, iotAlertEnabled: true, taskVaccineReminderEnabled: true, debtReminderEnabled: true },
        };
      }
      if (config.url === '/push/preferences' && config.method === 'put') {
        const parsed = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        return { status: 200, statusText: 'OK', headers: {}, config, data: parsed };
      }
      if (config.url === '/employees/summary') {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: { success: true, data: { total: 6, active: 6, inactive: 0, ownerCount: 2, accountantCount: 1, workerCount: 3 } },
        };
      }
      return { status: 200, statusText: 'OK', headers: {}, config, data: { success: true, data: {} } };
    });
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    dataCache.clearAll();
  });

  it('loads database values and publishes only the saved server response', async () => {
    updateFarm.mockResolvedValue({ ...farm, name: 'Trang trại mới' });
    const listener = vi.fn();
    window.addEventListener('farmshift_info_updated', listener);
    renderView();
    const name = await screen.findByDisplayValue(farm.name);
    await waitFor(() => expect(screen.getByRole('button', { name: /Cập nhật thông tin/ })).toBeEnabled());
    fireEvent.change(name, { target: { value: 'Trang trại mới' } });
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật thông tin/ }));
    await waitFor(() => expect(updateFarm).toHaveBeenCalledWith(expect.objectContaining({ name: 'Trang trại mới' })));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('farmshift_farm_info')).name).toBe('Trang trại mới'));
    expect(listener).toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith(expect.any(String), 'success');
    window.removeEventListener('farmshift_info_updated', listener);
  });

  it('does not cache unsaved edits or report success when the API fails', async () => {
    updateFarm.mockRejectedValue(new Error('Network error'));
    renderView();
    const name = await screen.findByDisplayValue(farm.name);
    await waitFor(() => expect(screen.getByRole('button', { name: /Cập nhật thông tin/ })).toBeEnabled());
    fireEvent.change(name, { target: { value: 'Chưa lưu' } });
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật thông tin/ }));
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.any(String), 'error'));
    expect(JSON.parse(localStorage.getItem('farmshift_farm_info')).name).toBe(farm.name);
  });

  it('disables updates when loading fails', async () => {
    getFarm.mockRejectedValue(new Error('Offline'));
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được');
    expect(screen.getByRole('button', { name: /Cập nhật thông tin/ })).toBeDisabled();
  });

  it('allows workers to view but not edit farm settings', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    renderView();
    expect(await screen.findByDisplayValue(farm.name)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cập nhật thông tin/ })).toBeDisabled();
    expect(updateFarm).not.toHaveBeenCalled();
  });

  it('renders only the 4 standardized tabs and excludes removed prototype/mock tabs', async () => {
    renderView();
    await screen.findByDisplayValue(farm.name);

    const tabButtons = Array.from(document.querySelectorAll('.farmshift-tab-btn')).map(btn => btn.textContent.trim());
    expect(tabButtons).toEqual([
      'Thông tin cơ sở & Trang trại',
      'Vai trò khu nuôi',
      'Phân vai trò chung',
      'Thông báo cá nhân & Cảnh báo',
    ]);

    expect(screen.queryByRole('button', { name: /Phân vai trò theo Kho/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dữ liệu & Sao lưu JSON \/ Excel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Danh mục 73 màn hình hệ thống/i })).not.toBeInTheDocument();
  });

  it('keeps Web Push, in-app notifications, and 3 business alerts while removing Email and SMS rows in Thông báo cá nhân & Cảnh báo', async () => {
    renderView();
    await screen.findByDisplayValue(farm.name);

    fireEvent.click(screen.getByRole('button', { name: 'Thông báo cá nhân & Cảnh báo' }));

    expect(await screen.findByText(/Thông báo đẩy về Điện thoại & Trình duyệt \(Web Push\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Thông báo trong ứng dụng \(Chuông & Toast\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Cảnh báo môi trường \/ Thiết bị IoT/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhắc lịch tiêm phòng vắc-xin & Công việc/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhắc công nợ & Đến hạn thanh toán/i)).toBeInTheDocument();

    expect(screen.queryByText(/Thông báo qua Email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Thông báo tin nhắn SMS/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('▯');
  });

  it('upgrades Tab 3 Phân vai trò chung with 3 role summary cards and 7 operational domains', async () => {
    renderView();
    await screen.findByDisplayValue(farm.name);

    fireEvent.click(screen.getByRole('button', { name: 'Phân vai trò chung' }));

    expect(await screen.findByText('2 tài khoản')).toBeInTheDocument();
    expect(screen.getByText('1 tài khoản')).toBeInTheDocument();
    expect(screen.getByText('3 tài khoản')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quản lý Tài khoản & Nhân sự/i })).toBeInTheDocument();

    expect(screen.getByText('1. Khu nuôi, Chuồng & Lứa nuôi')).toBeInTheDocument();
    expect(screen.getByText('2. Việc hôm nay & Ghi nhật ký')).toBeInTheDocument();
    expect(screen.getByText('3. Kho hàng hóa & Xuất nhập nội bộ')).toBeInTheDocument();
    expect(screen.getByText('4. Hóa đơn nhập, Xuất bán & Công nợ')).toBeInTheDocument();
    expect(screen.getByText('5. Thiết bị IoT & Camera chuồng')).toBeInTheDocument();
    expect(screen.getByText('6. Báo cáo & Phân tích (8 Tab)')).toBeInTheDocument();
    expect(screen.getByText('7. Trợ lý AI, Giọng nói & OCR')).toBeInTheDocument();
    expect(screen.getByText(/AiRbacPolicy chặn 32 lệnh/i)).toBeInTheDocument();
  });

  it('persists notification preferences via PUT /api/push/preferences and retains state across tab switches via dataCache', async () => {
    renderView();
    await screen.findByDisplayValue(farm.name);

    fireEvent.click(screen.getByRole('button', { name: 'Thông báo cá nhân & Cảnh báo' }));

    const iotCheckbox = await screen.findByLabelText(/Cảnh báo môi trường \/ Thiết bị IoT/i);
    const debtCheckbox = screen.getByLabelText(/Nhắc công nợ & Đến hạn thanh toán/i);

    await waitFor(() => expect(iotCheckbox).toBeChecked());
    expect(debtCheckbox).toBeChecked();

    fireEvent.click(iotCheckbox);
    fireEvent.click(debtCheckbox);
    expect(iotCheckbox).not.toBeChecked();
    expect(debtCheckbox).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Lưu thiết lập thông báo/i }));

    await waitFor(() => {
      const putCall = api.defaults.adapter.mock.calls.find(
        ([cfg]) => cfg.url === '/push/preferences' && cfg.method === 'put'
      );
      expect(putCall).toBeDefined();
      const body = typeof putCall[0].data === 'string' ? JSON.parse(putCall[0].data) : putCall[0].data;
      expect(body).toEqual({
        inAppEnabled: true,
        iotAlertEnabled: false,
        taskVaccineReminderEnabled: true,
        debtReminderEnabled: false,
      });
    });

    expect(await screen.findByText(/Đã lưu cài đặt thông báo!/i)).toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith('MSG20', 'success');

    // Switch away to Tab 1 and back to Tab 4: cached preferences must survive without losing toggled state
    fireEvent.click(screen.getByRole('button', { name: 'Thông tin cơ sở & Trang trại' }));
    await screen.findByDisplayValue(farm.name);
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo cá nhân & Cảnh báo' }));

    expect(await screen.findByLabelText(/Cảnh báo môi trường \/ Thiết bị IoT/i)).not.toBeChecked();
    expect(screen.getByLabelText(/Nhắc công nợ & Đến hạn thanh toán/i)).not.toBeChecked();
    expect(screen.getByLabelText(/Thông báo trong ứng dụng/i)).toBeChecked();
  });

  it('hides debt alert toggle for ROLE_FARM_WORKER in Tab 4 and enforces read-only Tab 1', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    mocks.email = 'worker@farm.test';

    renderView('/general-settings?tab=notifications');

    expect(await screen.findByText(/Thông báo đẩy về Điện thoại & Trình duyệt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Thông báo trong ứng dụng/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cảnh báo môi trường \/ Thiết bị IoT/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nhắc lịch tiêm phòng vắc-xin & Công việc/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nhắc công nợ & Đến hạn thanh toán/i)).not.toBeInTheDocument();
  });
});
