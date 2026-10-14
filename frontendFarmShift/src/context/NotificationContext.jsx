// src/context/NotificationContext.jsx
// Quản lý trung tâm Thông báo & Cảnh báo IoT thời gian thực toàn hệ thống FarmShift
import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_FARMSHIFT_DATA } from '../data/farmshiftMockData';
import { SYSTEM_MESSAGES, getSystemMessage } from '../constants/systemMessages';

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

  /**
   * Bắn một thông báo hệ thống dạng Toast (hỗ trợ mã MSG hoặc text tự do)
   * và TỰ ĐỘNG GHI NHẬN vào danh sách thông báo trung tâm (chuông Header) khi thành công!
   * @param {string} messageOrCode - Mã MSG (ví dụ 'MSG03') hoặc chuỗi text
   * @param {'success'|'error'|'warning'|'info'} [type='success']
   * @param {Object} [params={}] - Tham số nếu có
   */
  const showToast = (messageOrCode, type = 'success', params = {}) => {
    let text = messageOrCode;
    let toastLevel = type === 'error' ? 'Lỗi' : type === 'warning' ? 'Cảnh báo' : type === 'info' ? 'Thông báo' : 'Thành công';
    let msgType = type;

    if (SYSTEM_MESSAGES && SYSTEM_MESSAGES[messageOrCode]) {
      const def = SYSTEM_MESSAGES[messageOrCode];
      text = getSystemMessage(messageOrCode, params, 'vi');
      if (def.type.includes('success')) toastLevel = 'Thành công';
      else if (def.type.includes('error')) toastLevel = 'Lỗi';
      else if (def.type.includes('warning')) toastLevel = 'Cảnh báo';
      else toastLevel = 'Thông báo';
      msgType = toastLevel;
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} - Vừa xong`;

    // Phân loại nguồn thao tác tự động dựa vào nội dung thông báo
    let source = 'Hệ thống FarmShift';
    const textLower = (text || '').toLowerCase();
    if (textLower.includes('hồ sơ') || textLower.includes('cá nhân')) source = 'Hồ sơ cá nhân';
    else if (textLower.includes('mật khẩu') || textLower.includes('bảo mật')) source = 'Bảo mật tài khoản';
    else if (textLower.includes('nhân viên') || textLower.includes('nhân sự')) source = 'Tài khoản & Nhân sự';
    else if (textLower.includes('quạt') || textLower.includes('đèn') || textLower.includes('iot')) source = 'Điều khiển thiết bị IoT';
    else if (textLower.includes('chuồng') || textLower.includes('nhà') || textLower.includes('khu')) source = 'Khu nuôi & Chuồng trại';
    else if (textLower.includes('kho') || textLower.includes('nhập hàng') || textLower.includes('xuất')) source = 'Kho hàng hóa';
    else if (textLower.includes('bán') || textLower.includes('đơn hàng')) source = 'Quản lý bán hàng';
    else if (textLower.includes('quỹ') || textLower.includes('thu') || textLower.includes('chi') || textLower.includes('tiền')) source = 'Sổ quỹ';
    else if (textLower.includes('tiêu chuẩn') || textLower.includes('định mức')) source = 'Thiết lập chăn nuôi';

    const toastObj = {
      id: 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      time: timeStr,
      barn: source,
      type: toastLevel === 'Thành công' ? 'Thao tác thành công' : toastLevel,
      value: text,
      level: toastLevel,
      status: toastLevel === 'Thành công' ? 'Đã hoàn tất & đồng bộ dữ liệu' : 'Hệ thống đã ghi nhận',
      isSystem: true
    };

    // Khi bất cứ thao tác nào SUCCESS:
    // Tự động ghi nhận vào danh sách thông báo trung tâm (alerts) để người dùng xem lại trong menu Chuông Header!
    if (type === 'success' || toastLevel === 'Thành công') {
      setAlerts(prev => [toastObj, ...prev.slice(0, 49)]); // Lưu tối đa 50 thông báo gần nhất
      setUnreadCount(prev => prev + 1);
    }

    // Hiển thị toast popup nổi ở góc phải màn hình
    setActiveToast(toastObj);
    setTimeout(() => {
      setActiveToast(prev => prev?.id === toastObj.id ? null : prev);
    }, 4500);

    // Bắn sự kiện Custom Event
    window.dispatchEvent(new CustomEvent('farmshift_new_alert', { detail: toastObj }));

    return toastObj;
  };

  return (
    <NotificationContext.Provider value={{
      alerts,
      unreadCount,
      activeToast,
      sendNotification,
      showToast,
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
