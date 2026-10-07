// src/components/StockTempChart/StockTempChart.jsx
// Biểu đồ biến động Nhiệt độ & Độ ẩm thời gian thực phong cách Bảng giá Chứng khoán (Trading Ticker)
// Tích hợp Động cơ Live Ticker: Chạy trực tiếp trên Frontend, phản ứng theo tốc độ Quạt IoT
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Thermometer, Droplets, Clock,
  Calendar, Zap, Activity, Info, ChevronRight, Sliders, Play,
  Pause, RotateCcw, Radio
} from 'lucide-react';
import styles from './StockTempChart.module.css';

export const StockTempChart = ({
  barnName = 'Nhà A1',
  areaName = 'Khu Mía Thịt',
  currentTemp = 31.5,
  currentHumidity = 68,
  tempThreshold = 29.5,
  fan = { on: true, speed: 2 },
  externalPoints = null,
  onLiveTempChange = null,
  onClose = null
}) => {
  const [metricType, setMetricType] = useState('temp'); // 'temp' | 'humidity'
  const [timeframe, setTimeframe] = useState('24h'); // '24h' | '7d' | '30d'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Live Stream Engine States
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [liveTemp, setLiveTemp] = useState(Number(currentTemp));
  const [liveHumidity, setLiveHumidity] = useState(Number(currentHumidity));
  const [flashClass, setFlashClass] = useState(''); // 'flashUp' | 'flashDown' | ''
  const prevTempRef = useRef(Number(currentTemp));
  const fanRef = useRef(fan);
  const onLiveTempChangeRef = useRef(onLiveTempChange);
  const liveHumidityRef = useRef(Number(currentHumidity));
  const prevBarnRef = useRef(barnName);

  useEffect(() => {
    fanRef.current = fan;
  }, [fan]);

  useEffect(() => {
    onLiveTempChangeRef.current = onLiveTempChange;
  }, [onLiveTempChange]);

  // Helper: smooth initial points curve around base temperature
  const generateInitialPoints = (baseT, baseH, currentFan) => {
    const fanLabel = currentFan?.on ? `Cấp ${currentFan?.speed || 2}` : 'Tắt';
    return [
      { time: '22:00', temp: Number((baseT - 0.4).toFixed(1)), humidity: Math.min(85, Math.round(baseH + 2)), fan: 'Tắt' },
      { time: '22:30', temp: Number((baseT - 0.2).toFixed(1)), humidity: Math.min(85, Math.round(baseH + 1)), fan: 'Tắt' },
      { time: '23:00', temp: Number((baseT - 0.1).toFixed(1)), humidity: Math.round(baseH), fan: 'Cấp 1' },
      { time: '23:10', temp: Number((baseT + 0.2).toFixed(1)), humidity: Math.max(55, Math.round(baseH - 1)), fan: 'Cấp 2' },
      { time: '23:15', temp: Number((baseT + 0.1).toFixed(1)), humidity: Math.round(baseH), fan: 'Cấp 2' },
      { time: '23:20', temp: Number((baseT - 0.1).toFixed(1)), humidity: Math.round(baseH), fan: 'Cấp 2' },
      { time: 'LIVE', temp: Number(baseT.toFixed(1)), humidity: Math.round(baseH), fan: fanLabel }
    ];
  };

  // Initial streaming dataset for 24h
  const [streamPoints, setStreamPoints] = useState(() => 
    generateInitialPoints(Number(currentTemp) || 30.5, Number(currentHumidity) || 68, fan)
  );

  // Sync if barnName changes externally
  useEffect(() => {
    if (prevBarnRef.current !== barnName) {
      prevBarnRef.current = barnName;
      const baseT = Number(currentTemp) || 30.5;
      const baseH = Number(currentHumidity) || 68;
      setLiveTemp(baseT);
      setLiveHumidity(baseH);
      liveHumidityRef.current = baseH;
      prevTempRef.current = baseT;
      setStreamPoints(generateInitialPoints(baseT, baseH, fan));
    }
  }, [barnName, currentTemp, currentHumidity, fan]);

  // Static reference sets for 7d and 30d
  const sevenDayPoints = useMemo(() => [
    { time: 'T2 (01/10)', temp: 28.2, humidity: 70, fan: 'Bình thường' },
    { time: 'T3 (02/10)', temp: 29.0, humidity: 68, fan: 'Bình thường' },
    { time: 'T4 (03/10)', temp: 31.5, humidity: 63, fan: 'Nhiệt cao' },
    { time: 'T5 (04/10)', temp: 30.8, humidity: 65, fan: 'Bình thường' },
    { time: 'T6 (05/10)', temp: 27.5, humidity: 74, fan: 'Mưa mát' },
    { time: 'T7 (06/10)', temp: 29.2, humidity: 69, fan: 'Bình thường' },
    { time: 'Hôm nay', temp: liveTemp, humidity: liveHumidity, fan: fan?.on ? `Cấp ${fan?.speed}` : 'Tắt' }
  ], [liveTemp, liveHumidity, fan]);

  const thirtyDayPoints = useMemo(() => [
    { time: 'Tuần 1', temp: 27.1, humidity: 72, fan: 'Giai đoạn úm' },
    { time: 'Tuần 2', temp: 28.4, humidity: 69, fan: 'Tăng trưởng' },
    { time: 'Tuần 3', temp: 29.8, humidity: 66, fan: 'Thông thoáng' },
    { time: 'Tuần 4', temp: 30.5, humidity: 65, fan: 'Vỗ béo' },
    { time: 'Hiện tại', temp: liveTemp, humidity: liveHumidity, fan: fan?.on ? `Cấp ${fan?.speed}` : 'Tắt' }
  ], [liveTemp, liveHumidity, fan]);

  // Real-Time Live Ticker Engine: ticks every 1.6s (chỉ chạy nội bộ nếu không có externalPoints từ parent)
  useEffect(() => {
    if (externalPoints || !isLiveStreaming || timeframe !== '24h') return;

    const timer = setInterval(() => {
      setLiveTemp((prev) => {
        // Dynamic IoT Reaction based on Ventilation Fan status!
        let drift = 0;
        if (fanRef.current?.on) {
          const coolRate = fanRef.current.speed === 3 ? 0.09 : fanRef.current.speed === 2 ? 0.06 : 0.035;
          drift = -coolRate;
        } else {
          drift = 0.055;
        }

        const jitter = (Math.random() - 0.48) * 0.08;
        let nextTemp = Number((prev + drift + jitter).toFixed(1));

        if (nextTemp < 25.0) nextTemp = 25.1;
        if (nextTemp > 34.0) nextTemp = 33.9;

        if (nextTemp > prevTempRef.current) {
          setFlashClass(styles.flashUp);
        } else if (nextTemp < prevTempRef.current) {
          setFlashClass(styles.flashDown);
        }
        prevTempRef.current = nextTemp;
        setTimeout(() => setFlashClass(''), 600);

        const humJitter = (Math.random() - 0.5) * 0.4;
        const humDrift = drift < 0 ? 0.12 : -0.12;
        const nextHum = Math.max(55, Math.min(85, Math.round(liveHumidityRef.current + humDrift + humJitter)));
        liveHumidityRef.current = nextHum;
        setLiveHumidity(nextHum);

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        setStreamPoints((pts) => {
          const updated = [...pts];
          const newPt = {
            time: nowTime,
            temp: nextTemp,
            humidity: nextHum,
            fan: fanRef.current?.on ? `Cấp ${fanRef.current?.speed || 2}` : 'Tắt'
          };
          if (updated.length >= 15) {
            updated.shift();
          }
          return [...updated, newPt];
        });

        if (onLiveTempChangeRef.current) {
          onLiveTempChangeRef.current(barnName, nextTemp, nextHum);
        }

        return nextTemp;
      });
    }, 1600);

    return () => clearInterval(timer);
  }, [externalPoints, isLiveStreaming, timeframe, barnName]);

  // Flash animation khi nhận nhiệt độ mới từ externalPoints của parent
  useEffect(() => {
    if (externalPoints) {
      const numT = Number(currentTemp);
      if (numT > prevTempRef.current) {
        setFlashClass(styles.flashUp);
      } else if (numT < prevTempRef.current) {
        setFlashClass(styles.flashDown);
      }
      prevTempRef.current = numT;
      const t = setTimeout(() => setFlashClass(''), 600);
      return () => clearTimeout(t);
    }
  }, [externalPoints, currentTemp]);

  // Current active dataset
  const activeDataset = timeframe === '24h'
    ? ((externalPoints && externalPoints.length > 0) ? externalPoints : streamPoints)
    : timeframe === '7d'
      ? sevenDayPoints
      : thirtyDayPoints;

  const currentDisplayTemp = externalPoints ? Number(currentTemp) : liveTemp;
  const currentDisplayHum = externalPoints ? Number(currentHumidity) : liveHumidity;

  const activeValues = activeDataset.map(d => metricType === 'temp' ? d.temp : d.humidity);
  const minVal = Math.min(...activeValues, metricType === 'temp' ? tempThreshold - 2 : 55);
  const maxVal = Math.max(...activeValues, metricType === 'temp' ? tempThreshold + 2 : 85);
  const highVal = Math.max(...activeValues);
  const lowVal = Math.min(...activeValues);
  const avgVal = (activeValues.reduce((a, b) => a + b, 0) / (activeValues.length || 1)).toFixed(1);

  // Delta calculation compared to first point in window
  const firstVal = activeValues[0] || (metricType === 'temp' ? currentDisplayTemp : currentDisplayHum);
  const currentDisplayVal = metricType === 'temp' ? currentDisplayTemp : currentDisplayHum;
  const delta = (currentDisplayVal - firstVal).toFixed(1);
  const deltaPct = ((delta / (firstVal || 1)) * 100).toFixed(1);
  const isUp = delta >= 0;

  // SVG Chart Geometry
  const svgWidth = 800;
  const svgHeight = 220;
  const padLeft = 45;
  const padRight = 75;
  const padTop = 25;
  const padBottom = 35;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const points = useMemo(() => {
    return activeDataset.map((d, i) => {
      const val = metricType === 'temp' ? d.temp : d.humidity;
      const x = padLeft + (i / (activeDataset.length - 1)) * plotWidth;
      const y = padTop + (1 - (val - minVal) / (maxVal - minVal || 1)) * plotHeight;
      return { x, y, data: d, val };
    });
  }, [activeDataset, metricType, minVal, maxVal, plotWidth, plotHeight]);

  // Compute smooth Bezier curve spline
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    let p = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cpx = curr.x + (next.x - curr.x) / 2;
      p += ` C ${cpx} ${curr.y}, ${cpx} ${next.y}, ${next.x} ${next.y}`;
    }
    return p;
  }, [points]);

  // Fill area under curve
  const areaPath = useMemo(() => {
    if (!linePath || points.length === 0) return '';
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const bottomY = padTop + plotHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, points, padTop, plotHeight]);

  // Threshold horizontal Y position
  const thresholdY = padTop + (1 - (tempThreshold - minVal) / (maxVal - minVal || 1)) * plotHeight;

  // Mouse move handler for interactive crosshair & tooltip
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const ratioX = clientX / rect.width;
    const approxIndex = Math.round(ratioX * (points.length - 1));
    const clampedIndex = Math.max(0, Math.min(points.length - 1, approxIndex));
    setHoveredPoint(points[clampedIndex]);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  const lastPoint = points[points.length - 1] || { x: 0, y: 0 };

  return (
    <div className={styles.chartContainer}>
      {/* ── Ticker Header (Stock Exchange Style) ────── */}
      <div className={styles.tickerHeader}>
        <div className={styles.tickerMain}>
          <div className={styles.tickerTitleRow}>
            <span className={styles.tickerSymbol}>CLIMATE-TICKER</span>
            <span className={styles.tickerBarnName}>{barnName} ({areaName})</span>
            {isLiveStreaming && (
              <span className={styles.liveStreamPill}>
                <span className={styles.liveStreamDot} />
                LIVE 1.6s
              </span>
            )}
          </div>

          <div className={styles.tickerPriceRow}>
            <span className={`${styles.tickerCurrentVal} ${flashClass}`}>
              {metricType === 'temp' ? `${currentDisplayTemp}°C` : `${currentDisplayHum}%`}
            </span>
            <span className={`${styles.tickerChangeBadge} ${isUp ? styles.badgeUp : styles.badgeDown}`}>
              {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {isUp ? `+${delta}` : delta}{metricType === 'temp' ? '°C' : '%'} ({isUp ? `+${deltaPct}` : deltaPct}%)
            </span>
          </div>
        </div>

        {/* Key Metrics Strip (High / Low / Avg / Threshold) */}
        <div className={styles.metricsStrip}>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Đỉnh (High)</span>
            <span className={styles.metricVal}>{highVal}{metricType === 'temp' ? '°C' : '%'}</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Đáy (Low)</span>
            <span className={styles.metricVal}>{lowVal}{metricType === 'temp' ? '°C' : '%'}</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Trung bình (Avg)</span>
            <span className={styles.metricVal}>{avgVal}{metricType === 'temp' ? '°C' : '%'}</span>
          </div>
          {metricType === 'temp' && (
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Ngưỡng quạt Auto</span>
              <span className={styles.metricVal} style={{ color: '#fbbf24' }}>{tempThreshold}°C</span>
            </div>
          )}
        </div>

        {/* Controls: Timeframe, Metric Toggles & Live Controls */}
        <div className={styles.controlsRow}>
          {/* Live Play/Pause toggle */}
          <div className={styles.btnGroup}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${isLiveStreaming ? styles.toggleBtnActive : ''}`}
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              title={isLiveStreaming ? 'Tạm dừng luồng stream' : 'Bật luồng stream trực tiếp'}
            >
              {isLiveStreaming ? <Pause size={12} style={{ display: 'inline', marginRight: '3px' }} /> : <Play size={12} style={{ display: 'inline', marginRight: '3px' }} />}
              {isLiveStreaming ? 'Tạm dừng' : 'Chạy LIVE'}
            </button>
          </div>

          {/* Metric Toggle */}
          <div className={styles.btnGroup}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${metricType === 'temp' ? styles.toggleBtnActive : ''}`}
              onClick={() => setMetricType('temp')}
            >
              <Thermometer size={12} style={{ display: 'inline', marginRight: '3px' }} />
              Nhiệt độ
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${metricType === 'humidity' ? styles.toggleBtnActive : ''}`}
              onClick={() => setMetricType('humidity')}
            >
              <Droplets size={12} style={{ display: 'inline', marginRight: '3px' }} />
              Độ ẩm
            </button>
          </div>

          {/* Timeframe Toggle */}
          <div className={styles.btnGroup}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${timeframe === '24h' ? styles.toggleBtnActive : ''}`}
              onClick={() => setTimeframe('24h')}
            >
              24h
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${timeframe === '7d' ? styles.toggleBtnActive : ''}`}
              onClick={() => setTimeframe('7d')}
            >
              7 ngày
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${timeframe === '30d' ? styles.toggleBtnActive : ''}`}
              onClick={() => setTimeframe('30d')}
            >
              30 ngày
            </button>
          </div>
        </div>
      </div>

      {/* ── Interactive Stock Chart SVG Stage ────── */}
      <div
        className={styles.svgStage}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className={styles.svgElement}
          preserveAspectRatio="none"
        >
          <defs>
            {/* Emerald/Teal gradient fill for temperature */}
            <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#019788" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#019788" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#019788" stopOpacity="0.0" />
            </linearGradient>

            {/* Cyan gradient fill for humidity */}
            <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#0284c7" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Dotted Grid Horizontal Lines */}
          {[0.2, 0.45, 0.7, 0.95].map((ratio, idx) => {
            const gridY = padTop + ratio * plotHeight;
            const gridVal = (maxVal - ratio * (maxVal - minVal)).toFixed(0);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={gridY}
                  x2={svgWidth - padRight}
                  y2={gridY}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={svgWidth - padRight + 8}
                  y={gridY + 4}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {gridVal}{metricType === 'temp' ? '°C' : '%'}
                </text>
              </g>
            );
          })}

          {/* Quạt Auto Activation Threshold Line (Chỉ hiện khi xem nhiệt độ) */}
          {metricType === 'temp' && thresholdY >= padTop && thresholdY <= padTop + plotHeight && (
            <g>
              <line
                x1={padLeft}
                y1={thresholdY}
                x2={svgWidth - padRight}
                y2={thresholdY}
                stroke="#f59e0b"
                strokeDasharray="5 3"
                strokeWidth="1.5"
              />
              <rect
                x={svgWidth - padRight + 4}
                y={thresholdY - 9}
                width="64"
                height="17"
                rx="3"
                fill="rgba(245, 158, 11, 0.2)"
                stroke="#f59e0b"
                strokeWidth="0.8"
              />
              <text
                x={svgWidth - padRight + 8}
                y={thresholdY + 3}
                fill="#fbbf24"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="monospace"
              >
                Auto {tempThreshold}°
              </text>
            </g>
          )}

          {/* Area under curve */}
          <path
            d={areaPath}
            fill={metricType === 'temp' ? 'url(#tempGradient)' : 'url(#humidityGradient)'}
          />

          {/* Smooth Bezier Spline Stroke */}
          <path
            d={linePath}
            fill="none"
            stroke={metricType === 'temp' ? '#10b981' : '#38bdf8'}
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Live pulsing dot at the latest point (chớp nháy thời gian thực như bảng giá chứng khoán) */}
          <g transform={`translate(${lastPoint.x}, ${lastPoint.y})`}>
            <circle
              r="4"
              fill={metricType === 'temp' ? '#34d399' : '#38bdf8'}
              className={styles.pulsingCircle}
            />
            <circle
              r="3.5"
              fill="#ffffff"
            />
            <circle
              r="2"
              fill={metricType === 'temp' ? '#059669' : '#0284c7'}
            />
          </g>

          {/* Hover Crosshair and Dot Marker */}
          {hoveredPoint && (
            <g>
              {/* Vertical Crosshair Line */}
              <line
                x1={hoveredPoint.x}
                y1={padTop}
                x2={hoveredPoint.x}
                y2={padTop + plotHeight}
                stroke="#38bdf8"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              {/* Hover Dot */}
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="5"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Bottom Time Axis Labels */}
          {points.map((pt, i) => {
            const step = timeframe === '24h' ? 2 : 1;
            if (i % step !== 0 && i !== points.length - 1) return null;
            return (
              <text
                key={i}
                x={pt.x}
                y={svgHeight - 10}
                fill={i === points.length - 1 ? '#38bdf8' : '#64748b'}
                fontSize="10"
                fontFamily="monospace"
                fontWeight={i === points.length - 1 ? '700' : '400'}
                textAnchor="middle"
              >
                {pt.data.time}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className={styles.tooltipOverlay}
            style={{
              left: `${(hoveredPoint.x / svgWidth) * 100}%`,
              top: `${(hoveredPoint.y / svgHeight) * 100}%`
            }}
          >
            <div className={styles.tooltipTime}>⏰ Mốc: {hoveredPoint.data.time}</div>
            <div className={styles.tooltipValue}>
              {metricType === 'temp' ? `🌡 ${hoveredPoint.val}°C` : `💧 ${hoveredPoint.val}%`}
            </div>
            <div className={styles.tooltipAction}>
              🌀 Quạt IoT: {hoveredPoint.data.fan}
            </div>
          </div>
        )}
      </div>

      {/* ── Summary & Insights Footer ────── */}
      <div className={styles.chartFooter}>
        <div className={styles.footerInsight}>
          <div className={styles.pulseGreenDot} />
          <span>
            {currentDisplayTemp > tempThreshold
              ? `🔥 Nhiệt độ (${currentDisplayTemp}°C) > ${tempThreshold}°C: Quạt thông gió đã tự động kích hoạt điều hòa vi khí hậu.`
              : `✅ Nhiệt độ (${currentDisplayTemp}°C) ≤ ${tempThreshold}°C: Vi khí hậu ổn định trong dải sinh lý an toàn.`}
            {fan?.on ? ` [Quạt đang quay Cấp ${fan.speed || 2} - Đang hỗ trợ hạ nhiệt]` : ' [Quạt đang ngắt nghỉ - Giữ nhiệt]'}
          </span>
        </div>
        <span style={{ fontFamily: 'monospace', color: '#64748b' }}>
          ĐỒNG BỘ LIVE TICKER: 1.6 GIÂY/LẦN
        </span>
      </div>
    </div>
  );
};
