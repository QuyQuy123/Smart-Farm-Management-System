import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { User, Lock, Bell, Shield, Save } from 'lucide-react';
import styles from './Settings.module.css';

export const Settings = () => {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Hệ thống' }, { label: 'Cài đặt' }]}>
      <div className={styles.pageContainer}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Cài đặt hệ thống</h1>
            <p className={styles.pageSubtitle}>Quản lý cấu hình trang trại, bảo mật và thông báo</p>
          </div>
          <button className={styles.saveBtn}>
            <Save size={16} />
            Lưu thay đổi
          </button>
        </div>

        <div className={styles.layout}>
          {/* Sidebar */}
          <div className={styles.sidebar}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'general' ? styles.active : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <User size={18} /> Thông tin chung
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'security' ? styles.active : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Lock size={18} /> Bảo mật
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'notifications' ? styles.active : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={18} /> Thông báo
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'roles' ? styles.active : ''}`}
              onClick={() => setActiveTab('roles')}
            >
              <Shield size={18} /> Phân quyền
            </button>
          </div>

          {/* Content */}
          <div className={styles.content}>
            {activeTab === 'general' && (
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Thông tin trang trại</h3>
                <div className={styles.formGroup}>
                  <label>Tên trang trại</label>
                  <input type="text" defaultValue="Trang trại Miền Bình" />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Quy mô (Số lượng chuồng)</label>
                    <input type="number" defaultValue={10} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Tổng diện tích (m²)</label>
                    <input type="number" defaultValue={5000} />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Địa chỉ</label>
                  <textarea defaultValue="Thôn An Lạc, Xã Bình Minh, Huyện Kiến Xương, Thái Bình" rows={3}></textarea>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Đổi mật khẩu</h3>
                <div className={styles.formGroup}>
                  <label>Mật khẩu hiện tại</label>
                  <input type="password" placeholder="Nhập mật khẩu hiện tại" />
                </div>
                <div className={styles.formGroup}>
                  <label>Mật khẩu mới</label>
                  <input type="password" placeholder="Nhập mật khẩu mới" />
                </div>
                <div className={styles.formGroup}>
                  <label>Nhập lại mật khẩu mới</label>
                  <input type="password" placeholder="Nhập lại mật khẩu mới" />
                </div>
                
                <h3 className={styles.panelTitle} style={{ marginTop: '24px' }}>Bảo mật nâng cao</h3>
                <div className={styles.toggleGroup}>
                  <div>
                    <div className={styles.toggleTitle}>Xác thực 2 yếu tố (2FA)</div>
                    <div className={styles.toggleDesc}>Tăng cường bảo mật bằng mã OTP gửi về điện thoại</div>
                  </div>
                  <label className={styles.switch}>
                    <input type="checkbox" />
                    <span className={styles.slider}></span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Cấu hình nhận thông báo</h3>
                
                <div className={styles.toggleGroup}>
                  <div>
                    <div className={styles.toggleTitle}>Cảnh báo nhiệt độ IoT</div>
                    <div className={styles.toggleDesc}>Nhận thông báo khi nhiệt độ chuồng vượt ngưỡng an toàn</div>
                  </div>
                  <label className={styles.switch}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.toggleGroup}>
                  <div>
                    <div className={styles.toggleTitle}>Nhập/Xuất kho</div>
                    <div className={styles.toggleDesc}>Thông báo khi có phiếu xuất nhập kho mới được tạo</div>
                  </div>
                  <label className={styles.switch}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.toggleGroup}>
                  <div>
                    <div className={styles.toggleTitle}>Báo cáo công việc hàng ngày</div>
                    <div className={styles.toggleDesc}>Thông báo nhắc nhở nhân viên ghi nhật ký</div>
                  </div>
                  <label className={styles.switch}>
                    <input type="checkbox" />
                    <span className={styles.slider}></span>
                  </label>
                </div>
              </div>
            )}
            
            {activeTab === 'roles' && (
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Cài đặt phân quyền mặc định</h3>
                <p style={{color: 'var(--color-muted)', marginBottom: '20px', fontSize: 'var(--fs-body-md)'}}>
                  Tính năng này đang trong quá trình phát triển (Sprint tiếp theo).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
