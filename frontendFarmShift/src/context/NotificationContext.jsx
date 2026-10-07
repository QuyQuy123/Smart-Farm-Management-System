// src/context/NotificationContext.jsx
// Quản lý trung tâm Thông báo & Cảnh báo IoT thời gian thực toàn hệ thống FarmShift
import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_FARMSHIFT_DATA } from '../data/farmshiftMockData';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [alerts, setAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('farmshift_alerts');
      return saved ? JSON.parse(saved) : INITIAL_FARMSHIFT_DATA.alerts;
    } catch (e) {
      return INITIAL_FARMSHIFT_DATA.alerts;
    }
  });

  const [unreadCount, setUnreadCount] = useState(() => {
    try {
      const saved = localStorage.getItem('farmshift_unread_alerts');
      return saved !== null ? parseInt(saved, 10) : INITIAL_FARMSHIFT_DATA.alerts.length;
    } catch (e) {
      return INITIAL_FARMSHIFT_DATA.alerts.length;
    }
  });

  const [activeToast, setActiveToast] = useState(null);

  // Lưu trữ đồng bộ vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('farmshift_alerts', JSON.stringify(alerts));
      localStorage.setItem('farmshift_unread_alerts', unreadCount.toString());
    } catch (e) { }
  }, [alerts, unreadCount]);

  /**
   * Bắn một thông báo / cảnh báo mới lên thanh Header
   * @param {Object} param0 
   * @param {string} param0.barn - Tên chuồng hoặc khu vực (ví dụ: Nhà A1)
   * @param {string} param0.type - Loại cảnh báo (ví dụ: Nhiệt độ cao, Bật đèn, Tồn kho)
   * @param {string} param0.value - Giá trị cụ thể (ví dụ: 31.8°C (Ngưỡng 29.5°C))
   * @param {string} param0.level - Mức độ ('Cảnh báo' | 'Nhắc nhở' | 'Thành công')
   * @param {string} param0.status - Trạng thái / Hành động xử lý
   */
  const sendNotification = ({ barn = 'Toàn trại', type = 'Cảnh báo IoT', value = '', level = 'Cảnh báo', status = 'Hệ thống đã ghi nhận' }) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} - Vừa xong`;

    const newAlert = {
      id: 'al-' + Date.now(),
      time: timeStr,
      barn,
      type,
      value,
      level,
      status
    };

    setAlerts(prev => [newAlert, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Kích hoạt banner toast nổi ở góc phải màn hình
    setActiveToast(newAlert);
    setTimeout(() => {
      setActiveToast(null);
    }, 4500);

    // Bắn sự kiện Custom Event
    window.dispatchEvent(new CustomEvent('farmshift_new_alert', { detail: newAlert }));

    return newAlert;
  };

  const markAllAsRead = () => {
    setUnreadCount(0);
  };

  const clearAllAlerts = () => {
    setAlerts([]);
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{
      alerts,
      unreadCount,
      activeToast,
      sendNotification,
      markAllAsRead,
      clearAllAlerts,
      setActiveToast
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
