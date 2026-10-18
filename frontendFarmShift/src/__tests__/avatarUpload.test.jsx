import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountView } from '../features/farmshift/AccountView';
import { fileService } from '../services/fileService';
import { updateEmployee } from '../services/employeeService';

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  employees: [],
  user: { email: 'avatar@test.local', fullName: 'Avatar User', role: 'ROLE_FARM_OWNER', avatarUrl: '/img/old.png' },
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, updateUser: mocks.updateUser }) }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: vi.fn() }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children }) => <div>{children}</div> }));
vi.mock('../services/fileService', () => ({ fileService: { uploadAvatar: vi.fn(), uploadFile: vi.fn() } }));
vi.mock('../services/userService', () => ({ getProfile: async () => mocks.user, updateProfile: vi.fn(), changePassword: vi.fn() }));
vi.mock('../services/employeeService', () => ({ getEmployees: async () => mocks.employees, getEmployeeById: vi.fn(), createEmployee: vi.fn(), updateEmployee: vi.fn() }));
vi.mock('../features/profile/AvatarCropperModal', () => ({
  AvatarCropperModal: ({ onCropComplete }) => <button onClick={() => onCropComplete('data:image/png;base64,preview', new File(['image'], 'avatar.png', { type: 'image/png' }))}>Confirm crop</button>,
}));

async function selectAndCrop() {
  const view = render(<MemoryRouter initialEntries={['/account?tab=profile']}><AccountView /></MemoryRouter>);
  await screen.findByDisplayValue('Avatar User');
  fireEvent.change(view.container.querySelector('input[type="file"]'), {
    target: { files: [new File(['image'], 'avatar.png', { type: 'image/png' })] },
  });
  const confirm = await screen.findByRole('button', { name: 'Confirm crop' });
  await act(async () => { fireEvent.click(confirm); });
}

describe('Profile avatar upload', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.employees = []; });

  it('uploads the employee photo on save and sends its URL to the correct employee', async () => {
    mocks.employees = [{ id: 42, fullName: 'Employee', email: 'employee@test.local', phone: '', roleName: 'ROLE_FARM_WORKER', isActive: true }];
    fileService.uploadFile.mockResolvedValue('/img/avatars/employee.png');
    updateEmployee.mockResolvedValue({ id: 42 });
    render(<MemoryRouter initialEntries={['/account']}><AccountView /></MemoryRouter>);
    fireEvent.click(await screen.findByTitle('Chỉnh sửa & Phân quyền'));
    fireEvent.change(screen.getByLabelText('Thay đổi ảnh nhân viên'), {
      target: { files: [new File(['image'], 'employee.png', { type: 'image/png' })] },
    });
    const confirm = await screen.findByRole('button', { name: 'Confirm crop' });
    await act(async () => { fireEvent.click(confirm); });
    expect(fileService.uploadFile).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' })); });
    expect(fileService.uploadFile).toHaveBeenCalledWith(expect.any(File), 'avatars');
    expect(updateEmployee).toHaveBeenCalledWith(42, expect.objectContaining({ avatarUrl: '/img/avatars/employee.png' }));
    expect(fileService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('updates the profile and header with the saved URL after successful upload', async () => {
    fileService.uploadAvatar.mockResolvedValue('/img/avatars/saved.png');
    await selectAndCrop();
    await waitFor(() => expect(screen.getByAltText('Avatar')).toHaveAttribute('src', '/img/avatars/saved.png'));
    expect(mocks.updateUser).toHaveBeenCalledWith({ avatarUrl: '/img/avatars/saved.png' });
    expect(screen.getByText('Đã lưu ảnh đại diện thành công.')).toBeInTheDocument();
  });

  it('keeps the saved avatar and reports an error when upload fails', async () => {
    fileService.uploadAvatar.mockRejectedValue(new Error('Offline'));
    await selectAndCrop();
    await screen.findByText('Không lưu được ảnh đại diện. Vui lòng thử lại.');
    expect(screen.getByAltText('Avatar')).toHaveAttribute('src', '/img/old.png');
    expect(mocks.updateUser).not.toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: expect.stringContaining('data:') }));
  });
});
