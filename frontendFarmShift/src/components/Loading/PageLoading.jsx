// src/components/Loading/PageLoading.jsx
// Giao diện Màn hình Loading Đẳng cấp Công nghệ cao cho FarmShift
import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, AlertCircle, Zap, ShieldCheck } from 'lucide-react';
import styles from './PageLoading.module.css';

const LOADING_STEPS = [
  { text: 'Đang kết nối trung tâm điều hành trang trại...', icon: '🛰️' },
  { text: 'Đồng bộ chỉ số môi trường & cảm biến IoT chuồng nuôi...', icon: '🌡️' },
  { text: 'Kiểm tra dữ liệu đàn gà, định mức cám & chỉ số FCR...', icon: '📊' },
  { text: 'Xác thực chứng chỉ bảo mật và phạm vi phân quyền...', icon: '🔒' },
  { text: 'Hoàn tất khởi tạo bảng điều khiển thông minh...', icon: '✨' },
];

export const PageLoading = ({
  message,
  subMessage,
  fullscreen = true,
  showTimeoutHelper = true,
  onEnterDemo
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [showTimeout, setShowTimeout] = useState(false);

  // Chu kỳ đổi thông điệp trạng thái mỗi 1.4s
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1400);

    // Sau 3.5 giây nếu vẫn đang loading (ví dụ máy chủ backend chưa bật), hiện gợi ý demo
    const timeoutTimer = setTimeout(() => {
      if (showTimeoutHelper) {
        setShowTimeout(true);
      }
    }, 3500);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(timeoutTimer);
    };
  }, [showTimeoutHelper]);

  const handleStartDemo = () => {
    sessionStorage.setItem('demo_mode', 'true');
    if (onEnterDemo) {
      onEnterDemo();
    } else {
      window.location.reload();
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  const currentStep = LOADING_STEPS[stepIndex];

  return (
    <div className={fullscreen ? styles.loadingContainer : ''}>
      {/* ── Ambient Background Aurora Glow & Mesh Grid ─────────── */}
      <div className={styles.ambientBackdrop}>
        <div className={styles.auroraBlob1} />
        <div className={styles.auroraBlob2} />
        <div className={styles.auroraBlob3} />
        <div className={styles.gridPattern} />
      </div>

      {/* ── Central Glassmorphism Card ─────────────────────────── */}
      <div className={styles.glassCard}>
        {/* Hologram Stage: Concentric Animated Rings + Core Emblem */}
        <div className={styles.hologramStage}>
          {/* Radar ripples expanding outward */}
          <div className={styles.rippleWave} />
          <div className={styles.rippleWaveDelayed} />

          {/* Concentric SVG Rings */}
          <svg className={styles.svgRings} viewBox="0 0 140 140" fill="none">
            {/* Outer dotted/dashed orbital ring */}
            <circle
              cx="70"
              cy="70"
              r="64"
              stroke="#019788"
              strokeWidth="1.8"
              strokeDasharray="24 14 6 14"
              strokeOpacity="0.75"
              className={styles.outerRing}
            />

            {/* Orbiting glowing node on outer ring */}
            <circle
              cx="70"
              cy="6"
              r="3.5"
              fill="#8aaa34"
              className={styles.outerRing}
            />

            {/* Middle counter-rotating telemetry ring */}
            <circle
              cx="70"
              cy="70"
              r="52"
              stroke="#3684ed"
              strokeWidth="1.2"
              strokeDasharray="6 8"
              strokeOpacity="0.45"
              className={styles.middleRing}
            />

            {/* Inner breathing halo ring */}
            <circle
              cx="70"
              cy="70"
              r="40"
              stroke="#019788"
              strokeWidth="1.5"
              strokeOpacity="0.3"
              className={styles.innerPulseRing}
            />
          </svg>

          {/* Central Logo Emblem */}
          <div className={styles.centerEmblem}>
            {/* Smart Farm Sprout SVG */}
            <svg
              className={styles.sproutIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 20h10" />
              <path d="M12 20v-8" />
              <path d="M12 12a5 5 0 0 1 5-5c2 0 3 .5 3 2s-.5 3-2 3c-2.5 0-4.5-1.5-6 0Z" />
              <path d="M12 15a5 5 0 0 0-5-5c-2 0-3 .5-3 2s.5 3 2 3c2.5 0 4.5-1.5 6 0Z" />
            </svg>
          </div>
        </div>

        {/* ── Brand Title & Tag ─────────────────────────────────── */}
        <div className={styles.brandBadge}>
          <span className={styles.liveDot} />
          <span>Smart Farming OS • v2.0</span>
        </div>

        <h1 className={styles.brandTitle}>FarmShift</h1>
        <p className={styles.brandSubtitle}>
          {subMessage || 'Hệ thống Quản lý Trang trại Chăn nuôi Thông minh'}
        </p>

        {/* ── Dynamic Progress Bar ───────────────────────────────── */}
        <div className={styles.progressTrack}>
          <div className={styles.progressBar} />
        </div>

        {/* ── Cycling Status Message ─────────────────────────────── */}
        <div className={styles.statusMessageContainer}>
          <span style={{ fontSize: '15px' }}>{currentStep.icon}</span>
          <span key={stepIndex} className={styles.statusText}>
            {message || currentStep.text}
          </span>
        </div>

        {/* ── Telemetry Status Footer ────────────────────────────── */}
        <div className={styles.telemetryBar}>
          <div className={styles.telemetryItem}>
            <span>Cảm biến:</span>
            <strong>Thời gian thực</strong>
          </div>
          <div className={styles.telemetryItem}>
            <span>Mã hóa:</span>
            <strong>TLS 256-bit</strong>
          </div>
          <div className={styles.telemetryItem}>
            <span>Trạng thái:</span>
            <strong style={{ color: '#019788' }}>Sẵn sàng</strong>
          </div>
        </div>

        {/* ── Timeout Assistant / Quick Demo Mode Bypass ─────────── */}
        {showTimeout && (
          <div className={styles.timeoutNotice}>
            <div className={styles.timeoutHeader}>
              <AlertCircle size={15} />
              <span>Máy chủ phản hồi chậm hoặc đang khởi động?</span>
            </div>
            <p className={styles.timeoutDesc}>
              Bạn có thể vào ngay <strong>Chế độ Trải nghiệm (Offline Demo)</strong> để khám phá đầy đủ giao diện trang trại mà không cần đợi backend.
            </p>
            <div className={styles.timeoutActions}>
              <button
                type="button"
                className={styles.btnDemoQuick}
                onClick={handleStartDemo}
              >
                <Zap size={14} />
                <span>Vào chế độ Trải nghiệm ngay</span>
              </button>
              <button
                type="button"
                className={styles.btnReload}
                onClick={handleReload}
                title="Tải lại trang"
              >
                <RefreshCw size={13} />
                <span style={{ marginLeft: '4px' }}>Tải lại</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PageLoading;
