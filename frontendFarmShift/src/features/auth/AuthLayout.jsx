// src/features/auth/AuthLayout.jsx
// Bright white / green login shell: farm photo panel on the left, logo + form card on the right.
// The login-visual-panel / farmshift-auth-form-* classes keep the responsive rules in farmshift.css.
import React from 'react';
import farmLogo from '../../assets/logo_Farm.png';
import styles from './AuthLayout.module.css';

export const AuthLayout = ({ children }) => {
  return (
    <div className={styles.page}>
      <div className={`login-visual-panel ${styles.visual}`}>
        <div className={styles.visualBrand}>
          <img src={farmLogo} alt="" className={styles.visualLogo} />
          <strong>
            FarmShift Management
            <small>Quản lý trang trại gà thịt</small>
          </strong>
        </div>

        <div className={styles.visualBody}>
          <span className={styles.badge}>Nền tảng quản lý chăn nuôi chuyên biệt gia cầm</span>
          <h1>
            Giám sát chuồng trại.<br />
            Tự động hóa sổ sách & IoT.
          </h1>
          <p>
            Tích hợp đầy đủ từ nhật ký cho ăn từng cữ, cảm biến vi khí hậu trực tuyến, hóa đơn nhập xuất kho đến cân đối sổ quỹ theo thời gian thực.
          </p>
        </div>

        <div className={styles.ticks}>
          <span>✓ Chuẩn hóa quy trình nuôi</span>
          <span>✓ Bóc tách hóa đơn OCR</span>
          <span>✓ Bảo mật dữ liệu đám mây</span>
        </div>
      </div>

      <div className={`farmshift-auth-form-panel ${styles.formPanel}`}>
        <div className={`farmshift-auth-form-card ${styles.card}`}>
          <div className={styles.cardBrand}>
            <img src={farmLogo} alt="FarmShift" className={styles.cardLogo} />
            <small>Hệ thống quản lý trang trại thông minh</small>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};
