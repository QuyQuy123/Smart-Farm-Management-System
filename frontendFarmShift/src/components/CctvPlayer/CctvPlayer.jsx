// src/components/CctvPlayer/CctvPlayer.jsx
// Trình phát Camera CCTV Chuồng Trại Real-Time tích hợp OSD & Telemetry IoT
import React, { useState, useEffect, useRef } from 'react';
import {
  Video, VideoOff, Camera, Maximize, Minimize, ZoomIn, ZoomOut,
  Moon, Sun, RefreshCw, Eye, EyeOff, Sliders, Play, Pause,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check,
  Thermometer, Droplets, Fan, Lightbulb, Wifi, Activity
} from 'lucide-react';
import styles from './CctvPlayer.module.css';

export const CctvPlayer = ({
  barn = {},
  compact = false,
  streamUrl = '',
  onClose = null
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Stream & Camera States
  const [isPlaying, setIsPlaying] = useState(true);
  const [nightVision, setNightVision] = useState(false);
  const [cameraAngle, setCameraAngle] = useState(1); // 1: Toàn cảnh, 2: Máng ăn, 3: Quạt hút
  const [showOsd, setShowOsd] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showStreamConfig, setShowStreamConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState(streamUrl);

  // Live real-time clock
  const [liveClock, setLiveClock] = useState(() => {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
  });

  // Ticking clock effect
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      setLiveClock(formatted);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Chicken flock simulation state inside canvas
  const chickensRef = useRef([]);
  const fanAngleRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Initialize flock of chickens
  useEffect(() => {
    const chickenCount = compact ? 14 : 24;
    const flock = [];
    const colors = [
      { body: '#d97706', head: '#b45309', comb: '#dc2626' }, // Gà Mía / Gà ri vàng rơm
      { body: '#92400e', head: '#78350f', comb: '#b91c1c' }, // Gà J-Dabaco nâu sẫm
      { body: '#f59e0b', head: '#d97706', comb: '#ef4444' }, // Gà vàng nhạt
      { body: '#e2e8f0', head: '#cbd5e1', comb: '#dc2626' }  // Gà trắng
    ];

    for (let i = 0; i < chickenCount; i++) {
      flock.push({
        x: 100 + Math.random() * 600,
        y: 220 + Math.random() * 190,
        targetX: 100 + Math.random() * 600,
        targetY: 220 + Math.random() * 190,
        speed: 0.3 + Math.random() * 0.45,
        facing: Math.random() > 0.5 ? 1 : -1,
        palette: colors[i % colors.length],
        peckProgress: 0,
        isPecking: false,
        nextPeckTime: Math.random() * 180 + 60,
        walkCycle: Math.random() * 20
      });
    }
    chickensRef.current = flock;
  }, [compact]);

  // Adjust PTZ view based on angle selection
  const switchAngle = (angleNum) => {
    setCameraAngle(angleNum);
    if (angleNum === 1) {
      setZoomLevel(1.0);
      setPanOffset({ x: 0, y: 0 });
    } else if (angleNum === 2) {
      setZoomLevel(1.6);
      setPanOffset({ x: 0, y: -40 });
    } else if (angleNum === 3) {
      setZoomLevel(1.8);
      setPanOffset({ x: 0, y: 80 });
    }
  };

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    // Fan rotation speed based on barn fan status
    const fanSpeedMultiplier = barn.fan?.on ? (barn.fan?.speed || 2) * 0.08 : 0;

    const render = () => {
      if (!running) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Apply Pan & Zoom PTZ Transformations
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoomLevel, zoomLevel);
      ctx.translate(-width / 2 + panOffset.x, -height / 2 + panOffset.y);

      // 1. Draw Barn Interior Background (Trần chuồng & tường cách nhiệt)
      const isIR = nightVision;

      // Ceiling and back wall perspective
      const ceilingGradient = ctx.createLinearGradient(0, 0, 0, 160);
      ceilingGradient.addColorStop(0, isIR ? '#06130b' : '#1e293b');
      ceilingGradient.addColorStop(1, isIR ? '#0f2416' : '#334155');
      ctx.fillStyle = ceilingGradient;
      ctx.fillRect(0, 0, width, 160);

      // Steel truss rafters
      ctx.strokeStyle = isIR ? '#1b3824' : '#475569';
      ctx.lineWidth = 3;
      for (let x = 80; x < width; x += 130) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(width / 2, 90);
        ctx.stroke();
      }

      // Back far wall
      const wallGradient = ctx.createLinearGradient(0, 90, 0, 220);
      wallGradient.addColorStop(0, isIR ? '#0c2214' : '#3b4252');
      wallGradient.addColorStop(1, isIR ? '#122e1b' : '#4c566a');
      ctx.fillStyle = wallGradient;
      ctx.fillRect(0, 90, width, 130);

      // Industrial Exhaust Fan Box (Tường quạt hút thông gió phía sau)
      const fanCenterX = width * 0.78;
      const fanCenterY = 145;
      const fanRadius = 32;

      // Fan housing
      ctx.fillStyle = isIR ? '#08170d' : '#1f2937';
      ctx.fillRect(fanCenterX - 42, fanCenterY - 42, 84, 84);
      ctx.strokeStyle = isIR ? '#22543d' : '#6b7280';
      ctx.lineWidth = 2;
      ctx.strokeRect(fanCenterX - 42, fanCenterY - 42, 84, 84);

      // Fan circular grill
      ctx.beginPath();
      ctx.arc(fanCenterX, fanCenterY, fanRadius, 0, Math.PI * 2);
      ctx.fillStyle = isIR ? '#020b05' : '#111827';
      ctx.fill();
      ctx.strokeStyle = isIR ? '#166534' : '#4b5563';
      ctx.stroke();

      // Spinning fan blades
      fanAngleRef.current += fanSpeedMultiplier;
      ctx.save();
      ctx.translate(fanCenterX, fanCenterY);
      ctx.rotate(fanAngleRef.current);
      ctx.fillStyle = isIR ? '#4ade80' : '#9ca3af';
      for (let b = 0; b < 6; b++) {
        ctx.beginPath();
        ctx.rotate(Math.PI / 3);
        ctx.ellipse(14, 0, 16, 5, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Fan status indicator light
      ctx.fillStyle = barn.fan?.on ? (isIR ? '#86efac' : '#22c55e') : '#ef4444';
      ctx.beginPath();
      ctx.arc(fanCenterX - 32, fanCenterY - 32, 3, 0, Math.PI * 2);
      ctx.fill();

      // Second Fan (Nhà A/Mía thường có cụm quạt)
      const fan2X = width * 0.91;
      ctx.fillStyle = isIR ? '#08170d' : '#1f2937';
      ctx.fillRect(fan2X - 35, fanCenterY - 35, 70, 70);
      ctx.beginPath();
      ctx.arc(fan2X, fanCenterY, 26, 0, Math.PI * 2);
      ctx.fillStyle = isIR ? '#020b05' : '#111827';
      ctx.fill();
      ctx.save();
      ctx.translate(fan2X, fanCenterY);
      ctx.rotate(fanAngleRef.current * 0.9);
      ctx.fillStyle = isIR ? '#4ade80' : '#9ca3af';
      for (let b = 0; b < 6; b++) {
        ctx.beginPath();
        ctx.rotate(Math.PI / 3);
        ctx.ellipse(12, 0, 13, 4, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 2. Floor: Rice Hull Bedding (Đệm lót trấu sinh học)
      const floorGradient = ctx.createLinearGradient(0, 210, 0, height);
      if (isIR) {
        floorGradient.addColorStop(0, '#0d2818');
        floorGradient.addColorStop(0.5, '#133520');
        floorGradient.addColorStop(1, '#091c10');
      } else {
        floorGradient.addColorStop(0, '#785934');
        floorGradient.addColorStop(0.3, '#926a3d');
        floorGradient.addColorStop(1, '#664724');
      }
      ctx.fillStyle = floorGradient;
      ctx.fillRect(0, 210, width, height - 210);

      // Floor bedding grains & straw texture speckles
      ctx.fillStyle = isIR ? 'rgba(74, 222, 128, 0.08)' : 'rgba(254, 240, 138, 0.12)';
      for (let p = 0; p < 70; p++) {
        const px = (p * 79) % width;
        const py = 215 + ((p * 47) % (height - 220));
        ctx.fillRect(px, py, 2.5, 1.5);
      }

      // 3. Overhead Automated Feeder Line & Drinkers (Dàn máng ăn xoay & đường nước)
      // Main feeder pipe
      ctx.strokeStyle = isIR ? '#1b4329' : '#64748b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(30, 250);
      ctx.lineTo(width - 30, 250);
      ctx.stroke();

      // Feeder pans (máng ăn tròn màu vàng/đỏ)
      for (let panX = 90; panX < width - 60; panX += 110) {
        // Hanging drop wire
        ctx.strokeStyle = isIR ? '#166534' : '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(panX, 160);
        ctx.lineTo(panX, 250);
        ctx.stroke();

        // Feed Pan Dish
        ctx.fillStyle = isIR ? '#22543d' : '#eab308';
        ctx.beginPath();
        ctx.ellipse(panX, 255, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Feed cone center
        ctx.fillStyle = isIR ? '#38a169' : '#dc2626';
        ctx.beginPath();
        ctx.ellipse(panX, 252, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Update and Draw Chicken Flock (Đàn gà di chuyển sinh động)
      const flock = chickensRef.current;
      // Sort chickens by Y coordinate for correct perspective overlapping
      flock.sort((a, b) => a.y - b.y);

      flock.forEach((chicken) => {
        // AI Movement: roam toward target
        const dx = chicken.targetX - chicken.x;
        const dy = chicken.targetY - chicken.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 4 && !chicken.isPecking) {
          chicken.x += (dx / dist) * chicken.speed;
          chicken.y += (dy / dist) * chicken.speed;
          chicken.facing = dx > 0 ? 1 : -1;
          chicken.walkCycle += 0.25;
        } else {
          // Reached destination, pick new wander spot
          if (Math.random() < 0.015) {
            chicken.targetX = 80 + Math.random() * (width - 160);
            chicken.targetY = 225 + Math.random() * (height - 250);
          }
        }

        // Random Pecking action (gà mổ thóc trên đệm lót)
        chicken.nextPeckTime -= 1;
        if (chicken.nextPeckTime <= 0) {
          chicken.isPecking = true;
          chicken.peckProgress += 0.15;
          if (chicken.peckProgress > Math.PI) {
            chicken.isPecking = false;
            chicken.peckProgress = 0;
            chicken.nextPeckTime = Math.random() * 200 + 80;
          }
        }

        // Perspective scaling (further away = smaller)
        const scale = 0.45 + ((chicken.y - 210) / (height - 210)) * 0.75;
        const cx = chicken.x;
        const cy = chicken.y;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(chicken.facing * scale, scale);

        // Pecking angle tilt
        const headDip = chicken.isPecking ? Math.sin(chicken.peckProgress) * 7 : 0;

        // Shadow under chicken
        ctx.fillStyle = isIR ? 'rgba(2, 10, 4, 0.45)' : 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(0, 10, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs & Feet (chân gà)
        ctx.strokeStyle = isIR ? '#4ade80' : '#f59e0b';
        ctx.lineWidth = 1.8;
        const legWiggle = Math.sin(chicken.walkCycle) * 3;
        ctx.beginPath();
        ctx.moveTo(-3, 4);
        ctx.lineTo(-4 + legWiggle, 10);
        ctx.moveTo(3, 4);
        ctx.lineTo(4 - legWiggle, 10);
        ctx.stroke();

        // Chicken Body (thân gà)
        ctx.fillStyle = isIR ? '#1e3a29' : chicken.palette.body;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 10, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // Wing feathers (cánh)
        ctx.fillStyle = isIR ? '#162e20' : chicken.palette.head;
        ctx.beginPath();
        ctx.ellipse(-2, -1, 10, 6, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Tail feathers (đuôi gà vểnh lên)
        ctx.fillStyle = isIR ? '#162e20' : chicken.palette.head;
        ctx.beginPath();
        ctx.moveTo(-13, 0);
        ctx.lineTo(-20, -10);
        ctx.lineTo(-14, -5);
        ctx.closePath();
        ctx.fill();

        // Head and Neck (cổ và đầu)
        const headX = 11;
        const headY = -6 + headDip;
        ctx.fillStyle = isIR ? '#1e3a29' : chicken.palette.head;
        ctx.beginPath();
        ctx.arc(headX, headY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Beak (mỏ gà)
        ctx.fillStyle = isIR ? '#86efac' : '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(headX + 5, headY - 1);
        ctx.lineTo(headX + 10, headY + 2);
        ctx.lineTo(headX + 5, headY + 4);
        ctx.closePath();
        ctx.fill();

        // Comb (mào đỏ trên đỉnh đầu)
        ctx.fillStyle = isIR ? '#34d399' : chicken.palette.comb;
        ctx.beginPath();
        ctx.moveTo(headX - 2, headY - 5);
        ctx.lineTo(headX, headY - 10);
        ctx.lineTo(headX + 3, headY - 6);
        ctx.lineTo(headX + 5, headY - 9);
        ctx.lineTo(headX + 6, headY - 4);
        ctx.closePath();
        ctx.fill();

        // Eye (mắt)
        if (isIR) {
          // Night vision eye glint (phản quang hồng ngoại đặc trưng camera chuồng trại)
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(headX + 2, headY - 1, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(headX + 2, headY - 1, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // 5. Overhead Barn Lamps (Đèn chiếu sáng trang trại)
      const lampX1 = width * 0.28;
      const lampX2 = width * 0.62;
      const lamps = [lampX1, lampX2];

      lamps.forEach((lx) => {
        // Wire
        ctx.strokeStyle = isIR ? '#166534' : '#64748b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, 65);
        ctx.stroke();

        // Light bulb cone
        const isLightOn = barn.light?.on ?? true;
        ctx.fillStyle = isIR ? '#22543d' : '#e2e8f0';
        ctx.fillRect(lx - 8, 65, 16, 5);

        if (isLightOn) {
          const glow = ctx.createRadialGradient(lx, 70, 5, lx, 220, 180);
          glow.addColorStop(0, isIR ? 'rgba(74, 222, 128, 0.2)' : 'rgba(254, 240, 138, 0.25)');
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(lx, 150, 140, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Restore base transform for post-processing overlay
      ctx.restore();

      // 6. Surveillance Camera Filters (Scanlines & Vignette)
      // Subtle scanline overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1.5);
      }

      // Vignette lens darkening
      const vignette = ctx.createRadialGradient(
        width / 2, height / 2, width * 0.35,
        width / 2, height / 2, width * 0.65
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, isIR ? 'rgba(0, 20, 10, 0.65)' : 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      // Night vision overall IR tint if active
      if (isIR) {
        ctx.fillStyle = 'rgba(10, 45, 20, 0.22)';
        ctx.fillRect(0, 0, width, height);
      }

      // Corner surveillance reticle markers
      ctx.strokeStyle = isIR ? 'rgba(134, 239, 172, 0.5)' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      const cornerSize = 14;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(12, 12 + cornerSize);
      ctx.lineTo(12, 12);
      ctx.lineTo(12 + cornerSize, 12);
      ctx.stroke();
      // Top-Right
      ctx.beginPath();
      ctx.moveTo(width - 12 - cornerSize, 12);
      ctx.lineTo(width - 12, 12);
      ctx.lineTo(width - 12, 12 + cornerSize);
      ctx.stroke();
      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(12, height - 12 - cornerSize);
      ctx.lineTo(12, height - 12);
      ctx.lineTo(12 + cornerSize, height - 12);
      ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(width - 12 - cornerSize, height - 12);
      ctx.lineTo(width - 12, height - 12);
      ctx.lineTo(width - 12, height - 12 - cornerSize);
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, nightVision, zoomLevel, panOffset, barn, compact]);

  // Handle Dragging Canvas for Manual Pan (PTZ)
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setPanOffset(prev => ({
      x: Math.max(-150, Math.min(150, prev.x + dx * 0.7)),
      y: Math.max(-100, Math.min(100, prev.y + dy * 0.7))
    }));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // PTZ Control Helpers
  const handlePan = (direction) => {
    const step = 25;
    if (direction === 'up') setPanOffset(prev => ({ ...prev, y: Math.max(-120, prev.y - step) }));
    if (direction === 'down') setPanOffset(prev => ({ ...prev, y: Math.min(120, prev.y + step) }));
    if (direction === 'left') setPanOffset(prev => ({ ...prev, x: Math.max(-160, prev.x - step) }));
    if (direction === 'right') setPanOffset(prev => ({ ...prev, x: Math.min(160, prev.x + step) }));
    if (direction === 'reset') {
      setPanOffset({ x: 0, y: 0 });
      setZoomLevel(1.0);
      setCameraAngle(1);
    }
  };

  const handleZoom = (delta) => {
    setZoomLevel(prev => Math.max(1.0, Math.min(3.0, Number((prev + delta).toFixed(1)))));
  };

  // Snapshot / Screenshot Capture
  const handleTakeSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      const filename = `CCTV_${(barn.name || 'BARN').replace(/\s+/g, '_')}_${Date.now()}.jpg`;
      link.download = filename;
      link.href = dataUrl;
      link.click();

      setToastMessage(`📸 Đã chụp và lưu ảnh giám sát: ${filename}`);
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Error saving snapshot:', err);
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  // Default barn metadata fallback
  const barnName = barn.name || 'Chuồng Nuôi';
  const areaName = barn.areaName || 'Khu Chăn Nuôi';
  const livestockType = barn.livestockType || 'Gia Cầm (Gà)';
  const currentCount = barn.current || 2400;
  const tempVal = barn.temp || 27.5;
  const humidityVal = barn.humidity || 68;
  const fanText = barn.fan?.on ? `Cấp ${barn.fan?.speed || 2} (Đang quay)` : 'Đang tắt';
  const lightText = barn.light?.on ? 'Bật (100% Lux)' : 'Tắt';

  return (
    <div
      ref={containerRef}
      className={styles.cctvContainer}
    >
      {/* ── Video & Canvas Display Stage ────── */}
      <div className={styles.videoStage}>
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className={styles.cctvCanvas}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          title="Kéo chuột để di chuyển góc quay camera (PTZ Pan)"
        />

        {/* ── OSD (On Screen Display) Surveillance HUD ────── */}
        {showOsd && (
          <div className={styles.osdLayer}>
            {/* Top Bar: Cam Name, Live Stamp, FPS */}
            <div className={styles.osdTopBar}>
              <div className={styles.osdCamInfo}>
                <div className={styles.osdCamName}>
                  <Video size={14} color="#38bdf8" />
                  <span>CAM-01 [{areaName.toUpperCase()} - {barnName.toUpperCase()}]</span>
                  {nightVision && (
                    <span className={styles.nightVisionBadge}>IR NIGHT 850nm</span>
                  )}
                </div>
                <div className={styles.osdStreamSpecs}>
                  RTSP 192.168.1.10{barn.id?.slice(-1) || '1'}:554/ch1 · 1080P · 30 FPS · H.265+
                </div>
              </div>

              <div className={styles.osdTopRight}>
                <div className={styles.liveBadge}>
                  <div className={styles.livePulseDot} />
                  <span>LIVE</span>
                </div>
                <div className={styles.osdClock}>{liveClock}</div>
                <div className={styles.osdFps}>Bitrate: 2.84 Mbps · Zoom {zoomLevel}x</div>
              </div>
            </div>

            {/* Bottom Bar: Telemetry Sensors OSD Overlay */}
            <div className={styles.osdBottomBar}>
              <div className={styles.osdTelemetry}>
                <div className={styles.telemetryItem}>
                  <Thermometer size={13} color="#38bdf8" />
                  <span>Nhiệt độ:</span>
                  <span className={styles.telemetryValue}>{tempVal}°C</span>
                </div>
                <div className={styles.telemetryItem}>
                  <Droplets size={13} color="#60a5fa" />
                  <span>Độ ẩm:</span>
                  <span className={styles.telemetryValue}>{humidityVal}%</span>
                </div>
                <div className={styles.telemetryItem}>
                  <Fan size={13} color={barn.fan?.on ? '#4ade80' : '#94a3b8'} />
                  <span>Quạt hút:</span>
                  <span className={barn.fan?.on ? styles.telemetryValueGreen : styles.telemetryValue}>
                    {fanText}
                  </span>
                </div>
                <div className={styles.telemetryItem}>
                  <Lightbulb size={13} color={barn.light?.on ? '#fbbf24' : '#94a3b8'} />
                  <span>Đèn:</span>
                  <span className={barn.light?.on ? styles.telemetryValueAmber : styles.telemetryValue}>
                    {lightText}
                  </span>
                </div>
                <div className={styles.telemetryItem}>
                  <Activity size={13} color="#a78bfa" />
                  <span>Đàn:</span>
                  <span className={styles.telemetryValue}>{currentCount.toLocaleString()} con</span>
                </div>
              </div>

              <div className={styles.cctvWatermark}>
                FARMSHIFT SURVEILLANCE V3.2
              </div>
            </div>
          </div>
        )}

        {/* Snapshot Notification Toast */}
        {toastMessage && (
          <div className={styles.playerToast}>
            <Check size={16} />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* ── Control Bar & Tools ────── */}
      <div className={styles.controlBar}>
        {/* Preset Angle Buttons */}
        <div className={styles.angleButtonGroup}>
          <button
            type="button"
            className={`${styles.angleBtn} ${cameraAngle === 1 ? styles.angleBtnActive : ''}`}
            onClick={() => switchAngle(1)}
            title="Góc quay 1: Toàn cảnh chuồng nuôi (Wide Lens 120°)"
          >
            Góc 1: Toàn cảnh
          </button>
          <button
            type="button"
            className={`${styles.angleBtn} ${cameraAngle === 2 ? styles.angleBtnActive : ''}`}
            onClick={() => switchAngle(2)}
            title="Góc quay 2: Cận cảnh máng ăn xoay & đường nước uống"
          >
            Góc 2: Máng ăn
          </button>
          <button
            type="button"
            className={`${styles.angleBtn} ${cameraAngle === 3 ? styles.angleBtnActive : ''}`}
            onClick={() => switchAngle(3)}
            title="Góc quay 3: Khu vực quạt hút & giàn làm mát phía cuối chuồng"
          >
            Góc 3: Quạt hút
          </button>
        </div>

        {/* PTZ Arrow Controls */}
        <div className={styles.ptzPad}>
          <button
            type="button"
            className={styles.ptzArrowBtn}
            onClick={() => handlePan('left')}
            title="Quay trái"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className={styles.ptzArrowBtn}
            onClick={() => handlePan('up')}
            title="Nâng góc lên"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            className={styles.ptzArrowBtn}
            onClick={() => handlePan('down')}
            title="Hạ góc xuống"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            className={styles.ptzArrowBtn}
            onClick={() => handlePan('right')}
            title="Quay phải"
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            className={styles.ptzArrowBtn}
            onClick={() => handlePan('reset')}
            title="Đặt lại góc trung tâm"
            style={{ fontSize: '11px', fontWeight: 600 }}
          >
            ⟲
          </button>
        </div>

        {/* Zoom & Camera Tools */}
        <div className={styles.toolActions}>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => handleZoom(-0.2)}
            title="Thu nhỏ góc nhìn (Zoom Out)"
          >
            <ZoomOut size={13} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => handleZoom(0.2)}
            title="Phóng to góc nhìn (Zoom In)"
          >
            <ZoomIn size={13} />
          </button>

          {/* Night Vision Toggle */}
          <button
            type="button"
            className={`${styles.toolBtn} ${nightVision ? styles.toolBtnActive : ''}`}
            onClick={() => setNightVision(!nightVision)}
            title="Chuyển chế độ Hồng ngoại ban đêm (IR Night Vision)"
          >
            {nightVision ? <Moon size={13} color="#86efac" /> : <Sun size={13} />}
            <span>{nightVision ? 'Hồng ngoại: BẬT' : 'Hồng ngoại'}</span>
          </button>

          {/* Toggle OSD Telemetry HUD */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => setShowOsd(!showOsd)}
            title="Ẩn / Hiện thông tin OSD cảm biến trên màn hình"
          >
            {showOsd ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>OSD</span>
          </button>

          {/* Take Snapshot */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleTakeSnapshot}
            title="Chụp ảnh màn hình lưu vào máy tính"
          >
            <Camera size={13} />
            <span>Chụp ảnh</span>
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={toggleFullscreen}
            title="Xem toàn màn hình"
          >
            {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>

          {/* Stream Config Button */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => setShowStreamConfig(!showStreamConfig)}
            title="Cấu hình luồng RTSP / IP Camera thực tế"
          >
            <Wifi size={13} />
          </button>
        </div>
      </div>

      {/* Optional Custom RTSP / HLS Stream Input Drawer */}
      {showStreamConfig && (
        <div className={styles.streamConfigBar}>
          <Wifi size={14} color="#019788" />
          <span>Luồng IP Camera:</span>
          <input
            type="text"
            className={styles.streamInput}
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="rtsp://admin:pass@192.168.1.101:554/stream1 hoặc https://...m3u8"
          />
          <button
            type="button"
            className="farmshift-btn farmshift-btn-primary"
            style={{ fontSize: '11px', padding: '3px 10px', height: '26px' }}
            onClick={() => {
              setToastMessage('Đã đồng bộ cấu hình camera!');
              setTimeout(() => setToastMessage(''), 2500);
              setShowStreamConfig(false);
            }}
          >
            Lưu
          </button>
        </div>
      )}
    </div>
  );
};
