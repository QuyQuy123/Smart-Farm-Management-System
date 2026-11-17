// src/features/auth/AuthLayout.jsx
// Login shell: farm photo across the whole page, logo + form card centred on top of it.
// The login-visual-panel / farmshift-auth-form-* classes keep the responsive rules in farmshift.css.
import React from 'react';
import farmLogo from '../../assets/logo_Farm.png';
import styles from './AuthLayout.module.css';

export const AuthLayout = ({ children }) => {
  return (
    <div className={styles.page}>
      {/* Ảnh trang trại phủ cả trang (nền của .page); logo ở góc trên, nhãn ở chân trang, ẩn trên màn hẹp. */}
      <div className={`login-visual-panel ${styles.visual}`}>
        <div className={styles.visualBrand}>
          <img src={farmLogo} alt="" className={styles.visualLogo} />
          <strong>
            FarmShift Management
            <small>Quản lý trang trại gà thịt</small>
          </strong>
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
