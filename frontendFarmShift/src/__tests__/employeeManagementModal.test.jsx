import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { MemoryRouter } from 'react-router-dom';
import { AccountView, generateEmailFromName } from '../features/farmshift/AccountView';
import * as employeeService from '../services/employeeService';

vi.mock('../utils/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } }))
  }
}));

describe('Employee Creation & Auto-suggestion logic', () => {
  it('generateEmailFromName produces clean non-accented email slugs', () => {
    expect(generateEmailFromName('Trần Văn Kế Toán')).toBe('tranvanketoan@smartfarm.com');
    expect(generateEmailFromName('Lê Thị Ánh Tuyết')).toBe('lethianhtuyet@smartfarm.com');
    expect(generateEmailFromName('Nguyễn Đức Đạt')).toBe('nguyenducdat@smartfarm.com');
    expect(generateEmailFromName('  Vũ Đình    Khánh  ')).toBe('vudinhkhanh@smartfarm.com');
    expect(generateEmailFromName('')).toBe('');
  });

  it('auto-suggests email on name change, allows manual edit, and supports "↻ Đề xuất lại"', async () => {
    vi.spyOn(employeeService, 'getEmployees').mockResolvedValue([
      { id: 1, email: 'admin@smartfarm.com', fullName: 'Admin', role: 'ROLE_FARM_OWNER', isActive: true }
    ]);
    vi.spyOn(employeeService, 'getEmployeeSummary').mockResolvedValue({
      total: 1, active: 1, inactive: 0, ownerCount: 1, accountantCount: 0, workerCount: 0
    });
    const createEmployeeSpy = vi.spyOn(employeeService, 'createEmployee').mockResolvedValue({ id: 2 });

    render(
      <MemoryRouter>
        <AuthProvider>
          <NotificationProvider>
            <AccountView />
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Open Modal
    const addBtn = await screen.findByRole('button', { name: /Thêm nhân viên/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Thêm mới nhân viên')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/VD: Trần Văn Kế Toán/i);
    const emailInput = screen.getByPlaceholderText(/nhanvien@smartfarm\.com/i);
    const passwordInput = screen.getByPlaceholderText(/Mặc định: 123456/i);

    // 1. Type name -> Email auto-fills
    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn Nông Nghiệp' } });
    expect(emailInput.value).toBe('nguyenvannongnghiep@smartfarm.com');

    // 2. User edits email manually
    fireEvent.change(emailInput, { target: { value: 'custom.email@gmail.com' } });
    expect(emailInput.value).toBe('custom.email@gmail.com');

    // Changing name now should NOT overwrite manual email
    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn Nông Nghiệp VIP' } });
    expect(emailInput.value).toBe('custom.email@gmail.com');

    // 3. Click "↻ Đề xuất lại" button
    const suggestBtn = screen.getByText('↻ Đề xuất lại');
    fireEvent.click(suggestBtn);
    expect(emailInput.value).toBe('nguyenvannongnghiepvip@smartfarm.com');

    // 4. Leave password completely blank -> submit -> defaults to 123456
    expect(passwordInput.value).toBe('');

    const submitBtn = screen.getByRole('button', { name: /Tạo tài khoản & Lưu/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(createEmployeeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Nguyễn Văn Nông Nghiệp VIP',
          email: 'nguyenvannongnghiepvip@smartfarm.com',
          password: '123456'
        })
      );
    });
  });
});
