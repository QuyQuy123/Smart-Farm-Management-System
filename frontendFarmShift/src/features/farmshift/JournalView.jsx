// src/features/farmshift/JournalView.jsx
// Ghi nhật ký chăn nuôi chuẩn FarmShift & DESIGN.md (Cữ ăn, IoT môi trường, Sức khỏe, Xử lý vật nuôi, Ghi công việc)
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ClipboardList, Plus, Search, FileSpreadsheet, Utensils,
  Thermometer, HeartPulse, ShieldAlert, Mic, CheckCircle,
  Camera, Image as ImageIcon, X, AlertTriangle, ArrowRight, Clock,
  Fan, Droplets, Zap, Sliders, Cpu, Power, Wind, RefreshCw, Check,
  Lightbulb, Bell, Video, TrendingUp, ClipboardCheck, Calendar
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useNotification } from '../../context/NotificationContext';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';
import { CctvPlayer } from '../../components/CctvPlayer';
import { StockTempChart } from '../../components/StockTempChart';

export const JournalView = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') || 'feed';

  const { sendNotification } = useNotification();
  const [activeTab, setActiveTab] = useState(initialTab); // 'feed' | 'env' | 'iot_devices' | 'health' | 'treatment' | 'work'
  const [viewingCctvBarn, setViewingCctvBarn] = useState(null);
  const [activeChartBarns, setActiveChartBarns] = useState({});

  // Work tasks state (Ghi công việc - work-diary parity)
  const [workTasks, setWorkTasks] = useState([
    {
      id: 'work-1',
      taskName: 'Dọn phân chuồng & đảo trấu đệm lót',
      area: 'Khu Mía Thịt',
      barn: 'Nhà A1',
      time: '07:30',
      assignee: 'Nguyễn Văn An',
      priority: 'Bắt buộc hàng ngày',
      status: 'Đã hoàn thành',
      notes: 'Đã bổ sung thêm 2 bao trấu khô khử mùi Balasa N01'
    },
    {
      id: 'work-2',
      taskName: 'Phun thuốc sát trùng lối đi và tường chuồng',
      area: 'Khu Mía Thịt',
      barn: 'Toàn bộ Khu Mía Thịt',
      time: '14:00',
      assignee: 'Trần Văn Bình',
      priority: 'Định kỳ 3 ngày/lần',
      status: 'Đã hoàn thành',
      notes: 'Sử dụng dung dịch Benkokid 0.5% phun tiêu độc khử trùng'
    },
    {
      id: 'work-3',
      taskName: 'Kiểm tra hệ thống núm uống & máng ăn tự động',
      area: 'Khu J Thịt',
      barn: 'Nhà B1, B2',
      time: '08:00',
      assignee: 'Nguyễn Văn Hải',
      priority: 'Hàng ngày',
      status: 'Đã hoàn thành',
      notes: 'Áp lực nước ổn định, không bị rò rỉ núm uống'
    },
    {
      id: 'work-4',
      taskName: 'Cân mẫu định kỳ kiểm tra tăng trọng',
      area: 'Khu J Thịt',
      barn: 'Nhà B1',
      time: '10:00',
      assignee: 'Trần Văn Bình',
      priority: 'Định kỳ 7 ngày/lần',
      status: 'Đã hoàn thành',
      notes: 'Cân ngẫu nhiên 30 con: Trung bình 1.82 kg/con, đạt chuẩn'
    },
    {
      id: 'work-5',
      taskName: 'Vệ sinh giàn làm mát cooling pad & kiểm tra bạt',
      area: 'Khu Mía Thịt',
      barn: 'Nhà A2',
      time: '15:30',
      assignee: 'Nguyễn Văn An',
      priority: 'Tuần/lần',
      status: 'Đang thực hiện',
      notes: 'Xịt rửa rong rêu tấm cooling pad'
    }
  ]);
  const [showWorkModal, setShowWorkModal] = useState(false);
  const [newWorkTask, setNewWorkTask] = useState({
    taskName: '',
    area: 'Khu Mía Thịt',
    barn: 'Nhà A1',
    time: '08:00',
    assignee: 'Nguyễn Văn An',
    priority: 'Hàng ngày',
    notes: ''
  });

  const handleCreateWorkTask = (e) => {
    e.preventDefault();
    if (!newWorkTask.taskName) return;
    const created = {
      id: `work-${Date.now()}`,
      taskName: newWorkTask.taskName,
      area: newWorkTask.area,
      barn: newWorkTask.barn,
      time: newWorkTask.time,
      assignee: newWorkTask.assignee,
      priority: newWorkTask.priority,
      status: 'Chưa bắt đầu',
      notes: newWorkTask.notes || 'Công việc mới giao'
    };
    setWorkTasks([created, ...workTasks]);
    setShowWorkModal(false);
    setNewWorkTask({
      taskName: '',
      area: 'Khu Mía Thịt',
      barn: 'Nhà A1',
      time: '08:00',
      assignee: 'Nguyễn Văn An',
      priority: 'Hàng ngày',
      notes: ''
    });
  };

  // Feed logs organized by Barn
  const [feedRows, setFeedRows] = useState([
    { area: 'Khu Mía Thịt', barn: 'Nhà A1', dayAge: 6, meal1: 50, meal2: 45, meal3: 0, feedType: 'Higro 01 (Cám gà con)', unit: 'Kg' },
    { area: 'Khu Mía Thịt', barn: 'Nhà A2', dayAge: 6, meal1: 48, meal2: 44, meal3: 0, feedType: 'Higro 01 (Cám gà con)', unit: 'Kg' },
    { area: 'Khu Mía Thịt', barn: 'Nhà A3', dayAge: 6, meal1: 52, meal2: 48, meal3: 0, feedType: 'Higro 01 (Cám gà con)', unit: 'Kg' },
    { area: 'Khu J Thịt', barn: 'Nhà B1', dayAge: 45, meal1: 120, meal2: 110, meal3: 0, feedType: 'Higro 03 (Gà vỗ béo)', unit: 'Kg' },
    { area: 'Khu J Thịt', barn: 'Nhà B2', dayAge: 45, meal1: 115, meal2: 108, meal3: 0, feedType: 'Higro 03 (Gà vỗ béo)', unit: 'Kg' },
  ]);

  // Environment readings (IoT) - Chỉ nhiệt độ & độ ẩm
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
        let drift = 0;
        if (device.fan?.on) {
          // Quạt đang chạy: làm mát chuồng, cấp càng cao làm mát càng nhanh
          const speed = device.fan?.speed || 2;
          const coolRate = speed === 3 ? 0.09 : speed === 2 ? 0.06 : 0.035;
          drift = -coolRate;
        } else {
          // Quạt tắt: nhiệt độ nhà kính và thân nhiệt tăng dần
          drift = 0.055;
        }

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

  // Health & mortality logs
  const [healthRows, setHealthRows] = useState([
    { area: 'Khu Mía Thịt', barn: 'Nhà A1', dayAge: 6, avgWeight: 0.16, cullCount: 2, photo: true, notes: 'Gà khỏe, ăn đều, phân sáp khuôn đẹp' },
    { area: 'Khu Mía Thịt', barn: 'Nhà A2', dayAge: 6, avgWeight: 0.15, cullCount: 1, photo: false, notes: 'Gà phản xạ tốt với ánh sáng, tiếng động' },
    { area: 'Khu Mía Thịt', barn: 'Nhà A3', dayAge: 6, avgWeight: 0.16, cullCount: 3, photo: false, notes: 'Đè bẹp tự nhiên 2 con gần cửa gió' },
    { area: 'Khu J Thịt', barn: 'Nhà B1', dayAge: 45, avgWeight: 1.68, cullCount: 1, photo: true, notes: 'Đạt chuẩn cân Dabaco 45 ngày, lông mượt' },
    { area: 'Khu J Thịt', barn: 'Nhà B2', dayAge: 45, avgWeight: 1.64, cullCount: 2, photo: false, notes: 'Tiêu hóa tốt, uống nước bình thường' },
  ]);

  // Treatments & Schedules
  const [treatmentTasks, setTreatmentTasks] = useState([
    {
      id: 'task-1',
      group: 'Vaxin & Thuốc',
      barn: 'Nhà A1 (Khu Mía Thịt)',
      description: 'Nhỏ mắt vắc-xin Newcastle Lasota + Gumboro lần 1',
      medicine: 'PoulShot Larygo (1000 liều)',
      timeStart: '07:30 - 06/10/2026',
      timeEnd: '09:00 - 06/10/2026',
      person: 'Nguyen Hiep',
      status: 'Đã hoàn thành'
    },
    {
      id: 'task-2',
      group: 'Xử lý môi trường',
      barn: 'Nhà B1 (Khu J Thịt)',
      description: 'Phun sát trùng định kỳ khuôn viên chuồng và lối đi',
      medicine: 'Hóa chất sát trùng BKC 80%',
      timeStart: '15:00 - 06/10/2026',
      timeEnd: '16:30 - 06/10/2026',
      person: 'Tran Van Nam',
      status: 'Đã hoàn thành'
    },
    {
      id: 'task-3',
      group: 'Vaxin & Thuốc',
      barn: 'Nhà B2 (Khu J Thịt)',
      description: 'Bổ sung điện giải Vitamin C chống nóng buổi trưa',
      medicine: 'Paracetamol C bột',
      timeStart: '11:00 - 07/10/2026',
      timeEnd: '12:00 - 07/10/2026',
      person: 'Nguyen Thi Thu Ha',
      status: 'Đang tiến hành'
    }
  ]);

  const [treatmentFilter, setTreatmentFilter] = useState('ALL');

  // Modals
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showFeedMeal3, setShowFeedMeal3] = useState(false);

  // New treatment task state
  const [newTask, setNewTask] = useState({
    group: 'Vaxin & Thuốc',
    barn: 'Nhà A1',
    description: '',
    medicine: 'PoulShot Larygo - 1000 liều',
    timeStart: '',
    timeEnd: '',
    person: 'Nguyen Hiep'
  });

  const handleCreateTreatmentTask = (e) => {
    e.preventDefault();
    const created = {
      id: `task-${Date.now()}`,
      group: newTask.group,
      barn: newTask.barn,
      description: newTask.description,
      medicine: newTask.medicine,
      timeStart: newTask.timeStart || new Date().toLocaleString('vi-VN'),
      timeEnd: newTask.timeEnd || '—',
      person: newTask.person || 'Nguyen Hiep',
      status: 'Đã lên lịch'
    };
    setTreatmentTasks([created, ...treatmentTasks]);
    setShowTreatmentModal(false);
  };

  const handleMealChange = (index, field, val) => {
    const updated = [...feedRows];
    updated[index][field] = Number(val) || 0;
    setFeedRows(updated);
  };

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

  const showToast = (msg) => {
    setIotToast(msg);
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

  const handleHealthChange = (index, field, val) => {
    const updated = [...healthRows];
    updated[index][field] = field === 'notes' ? val : Number(val) || 0;
    setHealthRows(updated);
  };

  const filteredTasks = treatmentTasks.filter(t => {
    if (treatmentFilter === 'ALL') return true;
    return t.group === treatmentFilter;
  });

  return (
    <FarmShiftLayout
      pageTitle="Ghi nhật ký chăn nuôi"
      breadcrumbs={[{ label: 'Ghi nhật ký' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          {activeTab === 'treatment' ? (
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowTreatmentModal(true)}
            >
              <Plus size={16} /> Thêm lịch xử lý
            </button>
          ) : activeTab === 'work' ? (
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowWorkModal(true)}
            >
              <Plus size={16} /> Giao việc mới
            </button>
          ) : (
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowAddLogModal(true)}
            >
              <Plus size={16} /> Ghi nhật ký hôm nay
            </button>
          )}
        </div>
      }
    >
      {/* ── FarmShift Tab Navigation ────────────────────────── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <Utensils size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Ghi nhật ký cho ăn
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'work' ? 'active' : ''}`}
          onClick={() => setActiveTab('work')}
        >
          <ClipboardCheck size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Ghi công việc (Work Diary)
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'env' ? 'active' : ''}`}
          onClick={() => setActiveTab('env')}
        >
          <Thermometer size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Chỉ số môi trường (Nhiệt độ & Độ ẩm)
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'iot_devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('iot_devices')}
        >
          <Fan size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Quản lý thiết bị IoT & Điều khiển quạt
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          <HeartPulse size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Tình trạng sức khỏe & Bệnh tích
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'treatment' ? 'active' : ''}`}
          onClick={() => setActiveTab('treatment')}
        >
          <ShieldAlert size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Xử lý vật nuôi & Phác đồ
        </button>
      </div>

      {/* ── TAB 1: Ghi nhật ký cho ăn (Parity Ghi nhật ký.html) ────────── */}
      {activeTab === 'feed' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
              Nhập số lượng cám cho ăn thực tế từng cữ theo từng khu và chuồng nuôi
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="farmshift-btn farmshift-btn-secondary"
                style={{ fontSize: '12.5px', padding: '6px 12px' }}
                onClick={() => setShowFeedMeal3(!showFeedMeal3)}
              >
                <Plus size={14} /> {showFeedMeal3 ? 'Ẩn Cữ 3' : 'Thêm 1 cữ ăn (Cữ 3)'}
              </button>
            </div>
          </div>

          {['Khu Mía Thịt', 'Khu J Thịt'].map(areaName => (
            <div key={areaName} className="farmshift-card" style={{ marginBottom: '20px' }}>
              <div className="farmshift-card-header" style={{ backgroundColor: 'var(--color-canvas)' }}>
                <h3 className="farmshift-card-title">{areaName}</h3>
                <span className="farmshift-badge farmshift-badge-neutral">
                  Tổng ăn khu: {feedRows.filter(r => r.area === areaName).reduce((a, b) => a + b.meal1 + b.meal2 + (showFeedMeal3 ? b.meal3 : 0), 0)} Kg
                </span>
              </div>
              <div className="farmshift-table-container" style={{ border: 'none' }}>
                <table className="farmshift-table">
                  <thead>
                    <tr>
                      <th style={{ width: '120px' }}>Chuồng nuôi</th>
                      <th style={{ width: '110px' }}>Ngày nuôi</th>
                      <th style={{ width: '180px' }}>Loại thức ăn (Kho)</th>
                      <th>Cữ 1 (Sáng - Kg)</th>
                      <th>Cữ 2 (Chiều - Kg)</th>
                      {showFeedMeal3 && <th>Cữ 3 (Tối - Kg)</th>}
                      <th>Tổng cữ ăn (Kg)</th>
                      <th style={{ textAlign: 'right' }}>Tác vụ trừ kho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedRows.map((row, idx) => {
                      if (row.area !== areaName) return null;
                      const totalMeal = row.meal1 + row.meal2 + (showFeedMeal3 ? row.meal3 : 0);
                      return (
                        <tr key={row.barn}>
                          <td><strong>{row.barn}</strong></td>
                          <td>
                            <span className="farmshift-badge farmshift-badge-neutral">Ngày {row.dayAge}</span>
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--color-ink)' }}>{row.feedType}</td>
                          <td>
                            <input
                              type="number"
                              className="farmshift-form-control"
                              style={{ width: '90px', padding: '6px 10px', height: '36px' }}
                              value={row.meal1}
                              onChange={(e) => handleMealChange(idx, 'meal1', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="farmshift-form-control"
                              style={{ width: '90px', padding: '6px 10px', height: '36px' }}
                              value={row.meal2}
                              onChange={(e) => handleMealChange(idx, 'meal2', e.target.value)}
                            />
                          </td>
                          {showFeedMeal3 && (
                            <td>
                              <input
                                type="number"
                                className="farmshift-form-control"
                                style={{ width: '90px', padding: '6px 10px', height: '36px' }}
                                value={row.meal3}
                                onChange={(e) => handleMealChange(idx, 'meal3', e.target.value)}
                              />
                            </td>
                          )}
                          <td>
                            <strong style={{ fontSize: '15px', color: 'var(--color-primary)' }}>
                              {totalMeal} Kg
                            </strong>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="farmshift-btn farmshift-btn-primary"
                              style={{ fontSize: '12px', padding: '5px 12px' }}
                              onClick={() => alert(`Đã ghi nhận cho ăn ${totalMeal}kg ${row.feedType} tại ${row.barn} và tự động trừ tồn kho!`)}
                            >
                              Cho ăn ({totalMeal} Kg)
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: GHI CÔNG VIỆC (Work Diary parity) ──────────── */}
      {activeTab === 'work' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Action Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <span style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>
                Nhật ký theo dõi công việc hàng ngày: Dọn chuồng, phun sát trùng, thay trấu đệm lót, cân mẫu và bảo trì thiết bị
              </span>
            </div>
            <button
              className="farmshift-btn farmshift-btn-primary"
              style={{ fontSize: '12.5px', padding: '6px 14px' }}
              onClick={() => setShowWorkModal(true)}
            >
              <Plus size={14} /> Giao việc mới hôm nay
            </button>
          </div>

          {/* Work Tasks Table */}
          <div className="farmshift-card" style={{ margin: 0 }}>
            <div className="farmshift-card-header">
              <h3 className="farmshift-card-title">
                <ClipboardCheck size={18} color="var(--color-primary)" />
                Danh sách công việc & phân công hôm nay
              </h3>
              <span className="farmshift-badge farmshift-badge-neutral">
                {workTasks.filter(t => t.status === 'Đã hoàn thành').length}/{workTasks.length} việc đã xong
              </span>
            </div>
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Giờ</th>
                    <th>Tên công việc</th>
                    <th>Chuồng / Khu vực</th>
                    <th>Người thực hiện</th>
                    <th>Định kỳ / Ưu tiên</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú thực hiện</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {workTasks.map(task => (
                    <tr key={task.id}>
                      <td>
                        <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                          {task.time}
                        </strong>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--color-ink)' }}>{task.taskName}</strong>
                      </td>
                      <td>
                        <strong>{task.barn}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{task.area}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{task.assignee}</span>
                      </td>
                      <td>
                        <span className="farmshift-badge farmshift-badge-neutral" style={{ fontSize: '11.5px' }}>
                          {task.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`farmshift-badge ${task.status === 'Đã hoàn thành' ? 'farmshift-badge-success' : task.status === 'Đang thực hiện' ? 'farmshift-badge-warning' : 'farmshift-badge-neutral'}`}>
                          {task.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                        {task.notes}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {task.status !== 'Đã hoàn thành' ? (
                          <button
                            className="farmshift-btn farmshift-btn-primary"
                            style={{ fontSize: '11.5px', padding: '3px 8px' }}
                            onClick={() => {
                              setWorkTasks(workTasks.map(t => t.id === task.id ? { ...t, status: 'Đã hoàn thành' } : t));
                            }}
                          >
                            ✓ Hoàn thành
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 600 }}>
                            ✓ Đã xong
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Chỉ số môi trường nuôi (IoT) (Chỉ Nhiệt độ & Độ ẩm) ─ */}
      {activeTab === 'env' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
              Đồng bộ dữ liệu cảm biến IoT tự động (Nhiệt độ & Độ ẩm) cho phép theo dõi và hiệu chỉnh vi khí hậu chuồng nuôi
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                style={{ fontSize: '12.5px', padding: '6px 14px' }}
                onClick={() => setActiveTab('iot_devices')}
              >
                <Fan size={14} /> Chuyển đến Điều khiển Quạt IoT →
              </button>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-primary"
                style={{ fontSize: '12.5px', padding: '6px 14px' }}
                onClick={() => alert('Đã lưu các thay đổi chỉ số nhiệt độ & độ ẩm!')}
              >
                <CheckCircle size={14} /> Lưu thay đổi
              </button>
            </div>
          </div>

          {['Khu Mía Thịt', 'Khu J Thịt'].map(areaName => (
            <div key={areaName} className="farmshift-card" style={{ marginBottom: '20px' }}>
              <div className="farmshift-card-header" style={{ backgroundColor: 'var(--color-canvas)' }}>
                <h3 className="farmshift-card-title">{areaName}</h3>
                <span className="farmshift-badge farmshift-badge-success">Cảm biến trực tuyến</span>
              </div>
              <div className="farmshift-table-container" style={{ border: 'none' }}>
                <table className="farmshift-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Chuồng nuôi</th>
                      <th style={{ width: '110px' }}>Ngày nuôi</th>
                      <th style={{ width: '160px' }}>Nhiệt độ (°C)</th>
                      <th style={{ width: '160px' }}>Độ ẩm (%)</th>
                      <th>Trạng thái vi khí hậu</th>
                      <th style={{ width: '220px' }}>Quạt & Thiết bị IoT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {envRows.map((row, idx) => {
                      if (row.area !== areaName) return null;
                      const device = barnDevices[row.barn] || { mode: 'auto', fan: { on: true, speed: 2 }, light: { on: true } };

                      return (
                        <tr key={row.barn}>
                          <td><strong>{row.barn}</strong></td>
                          <td>
                            <span className="farmshift-badge farmshift-badge-neutral">Ngày {row.dayAge}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Thermometer size={15} color="var(--color-info)" />
                              <input
                                type="number"
                                step="0.1"
                                className="farmshift-form-control"
                                style={{ width: '75px', padding: '4px 8px', height: '34px' }}
                                value={row.temp}
                                onChange={(e) => handleEnvChange(idx, 'temp', e.target.value)}
                              />
                              <span>°C</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Droplets size={15} color="#0284c7" />
                              <input
                                type="number"
                                className="farmshift-form-control"
                                style={{ width: '75px', padding: '4px 8px', height: '34px' }}
                                value={row.humidity}
                                onChange={(e) => handleEnvChange(idx, 'humidity', e.target.value)}
                              />
                              <span>%</span>
                            </div>
                          </td>
                          <td>
                            <span className="farmshift-badge farmshift-badge-success">{row.status}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                <Fan
                                  size={15}
                                  color={device.fan?.on ? '#019788' : '#94a3b8'}
                                  className={device.fan?.on ? (device.fan?.speed === 3 ? 'farmshift-fan-spinning-3' : device.fan?.speed === 2 ? 'farmshift-fan-spinning-2' : 'farmshift-fan-spinning-1') : ''}
                                />
                                <span style={{ fontWeight: 500, color: device.fan?.on ? 'var(--color-primary)' : 'var(--color-muted)' }}>
                                  {device.fan?.on ? `Quạt (Cấp ${device.fan?.speed})` : 'Quạt tắt'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                <Lightbulb
                                  size={15}
                                  color={device.light?.on ? '#f59e0b' : '#94a3b8'}
                                />
                                <span style={{ fontWeight: 500, color: device.light?.on ? '#f59e0b' : 'var(--color-muted)' }}>
                                  {device.light?.on ? 'Đèn bật' : 'Đèn tắt'}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="farmshift-btn farmshift-btn-secondary"
                                style={{ fontSize: '11.5px', padding: '3px 8px', height: '26px' }}
                                onClick={() => { setSelectedIotBarnFilter(row.barn); setActiveTab('iot_devices'); }}
                                title="Mở bảng điều khiển quạt và đèn chuồng này"
                              >
                                <Sliders size={12} /> Chỉnh thiết bị
                              </button>
                              <button
                                type="button"
                                className="farmshift-btn farmshift-btn-secondary"
                                style={{ fontSize: '11.5px', padding: '3px 8px', height: '26px', display: 'flex', alignItems: 'center', gap: '3px' }}
                                onClick={() => setViewingCctvBarn({
                                  name: row.barn,
                                  areaName: row.area,
                                  livestockType: 'Gia cầm (Gà thịt)',
                                  temp: row.temp,
                                  humidity: row.humidity,
                                  fan: device.fan,
                                  light: device.light,
                                  current: 2400
                                })}
                                title="Xem camera trực tiếp chuồng này"
                              >
                                <Video size={12} color="#019788" /> Cam
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Banner liên kết sang điều khiển quạt IoT */}
          <div className="farmshift-card" style={{ marginTop: '16px', padding: '16px 20px', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#019788', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Fan size={22} className="farmshift-fan-spinning-2" />
                </div>
                <div>
                  <strong style={{ fontSize: '14.5px', color: 'var(--color-ink)' }}>Trung tâm điều khiển Quạt thông gió & Giàn mát IoT</strong>
                  <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '2px' }}>
                    Dữ liệu cảm biến nhiệt độ và độ ẩm được kết nối trực tiếp với cụm quạt hút. Bạn có thể bật/tắt thủ công hoặc cài đặt tự động kích hoạt.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-primary"
                style={{ fontSize: '13px', padding: '8px 16px' }}
                onClick={() => setActiveTab('iot_devices')}
              >
                <Sliders size={14} /> Chuyển sang Điều khiển Quạt IoT →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Quản lý thiết bị IoT & Điều khiển Quạt theo ý mình ─── */}
      {activeTab === 'iot_devices' && (
        <div>
          {/* Toast alert */}
          {iotToast && (
            <div style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '12px 18px',
              borderRadius: 'var(--rounded-md)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13.5px',
              marginBottom: '16px'
            }}>
              <Check size={16} color="#34d399" />
              <span>{iotToast}</span>
            </div>
          )}

          {/* Header & Master Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 4px' }}>
                Quản lý thiết bị IoT & Điều khiển Quạt - Đèn
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: 0 }}>
                Hệ thống chuồng chuẩn: 01 Quạt thông gió + 01 Hệ thống Đèn chiếu sáng. Điều khiển tự động theo cảm biến hoặc thủ công.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-primary"
                style={{ fontSize: '12.5px', padding: '6px 14px' }}
                onClick={() => handleTurnAllFans(true)}
              >
                <Zap size={14} /> Bật toàn bộ quạt
              </button>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                style={{ fontSize: '12.5px', padding: '6px 14px' }}
                onClick={() => handleTurnAllLights(true)}
              >
                <Lightbulb size={14} color="#f59e0b" /> Bật toàn bộ đèn
              </button>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                style={{ fontSize: '12.5px', padding: '6px 14px' }}
                onClick={handleSetAllAuto}
              >
                <Cpu size={14} /> Chuyển tất cả sang Auto
              </button>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-secondary"
                style={{ fontSize: '12.5px', padding: '6px 14px' }}
                onClick={handleTurnOffAll}
              >
                <Power size={14} /> Tắt tất cả thiết bị
              </button>
            </div>
          </div>

          {/* Dynamic Overview Metrics from envRows */}
          {(() => {
            const avgCampTemp = (envRows.reduce((acc, r) => acc + Number(r.temp), 0) / (envRows.length || 1)).toFixed(1);
            const avgCampHumidity = Math.round(envRows.reduce((acc, r) => acc + Number(r.humidity), 0) / (envRows.length || 1));
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="farmshift-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>Nhiệt độ TB toàn trại</span>
                    <Thermometer size={16} color="var(--color-info)" />
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '8px' }}>
                    {avgCampTemp}°C
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-success)', marginTop: '4px' }}>
                    ● 5/5 cảm biến trực tuyến (Live Sync)
                  </div>
                </div>

                <div className="farmshift-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>Độ ẩm TB toàn trại</span>
                    <Droplets size={16} color="#0284c7" />
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '8px' }}>
                    {avgCampHumidity}%
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '4px' }}>
                    Chuẩn sinh thái gà thịt
                  </div>
                </div>

                <div className="farmshift-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>Quạt đang quay</span>
                    <Fan size={16} color="var(--color-primary)" className="farmshift-fan-spinning-2" />
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '8px' }}>
                    {Object.values(barnDevices).reduce((acc, b) => acc + (b.fan?.on ? 1 : 0), 0)} / 5 quạt
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-success)', marginTop: '4px' }}>
                    Đang duy trì thông thoáng
                  </div>
                </div>

                <div className="farmshift-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>Đèn chuồng đang sáng</span>
                    <Lightbulb size={16} color="#f59e0b" />
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '8px' }}>
                    {Object.values(barnDevices).reduce((acc, b) => acc + (b.light?.on ? 1 : 0), 0)} / 5 chuồng
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '4px' }}>
                    {Object.values(barnDevices).reduce((acc, b) => acc + (b.light?.on ? 0.3 : 0), 0).toFixed(1)} kW điện chiếu sáng
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Barn Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {['ALL', 'Nhà A1', 'Nhà A2', 'Nhà A3', 'Nhà B1', 'Nhà B2'].map(name => (
              <button
                key={name}
                type="button"
                className={`farmshift-btn ${selectedIotBarnFilter === name ? 'farmshift-btn-primary' : 'farmshift-btn-secondary'}`}
                style={{ fontSize: '12.5px', padding: '5px 14px', borderRadius: 'var(--rounded-full)' }}
                onClick={() => setSelectedIotBarnFilter(name)}
              >
                {name === 'ALL' ? 'Tất cả chuồng (5)' : name}
              </button>
            ))}
          </div>

          {/* Barn IoT Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
            {Object.entries(barnDevices).map(([barnName, b]) => {
              if (selectedIotBarnFilter !== 'ALL' && selectedIotBarnFilter !== barnName) return null;
              const envData = envRows.find(r => r.barn === barnName) || { temp: 29.5, humidity: 68 };

              return (
                <div key={barnName} className="farmshift-card" style={{ padding: '20px' }}>
                  {/* Card Header (2 clear rows: Title & Mode in row 1, Sensors & Camera in row 2) */}
                  <div style={{ paddingBottom: '14px', borderBottom: '1px solid var(--color-hairline)', marginBottom: '16px' }}>
                    {/* Row 1: Title, Area & Mode Switch */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-ink)' }}>{barnName}</h4>
                        <span className="farmshift-badge farmshift-badge-neutral">{b.area}</span>
                        <span style={{ fontSize: '11.5px', color: 'var(--color-muted)', backgroundColor: 'var(--color-surface-soft)', padding: '2px 8px', borderRadius: '4px' }}>
                          {b.stage}
                        </span>
                      </div>

                      {/* Mode Toggle */}
                      <div style={{ display: 'flex', backgroundColor: 'var(--color-surface-soft)', padding: '3px', borderRadius: 'var(--rounded-sm)', border: '1px solid var(--color-hairline)', flexShrink: 0 }}>
                        <button
                          type="button"
                          style={{
                            border: 'none',
                            padding: '3px 9px',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            backgroundColor: b.mode === 'auto' ? '#019788' : 'transparent',
                            color: b.mode === 'auto' ? '#ffffff' : 'var(--color-muted)',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => handleToggleMode(barnName, 'auto')}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          style={{
                            border: 'none',
                            padding: '3px 9px',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            backgroundColor: b.mode === 'manual' ? '#0f172a' : 'transparent',
                            color: b.mode === 'manual' ? '#ffffff' : 'var(--color-muted)',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => handleToggleMode(barnName, 'manual')}
                        >
                          Thủ công
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Live IoT Sensors & Camera Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: envData.temp > b.tempThreshold ? '#dc2626' : 'var(--color-info)',
                          backgroundColor: envData.temp > b.tempThreshold ? 'rgba(220, 38, 38, 0.10)' : 'rgba(37, 79, 173, 0.08)',
                          padding: '3px 9px',
                          borderRadius: '4px',
                          border: envData.temp > b.tempThreshold ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid transparent',
                          transition: 'all 0.25s ease'
                        }}>
                          <Thermometer size={14} /> {envData.temp}°C
                          {envData.temp > b.tempThreshold && (
                            <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, marginLeft: '2px' }}>
                              🔥 Cao
                            </span>
                          )}
                        </span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0284c7',
                          backgroundColor: 'rgba(2, 132, 199, 0.08)',
                          padding: '3px 9px',
                          borderRadius: '4px'
                        }}>
                          <Droplets size={14} /> {envData.humidity}%
                        </span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          color: '#10b981',
                          fontWeight: 600,
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            boxShadow: '0 0 6px #10b981'
                          }} />
                          Live 1.6s
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="farmshift-btn farmshift-btn-secondary"
                          style={{ fontSize: '11.5px', padding: '3px 10px', height: '26px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          onClick={() => setViewingCctvBarn({
                            name: barnName,
                            areaName: b.area,
                            livestockType: 'Gia cầm (Gà thịt)',
                            temp: envData.temp,
                            humidity: envData.humidity,
                            fan: b.fan,
                            light: b.light,
                            current: 2400
                          })}
                          title="Xem camera trực tiếp chuồng này"
                        >
                          <Video size={13} color="#019788" /> 📹 Xem Camera
                        </button>

                        <button
                          type="button"
                          className={`farmshift-btn ${(activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) ? 'farmshift-btn-primary' : 'farmshift-btn-secondary'}`}
                          style={{
                            fontSize: '11.5px',
                            padding: '3px 10px',
                            height: '26px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: (activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) ? '#0f172a' : undefined,
                            color: (activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) ? '#38bdf8' : undefined,
                            borderColor: (activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) ? '#38bdf8' : undefined
                          }}
                          onClick={() => setActiveChartBarns(prev => ({
                            ...prev,
                            [barnName]: !(prev[barnName] ?? (selectedIotBarnFilter === barnName))
                          }))}
                          title="Bật / Tắt biểu đồ nhiệt độ biến động dạng bảng chứng khoán"
                        >
                          <TrendingUp size={13} color={(activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) ? '#38bdf8' : '#019788'} />
                          📈 Biểu đồ nhiệt
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mode Banner */}
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--rounded-sm)',
                    fontSize: '12px',
                    marginBottom: '16px',
                    backgroundColor: b.mode === 'auto' ? (b.fan?.on ? '#fef2f2' : '#f0fdfa') : '#f8fafc',
                    border: `1px solid ${b.mode === 'auto' ? (b.fan?.on ? '#fecaca' : '#ccfbf1') : '#e2e8f0'}`,
                    color: b.mode === 'auto' ? (b.fan?.on ? '#991b1b' : '#0f766e') : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.3s ease'
                  }}>
                    <span>
                      {b.mode === 'auto'
                        ? (b.fan?.on
                            ? `🤖 Auto AI: Nhiệt độ (${envData.temp}°C) > ${b.tempThreshold}°C ➔ Đang kích hoạt Quạt ${b.fan?.rpm} để hạ nhiệt`
                            : `🤖 Auto AI: Nhiệt độ (${envData.temp}°C) ≤ ${b.tempThreshold}°C ➔ Quạt tự ngắt nghỉ an toàn`)
                        : '🖐️ Chế độ thủ công: Bạn toàn quyền bật/tắt & chọn cấp độ gió'}
                    </span>
                    {b.mode === 'auto' && (
                      <span className={`farmshift-badge ${b.fan?.on ? 'farmshift-badge-danger' : 'farmshift-badge-success'}`} style={{ fontSize: '10.5px' }}>
                        {b.fan?.on ? 'Auto Làm Mát' : 'Auto Ổn Định'}
                      </span>
                    )}
                  </div>

                  {/* 📈 Biểu đồ nhiệt độ & vi khí hậu thời gian thực dạng chứng khoán */}
                  {(activeChartBarns[barnName] ?? (selectedIotBarnFilter === barnName)) && (
                    <div style={{ marginBottom: '16px' }}>
                      <StockTempChart
                        barnName={barnName}
                        areaName={b.area}
                        currentTemp={envData.temp}
                        currentHumidity={envData.humidity}
                        tempThreshold={b.tempThreshold}
                        fan={b.fan}
                        externalPoints={barnHistories[barnName]}
                        onLiveTempChange={handleLiveClimateUpdate}
                      />
                    </div>
                  )}

                  {/* Devices Grid (Chỉ 1 Quạt + 1 Đèn) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Device 1: Quạt thông gió */}
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--rounded-md)',
                      border: '1px solid var(--color-hairline)',
                      backgroundColor: b.fan?.on ? '#ffffff' : 'var(--color-surface-soft)',
                      transition: 'all 0.2s ease'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            backgroundColor: b.fan?.on ? 'rgba(1, 151, 136, 0.12)' : '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Fan
                              size={20}
                              color={b.fan?.on ? '#019788' : '#64748b'}
                              className={b.fan?.on ? (b.fan?.speed === 3 ? 'farmshift-fan-spinning-3' : b.fan?.speed === 2 ? 'farmshift-fan-spinning-2' : 'farmshift-fan-spinning-1') : ''}
                            />
                          </div>
                          <div>
                            <strong style={{ fontSize: '13.5px', color: 'var(--color-ink)' }}>Quạt thông gió (Quạt hút)</strong>
                            <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '2px' }}>
                              {b.fan?.power} · {b.fan?.on ? b.fan?.rpm : 'Đang dừng'}
                            </div>
                          </div>
                        </div>

                        <label className="farmshift-iot-toggle">
                          <input
                            type="checkbox"
                            checked={b.fan?.on}
                            onChange={() => handleToggleFan(barnName)}
                          />
                          <span className="farmshift-iot-slider"></span>
                        </label>
                      </div>

                      {/* Speed selector */}
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--color-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Cấp độ gió:</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[1, 2, 3].map(speed => (
                            <button
                              key={speed}
                              type="button"
                              style={{
                                border: '1px solid',
                                borderColor: b.fan?.on && b.fan?.speed === speed ? '#019788' : 'var(--color-hairline)',
                                backgroundColor: b.fan?.on && b.fan?.speed === speed ? '#019788' : '#ffffff',
                                color: b.fan?.on && b.fan?.speed === speed ? '#ffffff' : 'var(--color-body)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                              onClick={() => handleSetFanSpeed(barnName, speed)}
                            >
                              Số {speed}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Device 2: Đèn chiếu sáng / Đèn sưởi */}
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--rounded-md)',
                      border: '1px solid var(--color-hairline)',
                      backgroundColor: b.light?.on ? '#ffffff' : 'var(--color-surface-soft)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: b.light?.on ? 'rgba(245, 158, 11, 0.15)' : '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Lightbulb
                            size={20}
                            color={b.light?.on ? '#f59e0b' : '#64748b'}
                          />
                        </div>
                        <div>
                          <strong style={{ fontSize: '13.5px', color: 'var(--color-ink)' }}>Hệ thống Đèn chiếu sáng</strong>
                          <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '2px' }}>
                            {b.light?.on ? 'Đèn đang sáng · 300W' : 'Đang tắt đèn'}
                          </div>
                        </div>
                      </div>

                      <label className="farmshift-iot-toggle">
                        <input
                          type="checkbox"
                          checked={b.light?.on}
                          onChange={() => handleToggleLight(barnName)}
                        />
                        <span className="farmshift-iot-slider"></span>
                      </label>
                    </div>
                  </div>

                  {/* Auto threshold adjustment & Test Alert Button */}
                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--color-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Ngưỡng nhiệt tự kích hoạt quạt:</span>
                      <input
                        type="number"
                        step="0.5"
                        style={{ width: '60px', padding: '4px 6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--color-hairline)', textAlign: 'center' }}
                        value={b.tempThreshold}
                        onChange={(e) => handleSetThreshold(barnName, 'tempThreshold', e.target.value)}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>°C</span>
                    </div>

                    <button
                      type="button"
                      className="farmshift-btn"
                      style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', fontWeight: 600 }}
                      onClick={() => handleTriggerTestAlert(barnName)}
                      title="Bắn thử cảnh báo của chuồng này lên chuông Header"
                    >
                      <Bell size={12} /> Bắn test chuông
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: Tình trạng sức khỏe & Bệnh tích ──────────────── */}
      {activeTab === 'health' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
              Theo dõi cân nặng bình quân, hao hụt (con chết) và nhật ký hình ảnh bệnh tích
            </span>
            <button
              className="farmshift-btn farmshift-btn-primary"
              style={{ fontSize: '12.5px', padding: '6px 14px' }}
              onClick={() => alert('Đã lưu cập nhật sức khỏe & hao hụt!')}
            >
              <CheckCircle size={14} /> Lưu thay đổi
            </button>
          </div>

          {['Khu Mía Thịt', 'Khu J Thịt'].map(areaName => (
            <div key={areaName} className="farmshift-card" style={{ marginBottom: '20px' }}>
              <div className="farmshift-card-header" style={{ backgroundColor: 'var(--color-canvas)' }}>
                <h3 className="farmshift-card-title">{areaName}</h3>
                <span className="farmshift-badge farmshift-badge-neutral">
                  Hao hụt khu: {healthRows.filter(r => r.area === areaName).reduce((a, b) => a + b.cullCount, 0)} con
                </span>
              </div>
              <div className="farmshift-table-container" style={{ border: 'none' }}>
                <table className="farmshift-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Chuồng nuôi</th>
                      <th style={{ width: '110px' }}>Ngày nuôi</th>
                      <th>Cân nặng TB (kg)</th>
                      <th>Hao hụt (con)</th>
                      <th>Ảnh vật nuôi & Mổ khám</th>
                      <th>Ghi chú bệnh tích / Biểu hiện</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthRows.map((row, idx) => {
                      if (row.area !== areaName) return null;
                      return (
                        <tr key={row.barn}>
                          <td><strong>{row.barn}</strong></td>
                          <td>
                            <span className="farmshift-badge farmshift-badge-neutral">Ngày {row.dayAge}</span>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="farmshift-form-control"
                              style={{ width: '90px', padding: '4px 8px', height: '34px' }}
                              value={row.avgWeight}
                              onChange={(e) => handleHealthChange(idx, 'avgWeight', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="farmshift-form-control"
                              style={{ width: '80px', padding: '4px 8px', height: '34px', color: row.cullCount > 2 ? 'var(--color-signature-coral)' : 'inherit' }}
                              value={row.cullCount}
                              onChange={(e) => handleHealthChange(idx, 'cullCount', e.target.value)}
                            />
                          </td>
                          <td>
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 10px',
                                border: '1px solid var(--color-hairline)',
                                borderRadius: 'var(--rounded-sm)',
                                fontSize: '12px',
                                cursor: 'pointer',
                                backgroundColor: 'var(--color-canvas)',
                                color: 'var(--color-ink)'
                              }}
                            >
                              <Camera size={14} />
                              {row.photo ? '1 ảnh đã đính kèm' : 'Chọn ảnh...'}
                              <input type="file" style={{ display: 'none' }} onChange={() => alert('Đã đính kèm ảnh chụp bệnh tích mổ khám!')} />
                            </label>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="farmshift-form-control"
                              style={{ height: '34px', fontSize: '13px' }}
                              value={row.notes}
                              onChange={(e) => handleHealthChange(idx, 'notes', e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB 4: Xử lý vật nuôi & Phác đồ ─────────────────────── */}
      {activeTab === 'treatment' && (
        <div>
          {/* Subfilter buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['ALL', 'Vaxin & Thuốc', 'Xử lý môi trường'].map(grp => (
              <button
                key={grp}
                className={`farmshift-btn ${treatmentFilter === grp ? 'farmshift-btn-primary' : 'farmshift-btn-secondary'}`}
                style={{ fontSize: '13px', padding: '6px 14px' }}
                onClick={() => setTreatmentFilter(grp)}
              >
                {grp === 'ALL' ? 'Mặc định (Tất cả)' : grp}
              </button>
            ))}
          </div>

          <div className="farmshift-card">
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Nhóm công việc</th>
                    <th>Nơi xử lý (Chuồng)</th>
                    <th>Mô tả công việc thực hiện</th>
                    <th>Thuốc / Hóa chất sử dụng</th>
                    <th>Thời gian thực hiện</th>
                    <th>Người phụ trách</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => (
                    <tr key={task.id}>
                      <td>
                        <span className={`farmshift-badge ${task.group === 'Vaxin & Thuốc' ? 'farmshift-badge-warning' : 'farmshift-badge-neutral'}`}>
                          {task.group}
                        </span>
                      </td>
                      <td><strong>{task.barn}</strong></td>
                      <td>
                        <strong style={{ color: 'var(--color-ink)' }}>{task.description}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--color-primary)' }}>
                          {task.medicine}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                          {task.timeStart}
                        </div>
                      </td>
                      <td>{task.person}</td>
                      <td>
                        <span className={`farmshift-badge ${task.status === 'Đã hoàn thành' ? 'farmshift-badge-success' : 'farmshift-badge-neutral'}`}>
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Thêm lịch xử lý vật nuôi ───────────────────── */}
      {showTreatmentModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Thêm công việc xử lý vật nuôi</h3>
              <button
                onClick={() => setShowTreatmentModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateTreatmentTask}>
              <div className="farmshift-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Nơi xử lý *</label>
                    <select
                      className="farmshift-form-control"
                      value={newTask.barn}
                      onChange={(e) => setNewTask({ ...newTask, barn: e.target.value })}
                    >
                      <option value="Nhà A1 (Khu Mía Thịt)">Nhà A1 (Khu Mía Thịt)</option>
                      <option value="Nhà A2 (Khu Mía Thịt)">Nhà A2 (Khu Mía Thịt)</option>
                      <option value="Nhà A3 (Khu Mía Thịt)">Nhà A3 (Khu Mía Thịt)</option>
                      <option value="Nhà B1 (Khu J Thịt)">Nhà B1 (Khu J Thịt)</option>
                      <option value="Nhà B2 (Khu J Thịt)">Nhà B2 (Khu J Thịt)</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Nhóm công việc *</label>
                    <select
                      className="farmshift-form-control"
                      value={newTask.group}
                      onChange={(e) => setNewTask({ ...newTask, group: e.target.value })}
                    >
                      <option value="Vaxin & Thuốc">Vaxin & Thuốc</option>
                      <option value="Xử lý môi trường">Xử lý môi trường</option>
                      <option value="Chăm sóc đặc biệt">Chăm sóc đặc biệt</option>
                    </select>
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Mô tả công việc *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nhỏ vắc-xin Gum lần 2, Phun sát trùng..."
                    className="farmshift-form-control"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  />
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Thuốc / Hóa chất sử dụng</label>
                  <input
                    type="text"
                    placeholder="Chọn từ kho thuốc (VD: PoulShot, Paracetamol C, BKC...)"
                    className="farmshift-form-control"
                    value={newTask.medicine}
                    onChange={(e) => setNewTask({ ...newTask, medicine: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Thời gian bắt đầu *</label>
                    <input
                      type="text"
                      placeholder="VD: 08:00 - 08/10/2026"
                      className="farmshift-form-control"
                      value={newTask.timeStart}
                      onChange={(e) => setNewTask({ ...newTask, timeStart: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Kết thúc</label>
                    <input
                      type="text"
                      placeholder="VD: 10:00 - 08/10/2026"
                      className="farmshift-form-control"
                      value={newTask.timeEnd}
                      onChange={(e) => setNewTask({ ...newTask, timeEnd: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowTreatmentModal(false)}
                >
                  Bỏ qua
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Lưu và đóng lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Ghi nhanh nhật ký hôm nay ─────────────────── */}
      {showAddLogModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Ghi nhật ký tổng hợp hôm nay</h3>
              <button
                onClick={() => setShowAddLogModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="farmshift-modal-body">
              <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                Dữ liệu có thể nhập trực tiếp ở bảng theo từng chuồng hoặc nhập biểu mẫu nhanh dưới đây:
              </p>
              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Chuồng nuôi</label>
                <select className="farmshift-form-control">
                  <option value="Nhà A1">Nhà A1 (Khu Mía Thịt)</option>
                  <option value="Nhà A2">Nhà A2 (Khu Mía Thịt)</option>
                  <option value="Nhà B1">Nhà B1 (Khu J Thịt)</option>
                  <option value="Nhà B2">Nhà B2 (Khu J Thịt)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Cữ ăn 1 (Kg)</label>
                  <input type="number" placeholder="50" className="farmshift-form-control" />
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Cữ ăn 2 (Kg)</label>
                  <input type="number" placeholder="45" className="farmshift-form-control" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Hao hụt (con)</label>
                  <input type="number" placeholder="0" className="farmshift-form-control" />
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Cân nặng TB (kg)</label>
                  <input type="number" step="0.01" placeholder="1.65" className="farmshift-form-control" />
                </div>
              </div>
            </div>
            <div className="farmshift-modal-footer">
              <button
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => setShowAddLogModal(false)}
              >
                Hủy bỏ
              </button>
              <button
                className="farmshift-btn farmshift-btn-primary"
                onClick={() => {
                  alert('Đã lưu nhật ký chăn nuôi thành công!');
                  setShowAddLogModal(false);
                }}
              >
                Lưu nhật ký
              </button>
            </div>
          </div>
        </div>
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
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>
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
                  <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Nhiệt độ hiện tại</span>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '2px' }}>
                    {viewingCctvBarn.temp}°C
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Độ ẩm chuồng</span>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '2px' }}>
                    {viewingCctvBarn.humidity}%
                  </div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Trạng thái Quạt & Đèn</span>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '4px' }}>
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

      {/* ── Modal: Giao việc mới (Work Task Modal) ─────────── */}
      {showWorkModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Giao công việc chăn nuôi mới</h3>
              <button
                onClick={() => setShowWorkModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateWorkTask}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Tên công việc *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Dọn phân chuồng, Phun sát trùng, Cân mẫu..."
                    className="farmshift-form-control"
                    value={newWorkTask.taskName}
                    onChange={(e) => setNewWorkTask({ ...newWorkTask, taskName: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Khu vực *</label>
                    <select
                      className="farmshift-form-control"
                      value={newWorkTask.area}
                      onChange={(e) => setNewWorkTask({ ...newWorkTask, area: e.target.value })}
                    >
                      <option value="Khu Mía Thịt">Khu Mía Thịt</option>
                      <option value="Khu J Thịt">Khu J Thịt</option>
                      <option value="Toàn trại">Toàn bộ trang trại</option>
                    </select>
                  </div>

                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Chuồng nuôi chỉ định *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Nhà A1, Nhà B1..."
                      className="farmshift-form-control"
                      value={newWorkTask.barn}
                      onChange={(e) => setNewWorkTask({ ...newWorkTask, barn: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Giờ thực hiện</label>
                    <input
                      type="time"
                      className="farmshift-form-control"
                      value={newWorkTask.time}
                      onChange={(e) => setNewWorkTask({ ...newWorkTask, time: e.target.value })}
                    />
                  </div>

                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Người phụ trách *</label>
                    <select
                      className="farmshift-form-control"
                      value={newWorkTask.assignee}
                      onChange={(e) => setNewWorkTask({ ...newWorkTask, assignee: e.target.value })}
                    >
                      <option value="Nguyễn Văn An">Nguyễn Văn An (Công nhân)</option>
                      <option value="Trần Văn Bình">Trần Văn Bình (Công nhân)</option>
                      <option value="Nguyễn Văn Hải">Nguyễn Văn Hải (Quản lý kỹ thuật)</option>
                    </select>
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Mức độ ưu tiên / Chu kỳ</label>
                  <select
                    className="farmshift-form-control"
                    value={newWorkTask.priority}
                    onChange={(e) => setNewWorkTask({ ...newWorkTask, priority: e.target.value })}
                  >
                    <option value="Bắt buộc hàng ngày">Bắt buộc hàng ngày</option>
                    <option value="Hàng ngày">Hàng ngày</option>
                    <option value="Định kỳ 3 ngày/lần">Định kỳ 3 ngày/lần</option>
                    <option value="Định kỳ 7 ngày/lần">Định kỳ 7 ngày/lần</option>
                    <option value="Khẩn cấp xử lý ngay">Khẩn cấp xử lý ngay</option>
                  </select>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Ghi chú & Chỉ dẫn kỹ thuật</label>
                  <textarea
                    rows="2"
                    placeholder="Chỉ dẫn liều lượng thuốc sát trùng, quy cách thực hiện..."
                    className="farmshift-form-control"
                    value={newWorkTask.notes}
                    onChange={(e) => setNewWorkTask({ ...newWorkTask, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowWorkModal(false)}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Giao công việc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
