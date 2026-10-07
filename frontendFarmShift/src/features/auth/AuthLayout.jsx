// src/features/auth/AuthLayout.jsx
// Exact FarmShift Management Login visual + form split panel (Synchronized with Login.jsx)
import React from 'react';
import farmLogo from '../../assets/logo_Farm.png';

export const AuthLayout = ({ children }) => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: 'var(--color-surface-soft)',
      fontFamily: 'var(--font-haas)'
    }}>
      {/* ── Left Editorial Signature Brand Panel ───────────── */}
      <div style={{
        flex: '1.1',
        backgroundColor: 'var(--color-surface-dark)',
        color: '#ffffff',
        padding: '64px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative'
      }} className="login-visual-panel">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={farmLogo}
              alt="FarmShift"
              style={{
                width: '38px',
                height: '38px',
                objectFit: 'contain'
              }}
            />
            <strong style={{ fontSize: '18px', letterSpacing: '-0.01em' }}>FarmShift Management</strong>
          </div>

          <div style={{ marginTop: '96px', maxWidth: '520px' }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 'var(--rounded-full)',
              backgroundColor: 'rgba(1, 151, 136, 0.2)',
              color: '#4db6ac',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '20px'
            }}>
              Nền tảng quản lý chăn nuôi chuyên biệt gia cầm
            </span>
            <h1 style={{
              fontSize: '38px',
              fontWeight: 400,
              lineHeight: 1.25,
              color: '#ffffff',
              margin: '0 0 20px'
            }}>
              Giám sát chuồng trại.<br />
              Tự động hóa sổ sách & IoT.
            </h1>
            <p style={{
              fontSize: '15px',
              color: '#94a3b8',
              lineHeight: 1.6,
              margin: 0
            }}>
              Tích hợp đầy đủ từ nhật ký cho ăn từng cữ, cảm biến vi khí hậu trực tuyến, hóa đơn nhập xuất kho đến cân đối sổ quỹ theo thời gian thực.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '32px', fontSize: '13px', color: '#94a3b8' }}>
          <div>✓ Chuẩn hóa quy trình 75 ngày</div>
          <div>✓ Quét hóa đơn AI OCR</div>
          <div>✓ Bảo mật dữ liệu đám mây</div>
        </div>
      </div>

      {/* ── Right Form Panel (Clean Canvas) ────────────────── */}
      <div style={{
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 32px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--color-canvas)',
          borderRadius: 'var(--rounded-lg)',
          border: '1px solid var(--color-hairline)',
          padding: '40px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
};
