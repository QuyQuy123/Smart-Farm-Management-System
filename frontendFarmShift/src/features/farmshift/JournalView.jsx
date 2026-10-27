// src/features/farmshift/JournalView.jsx
// Ghi nhật ký chăn nuôi chuẩn FarmShift & DESIGN.md (Cữ ăn, IoT môi trường, Sức khỏe, Xử lý vật nuôi, Ghi công việc)
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Utensils, ClipboardCheck, Thermometer, Fan, HeartPulse,
  ShieldAlert, Plus, X, Video, FileSpreadsheet, HeartCrack, Scale
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useNotification } from '../../context/NotificationContext';
import { getSystemMessage } from '../../constants/systemMessages';
import { CctvPlayer } from '../../components/CctvPlayer';
import { FeedDiaryTab } from './FeedDiaryTab';
import { WorkDiaryTab } from './WorkDiaryTab';
import { EnvironmentalTab } from './EnvironmentalTab';
import { HealthDiaryTab } from './HealthDiaryTab';
import { IotDevicesTab } from './IotDevicesTab';
import { BarnJournal } from './BarnJournal';

export const JournalView = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') || 'loss';

  const { sendNotification, showToast: showGlobalToast } = useNotification();
  const [activeTab, setActiveTab] = useState(initialTab); // 'loss' | 'weight' | 'feed' | 'env' | 'iot_devices' | 'health' | 'treatment' | 'work'
  // Chuồng đang chọn ở tab Hao hụt / Cân mẫu, giữ khi chuyển qua lại giữa hai tab.
  const [journalCycleId, setJournalCycleId] = useState(null);
  const barnJournal = activeTab === 'loss' || activeTab === 'weight';
  // Lối tắt ?tab=... bấm khi đang ở trang này vẫn chuyển đúng tab.
  const [tabParam, setTabParam] = useState(initialTab);
  if (tabParam !== initialTab) {
    setTabParam(initialTab);
    setActiveTab(initialTab);
  }
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

  // Feed logs organized by Barn
  const [feedRows, setFeedRows] = useState([
    { area: 'Khu Mía Thịt', barn: 'Nhà A1', dayAge: 6, meal1: 50, meal2: 45, meal3: 0, feedType: 'Higro 01 (Cám gà con)', unit: 'Kg' },
    { area: 'Khu Mía Thịt', barn: 'Nhà A2', dayAge: 6, meal1: 48, meal2: 44, meal3: 0, feedType: 'Higro 01 (Cám gà con)', unit: 'Kg' },
    { area: 'Khu Mía Thịt', barn: 'Nhà A3', dayAge: 6, meal1: 52, meal2: 48, meal3: 0, feedType: 'Higro 01 (Cám gà con)', unit: 'Kg' },
    { area: 'Khu J Thịt', barn: 'Nhà B1', dayAge: 45, meal1: 120, meal2: 110, meal3: 0, feedType: 'Higro 03 (Gà vỗ béo)', unit: 'Kg' },
    { area: 'Khu J Thịt', barn: 'Nhà B2', dayAge: 45, meal1: 115, meal2: 108, meal3: 0, feedType: 'Higro 03 (Gà vỗ béo)', unit: 'Kg' },
  ]);

  useEffect(() => {
    const handleAiAction = (event) => {
      const action = event.detail;
      if (!action) return;
      if (action.actionType === 'LOG_FEED' && action.actionSummary) {
        const barnName = action.actionSummary.barnName || '';
        const kg = Number(action.actionSummary.kg) || 50;
        const feedName = action.actionSummary.feedName || 'Higro 01 (Cám gà con)';

        setFeedRows(prev => {
          const matchIndex = prev.findIndex(r => barnName && r.barn.toLowerCase().includes(barnName.toLowerCase()));
          if (matchIndex >= 0) {
            return prev.map((row, idx) => {
              if (idx === matchIndex) {
                const updatedMeal3 = row.meal3 > 0 ? row.meal3 + kg : kg;
                return { ...row, meal3: updatedMeal3, feedType: feedName };
              }
              return row;
            });
          }
          return [...prev, {
            area: 'Khu Mía Thịt',
            barn: barnName || 'Chuồng mới',
            dayAge: 6,
            meal1: kg,
            meal2: 0,
            meal3: 0,
            feedType: feedName,
            unit: 'Kg'
          }];
        });

        showGlobalToast(`Đã đồng bộ nhật ký cám cho ${action.actionSummary.barnName || 'chuồng'}: ${action.actionSummary.detail}`);
      } else if (action.actionType === 'LOG_WEIGHT' && action.actionSummary) {
        const barnName = action.actionSummary.barnName || 'Chuồng';
        const detail = action.actionSummary.detail || '';
        const newTask = {
          id: `work-weight-${Date.now()}`,
          taskName: `Cân mẫu định kỳ (${detail})`,
          area: 'Khu Mía Thịt',
          barn: barnName,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          assignee: 'Trợ lý AI FarmShift',
          priority: 'Hàng ngày',
          status: 'Hoàn thành',
          notes: `Đã ghi nhận số liệu cân mẫu qua AI: ${detail}`
        };
        setWorkTasks(prev => [newTask, ...prev]);
        showGlobalToast(`Đã đồng bộ cân mẫu: ${action.actionSummary.detail}`);
      }
    };
    window.addEventListener('farmshift:ai-action', handleAiAction);
    return () => window.removeEventListener('farmshift:ai-action', handleAiAction);
  }, [showGlobalToast]);

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
      actions={barnJournal ? null : (
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
      )}
    >
      {/* ── FarmShift Tab Navigation ────────────────────────── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'loss' ? 'active' : ''}`}
          onClick={() => setActiveTab('loss')}
        >
          <HeartCrack size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Hao hụt (chết / loại thải)
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'weight' ? 'active' : ''}`}
          onClick={() => setActiveTab('weight')}
        >
          <Scale size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Cân mẫu
        </button>
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

      {/* ── TAB: HAO HỤT / CÂN MẪU (dữ liệu thật theo chuồng) ── */}
      {barnJournal && <BarnJournal mode={activeTab} selectedCycleId={journalCycleId} onSelect={setJournalCycleId} />}

      {/* ── TAB: CỮ ĂN HÀNG NGÀY (Feed Diary) ─────────────── */}
      {activeTab === 'feed' && (
        <FeedDiaryTab
          feedRows={feedRows}
          showFeedMeal3={showFeedMeal3}
          setShowFeedMeal3={setShowFeedMeal3}
          handleMealChange={handleMealChange}
          showToast={showToast}
        />
      )}

      {/* ── TAB: GHI CÔNG VIỆC (Work Diary) ───────────────── */}
      {activeTab === 'work' && (
        <WorkDiaryTab
          workTasks={workTasks}
          setWorkTasks={setWorkTasks}
          setShowWorkModal={setShowWorkModal}
        />
      )}

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

      {/* ── TAB: TÌNH TRẠNG SỨC KHỎE (Health Diary) ───────── */}
      {activeTab === 'health' && (
        <HealthDiaryTab
          healthRows={healthRows}
          handleHealthChange={handleHealthChange}
          showToast={showToast}
        />
      )}

      {/* ── TAB: XỬ LÝ VẬT NUÔI & PHÁC ĐỒ (Treatment) ──────── */}
      {activeTab === 'treatment' && (
        <HealthDiaryTab
          treatmentFilter={treatmentFilter}
          setTreatmentFilter={setTreatmentFilter}
          filteredTasks={filteredTasks}
          isTreatmentMode={true}
        />
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
              <p style={{ fontSize: '14.5px', color: 'var(--color-muted)' }}>
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
                  showToast('MSG03');
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
