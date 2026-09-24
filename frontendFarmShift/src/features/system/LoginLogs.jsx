import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Search, History, MonitorSmartphone, Globe, Clock } from 'lucide-react';
import styles from './System.module.css';

export const LoginLogs = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Dummy data for login logs
  const logs = [
    { id: 1, user: 'Admin (Farm Owner)', role: 'ROLE_FARM_OWNER', ip: '192.168.1.45', device: 'Windows / Chrome', location: 'Hà Nội, VN', status: 'Thành công', time: '2026-09-24 10:15:22' },
    { id: 2, user: 'Kế toán trưởng', role: 'ROLE_ACCOUNTANT', ip: '14.232.112.98', device: 'MacOS / Safari', location: 'Hồ Chí Minh, VN', status: 'Thành công', time: '2026-09-24 08:30:10' },
    { id: 3, user: 'Admin (Farm Owner)', role: 'ROLE_FARM_OWNER', ip: '192.168.1.45', device: 'Windows / Chrome', location: 'Hà Nội, VN', status: 'Thất bại (Sai mật khẩu)', time: '2026-09-24 07:12:05' },
    { id: 4, user: 'Nhân công 1', role: 'ROLE_FARM_WORKER', ip: '113.190.23.11', device: 'Android / Chrome', location: 'Bắc Ninh, VN', status: 'Thành công', time: '2026-09-23 18:45:00' },
    { id: 5, user: 'Admin (Farm Owner)', role: 'ROLE_FARM_OWNER', ip: '203.113.14.55', device: 'iOS / Safari', location: 'Hà Nội, VN', status: 'Thành công', time: '2026-09-23 09:20:15' },
  ];

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Hệ thống' }, { label: 'Nhật ký đăng nhập' }]}>
      <div className={styles.pageContainer}>
        <div className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>Nhật ký đăng nhập</h1>
            <p className={styles.pageSubtitle}>Theo dõi lịch sử truy cập hệ thống của người dùng.</p>
          </div>
          <div className={styles.headerRight}>
             <div className={styles.searchBox}>
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm theo tên, IP..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
        </div>

        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người dùng</th>
                <th>Thiết bị & Trình duyệt</th>
                <th>IP & Vị trí</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>
                    <div className={styles.timeCell}>
                      <Clock size={16} className={styles.icon} />
                      <span>{log.time}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.userName}>{log.user}</span>
                      <span className={styles.userRole}>{log.role === 'ROLE_FARM_OWNER' ? 'Farm Owner' : log.role === 'ROLE_ACCOUNTANT' ? 'Kế Toán' : 'Nhân Công'}</span>
                    </div>
                  </td>
                  <td>
                     <div className={styles.deviceCell}>
                        <MonitorSmartphone size={16} className={styles.icon} />
                        <span>{log.device}</span>
                     </div>
                  </td>
                  <td>
                     <div className={styles.ipCell}>
                        <Globe size={16} className={styles.icon} />
                        <div className={styles.ipInfo}>
                           <span className={styles.ipAddress}>{log.ip}</span>
                           <span className={styles.location}>{log.location}</span>
                        </div>
                     </div>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${log.status.includes('Thành công') ? styles.statusSuccess : styles.statusFailed}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};
