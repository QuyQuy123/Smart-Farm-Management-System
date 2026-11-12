import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FarmShiftLayout } from '../layouts/FarmShiftLayout';
import { NotificationProvider, useNotification } from '../context/NotificationContext';
import { AuthProvider } from '../context/AuthContext';

// Helper component that can trigger notifications within the context
const NotificationTrigger = () => {
  const { sendNotification } = useNotification();
  return (
    <div>
      <button
        onClick={() => sendNotification({
          barn: 'Nhà A1',
          type: 'Thao tác thành công',
          value: 'Đã hoàn tất thử nghiệm.',
          level: 'Thành công'
        })}
      >
        Send Test Notification
      </button>
      <div data-testid="outside-element">Outside Area</div>
    </div>
  );
};

const renderLayout = () => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <NotificationProvider>
          <FarmShiftLayout pageTitle="Test Title">
            <NotificationTrigger />
          </FarmShiftLayout>
        </NotificationProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('Notification Dropdown Interactions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('toggles dropdown and closes when clicking outside', async () => {
    renderLayout();

    // Open dropdown by clicking bell
    const bellBtn = screen.getByTitle('Thông báo hệ thống');
    fireEvent.click(bellBtn);

    expect(screen.getByText('Thông báo & Cảnh báo')).toBeInTheDocument();

    // Click outside on the outside area
    const outsideEl = screen.getByTestId('outside-element');
    fireEvent.mouseDown(outsideEl);

    // Dropdown should be closed
    expect(screen.queryByText('Thông báo & Cảnh báo')).not.toBeInTheDocument();
  });

  it('closes dropdown when pressing Escape', async () => {
    renderLayout();

    const bellBtn = screen.getByTitle('Thông báo hệ thống');
    fireEvent.click(bellBtn);

    expect(screen.getByText('Thông báo & Cảnh báo')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Thông báo & Cảnh báo')).not.toBeInTheDocument();
  });

  it('marks all as read when clicking "Đã đọc" and changes styling', async () => {
    renderLayout();

    // Trigger a new notification
    fireEvent.click(screen.getByText('Send Test Notification'));

    // Open dropdown
    const bellBtn = screen.getByTitle('Thông báo hệ thống');
    fireEvent.click(bellBtn);

    expect(screen.getByText('Đã đọc')).toBeInTheDocument();

    // Click "Đã đọc"
    fireEvent.click(screen.getByText('Đã đọc'));

    // Now "Đã đọc tất cả" should appear instead of clickable "Đã đọc"
    expect(screen.getByText('Đã đọc tất cả')).toBeInTheDocument();
    expect(screen.getByText('0 mới')).toBeInTheDocument();
  });

  it('marks an individual notification as read when clicked', async () => {
    renderLayout();

    // Trigger a new notification
    fireEvent.click(screen.getByText('Send Test Notification'));

    // Open dropdown
    const bellBtn = screen.getByTitle('Thông báo hệ thống');
    fireEvent.click(bellBtn);

    // Find the notification card by its title attribute
    const unreadItems = screen.getAllByTitle('Nhấp để đánh dấu đã đọc');
    expect(unreadItems.length).toBeGreaterThan(0);
    const countBefore = unreadItems.length;

    // Click first unread item to mark as read
    fireEvent.click(unreadItems[0]);

    // Its title should no longer be unread, total unread items reduced by 1
    const unreadItemsAfter = screen.queryAllByTitle('Nhấp để đánh dấu đã đọc');
    expect(unreadItemsAfter.length).toBe(countBefore - 1);
  });

  it('clears all notifications and hides redundant boilerplate status text', () => {
    localStorage.setItem('farmshift_alerts', JSON.stringify([
      {
        id: 'legacy-toast-1',
        time: '00:18',
        createdAt: Date.now(),
        barn: 'Hệ thống FarmShift',
        type: 'Thao tác thành công',
        value: 'Đã ghi nhận thanh toán thành công.',
        level: 'Thành công',
        status: 'Đã hoàn tất & đồng bộ dữ liệu',
        read: false
      },
      {
        id: 'iot-1',
        time: '00:15',
        createdAt: Date.now() - 60000,
        barn: 'Nhà A1',
        type: 'Nhiệt độ cao',
        value: '29.2°C (Ngưỡng: 29.0°C)',
        level: 'Cảnh báo',
        status: 'Hệ thống quạt hút đang tăng tốc',
        read: false
      }
    ]));
    localStorage.setItem('farmshift_unread_alerts', '2');

    renderLayout();

    const bellBtn = screen.getByTitle('Thông báo hệ thống');
    fireEvent.click(bellBtn);

    expect(screen.getByText('2 mới')).toBeInTheDocument();
    expect(screen.getByText('Đã ghi nhận thanh toán thành công.')).toBeInTheDocument();
    expect(screen.queryByText('Đã hoàn tất & đồng bộ dữ liệu')).not.toBeInTheDocument();
    expect(screen.getByText('Hệ thống quạt hút đang tăng tốc')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Xóa tất cả'));
    expect(screen.getByText('Chưa có thông báo nào')).toBeInTheDocument();
  });
});
