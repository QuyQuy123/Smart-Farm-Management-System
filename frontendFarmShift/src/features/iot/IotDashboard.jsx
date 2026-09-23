// src/features/iot/IotDashboard.jsx
// Giám sát và Điều khiển Chuồng trại (Feature 11)
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Thermometer, Fan, Droplets, AlertTriangle, Activity } from 'lucide-react';
import styles from './Iot.module.css';

/* ── Components ─────────────────────────────────────────── */
function Switch({ checked, onChange, disabled }) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
      <span className={styles.slider}></span>
    </label>
  );
}

export const IotDashboard = () => {
  const [chuong, setChuong] = useState('Chuồng 1');
  const [tMax, setTMax] = useState(32);
  const [tMin, setTMin] = useState(24);
  const [autoMode, setAutoMode] = useState(true);
  const [fanOn, setFanOn] = useState(false);
  const [mistOn, setMistOn] = useState(false);

  // Simulation state
  const [tempData, setTempData] = useState(Array(15).fill(28)); // 15 points
  const currentTemp = tempData[tempData.length - 1];

  // Simulator
  useEffect(() => {
    const interval = setInterval(() => {
      setTempData(prev => {
        const last = prev[prev.length - 1];
        // Simulate random fluctuation
        let diff = (Math.random() - 0.4) * 0.8; // tend to go slightly up over time

        // If fans are on, temp drops
        if (fanOn) diff -= 0.6;
        if (mistOn) diff -= 0.8;

        // Bounded random walk
        let next = last + diff;
        if (next > 36) next = 36;
        if (next < 20) next = 20;

        return [...prev.slice(1), parseFloat(next.toFixed(1))];
      });
    }, 2000); // update every 2s
    return () => clearInterval(interval);
  }, [fanOn, mistOn]);

  // Auto mode logic
  useEffect(() => {
    if (autoMode) {
      if (currentTemp >= tMax) {
        setFanOn(true);
        if (currentTemp >= tMax + 1.5) setMistOn(true);
      } else if (currentTemp <= tMax - 1) {
        setFanOn(false);
        setMistOn(false);
      }
    }
  }, [currentTemp, tMax, autoMode]);

  const isAlert = currentTemp >= tMax + 1 || currentTemp <= tMin - 1;

  // Chart SVG coordinates
  const minTempChart = 20;
  const maxTempChart = 40;
  const chartHeight = 240;
  const getY = t => chartHeight - ((t - minTempChart) / (maxTempChart - minTempChart)) * chartHeight;
  const points = tempData.map((t, i) => `${(i / (tempData.length - 1)) * 100}%,${getY(t)}`).join(' ');

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Giám sát IoT' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-title-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-ink)' }}>
            Giám sát môi trường IoT
          </h1>
          <p style={{ color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <div className={styles.liveDot} /> Đang kết nối cảm biến real-time
          </p>
        </div>
        <select 
          value={chuong} 
          onChange={e => setChuong(e.target.value)}
          style={{ padding: '8px 16px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', fontSize: 16, fontWeight: 600 }}
        >
          <option>Chuồng 1</option>
          <option>Chuồng 2</option>
          <option>Chuồng 3</option>
        </select>
      </div>

      {isAlert && (
        <div className={styles.alertBanner}>
          <AlertTriangle size={20} />
          CẢNH BÁO: Nhiệt độ {chuong} đang ở mức nguy hiểm ({currentTemp}°C). SMS khẩn cấp đã được gửi tới chủ trại!
        </div>
      )}

      <div className={styles.iotGrid}>
        {/* Left: Temperature Chart */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Thermometer size={18} /> Nhiệt độ chuồng
            </div>
            <Badge variant={isAlert ? 'warning' : 'active'}>{isAlert ? 'Vượt ngưỡng' : 'Ổn định'}</Badge>
          </div>

          <div className={`${styles.tempValue} ${isAlert ? styles.tempDanger : styles.tempNormal}`}>
            {currentTemp.toFixed(1)}°C
          </div>
          <div style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Cập nhật 2 giây trước</div>

          {/* SVG Chart */}
          <div className={styles.chartContainer}>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
              {/* Threshold lines */}
              <line x1="0" y1={getY(tMax)} x2="100%" y2={getY(tMax)} className={styles.thresholdLine} />
              <line x1="0" y1={getY(tMin)} x2="100%" y2={getY(tMin)} className={styles.thresholdLine} style={{ borderTopColor: '#3b82f6' }} />
              
              {/* Data line */}
              <polyline 
                points={tempData.map((t, i) => `${(i / (tempData.length - 1)) * 100},${getY(t)}`).join(' ')} 
                fill="none" 
                stroke={isAlert ? 'var(--color-farm-red)' : 'var(--color-farm-green)'} 
                strokeWidth="3" 
                strokeLinejoin="round" 
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            
            {/* Axis labels */}
            <div style={{ position: 'absolute', left: -30, bottom: getY(tMax) - 10, fontSize: 12, color: 'var(--color-farm-red)', fontWeight: 600 }}>{tMax}°C</div>
            <div style={{ position: 'absolute', left: -30, bottom: getY(tMin) - 10, fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>{tMin}°C</div>
          </div>
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
          
          <div className={styles.card}>
            <div className={styles.cardHeader} style={{ marginBottom: 0 }}>
              <div className={styles.cardTitle}>
                <Activity size={18} /> Chế độ tự động
              </div>
              <Switch checked={autoMode} onChange={setAutoMode} />
            </div>
            {autoMode && (
              <div style={{ marginTop: 'var(--sp-md)', fontSize: 13, color: 'var(--color-muted)' }}>
                Hệ thống sẽ tự động bật quạt khi &gt;= {tMax}°C và phun sương khi &gt;= {tMax + 1.5}°C.
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle} style={{ marginBottom: 'var(--sp-md)' }}>Điều khiển thiết bị</div>
            
            <div className={styles.controlRow}>
              <div className={styles.controlInfo}>
                <span className={styles.controlLabel}><Fan size={14} style={{display:'inline', marginRight:4}}/> Quạt thông gió</span>
                <span className={styles.controlSub}>{fanOn ? 'Đang bật (Tốc độ cao)' : 'Đang tắt'}</span>
              </div>
              <Switch checked={fanOn} onChange={setFanOn} disabled={autoMode} />
            </div>

            <div className={styles.controlRow}>
              <div className={styles.controlInfo}>
                <span className={styles.controlLabel}><Droplets size={14} style={{display:'inline', marginRight:4}}/> Giàn phun sương</span>
                <span className={styles.controlSub}>{mistOn ? 'Đang bật' : 'Đang tắt'}</span>
              </div>
              <Switch checked={mistOn} onChange={setMistOn} disabled={autoMode} />
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Ngưỡng cảnh báo</div>
            <div className={styles.thresholdGrid}>
              <div className={styles.thresholdBox}>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>Ngưỡng CAO (T_max)</div>
                <input type="number" className={styles.thresholdInput} value={tMax} onChange={e => setTMax(parseFloat(e.target.value))} />
                <div style={{ fontSize: 12 }}>°C</div>
              </div>
              <div className={styles.thresholdBox}>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>Ngưỡng THẤP (T_min)</div>
                <input type="number" className={styles.thresholdInput} value={tMin} onChange={e => setTMin(parseFloat(e.target.value))} />
                <div style={{ fontSize: 12 }}>°C</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};
