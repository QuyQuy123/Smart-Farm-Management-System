// src/features/farmshift/JournalView.jsx
// Ghi nhật ký chăn nuôi chuẩn FarmShift & DESIGN.md (Cữ ăn, IoT môi trường, Sức khỏe, Xử lý vật nuôi, Ghi công việc)
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Thermometer, Fan, X, Video, MapPinned
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useNotification } from '../../context/NotificationContext';
import { getSystemMessage } from '../../constants/systemMessages';
import { CctvPlayer } from '../../components/CctvPlayer';
import { EnvironmentalTab } from './EnvironmentalTab';
import { IotDevicesTab } from './IotDevicesTab';
import { BarnJournal } from './BarnJournal';

/** ?tab=env | iot_devices mở tab đó; còn lại (kể cả lối tắt cũ ?tab=loss, weight, feed...) mở Nhật ký chuồng. */
const tabOf = param => (param === 'env' || param === 'iot_devices' ? param : 'barns');

export const JournalView = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabParamValue = searchParams.get('tab') || '';
  const initialTab = tabOf(tabParamValue);
  // ?tab=weight mở thẳng phần cân mẫu khi bấm vào chuồng.
  const journalMode = tabParamValue === 'weight' ? 'weight' : 'loss';

  const { sendNotification, showToast: showGlobalToast } = useNotification();
  const [activeTab, setActiveTab] = useState(initialTab); // 'barns' | 'env' | 'iot_devices'
  // Chuồng đang mở ở tab Nhật ký chuồng; null là đang xem sơ đồ khu.
  const [journalCycleId, setJournalCycleId] = useState(null);
  // Lối tắt ?tab=... bấm khi đang ở trang này vẫn chuyển đúng tab.
  const [tabParam, setTabParam] = useState(tabParamValue);
  if (tabParam !== tabParamValue) {
    setTabParam(tabParamValue);
    setActiveTab(initialTab);
    setJournalCycleId(null);
  }
  const [viewingCctvBarn, setViewingCctvBarn] = useState(null);
  const [activeChartBarns, setActiveChartBarns] = useState({});

  const [envRows, setEnvRows] = useState([
    { area: 'Khu Mía Thịt', barn: 'Nhà A1', dayAge: 6, temp: 31.5, humidity: 68, status: 'Úm gà tiêu chuẩn' },
    { area: 'Khu Mía Thịt', barn: 'Nhà A2', dayAge: 6, temp: 31.8, humidity: 66, status: 'Úm gà tiêu chuẩn' },
    { area: 'Khu Mía Thịt', barn: 'Nhà A3', dayAge: 6, temp: 31.2, humidity: 70, status: 'Úm gà tiêu chuẩn' },
    { area: 'Khu J Thịt', barn: 'Nhà B1', dayAge: 45, temp: 27.5, humidity: 74, status: 'Thông thoáng ổn định' },
    { area: 'Khu J Thịt', barn: 'Nhà B2', dayAge: 45, temp: 28.2, humidity: 72, status: 'Thông thoáng ổn định' },
  ]);

  // IoT Devices & Fan/Light Control State (Chỉ 1 quạt + 1 đèn theo thiết kế chuồng)
  const [selectedIotBarnFilter, setSelectedIotBarnFilter] = useState('ALL');
  const [iotToast, setIotToast] = useState('');

  const [barnDevices, setBarnDevices] = useState({
    'Nhà A1': {
      area: 'Khu Mía Thịt',
      dayAge: 6,
      stage: 'Úm gà con',
      mode: 'auto', // 'auto' | 'manual'
      fan: { on: true, speed: 2, power: '1.2 kW', rpm: '1,350 RPM' },
      light: { on: true, power: '0.3 kW' },
      tempThreshold: 29.5
    },
    'Nhà A2': {
      area: 'Khu Mía Thịt',
      dayAge: 6,
      stage: 'Úm gà con',
      mode: 'auto',
      fan: { on: true, speed: 2, power: '1.2 kW', rpm: '1,350 RPM' },
      light: { on: true, power: '0.3 kW' },
      tempThreshold: 29.5
    },
    'Nhà A3': {
      area: 'Khu Mía Thịt',
      dayAge: 6,
      stage: 'Úm gà con',
      mode: 'manual',
      fan: { on: false, speed: 1, power: '1.2 kW', rpm: '0 RPM' },
      light: { on: false, power: '0.3 kW' },
      tempThreshold: 29.5
    },
    'Nhà B1': {
      area: 'Khu J Thịt',
      dayAge: 45,
      stage: 'Vỗ béo xuất bán',
      mode: 'auto',
      fan: { on: true, speed: 3, power: '1.5 kW', rpm: '1,450 RPM' },
      light: { on: true, power: '0.3 kW' },
      tempThreshold: 28.0
    },
    'Nhà B2': {
      area: 'Khu J Thịt',
      dayAge: 45,
      stage: 'Vỗ béo xuất bán',
      mode: 'manual',
      fan: { on: true, speed: 2, power: '1.2 kW', rpm: '1,350 RPM' },
      light: { on: false, power: '0.3 kW' },
      tempThreshold: 28.0
    }
  });

  // Central IoT Real-Time Climate Buffers (Lưu trữ lịch sử streaming của toàn bộ 5 chuồng)
  const [barnHistories, setBarnHistories] = useState(() => {
    const initial = {};
    const baseTemps = { 'Nhà A1': 31.5, 'Nhà A2': 31.8, 'Nhà A3': 31.2, 'Nhà B1': 27.5, 'Nhà B2': 28.2 };
    const baseHums = { 'Nhà A1': 68, 'Nhà A2': 66, 'Nhà A3': 70, 'Nhà B1': 74, 'Nhà B2': 72 };

    Object.keys(baseTemps).forEach(bName => {
      const baseT = baseTemps[bName];
      const baseH = baseHums[bName];
      initial[bName] = [
        { time: '22:00', temp: Number((baseT - 0.4).toFixed(1)), humidity: Math.min(85, Math.round(baseH + 2)), fan: 'Tắt' },
        { time: '22:30', temp: Number((baseT - 0.2).toFixed(1)), humidity: Math.min(85, Math.round(baseH + 1)), fan: 'Tắt' },
        { time: '23:00', temp: Number((baseT - 0.1).toFixed(1)), humidity: Math.round(baseH), fan: 'Cấp 1' },
        { time: '23:10', temp: Number((baseT + 0.3).toFixed(1)), humidity: Math.max(55, Math.round(baseH - 1)), fan: 'Cấp 2' },
        { time: '23:20', temp: Number((baseT + 0.1).toFixed(1)), humidity: Math.round(baseH), fan: 'Cấp 2' },
        { time: '23:30', temp: Number((baseT - 0.1).toFixed(1)), humidity: Math.round(baseH), fan: 'Cấp 2' },
        { time: 'LIVE', temp: Number(baseT.toFixed(1)), humidity: Math.round(baseH), fan: 'Cấp 2' }
      ];
    });
    return initial;
  });

  const barnDevicesRef = useRef(barnDevices);
  useEffect(() => {
    barnDevicesRef.current = barnDevices;
  }, [barnDevices]);

  const envRowsRef = useRef(envRows);
  useEffect(() => {
    envRowsRef.current = envRows;
  }, [envRows]);

  // Central IoT Climate Engine: Luôn chạy ngầm 24/7 cho TẤT CẢ các chuồng (kể cả khi không mở biểu đồ)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const currentDevices = barnDevicesRef.current;
      const currentEnvs = envRowsRef.current;

      let devicesChanged = false;
      const updatedDevices = { ...currentDevices };
      const newHistoryEntries = {};

      const updatedEnvs = currentEnvs.map(row => {
        const barnName = row.barn;
        const device = currentDevices[barnName] || { mode: 'auto', fan: { on: false }, tempThreshold: 29.5 };
        const threshold = device.tempThreshold ?? 29.5;

        // 1. Hiệu ứng vi khí hậu vật lý
        const speed = device.fan?.speed || 2;
        const coolRate = speed === 3 ? 0.09 : speed === 2 ? 0.06 : 0.035;
        const drift = device.fan?.on ? -coolRate : 0.055;

        // Nhiễu ngẫu nhiên Brownian thực tế
        const jitter = (Math.random() - 0.48) * 0.08;
        let nextTemp = Number((Number(row.temp) + drift + jitter).toFixed(1));
        if (nextTemp < 24.5) nextTemp = 24.6;
        if (nextTemp > 35.5) nextTemp = 35.4;

        // Độ ẩm biến thiên tỷ lệ nghịch với nhiệt độ
        const humJitter = (Math.random() - 0.5) * 0.4;
        const humDrift = drift < 0 ? 0.12 : -0.12;
        const nextHum = Math.max(55, Math.min(85, Math.round(Number(row.humidity) + humDrift + humJitter)));

        // 2. Logic FE IoT tự động kích hoạt quạt khi chuồng ở chế độ 'auto'
        let currentFan = device.fan;
        if (device.mode === 'auto') {
          // Vượt ngưỡng: Tự động BẬT QUẠT để hạ nhiệt!
          if (nextTemp > threshold) {
            const targetSpeed = nextTemp >= threshold + 1.2 ? 3 : 2;
            const targetRpm = targetSpeed === 3 ? '1,450 RPM' : '1,350 RPM';
            const targetPower = targetSpeed === 3 ? '1.5 kW' : '1.2 kW';

            if (!device.fan?.on || device.fan?.speed !== targetSpeed) {
              currentFan = {
                ...device.fan,
                on: true,
                speed: targetSpeed,
                rpm: targetRpm,
                power: targetPower
              };
              updatedDevices[barnName] = {
                ...device,
                fan: currentFan
              };
              devicesChanged = true;
            }
          }
          // Hạ về an toàn: Tự động TẮT QUẠT!
          else if (nextTemp <= threshold - 0.4) {
            if (device.fan?.on) {
              currentFan = {
                ...device.fan,
                on: false,
                rpm: '0 RPM'
              };
              updatedDevices[barnName] = {
                ...device,
                fan: currentFan
              };
              devicesChanged = true;
            }
          }
        }

        newHistoryEntries[barnName] = {
          time: nowTime,
          temp: nextTemp,
          humidity: nextHum,
          fan: currentFan?.on ? `Cấp ${currentFan?.speed || 2}` : 'Tắt'
        };

        return {
          ...row,
          temp: nextTemp,
          humidity: nextHum
        };
      });

      // Cập nhật envRows (tất cả badge số bên ngoài và tab 2 lập tức cập nhật)
      setEnvRows(updatedEnvs);

      // Cập nhật trạng thái quạt nếu có chuồng tự động kích hoạt / ngắt
      if (devicesChanged) {
        setBarnDevices(updatedDevices);
      }

      // Cập nhật rolling stream points cho từng chuồng
      setBarnHistories(prev => {
        const next = { ...prev };
        Object.entries(newHistoryEntries).forEach(([bName, pt]) => {
          const list = next[bName] ? [...next[bName]] : [];
          if (list.length >= 15) {
            list.shift();
          }
          list.push(pt);
          next[bName] = list;
        });
        return next;
      });
    }, 1600);

    return () => clearInterval(timer);
  }, []);

  const handleEnvChange = (index, field, val) => {
    const updated = [...envRows];
    const numVal = Number(val) || 0;
    updated[index][field] = numVal;
    setEnvRows(updated);

    // Nếu thay đổi nhiệt độ vượt ngưỡng cài đặt và chuồng đang ở chế độ auto -> Tự động bắn thông báo lên Header!
    if (field === 'temp') {
      const barnName = updated[index].barn;
      const device = barnDevices[barnName];
      if (device && device.mode === 'auto' && numVal > device.tempThreshold) {
        // Tự động bật quạt
        setBarnDevices(prev => ({
          ...prev,
          [barnName]: {
            ...prev[barnName],
            fan: { ...prev[barnName].fan, on: true, speed: 3, rpm: '1,450 RPM' }
          }
        }));

        sendNotification({
          barn: barnName,
          type: 'Nhiệt độ cao IoT',
          value: `${numVal}°C (Vượt ngưỡng ${device.tempThreshold}°C)`,
          level: 'Cảnh báo',
          status: 'Quạt thông gió đã tự động kích hoạt cấp 3 để hạ nhiệt'
        });
      }
    }
  };

  const showToast = (msg, type = 'success') => {
    const text = typeof msg === 'string' && msg.startsWith('MSG') ? getSystemMessage(msg) : msg;
    setIotToast(text);
    if (showGlobalToast) {
      showGlobalToast(msg, type);
    }
    setTimeout(() => setIotToast(''), 3500);
  };

  // Bật/tắt Quạt thông gió
  const handleToggleFan = (barnName) => {
    setBarnDevices(prev => {
      const barn = prev[barnName];
      const newOn = !barn.fan.on;
      const rpm = newOn ? (barn.fan.speed === 3 ? '1,450 RPM' : barn.fan.speed === 2 ? '1,350 RPM' : '950 RPM') : '0 RPM';
      const updated = {
        ...prev,
        [barnName]: {
          ...barn,
          fan: {
            ...barn.fan,
            on: newOn,
            rpm
          }
        }
      };
      showToast(`Đã gửi lệnh IoT: ${newOn ? 'BẬT' : 'TẮT'} Quạt thông gió tại ${barnName}`);
      return updated;
    });
  };

  // Bật/tắt Đèn chuồng
  const handleToggleLight = (barnName) => {
    setBarnDevices(prev => {
      const barn = prev[barnName];
      const newOn = !barn.light.on;
      const updated = {
        ...prev,
        [barnName]: {
          ...barn,
          light: {
            ...barn.light,
            on: newOn
          }
        }
      };
      showToast(`Đã gửi lệnh IoT: ${newOn ? 'BẬT' : 'TẮT'} Hệ thống đèn chiếu sáng tại ${barnName}`);
      return updated;
    });
  };

  // Điều chỉnh cấp độ gió
  const handleSetFanSpeed = (barnName, speed) => {
    setBarnDevices(prev => {
      const barn = prev[barnName];
      const rpm = speed === 3 ? '1,450 RPM' : speed === 2 ? '1,350 RPM' : '950 RPM';
      const updated = {
        ...prev,
        [barnName]: {
          ...barn,
          fan: {
            ...barn.fan,
            speed,
            on: true,
            rpm
          }
        }
      };
      showToast(`Đã chỉnh Quạt thông gió tại ${barnName} sang Cấp ${speed} (${rpm})`);
      return updated;
    });
  };

  // Đồng bộ nhiệt độ & độ ẩm Live Ticker từ biểu đồ + Tự động kích hoạt/ngắt Quạt Auto trên Frontend
  const handleLiveClimateUpdate = (barnName, newTemp, newHumidity) => {
    // 1. Cập nhật bảng dữ liệu môi trường envRows (đồng bộ badge chuồng, Tab 2, overview KPI cards)
    setEnvRows(prev => prev.map(r => r.barn === barnName ? { ...r, temp: newTemp, humidity: newHumidity } : r));

    // 2. Chạy logic FE IoT: Điều khiển quạt tự động khi chuồng ở chế độ Auto
    setBarnDevices(prev => {
      const barn = prev[barnName];
      if (!barn) return prev;

      if (barn.mode === 'auto') {
        const threshold = barn.tempThreshold || 29.5;

        // Vượt ngưỡng -> Tự động BẬT QUẠT (Cấp 3 nếu nóng vượt >= threshold + 1.2, Cấp 2 nếu vượt nhẹ)
        if (newTemp > threshold) {
          const targetSpeed = newTemp >= threshold + 1.2 ? 3 : 2;
          const targetRpm = targetSpeed === 3 ? '1,450 RPM' : '1,350 RPM';
          const targetPower = targetSpeed === 3 ? '1.5 kW' : '1.2 kW';

          if (!barn.fan?.on || barn.fan?.speed !== targetSpeed) {
            return {
              ...prev,
              [barnName]: {
                ...barn,
                fan: {
                  ...barn.fan,
                  on: true,
                  speed: targetSpeed,
                  rpm: targetRpm,
                  power: targetPower
                }
              }
            };
          }
        }
        // Hạ nhiệt về ngưỡng an toàn (có độ trễ 0.4°C tránh đóng ngắt giật cục) -> Tự động TẮT QUẠT
        else if (newTemp <= threshold - 0.4) {
          if (barn.fan?.on) {
            return {
              ...prev,
              [barnName]: {
                ...barn,
                fan: {
                  ...barn.fan,
                  on: false,
                  rpm: '0 RPM'
                }
              }
            };
          }
        }
      }

      return prev;
    });
  };

  // Chuyển đổi Auto / Manual
  const handleToggleMode = (barnName, mode) => {
    setBarnDevices(prev => {
      const barn = prev[barnName];
      const envData = envRows.find(r => r.barn === barnName);
      let updatedFan = barn.fan;

      if (mode === 'auto' && envData) {
        if (envData.temp > barn.tempThreshold) {
          const targetSpeed = envData.temp >= barn.tempThreshold + 1.2 ? 3 : 2;
          updatedFan = {
            ...barn.fan,
            on: true,
            speed: targetSpeed,
            rpm: targetSpeed === 3 ? '1,450 RPM' : '1,350 RPM',
            power: targetSpeed === 3 ? '1.5 kW' : '1.2 kW'
          };
        } else if (envData.temp <= barn.tempThreshold - 0.4) {
          updatedFan = {
            ...barn.fan,
            on: false,
            rpm: '0 RPM'
          };
        }
      }

      return {
        ...prev,
        [barnName]: {
          ...barn,
          mode,
          fan: updatedFan
        }
      };
    });
    showToast(`Đã chuyển ${barnName} sang chế độ: ${mode === 'auto' ? 'Tự động (Theo cảm biến & hạ nhiệt)' : 'Thủ công (Người dùng toàn quyền)'}`);
  };

  // Bắn thông báo test lên thanh Header
  const handleTriggerTestAlert = (barnName = 'Nhà A1') => {
    const envData = envRows.find(r => r.barn === barnName) || { temp: 31.8, humidity: 68 };
    const b = barnDevices[barnName] || { tempThreshold: 29.5, fan: { speed: 2 } };

    sendNotification({
      barn: barnName,
      type: 'Nhiệt độ cao IoT',
      value: `${envData.temp}°C (Vượt ngưỡng ${b.tempThreshold}°C)`,
      level: 'Cảnh báo',
      status: `Đã tự động kích hoạt Quạt thông gió cấp ${b.fan?.speed || 2} để giải nhiệt`
    });
  };

  // Cài đặt ngưỡng nhiệt độ kích hoạt quạt
  const handleSetThreshold = (barnName, field, value) => {
    const numVal = Number(value) || 0;
    setBarnDevices(prev => {
      const barn = prev[barnName];
      const envData = envRows.find(r => r.barn === barnName);

      // Nếu auto và ngưỡng mới thấp hơn nhiệt độ thực tế -> Tự động kích hoạt quạt và bắn cảnh báo!
      if (barn.mode === 'auto' && envData && envData.temp > numVal) {
        sendNotification({
          barn: barnName,
          type: 'Nhiệt độ chuồng cao',
          value: `${envData.temp}°C > ${numVal}°C`,
          level: 'Cảnh báo',
          status: `Quạt thông gió ${barnName} đã tự động kích hoạt làm mát chuồng`
        });
      }

      return {
        ...prev,
        [barnName]: {
          ...barn,
          [field]: numVal
        }
      };
    });
  };

  // Bật toàn bộ quạt
  const handleTurnAllFans = (turnOn) => {
    setBarnDevices(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(barn => {
        updated[barn] = {
          ...updated[barn],
          mode: 'manual',
          fan: { ...updated[barn].fan, on: turnOn, speed: turnOn ? 3 : updated[barn].fan.speed, rpm: turnOn ? '1,450 RPM' : '0 RPM' }
        };
      });
      showToast(turnOn ? '⚡ Đã kích hoạt TOÀN BỘ quạt thông gió toàn trại ở công suất tối đa!' : '🛑 Đã tắt toàn bộ quạt thông gió!');
      return updated;
    });
  };

  // Bật toàn bộ đèn
  const handleTurnAllLights = (turnOn) => {
    setBarnDevices(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(barn => {
        updated[barn] = {
          ...updated[barn],
          light: { ...updated[barn].light, on: turnOn }
        };
      });
      showToast(turnOn ? '💡 Đã bật toàn bộ đèn chiếu sáng tất cả các chuồng!' : '🌑 Đã tắt toàn bộ đèn chuồng!');
      return updated;
    });
  };

  // Tắt tất cả thiết bị (Quạt + Đèn)
  const handleTurnOffAll = () => {
    setBarnDevices(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(barn => {
        updated[barn] = {
          ...updated[barn],
          fan: { ...updated[barn].fan, on: false, rpm: '0 RPM' },
          light: { ...updated[barn].light, on: false }
        };
      });
      showToast('🛑 Đã tắt toàn bộ thiết bị (Quạt & Đèn) toàn trại!');
      return updated;
    });
  };

  const handleSetAllAuto = () => {
    setBarnDevices(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(barn => {
        updated[barn] = {
          ...updated[barn],
          mode: 'auto'
        };
      });
      showToast('🤖 Đã chuyển toàn bộ chuồng sang chế độ TỰ ĐỘNG điều tiết theo cảm biến nhiệt độ & độ ẩm!');
      return updated;
    });
  };

  return (
    <FarmShiftLayout
      pageTitle="Ghi nhật ký chăn nuôi"
      breadcrumbs={[{ label: 'Ghi nhật ký' }]}
    >
      {/* ── FarmShift Tab Navigation ────────────────────────── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'barns' ? 'active' : ''}`}
          onClick={() => { setActiveTab('barns'); setJournalCycleId(null); }}
        >
          <MapPinned size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Nhật ký chuồng (hao hụt, cân mẫu)
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'env' ? 'active' : ''}`}
          onClick={() => setActiveTab('env')}
        >
          <Thermometer size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Môi trường (nhiệt độ, độ ẩm)
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'iot_devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('iot_devices')}
        >
          <Fan size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Thiết bị IoT & quạt
        </button>
      </div>

      {/* ── TAB: HAO HỤT / CÂN MẪU (dữ liệu thật theo chuồng) ── */}
      {activeTab === 'barns' && <BarnJournal mode={journalMode} selectedCycleId={journalCycleId} onSelect={setJournalCycleId} />}

      {/* ── TAB: CHỈ SỐ MÔI TRƯỜNG NUÔI (Environmental) ──── */}
      {activeTab === 'env' && (
        <EnvironmentalTab
          envRows={envRows}
          barnDevices={barnDevices}
          handleEnvChange={handleEnvChange}
          setSelectedIotBarnFilter={setSelectedIotBarnFilter}
          setActiveTab={setActiveTab}
          setViewingCctvBarn={setViewingCctvBarn}
          showToast={showToast}
        />
      )}

      {/* ── TAB: QUẢN LÝ THIẾT BỊ IOT & ĐIỀU KHIỂN QUẠT ───── */}
      {activeTab === 'iot_devices' && (
        <IotDevicesTab
          iotToast={iotToast}
          selectedIotBarnFilter={selectedIotBarnFilter}
          setSelectedIotBarnFilter={setSelectedIotBarnFilter}
          barnDevices={barnDevices}
          envRows={envRows}
          barnHistories={barnHistories}
          activeChartBarns={activeChartBarns}
          setActiveChartBarns={setActiveChartBarns}
          handleTurnAllFans={handleTurnAllFans}
          handleTurnAllLights={handleTurnAllLights}
          handleSetAllAuto={handleSetAllAuto}
          handleTurnOffAll={handleTurnOffAll}
          handleToggleMode={handleToggleMode}
          handleLiveClimateUpdate={handleLiveClimateUpdate}
          handleToggleFan={handleToggleFan}
          handleSetFanSpeed={handleSetFanSpeed}
          handleToggleLight={handleToggleLight}
          handleSetThreshold={handleSetThreshold}
          handleTriggerTestAlert={handleTriggerTestAlert}
          setViewingCctvBarn={setViewingCctvBarn}
        />
      )}

      {/* ── Modal: Xem Camera Trực Tiếp từ Nhật Ký & Thiết Bị IoT ── */}
      {viewingCctvBarn && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '850px' }}>
            <div className="farmshift-modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#019788', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Video size={16} color="#ffffff" />
                </div>
                <div>
                  <h3 className="farmshift-modal-title" style={{ margin: 0, fontSize: '16px' }}>
                    Camera Giám Sát Trực Tiếp: {viewingCctvBarn.name} ({viewingCctvBarn.areaName})
                  </h3>
                  <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', marginTop: '2px' }}>
                    Kết nối trực tiếp thiết bị IoT quạt, đèn và cảm biến vi khí hậu
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingCctvBarn(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="farmshift-modal-body" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '18px' }}>
                <CctvPlayer
                  barn={{
                    name: viewingCctvBarn.name,
                    areaName: viewingCctvBarn.areaName,
                    livestockType: viewingCctvBarn.livestockType,
                    current: viewingCctvBarn.current || 2400,
                    temp: viewingCctvBarn.temp,
                    humidity: viewingCctvBarn.humidity,
                    fan: viewingCctvBarn.fan || { on: true, speed: 2 },
                    light: viewingCctvBarn.light || { on: true }
                  }}
                />
              </div>

              {/* Status summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ padding: '10px 14px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Nhiệt độ hiện tại</span>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '2px' }}>
                    {viewingCctvBarn.temp}°C
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Độ ẩm chuồng</span>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '2px' }}>
                    {viewingCctvBarn.humidity}%
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <span style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>Trạng thái Quạt & Đèn</span>
                  <div style={{ fontSize: '14.5px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '4px' }}>
                    Quạt: {viewingCctvBarn.fan?.on ? `Bật (Cấp ${viewingCctvBarn.fan?.speed})` : 'Tắt'} · Đèn: {viewingCctvBarn.light?.on ? 'Bật' : 'Tắt'}
                  </div>
                </div>
              </div>
            </div>

            <div className="farmshift-modal-footer">
              <button
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => setViewingCctvBarn(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
