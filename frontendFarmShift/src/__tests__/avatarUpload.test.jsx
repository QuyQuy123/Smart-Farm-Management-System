import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountView } from '../features/farmshift/AccountView';
import { fileService } from '../services/fileService';

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  user: { email: 'avatar@test.local', fullName: 'Avatar User', role: 'ROLE_FARM_OWNER', avatarUrl: '/img/old.png' },
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, updateUser: mocks.updateUser }) }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: vi.fn() }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children }) => <div>{children}</div> }));
vi.mock('../services/fileService', () => ({ fileService: { uploadAvatar: vi.fn() } }));
vi.mock('../services/userService', () => ({ getProfile: async () => mocks.user, updateProfile: vi.fn(), changePassword: vi.fn() }));
vi.mock('../services/employeeService', () => ({ getEmployees: async () => [], getEmployeeById: vi.fn(), createEmployee: vi.fn(), updateEmployee: vi.fn() }));
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
  beforeEach(() => vi.clearAllMocks());

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
