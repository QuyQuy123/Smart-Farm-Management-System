import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider, useNotification, formatNotificationTime, renderNotificationContent } from '../context/NotificationContext';
import { MemoryRouter } from 'react-router-dom';
import {
  AccountView,
  validateProfileField,
  validateAllProfile,
  validatePasswordField,
  validateAllPassword
} from '../features/farmshift/AccountView';
import * as userService from '../services/userService';
import * as employeeService from '../services/employeeService';

vi.mock('../utils/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } }))
  }
}));

describe('Dynamic Frontend Validation Functions', () => {
  describe('validateProfileField - Citizen ID (CMND/CCCD)', () => {
    it('returns error when citizenId has 11 digits (user screenshot scenario)', () => {
      const err = validateProfileField('citizenId', '00120404978');
      expect(err).toContain('Số CMND/CCCD phải gồm đúng 9 chữ số (CMND) hoặc 12 chữ số (CCCD)');
      expect(err).toContain('11 số');
    });

    it('returns error when citizenId has non-digits', () => {
      const err = validateProfileField('citizenId', '001204abc789');
      expect(err).toContain('chỉ được chứa các chữ số');
    });

    it('returns empty string for valid 9-digit CMND', () => {
      expect(validateProfileField('citizenId', '123456789')).toBe('');
    });

    it('returns empty string for valid 12-digit CCCD', () => {
      expect(validateProfileField('citizenId', '001204049789')).toBe('');
    });

    it('returns empty string for empty optional field', () => {
      expect(validateProfileField('citizenId', '')).toBe('');
      expect(validateProfileField('citizenId', null)).toBe('');
    });
  });

  describe('validateProfileField - Phone Number', () => {
    it('returns error when phone number has invalid digits or length', () => {
      expect(validateProfileField('phone', '0966755')).toContain('phải gồm 10 hoặc 11 chữ số');
      expect(validateProfileField('phone', '0966755abc')).toContain('chỉ được chứa các chữ số');
      expect(validateProfileField('phone', '1234567890')).toContain('cần bắt đầu bằng số 0');
    });

    it('returns empty string for valid phone numbers', () => {
      expect(validateProfileField('phone', '0966755089')).toBe('');
      expect(validateProfileField('phone', '01234567890')).toBe('');
    });
  });

  describe('validateProfileField - Full Name', () => {
    it('validates mandatory full name rules', () => {
      expect(validateProfileField('fullName', '')).toContain('bắt buộc');
      expect(validateProfileField('fullName', '   ')).toContain('bắt buộc');
      expect(validateProfileField('fullName', 'A')).toContain('ít nhất 2 ký tự');
      expect(validateProfileField('fullName', 'Trần Văn FarmShift')).toBe('');
    });
  });

  describe('validateProfileField - Date of Birth', () => {
    it('validates birth date in past and age constraints', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      expect(validateProfileField('dateOfBirth', tomorrowStr)).toContain('phải ở trong quá khứ');

      expect(validateProfileField('dateOfBirth', '1850-01-01')).toContain('từ năm 1920 trở lại đây');
      expect(validateProfileField('dateOfBirth', '2004-10-29')).toBe('');
    });
  });

  describe('validatePasswordField', () => {
    it('validates password requirements and matching', () => {
      expect(validatePasswordField('currentPassword', '')).toContain('Vui lòng nhập mật khẩu hiện tại');
      expect(validatePasswordField('newPassword', '12345')).toContain('ít nhất 8 ký tự');
      expect(validatePasswordField('newPassword', 'password123', { currentPassword: 'password123' }))
        .toContain('không được trùng');
      expect(validatePasswordField('confirmPassword', 'diff1234', { newPassword: 'password123' }))
        .toContain('không khớp');
      expect(validatePasswordField('confirmPassword', 'password123', { newPassword: 'password123' }))
        .toBe('');
    });
  });
});

describe('Interactive Dynamic Validation in AccountView Component', () => {
  it('displays real-time live validation error on typing invalid CCCD without clicking submit', async () => {
    vi.spyOn(userService, 'getProfile').mockResolvedValue({
      fullName: 'Admin123',
      email: 'hiepgacute1989@gmail.com',
      phone: '0966755089',
      citizenId: '001204049789',
      address: 'Hà Nội',
      dateOfBirth: '2004-10-29',
      role: 'ROLE_FARM_OWNER'
    });
    const updateProfileSpy = vi.spyOn(userService, 'updateProfile').mockResolvedValue({});

    render(
      <MemoryRouter>
        <AuthProvider>
          <NotificationProvider>
            <AccountView />
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Switch to "Hồ sơ cá nhân" tab
    const profileTabBtn = await screen.findByRole('button', { name: /Hồ sơ cá nhân/i });
    fireEvent.click(profileTabBtn);

    const cccdInput = await screen.findByLabelText(/Số CMND\/CCCD/i);
    expect(cccdInput).toBeInTheDocument();

    // User types 11 digits: '00120404978' (matching the exact screenshot from the user!)
    fireEvent.change(cccdInput, { target: { value: '00120404978' } });

    // Expect real-time dynamic error to appear immediately WITHOUT clicking submit!
    const errorMsg = await screen.findByText(/Số CMND\/CCCD phải gồm đúng 9 chữ số \(CMND\) hoặc 12 chữ số \(CCCD\)/i);
    expect(errorMsg).toBeInTheDocument();
    expect(cccdInput.classList.contains('is-invalid')).toBe(true);

    // Try to click Submit while field is invalid: should BLOCK backend call
    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi hồ sơ/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Backend must NEVER have been called!
    expect(updateProfileSpy).not.toHaveBeenCalled();

    // Now user types the 12th digit ('001204049789')
    fireEvent.change(cccdInput, { target: { value: '001204049789' } });

    // Error under the field should disappear dynamically!
    await waitFor(() => {
      expect(document.querySelector('.farmshift-field-error-msg')).toBeNull();
      expect(cccdInput.classList.contains('is-valid')).toBe(true);
    });
  });

  it('automatically logs success operations into Notification Center (alerts) for header review', async () => {
    let notifContext;
    const TestComponent = () => {
      notifContext = useNotification();
      return (
        <button onClick={() => notifContext.showToast('MSG13', 'success')}>
          Trigger Success
        </button>
      );
    };

    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    const initialCount = notifContext.alerts.length;
    const btn = screen.getByText('Trigger Success');
    fireEvent.click(btn);

    expect(notifContext.alerts.length).toBe(initialCount + 1);
    expect(notifContext.alerts[0].value).toContain('Hồ sơ cá nhân đã được cập nhật thành công');
    expect(notifContext.alerts[0].level).toBe('Thành công');
    expect(notifContext.alerts[0].barn).toBe('Hồ sơ cá nhân');
  });

  describe('formatNotificationTime & renderNotificationContent helpers', () => {
    it('formats relative times properly according to duration rules', () => {
      const now = Date.now();
      
      // Under 60 seconds
      const justNow = formatNotificationTime(now - 15 * 1000);
      expect(justNow).toMatch(/^Vừa xong \(\d{2}:\d{2}\)$/);

      // 1 to 59 minutes (handles midnight boundary if run right after 00:00)
      const dNow = new Date();
      const fiveMins = formatNotificationTime(now - 5 * 60 * 1000);
      if (dNow.getHours() === 0 && dNow.getMinutes() < 6) {
        expect(fiveMins).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
      } else {
        expect(fiveMins).toMatch(/^5 phút trước \(\d{2}:\d{2}\)$/);
      }

      // 1 to 24 hours (e.g., 3 hours ago on same day)
      if (dNow.getHours() >= 4) {
        const threeHours = formatNotificationTime(now - 3 * 3600 * 1000);
        expect(threeHours).toMatch(/^3 giờ trước \(\d{2}:\d{2}\)$/);
      }

      // Past day / > 24 hours
      const yesterday = formatNotificationTime(now - 48 * 3600 * 1000);
      expect(yesterday).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    });

    it('deduplicates category/barn prefixes properly in renderNotificationContent', () => {
      // If message starts with barn name, avoid prepending barn:
      const rendered1 = renderNotificationContent('Hồ sơ cá nhân', 'Hồ sơ cá nhân đã được cập nhật thành công.');
      expect(rendered1).toBe('Hồ sơ cá nhân đã được cập nhật thành công.');

      // If message has double prefix in value, strip first
      const rendered2 = renderNotificationContent('Hồ sơ cá nhân', 'Hồ sơ cá nhân: Hồ sơ cá nhân đã được cập nhật thành công.');
      expect(rendered2).toBe('Hồ sơ cá nhân đã được cập nhật thành công.');

      // If message does not repeat barn name, return strong barn prefix
      const rendered3 = renderNotificationContent('Nhà A1', '29.2°C (Ngưỡng 29.0°C)');
      expect(React.isValidElement(rendered3)).toBe(true);
    });
  });
});

