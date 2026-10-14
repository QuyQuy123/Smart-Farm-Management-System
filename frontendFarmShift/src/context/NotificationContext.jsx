// src/context/NotificationContext.jsx
// Quản lý trung tâm Thông báo & Cảnh báo IoT thời gian thực toàn hệ thống FarmShift
import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_FARMSHIFT_DATA } from '../data/farmshiftMockData';
import { SYSTEM_MESSAGES, getSystemMessage } from '../constants/systemMessages';

const NotificationContext = createContext();

/**
 * Định dạng thời gian thông báo động theo yêu cầu:
 * - Dưới 60 giây: "Vừa xong (HH:mm)"
 * - Từ 1 đến 59 phút: "X phút trước (HH:mm)"
 * - Từ 1 đến 24 giờ: "X giờ trước (HH:mm)"
 * - Qua ngày hôm sau: "DD/MM/YYYY HH:mm"
 */
export const formatNotificationTime = (createdAt, fallback = '') => {
  let ts = createdAt;
  if (!ts && fallback && typeof fallback === 'string') {
    const match = fallback.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const d = new Date();
      d.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
      ts = d.getTime();
    }
  }
  if (!ts && fallback) {
    return fallback;
  }
  if (typeof ts === 'string' && /^\d+$/.test(ts)) {
    ts = parseInt(ts, 10);
  }
  const date = ts instanceof Date ? ts : new Date(ts || Date.now());
  if (isNaN(date.getTime())) {
    return fallback || '';
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  // Kiểm tra cùng ngày hay khác ngày (qua ngày hôm sau)
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (diffSec < 60) {
    return `Vừa xong (${timeStr})`;
  }
  if (diffMin < 60 && isSameDay) {
    return `${diffMin} phút trước (${timeStr})`;
  }
  if (diffHours < 24 && isSameDay) {
    return `${diffHours} giờ trước (${timeStr})`;
  }

  // Qua ngày hôm sau hoặc trên 24 giờ: DD/MM/YYYY HH:mm
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year} ${timeStr}`;
};

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Chuẩn hóa nội dung hiển thị để tránh lặp từ (ví dụ: "Hồ sơ cá nhân: Hồ sơ cá nhân đã...")
 */
export const renderNotificationContent = (barn, value, isSuccess = false) => {
  if (!value) return null;
  let valTrimmed = String(value).trim();
  const barnTrimmed = String(barn || '').trim();

  // 1. Nếu bản thân value đã bị lặp prefix ở đầu:
  // Ví dụ: "Hồ sơ cá nhân: Hồ sơ cá nhân đã..." -> "Hồ sơ cá nhân đã..."
  if (barnTrimmed) {
    const colonPrefixRegex = new RegExp(`^${escapeRegex(barnTrimmed)}:\\s*`, 'i');
    if (colonPrefixRegex.test(valTrimmed)) {
      valTrimmed = valTrimmed.replace(colonPrefixRegex, '').trim();
    }
  }

  // 2. Nếu value đã bắt đầu bằng tên phân hệ (hoặc prefix):
  // Ví dụ: value = "Hồ sơ cá nhân đã được cập nhật thành công." và barn = "Hồ sơ cá nhân"
  // => Không prepend "Hồ sơ cá nhân: " ở đầu nữa để tránh lặp từ, hiển thị gọn gàng.
  if (barnTrimmed && valTrimmed.toLowerCase().startsWith(barnTrimmed.toLowerCase())) {
    return valTrimmed;
  }

  return (
    <>
      {barnTrimmed ? (
        <strong style={{ color: isSuccess ? '#15803d' : 'inherit' }}>
          {barnTrimmed}:{' '}
        </strong>
      ) : null}
      {valTrimmed}
    </>
  );
};

export const NotificationProvider = ({ children }) => {
  const [alerts, setAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('farmshift_alerts');
      const parsed = saved ? JSON.parse(saved) : INITIAL_FARMSHIFT_DATA.alerts;
      return parsed.map((al, idx) => {
        let createdAt = al.createdAt;
        if (!createdAt) {
          if (al.id && al.id.includes('-')) {
            const parts = al.id.split('-');
            const num = parseInt(parts[1], 10);
            if (!isNaN(num) && num > 1600000000000) {
              createdAt = num;
            }
          }
        }
        if (!createdAt && al.time) {
          const match = String(al.time).match(/(\d{1,2}):(\d{2})/);
          if (match) {
            const d = new Date();
            d.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
            createdAt = d.getTime();
          }
        }
        if (!createdAt) {
          createdAt = Date.now() - (idx * 20 + 5) * 60 * 1000;
        }

        // Clean any duplicate prefix in al.value
        let cleanValue = al.value || '';
        if (al.barn) {
          const prefixWithColon = `${al.barn}: `;
          if (cleanValue.startsWith(prefixWithColon)) {
            const remainder = cleanValue.slice(prefixWithColon.length);
            if (remainder.toLowerCase().startsWith(al.barn.toLowerCase())) {
              cleanValue = remainder;
            }
          }
        }

        return {
          ...al,
          createdAt,
          value: cleanValue
        };
      });
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
    const createdAt = Date.now();
    const now = new Date(createdAt);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newAlert = {
      id: 'al-' + createdAt,
      time: timeStr,
      createdAt,
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

    const createdAt = Date.now();
    const now = new Date(createdAt);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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
      id: 'toast-' + createdAt + '-' + Math.random().toString(36).slice(2, 6),
      time: timeStr,
      createdAt,
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
