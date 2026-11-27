import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { AccountView, validateProfileField } from './AccountView';
import * as userService from '../../services/userService';
import * as employeeService from '../../services/employeeService';

vi.mock('../../utils/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } }))
  }
}));

describe('AccountView email validation and bidirectional profile/staff sync', () => {
  beforeEach(() => {
    sessionStorage.setItem('demo_mode', 'true');
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('validateProfileField("email", ...) rejects malformed emails and accepts valid ones', () => {
    expect(validateProfileField('email', '')).toContain('bắt buộc');
    expect(validateProfileField('email', 'invalid-email')).toContain('không đúng định dạng');
    expect(validateProfileField('email', 'admin@localhost')).toContain('không đúng định dạng');
    expect(validateProfileField('email', 'hiepgacute1989@gmail.c')).toContain('không đúng định dạng');
    expect(validateProfileField('email', 'hiepgacute1989@gmail.com')).toBe('');
  });

  it('saving profile in Hồ sơ cá nhân triggers a refresh of getEmployees for Owner', async () => {
    vi.spyOn(userService, 'getProfile').mockResolvedValue({
      fullName: 'Admin',
      email: 'admin@farmshift.local',
      phone: '0988111222',
      citizenId: '001000000000',
      address: 'Vĩnh Phúc',
      dateOfBirth: '',
      role: 'ROLE_FARM_OWNER'
    });
    vi.spyOn(userService, 'updateProfile').mockResolvedValue({
      fullName: 'Admin',
      email: 'admin@farmshift.local',
      phone: '0966755098',
      citizenId: '001000000000',
      address: 'Vĩnh Phúc',
      dateOfBirth: '',
      role: 'ROLE_FARM_OWNER'
    });
    const getEmployeesSpy = vi.spyOn(employeeService, 'getEmployees').mockResolvedValue([
      {
        id: 1,
        fullName: 'Admin',
        email: 'admin@farmshift.local',
        phone: '0988111222',
        roleName: 'ROLE_FARM_OWNER',
        isActive: true
      }
    ]);
    vi.spyOn(employeeService, 'getEmployeeSummary').mockResolvedValue({
      total: 1, active: 1, inactive: 0, ownerCount: 1, accountantCount: 0, workerCount: 0
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <NotificationProvider>
            <AccountView />
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const profileTabBtn = await screen.findByRole('button', { name: /Hồ sơ cá nhân/i });
    fireEvent.click(profileTabBtn);

    const phoneInput = await screen.findByLabelText(/Số điện thoại liên hệ/i);
    fireEvent.change(phoneInput, { target: { value: '0966755098' } });

    const initialCalls = getEmployeesSpy.mock.calls.length;

    const saveBtn = screen.getByRole('button', { name: /Lưu thay đổi hồ sơ/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(getEmployeesSpy.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
