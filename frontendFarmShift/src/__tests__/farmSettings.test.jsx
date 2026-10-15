import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GeneralSettingsView } from '../features/farmshift/GeneralSettingsView';
import { getFarm, updateFarm } from '../services/farmService';

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), role: 'ROLE_FARM_OWNER' }));
vi.mock('../services/farmService', () => ({ getFarm: vi.fn(), updateFarm: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children }) => <div>{children}</div> }));

const farm = { name: 'Tên từ database', owner: 'Người đại diện', phone: '0987654321', scale: '100 con', address: 'Hà Nội', type: 'Gia cầm' };
const renderView = () => render(<MemoryRouter><GeneralSettingsView /></MemoryRouter>);

describe('Farm settings persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.role = 'ROLE_FARM_OWNER';
    getFarm.mockResolvedValue({ ...farm });
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
});
