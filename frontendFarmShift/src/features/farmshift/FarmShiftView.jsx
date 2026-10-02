// src/features/farmshift/FarmShiftView.jsx
// Complete React Universal View Engine for all 73 screens in FarmShift.html
// P1 Refactor: screen logic is delegated to feature modules under ./screens/
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { SEED_DATA, ROUTES_REGISTRY } from './farmshiftData';
import {
  Activity, BarChart3, Beef, Bell, Bird, Calendar as CalendarIcon,
  Check, CheckSquare, ChevronRight, ClipboardList, DollarSign,
  Download, Eye, FileText, LayoutDashboard, Mic, Package, Plus,
  Printer, RefreshCw, Search, Settings as SettingsIcon, ShoppingCart,
  Sparkles, Trash2, TrendingUp, Users, Warehouse, AlertTriangle, ArrowRight
} from 'lucide-react';

/* ── Screen Modules (P1 split) ─────────────────────────── */
import { ScreenFarm }      from './screens/ScreenFarm';
import { ScreenBatch }     from './screens/ScreenBatch';
import { ScreenFinance }   from './screens/ScreenFinance';
import { ScreenInventory } from './screens/ScreenInventory';
import { ScreenIoT }       from './screens/ScreenIoT';
import { ScreenJournal }   from './screens/ScreenJournal';
import { ScreenReports }   from './screens/ScreenReports';
import { ScreenTasks }     from './screens/ScreenTasks';
import { ScreenTrade }     from './screens/ScreenTrade';
import { ScreenEmployees } from './screens/ScreenEmployees';
import { num, money, DataTable, NoteBanner, LogTable, GrowthChart, FiltersRow } from './screenHelpers';


export const FarmShiftView = ({ screen: propScreen }) => {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Screen resolution
  const screenId = propScreen || params.screenId || 'dashboard';

  // Role resolution
  const roleMap = {
    'ROLE_FARM_OWNER': 'owner',
    'ROLE_ACCOUNTANT': 'accountant',
    'ROLE_FARM_WORKER': 'worker',
  };
  const role = roleMap[user?.role] || 'owner';

  // Database state
  const [db, setDb] = useState(() => {
    try {
      const saved = localStorage.getItem('farmshift-demo-v1');
      return saved ? JSON.parse(saved) : structuredClone(SEED_DATA);
    } catch {
      return structuredClone(SEED_DATA);
    }
  });

  const persist = (nextDb) => {
    setDb(nextDb);
    try {
      localStorage.setItem('farmshift-demo-v1', JSON.stringify(nextDb));
    } catch {
      console.warn('localStorage unavailable');
    }
  };

  // Draft & UI state
  const [draft, setDraft] = useState({});
  const [toastMsg, setToastMsg] = useState(null);
  const [formError, setFormError] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: `Xin chào! Bạn có thể tra cứu ${role === 'worker' ? 'công việc và nhật ký chuồng B6' : role === 'accountant' ? 'công nợ, chứng từ và tồn kho' : 'đàn, công việc, tồn kho và chi phí'}.` }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [healthResult, setHealthResult] = useState('');
  const [searchFilterText, setSearchFilterText] = useState('');
  const [statusFilterVal, setStatusFilterVal] = useState('');

  // Audio recorder state
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const navTo = (page, query = '') => {
    navigate(`/view/${page}${query ? '?' + query : ''}`);
  };

  const currentRoute = ROUTES_REGISTRY[screenId] || {
    id: screenId,
    title: screenId,
    group: 'dashboard',
    kind: 'unknown',
    allowed: 'oaw'
  };

  const roleChar = { owner: 'o', accountant: 'a', worker: 'w' }[role];
  const canAccess = currentRoute.allowed.includes(roleChar);

  // Scoped database selectors
  const scopedCoops = () => role === 'worker' ? db.coops.filter(c => c.id === 'B6') : db.coops;
  const scopedLogs = () => role === 'worker' ? db.logs.filter(l => l.coop === 'B6') : db.logs;
  const scopedTasks = () => role === 'worker' ? db.tasks.filter(t => t.coop === 'B6') : db.tasks;
  const totalBirds = () => db.coops.reduce((s, c) => s + c.n, 0);
  const currentCost = () => 70000000 + db.entries.filter(e => e.type === 'cost').reduce((s, e) => s + Number(e.data.amount), 0);

  const num = (n) => Number(n || 0).toLocaleString('vi-VN');
  const money = (n) => num(n) + ' ₫';

  const costs = [
    ['Con giống', 45000000],
    ['Thức ăn', 160000000],
    ['Chăm sóc sức khỏe', 5000000],
    ['Nhân công', 20000000],
    ['Điện nước', 10000000],
    ['Chi phí khác', 10000000]
  ];

  // Tabs generator
  const renderNavTabs = (arr) => (
    <nav className="tabs">
      {arr.map(([p, t]) => (
        <button
          key={p}
          type="button"
          className={p === screenId ? 'active' : ''}
          onClick={() => navTo(p)}
        >
          {t}
        </button>
      ))}
    </nav>
  );

  const batchTabs = () => renderNavTabs([
    ['batch', 'Tổng quan'],
    ['flocks', 'Đàn'],
    ['journal', 'Nhật ký'],
    ['tasks', 'Công việc'],
    ['growth', 'Tăng trưởng'],
    ['feed', 'Thức ăn'],
    ['health', 'Sức khỏe'],
    ['batch-cost', 'Chi phí'],
    ['harvest', 'Thu hoạch']
  ]);

  const stockTabs = () => renderNavTabs([
    ['inventory', 'Tồn kho'],
    ['lots', 'Lô & Hạn dùng'],
    ['stock-transactions', 'Nhập / Xuất'],
    ['counts', 'Kiểm kê']
  ]);

  const finTabs = () => renderNavTabs([
    ['finance', 'Tổng quan'],
    ['cashbook', 'Sổ quỹ'],
    ['receipts', 'Phiếu thu'],
    ['payments', 'Phiếu chi'],
    ['payables', 'Phải trả'],
    ['receivables', 'Phải thu'],
    ['costs', 'Chi phí lứa']
  ]);

  // Form Definitions
  const getFormDefs = (type) => {
    const coopOpts = scopedCoops().map(c => c.id);
    const coopField = { name: 'coop', label: 'Chuồng phụ trách', type: 'select', value: 'B6', opts: coopOpts };
    const dateField = { name: 'date', label: 'Ngày ghi nhận', type: 'date', value: '2026-10-21' };
    const noteField = { name: 'note', label: 'Ghi chú', type: 'textarea', value: '' };

    const defs = {
      area: [
        { name: 'name', label: 'Tên khu', type: 'text', value: 'Khu C' },
        { name: 'code', label: 'Mã khu', type: 'text', value: 'C' },
        noteField
      ],
      coop: [
        { name: 'name', label: 'Tên chuồng', type: 'text', value: 'B7' },
        { name: 'area', label: 'Khu nuôi', type: 'select', value: 'Khu B', opts: ['Khu A', 'Khu B'] },
        { name: 'capacity', label: 'Sức chứa (con)', type: 'number', value: 1500 },
        { name: 'worker', label: 'Người phụ trách', type: 'select', value: 'Trần Văn Bình', opts: ['Trần Văn Bình', 'Nguyễn Văn An'] }
      ],
      transfer: [
        { name: 'source', label: 'Chuồng nguồn', type: 'select', value: 'B6', opts: db.coops.map(c => c.id) },
        { name: 'target', label: 'Chuồng đích', type: 'select', value: 'B5', opts: db.coops.map(c => c.id) },
        { name: 'quantity', label: 'Số con chuyển', type: 'number', value: 100 },
        dateField,
        noteField
      ],
      split: [
        { name: 'source', label: 'Chuồng nguồn', type: 'select', value: 'B6', opts: db.coops.map(c => c.id) },
        { name: 'target', label: 'Chuồng đích', type: 'select', value: 'B5', opts: db.coops.map(c => c.id) },
        { name: 'quantity', label: 'Số con tách', type: 'number', value: 100 },
        { name: 'newFlock', label: 'Mã đàn mới', type: 'text', value: 'D-08-03' },
        noteField
      ],
      merge: [
        { name: 'source', label: 'Đàn nguồn tại chuồng', type: 'select', value: 'B5', opts: db.coops.map(c => c.id) },
        { name: 'target', label: 'Đàn nhận tại chuồng', type: 'select', value: 'B6', opts: db.coops.map(c => c.id) },
        dateField,
        noteField
      ],
      mortality: [
        coopField,
        dateField,
        { name: 'quantity', label: 'Số con hao hụt', type: 'number', value: 1 },
        { name: 'cause', label: 'Nguyên nhân', type: 'select', value: 'Chưa xác định', opts: ['Chưa xác định', 'Chết', 'Loại thải không bán'] },
        noteField
      ],
      feeding: [
        coopField,
        dateField,
        { name: 'item', label: 'Thức ăn', type: 'select', value: 'TA-002', opts: db.stock.filter(s => s.id.startsWith('TA')).map(s => [s.id, s.name]) },
        { name: 'quantity', label: 'Lượng sử dụng (kg)', type: 'number', value: 60 },
        { name: 'stockRef', label: 'Phiếu xuất đã cấp (nếu có)', type: 'text', value: 'XK-1021-01', help: 'Nhật ký không tự trừ kho lần nữa.' },
        noteField
      ],
      weighing: [
        coopField,
        dateField,
        { name: 'samples', label: 'Số con cân mẫu', type: 'number', value: 30 },
        { name: 'weight', label: 'Tổng khối lượng mẫu (kg)', type: 'number', value: 13.2 },
        noteField
      ],
      medication: [
        coopField,
        dateField,
        { name: 'kind', label: 'Loại', type: 'select', value: 'Vitamin', opts: ['Thuốc', 'Vaccine', 'Vitamin'] },
        { name: 'name', label: 'Tên sản phẩm', type: 'text', value: 'Vitamin tổng hợp B-Complex' },
        { name: 'dose', label: 'Liều dùng theo hướng dẫn đã được duyệt', type: 'text', value: '1g / 2 lít nước' },
        { name: 'method', label: 'Cách sử dụng', type: 'select', value: 'Pha nước', opts: ['Pha nước', 'Trộn thức ăn', 'Tiêm', 'Khác'] },
        noteField
      ],
      'work-log': [
        coopField,
        dateField,
        { name: 'kind', label: 'Loại công việc', type: 'select', value: 'Vệ sinh', opts: ['Vệ sinh', 'Khử trùng', 'Thay chất độn', 'Kiểm tra thiết bị', 'Khác'] },
        { name: 'name', label: 'Nội dung thực hiện', type: 'text', value: 'Quét dọn lối đi và máng ăn' },
        noteField
      ],
      'health-log': [
        coopField,
        dateField,
        { name: 'quantity', label: 'Số con có dấu hiệu', type: 'number', value: 1 },
        { name: 'name', label: 'Triệu chứng quan sát', type: 'text', value: 'Ủ rũ, giảm ăn nhẹ' },
        noteField
      ],
      program: [
        { name: 'name', label: 'Tên chương trình', type: 'text', value: 'Gà lông màu · 90 ngày' },
        { name: 'breed', label: 'Giống', type: 'text', value: 'Gà lông màu' },
        { name: 'days', label: 'Thời gian nuôi (ngày)', type: 'number', value: 90 },
        { name: 'stage', label: 'Giai đoạn', type: 'select', value: 'Khởi động', opts: ['Khởi động', 'Tăng trưởng', 'Vỗ béo'] },
        { name: 'instruction', label: 'Nội dung chăm sóc', type: 'textarea', value: 'Tuân thủ nhiệt độ và chế độ chiếu sáng theo ngày tuổi.' },
        noteField
      ],
      targets: [
        { name: 'age', label: 'Ngày tuổi', type: 'number', value: 21 },
        { name: 'weight', label: 'Khối lượng mục tiêu (g/con)', type: 'number', value: 470 },
        { name: 'feed', label: 'Thức ăn dự kiến (kg/ngày)', type: 'number', value: 120 },
        noteField
      ],
      task: [
        { name: 'name', label: 'Tên công việc', type: 'text', value: 'Cân mẫu định kỳ' },
        coopField,
        { name: 'worker', label: 'Người thực hiện', type: 'select', value: 'Trần Văn Bình', opts: ['Trần Văn Bình', 'Nguyễn Văn An'] },
        dateField,
        { name: 'time', label: 'Giờ thực hiện', type: 'time', value: '10:00' },
        { name: 'priority', label: 'Ưu tiên', type: 'select', value: 'Bình thường', opts: ['Bình thường', 'Cao'] },
        { name: 'note', label: 'Hướng dẫn', type: 'textarea', value: 'Lấy ngẫu nhiên 30 mẫu con phân bổ đều chuồng.' }
      ],
      'item-form': [
        { name: 'code', label: 'Mã vật tư', type: 'text', value: 'VT-002' },
        { name: 'name', label: 'Tên vật tư', type: 'text', value: 'Cám hỗn hợp' },
        { name: 'unit', label: 'Đơn vị tính', type: 'select', value: 'kg', opts: ['kg', 'gói', 'lít', 'hộp', 'bao'] },
        { name: 'minimum', label: 'Tồn tối thiểu', type: 'number', value: 30 },
        { name: 'group', label: 'Nhóm', type: 'select', value: 'Vật tư', opts: ['Thức ăn', 'Thuốc', 'Vaccine', 'Hóa chất', 'Vật tư'] },
        noteField
      ],
      'stock-in': [
        { name: 'item', label: 'Vật tư', type: 'select', value: 'VS-001', opts: db.stock.map(s => [s.id, s.name]) },
        { name: 'quantity', label: 'Số lượng nhập', type: 'number', value: 10 },
        { name: 'lot', label: 'Mã lô', type: 'text', value: 'VS-1026B' },
        { name: 'expiry', label: 'Hạn dùng', type: 'date', value: '2027-10-21' },
        { name: 'price', label: 'Đơn giá (₫)', type: 'number', value: 80000 },
        { name: 'warehouse', label: 'Kho nhận', type: 'select', value: 'Kho chính', opts: ['Kho chính', 'Kho phụ khu B'] },
        dateField,
        noteField
      ],
      'stock-out': [
        { name: 'item', label: 'Vật tư', type: 'select', value: 'TA-002', opts: db.stock.map(s => [s.id, s.name]) },
        { name: 'quantity', label: 'Số lượng xuất', type: 'number', value: 60 },
        coopField,
        { name: 'purpose', label: 'Mục đích', type: 'select', value: 'Cấp phát cho chuồng', opts: ['Cấp phát cho chuồng', 'Sử dụng chung'] },
        dateField,
        noteField
      ],
      'stock-transfer': [
        { name: 'item', label: 'Vật tư', type: 'select', value: 'TA-002', opts: db.stock.map(s => [s.id, s.name]) },
        { name: 'quantity', label: 'Số lượng chuyển', type: 'number', value: 60 },
        { name: 'from', label: 'Kho nguồn', type: 'select', value: 'Kho chính', opts: ['Kho chính', 'Kho phụ khu B'] },
        { name: 'to', label: 'Kho đích', type: 'select', value: 'Kho phụ khu B', opts: ['Kho chính', 'Kho phụ khu B'] },
        dateField,
        noteField
      ],
      'stock-return': [
        { name: 'item', label: 'Vật tư', type: 'select', value: 'TA-002', opts: db.stock.map(s => [s.id, s.name]) },
        { name: 'quantity', label: 'Số lượng nhập trả', type: 'number', value: 5 },
        { name: 'sourceRef', label: 'Phiếu xuất gốc', type: 'text', value: 'XK-1021-01' },
        coopField,
        noteField
      ],
      'stock-count': [
        { name: 'item', label: 'Vật tư kiểm kê', type: 'select', value: 'VS-001', opts: db.stock.map(s => [s.id, s.name]) },
        { name: 'actual', label: 'Số lượng thực đếm', type: 'number', value: 19 },
        dateField,
        { name: 'note', label: 'Giải trình chênh lệch', type: 'textarea', value: 'Thiếu 1 lít so với sổ kho' }
      ],
      'stock-adjust': [
        { name: 'item', label: 'Vật tư', type: 'select', value: 'VS-001', opts: db.stock.map(s => [s.id, s.name]) },
        { name: 'actual', label: 'Tồn sau điều chỉnh', type: 'number', value: 19 },
        { name: 'reference', label: 'Biên bản kiểm kê', type: 'text', value: 'KK-1021-01' },
        { name: 'reason', label: 'Lý do điều chỉnh', type: 'text', value: 'Chênh lệch kiểm kê đã xác minh' }
      ],
      purchase: [
        { name: 'party', label: 'Nhà cung cấp', type: 'select', value: 'NCC An Phú', opts: ['NCC An Phú', 'Cám Miền Trung'] },
        dateField,
        { name: 'item', label: 'Vật tư', type: 'select', value: 'TA-002', opts: db.stock.map(s => [s.id, s.name]) },
        { name: 'quantity', label: 'Số lượng', type: 'number', value: 1000 },
        { name: 'price', label: 'Đơn giá (₫)', type: 'number', value: 12000 },
        { name: 'due', label: 'Hạn thanh toán', type: 'date', value: '2026-11-05' },
        noteField
      ],
      supplier: [
        { name: 'name', label: 'Tên nhà cung cấp', type: 'text', value: 'Công ty Cám An Phú' },
        { name: 'phone', label: 'Số điện thoại', type: 'tel', value: '0901234567' },
        { name: 'email', label: 'Email', type: 'email', value: 'contact@anphu.vn' },
        { name: 'address', label: 'Địa chỉ', type: 'text', value: 'KCN Đồng An, Bình Dương' },
        noteField
      ],
      customer: [
        { name: 'name', label: 'Tên khách hàng / thương lái', type: 'text', value: 'Thương lái Hòa' },
        { name: 'phone', label: 'Số điện thoại', type: 'tel', value: '0988776655' },
        { name: 'address', label: 'Địa chỉ', type: 'text', value: 'Chợ đầu mối gia cầm Hà Vĩ' },
        noteField
      ],
      sale: [
        { name: 'party', label: 'Khách hàng', type: 'select', value: 'Thương lái Hòa', opts: ['Thương lái Hòa', 'Khách hàng Minh'] },
        coopField,
        dateField,
        { name: 'quantity', label: 'Số con xuất bán', type: 'number', value: 500 },
        { name: 'cages', label: 'Số lồng', type: 'number', value: 20 },
        { name: 'gross', label: 'Khối lượng cả bì (kg)', type: 'number', value: 1040 },
        { name: 'tare', label: 'Khối lượng bì (kg)', type: 'number', value: 40 },
        { name: 'price', label: 'Đơn giá (₫/kg)', type: 'number', value: 70000 },
        { name: 'due', label: 'Hạn thanh toán', type: 'date', value: '2026-11-05' },
        noteField
      ],
      harvest: [
        coopField,
        { name: 'date', label: 'Ngày dự kiến', type: 'date', value: '2026-12-30' },
        { name: 'quantity', label: 'Số con dự kiến', type: 'number', value: 500 },
        { name: 'weight', label: 'Khối lượng dự kiến (kg)', type: 'number', value: 1000 },
        noteField
      ],
      receipt: [
        { name: 'ref', label: 'Phiếu bán', type: 'select', value: db.sales[0]?.id || '', opts: db.sales.length ? db.sales.map(s => [s.id, `${s.id} · Còn ${money(s.amount - s.paid)}`]) : [['', 'Chưa có phiếu bán — tạo phiếu bán trước']] },
        { name: 'amount', label: 'Số tiền thu (₫)', type: 'number', value: 20000000 },
        { name: 'method', label: 'Hình thức', type: 'select', value: 'Chuyển khoản', opts: ['Chuyển khoản', 'Tiền mặt'] },
        dateField,
        noteField
      ],
      payment: [
        { name: 'ref', label: 'Phiếu mua', type: 'select', value: db.purchases[0]?.id || '', opts: db.purchases.map(s => [s.id, `${s.id} · Còn ${money(s.amount - s.paid)}`]) },
        { name: 'amount', label: 'Số tiền chi (₫)', type: 'number', value: 800000 },
        { name: 'method', label: 'Hình thức', type: 'select', value: 'Tiền mặt', opts: ['Tiền mặt', 'Chuyển khoản'] },
        dateField,
        noteField
      ],
      cost: [
        { name: 'batch', label: 'Lứa nuôi', type: 'select', value: 'MB-2026-08', opts: ['MB-2026-08'] },
        { name: 'category', label: 'Khoản mục', type: 'select', value: 'Nhân công', opts: costs.map(c => c[0]) },
        { name: 'amount', label: 'Chi phí (₫)', type: 'number', value: 2000000 },
        { name: 'source', label: 'Chứng từ nguồn', type: 'text', value: 'CP-1021-01' },
        { name: 'allocation', label: 'Phương pháp', type: 'select', value: 'Trực tiếp', opts: ['Trực tiếp', 'Theo số con', 'Theo ngày nuôi'] },
        dateField,
        noteField
      ],
      device: [
        { name: 'code', label: 'Mã thiết bị', type: 'text', value: 'SENSOR-B6' },
        { name: 'name', label: 'Tên thiết bị', type: 'text', value: 'Cảm biến nhiệt ẩm B6' },
        coopField,
        { name: 'kind', label: 'Loại', type: 'select', value: 'Cảm biến', opts: ['Cảm biến', 'Quạt', 'Phun sương'] },
        noteField
      ],
      threshold: [
        coopField,
        { name: 'temperature', label: 'Nhiệt độ cảnh báo (°C)', type: 'number', value: 32 },
        { name: 'duration', label: 'Duy trì vượt ngưỡng (phút)', type: 'number', value: 5 },
        { name: 'offline', label: 'Ngoại tuyến sau (phút)', type: 'number', value: 10 },
        { name: 'recipient', label: 'Người nhận', type: 'select', value: 'Chủ trại', opts: ['Chủ trại', 'Chủ trại và công nhân phụ trách'] }
      ],
      rule: [
        coopField,
        { name: 'temperature', label: 'Nếu nhiệt độ vượt (°C)', type: 'number', value: 32 },
        { name: 'duration', label: 'Trong (phút)', type: 'number', value: 5 },
        { name: 'action', label: 'Thao tác', type: 'select', value: 'Bật quạt', opts: ['Bật quạt', 'Gửi cảnh báo'] },
        { name: 'enabled', label: 'Trạng thái', type: 'select', value: 'Tắt', opts: ['Tắt', 'Bật'] }
      ],
      employee: [
        { name: 'name', label: 'Họ tên', type: 'text', value: 'Lê Văn Cường' },
        { name: 'username', label: 'Tên đăng nhập', type: 'text', value: 'cuonglv' },
        { name: 'role', label: 'Vai trò', type: 'select', value: 'Công nhân', opts: ['Công nhân', 'Kế toán'] },
        { name: 'phone', label: 'Số điện thoại', type: 'tel', value: '0912998877' },
        { name: 'password', label: 'Mật khẩu tạm thời', type: 'password', value: 'demo12345' },
        { name: 'status', label: 'Trạng thái', type: 'select', value: 'Hoạt động', opts: ['Hoạt động', 'Khóa'] }
      ],
      assignment: [
        { name: 'name', label: 'Công nhân', type: 'select', value: 'Trần Văn Bình', opts: ['Trần Văn Bình', 'Nguyễn Văn An'] },
        coopField,
        { name: 'fromDate', label: 'Ngày bắt đầu', type: 'date', value: '2026-10-21' },
        noteField
      ],
      settings: [
        { name: 'name', label: 'Tên trang trại', type: 'text', value: 'Trang trại Miền Bính' },
        { name: 'address', label: 'Địa chỉ', type: 'text', value: 'Thôn 4, Xã Bình Sơn, Huyện Lục Nam, Bắc Giang' },
        { name: 'phone', label: 'Điện thoại', type: 'tel', value: '0988665544' },
        { name: 'timezone', label: 'Múi giờ', type: 'select', value: 'Asia/Ho_Chi_Minh', opts: ['Asia/Ho_Chi_Minh'] },
        { name: 'currency', label: 'Tiền tệ', type: 'select', value: 'VND', opts: ['VND'] }
      ],
      notification: [
        { name: 'push', label: 'Thông báo ứng dụng', type: 'select', value: 'Bật', opts: ['Bật', 'Tắt'] },
        { name: 'sms', label: 'SMS khẩn cấp', type: 'select', value: 'Tắt', opts: ['Tắt', 'Bật'] },
        { name: 'phone', label: 'Số điện thoại nhận cảnh báo', type: 'tel', value: '0988665544' }
      ]
    };

    return defs[type] || [];
  };

  // Form Live Summary Preview
  const getFormSummary = (type, data = {}) => {
    if (type === 'sale') {
      const net = (+data.gross || 1040) - (+data.tare || 40);
      const price = +data.price || 70000;
      return (
        <div>
          <p>Khối lượng thực: <b>{num(net)} kg</b></p>
          <p>Thành tiền: <b>{money(net * price)}</b></p>
          <p>Tồn chuồng: {num(db.coops.find(c => c.id === (data.coop || 'B6'))?.n || 0)} con</p>
          <span className="badge gray">Chưa xuất đàn</span>
        </div>
      );
    }
    if (type === 'purchase') {
      return (
        <div>
          <p>Tiền hàng: <b>{money((+data.quantity || 1000) * (+data.price || 12000))}</b></p>
          <p>Kho: <span className="badge gray">Chưa nhập</span></p>
          <p>Thanh toán: <span className="badge warn">Chưa thanh toán</span></p>
        </div>
      );
    }
    if (type === 'weighing') {
      const avg = Math.round(((+data.weight || 13.2) / (+data.samples || 30)) * 1000);
      return (
        <div>
          <p>Khối lượng trung bình: <b>{num(avg)} g/con</b></p>
          <p>Mục tiêu ngày 21: 470 g/con</p>
        </div>
      );
    }
    if (type === 'mortality') {
      const c = db.coops.find(c => c.id === (data.coop || 'B6'));
      return (
        <div>
          <p>Trước ghi nhận: <b>{c?.n} con</b></p>
          <p>Sau ghi nhận: <b>{(c?.n || 0) - (+data.quantity || 1)} con</b></p>
        </div>
      );
    }
    if (type === 'stock-count' || type === 'stock-adjust') {
      const s = db.stock.find(s => s.id === (data.item || 'VS-001'));
      return (
        <div>
          <p>Tồn sổ: {s?.n} {s?.unit}</p>
          <p>Thực đếm: {data.actual ?? 19} {s?.unit}</p>
          <p>Chênh lệch: {num((data.actual ?? 19) - (s?.n || 0))} {s?.unit}</p>
        </div>
      );
    }
    return (
      <div>
        <p>Lứa hiện hành: <b>MB-2026-08</b></p>
        <p>Ngày nghiệp vụ mẫu: 21/10/2026</p>
        <p>Người thực hiện: {role === 'owner' ? 'Chủ trang trại' : role === 'accountant' ? 'Kế toán' : 'Công nhân'}</p>
      </div>
    );
  };

  // Form Save Action Handlers
  const handleSaveForm = (type, d) => {
    const q = +d.quantity;
    const c = db.coops.find(c => c.id === d.coop);
    if (d.coop && role === 'worker' && d.coop !== 'B6') {
      throw Error('Chỉ được ghi tại chuồng B6.');
    }

    const nextDb = structuredClone(db);

    if (type === 'purchase') {
      nextDb.purchases.push({
        id: 'MH-DEMO-' + (nextDb.purchases.length + 1),
        party: d.party,
        date: d.date,
        item: d.item,
        quantity: q,
        price: +d.price,
        amount: q * +d.price,
        paid: 0,
        received: false
      });
      persist(nextDb);
      toast('Đã lưu phiếu mua nháp.');
      navTo('purchase', 'id=' + (nextDb.purchases.length - 1));
      return;
    }

    if (type === 'sale') {
      if (!c || q > c.n) throw Error('Số con bán vượt tồn đàn trong chuồng.');
      const net = +d.gross - +d.tare;
      nextDb.sales.push({
        ...d,
        id: 'BH-DEMO-' + (nextDb.sales.length + 1),
        quantity: q,
        gross: +d.gross,
        tare: +d.tare,
        price: +d.price,
        net,
        amount: Math.round(net * +d.price),
        paid: 0,
        confirmed: false
      });
      persist(nextDb);
      toast('Đã lập phiếu bán hàng.');
      navTo('sale', 'id=' + (nextDb.sales.length - 1));
      return;
    }

    if (type === 'payment' || type === 'receipt') {
      const list = type === 'payment' ? nextDb.purchases : nextDb.sales;
      const p = list.find(p => p.id === d.ref);
      if (!p) throw Error('Chọn chứng từ hợp lệ trước khi thanh toán.');
      p.paid = (p.paid || 0) + +d.amount;
      nextDb.payments.push({
        ...d,
        id: (type === 'receipt' ? 'PT' : 'PC') + '-DEMO-' + (nextDb.payments.length + 1),
        type,
        amount: +d.amount
      });
      persist(nextDb);
      toast(`Đã ghi phiếu ${type === 'receipt' ? 'thu' : 'chi'}.`);
      navTo('cashbook');
      return;
    }

    if (type === 'mortality') {
      if (c) c.n = Math.max(0, c.n - (q || 1));
    }

    if (['feeding', 'weighing', 'medication', 'work-log', 'health-log', 'mortality'].includes(type)) {
      const names = {
        feeding: 'Cho ăn',
        weighing: 'Cân mẫu',
        medication: 'Thuốc & Vaccine',
        'work-log': 'Công việc',
        'health-log': 'Sức khỏe',
        mortality: 'Hao hụt'
      };
      nextDb.logs.push({
        date: d.date || '2026-10-21',
        time: '10:30',
        coop: d.coop || 'B6',
        type: names[type],
        amount: type === 'weighing' ? Math.round(+d.weight / +d.samples * 1000) : q || '—',
        unit: type === 'feeding' ? 'kg' : type === 'weighing' ? 'g/con' : type === 'mortality' ? 'con' : '',
        note: d.note || d.name || '',
        person: role === 'worker' ? 'Trần Văn Bình' : 'Chủ trại',
        generated: true
      });
      persist(nextDb);
      toast('Đã ghi nhật ký chăn nuôi.');
      navTo('journal');
      return;
    }

    if (type.startsWith('stock-')) {
      const s = nextDb.stock.find(s => s.id === d.item);
      if (type === 'stock-out' && s) s.n = Math.max(0, s.n - q);
      if ((type === 'stock-in' || type === 'stock-return') && s) s.n += q;
      if (type === 'stock-adjust' && s) s.n = +d.actual;
      persist(nextDb);
      toast('Đã cập nhật giao dịch kho.');
      navTo(type === 'stock-count' ? 'counts' : 'stock-transactions');
      return;
    }

    if (type === 'task') {
      nextDb.tasks.push({
        name: d.name,
        coop: d.coop,
        time: d.time,
        status: 'Chưa bắt đầu',
        note: d.note
      });
      persist(nextDb);
      toast('Đã giao công việc mới.');
      navTo('tasks');
      return;
    }

    if (type === 'employee') {
      nextDb.employees.push({
        name: d.name,
        role: d.role,
        coop: '—',
        status: d.status,
        username: d.username
      });
      persist(nextDb);
      toast('Đã thêm nhân viên.');
      navTo('employees');
      return;
    }

    if (type === 'assignment') {
      const emp = nextDb.employees.find(e => e.name === d.name);
      if (emp) emp.coop = d.coop;
      const coopItem = nextDb.coops.find(c => c.id === d.coop);
      if (coopItem) coopItem.worker = d.name;
      persist(nextDb);
      toast('Đã phân công chuồng nuôi.');
      navTo('employees');
      return;
    }

    persist(nextDb);
    toast('Đã lưu thông tin.');
    navTo(currentRoute.group || 'dashboard');
  };

  // Export CSV
  const handleExportCSV = () => {
    const tableEl = document.querySelector('table');
    if (!tableEl) return;
    const rows = [...tableEl.rows].map(r => [...r.cells].map(c => `"${c.textContent.replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FarmShift-${screenId}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Voice recording
  const startVoiceRecord = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        setAudioUrl(URL.createObjectURL(blob));
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast('Microphone chưa được cấp quyền, bạn có thể bấm nút "Dùng câu mẫu"');
    }
  };

  // Main Dynamic Page Renderer
  const renderScreenContent = () => {
    const kind = currentRoute.kind;
    const idParam = Number(searchParams.get('id') || 0);

    // ── Module Dispatchers (P1 split) ─────────────────────────
    const moduleProps = {
      kind, db, role, scopedCoops, scopedLogs, scopedTasks,
      totalBirds, currentCost, searchParams, navTo, num, money,
    };

    // Farm / Coops / Areas — ScreenFarm
    if (['farm', 'coops', 'areas', 'coop'].includes(kind)) {
      const result = ScreenFarm(moduleProps);
      if (result) return result;
    }

    // Batch / Movements — ScreenBatch
    if (['batches', 'batch', 'flocks', 'growth', 'feed', 'health', 'batch-cost',
         'harvest', 'batch-close', 'movements'].includes(kind)) {
      const result = ScreenBatch(moduleProps);
      if (result) return result;
    }

    // Finance tabs — ScreenFinance
    if (['finance', 'cashbook', 'receipts', 'payments', 'payables', 'receivables', 'costs'].includes(kind)) {
      const result = ScreenFinance(moduleProps);
      if (result) return result;
    }

    // Inventory / Stock — ScreenInventory
    if (['inventory', 'lots', 'stock-transactions', 'counts', 'stock-lookup'].includes(kind)) {
      const result = ScreenInventory(moduleProps);
      if (result) return result;
    }

    // IoT / Alerts / Notifications — ScreenIoT
    if (['iot', 'device', 'devices', 'rules', 'alerts', 'notifications'].includes(kind)) {
      const result = ScreenIoT(moduleProps);
      if (result) return result;
    }

    // Journal / Quick / Voice / History — ScreenJournal
    if (['journal', 'quick', 'voice', 'feeding-history', 'weight-history'].includes(kind)) {
      const result = ScreenJournal(moduleProps);
      if (result) return result;
    }

    // Reports hub + individual reports — ScreenReports
    if (['reports', 'report-batch', 'report-flock', 'report-growth',
         'report-stock', 'report-cash', 'report-debt', 'report-trade'].includes(kind)) {
      const result = ScreenReports(moduleProps);
      if (result) return result;
    }

    // Tasks / Kanban Board / Calendar / Task detail — ScreenTasks
    if (['tasks', 'board', 'calendar', 'task'].includes(kind)) {
      const result = ScreenTasks({ ...moduleProps, persist, toast });
      if (result) return result;
    }

    // Purchases / Suppliers / Sales / Customers — ScreenTrade
    if (['purchases', 'purchase', 'suppliers', 'supplier',
         'sales', 'sale', 'customers', 'customer', 'harvest-plan'].includes(kind)) {
      const result = ScreenTrade(moduleProps);
      if (result) return result;
    }

    // Employees / Permissions / Activity — ScreenEmployees
    if (['employees', 'employee', 'permissions', 'activity'].includes(kind)) {
      const result = ScreenEmployees(moduleProps);
      if (result) return result;
    }
    // ── End Module Dispatchers ───────────────────────────────

    // Dynamic Form
    if (kind === 'form') {
      const formType = currentRoute.form || screenId;
      const fields = getFormDefs(formType);
      return (
        <div className="grid two">
          <section className="card">
            <h2>Thông tin {currentRoute.title.toLowerCase()}</h2>
            <form onSubmit={e => {
              e.preventDefault();
              setFormError('');
              try {
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                handleSaveForm(formType, data);
              } catch (err) {
                setFormError(err.message);
              }
            }}>
              <div className="formgrid">
                {fields.map(f => (
                  <label key={f.name} className={`field ${f.type === 'textarea' ? 'full' : ''}`}>
                    {f.label}
                    {f.type === 'textarea' ? (
                      <textarea name={f.name} defaultValue={f.value} />
                    ) : f.type === 'select' ? (
                      <select name={f.name} defaultValue={Array.isArray(f.value) ? f.value[0] : f.value}>
                        {(f.opts || []).map(opt => {
                          const val = Array.isArray(opt) ? opt[0] : opt;
                          const txt = Array.isArray(opt) ? opt[1] : opt;
                          return <option key={val} value={val}>{txt}</option>;
                        })}
                      </select>
                    ) : (
                      <input name={f.name} type={f.type} defaultValue={f.value} required={!['note', 'file', 'phone', 'email'].includes(f.name)} />
                    )}
                    {f.help && <small>{f.help}</small>}
                  </label>
                ))}
              </div>

              {formError && <div className="error">{formError}</div>}

              <div className="formfoot">
                <button type="button" className="btn" onClick={() => navTo(currentRoute.group || 'dashboard')}>Hủy</button>
                <button type="submit" className="btn primary">Lưu thông tin</button>
              </div>
            </form>
          </section>

          <div>
            <section className="card">
              <h2>Kiểm tra trước khi lưu</h2>
              {getFormSummary(formType)}
            </section>
            <div className="note">
              Dữ liệu được lưu trên trình duyệt này. Các trường có đơn vị cần nhập theo đúng đơn vị hiển thị.
            </div>
          </div>
        </div>
      );
    }

    // Catalog / Sitemap
    if (kind === 'catalog') {
      return (
        <div>
          <div className="note">
            Chọn một màn hình để xem và thao tác. Danh mục hiển thị tất cả 73 màn hình trong hệ thống được cấp phép.
          </div>
          <div className="catalog">
            {Object.values(ROUTES_REGISTRY)
              .filter(r => r.allowed.includes(roleChar))
              .map(r => (
                <button
                  key={r.id}
                  className="card"
                  style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)' }}
                  onClick={() => navTo(r.id)}
                >
                  <b style={{ display: 'block', fontSize: 14 }}>{r.title}</b>
                  <small className="muted">{role.toUpperCase()} / {r.id}</small>
                </button>
              ))}
          </div>
        </div>
      );
    }

    // Farm / Coops
    if (kind === 'farm' || kind === 'coops') {
      return (
        <div>
          {renderNavTabs([['farm', 'Sơ đồ'], ['coops', 'Danh sách chuồng'], ['areas', 'Khu nuôi'], ['devices', 'Thiết bị']])}
          {role === 'owner' && (
            <div className="actions" style={{ marginBottom: 20 }}>
              <button className="btn primary" onClick={() => navTo('coop-form')}>＋ Thêm chuồng</button>
            </div>
          )}
          <div className="grid three">
            {scopedCoops().map(c => (
              <div key={c.id} className="card coop">
                <span className="temp">{c.temp}°C</span>
                <h2>Chuồng {c.id}</h2>
                <span className="badge">Đang nuôi</span>
                <p className="muted">MB-2026-08 · Gà lông màu</p>
                <div className="row"><span>Tổng đàn</span><strong>{num(c.n)} con</strong></div>
                <div className="row"><span>Người phụ trách</span><span>{c.worker}</span></div>
                <div className="progress"><i style={{ width: `${Math.min(c.n / 2000 * 100, 100)}%` }} /></div>
                <small>Sức chứa 2.000 con</small>
                <p style={{ marginTop: 15 }}>
                  <button className="btn small" onClick={() => navTo('coop', `id=${c.id}`)}>Xem chi tiết</button>
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Areas
    if (kind === 'areas') {
      return (
        <section className="card">
          <h2>Các khu nuôi</h2>
          <div style={{ marginBottom: 15 }}>
            <button className="btn primary small" onClick={() => navTo('area-form')}>＋ Thêm khu</button>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Mã khu</th><th>Tên khu</th><th>Số chuồng</th><th>Sức chứa</th><th></th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>B</td><td>Khu B</td><td>2</td><td>4.000 con</td>
                  <td className="num"><button className="btn small" onClick={() => navTo('area-form')}>Chỉnh sửa</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      );
    }

    // Coop Detail
    if (kind === 'coop') {
      const c = scopedCoops().find(c => c.id === (searchParams.get('id') || 'B6')) || scopedCoops()[0];
      return (
        <div>
          <div className="grid four">
            <div className="card kpi"><span className="round"><Bird size={20} /></span><div><span>Tổng đàn</span><strong>{num(c.n)}</strong><small>con</small></div></div>
            <div className="card kpi"><span className="round"><Activity size={20} /></span><div><span>Nhiệt độ</span><strong>{c.temp}</strong><small>°C</small></div></div>
            <div className="card kpi"><span className="round"><Activity size={20} /></span><div><span>Độ ẩm</span><strong>65</strong><small>%</small></div></div>
            <div className="card kpi"><span className="round"><TrendingUp size={20} /></span><div><span>Ngày tuổi</span><strong>21</strong><small>ngày</small></div></div>
          </div>
          <section className="card">
            <h2>Chuồng {c.id}</h2>
            <div className="meta">
              <div><small>Lứa đang nuôi</small><strong>MB-2026-08</strong></div>
              <div><small>Đàn</small><strong>D-08-{c.id}</strong></div>
              <div><small>Phụ trách</small><strong>{c.worker}</strong></div>
            </div>
            <div className="actions" style={{ marginTop: 22 }}>
              <button className="btn" onClick={() => navTo('journal')}>Nhật ký</button>
              <button className="btn" onClick={() => navTo('tasks')}>Công việc</button>
              <button className="btn" onClick={() => navTo('iot')}>Môi trường</button>
              {role === 'owner' ? (
                <button className="btn" onClick={() => navTo('coop-form')}>Chỉnh sửa chuồng</button>
              ) : (
                <button className="btn primary" onClick={() => navTo('quick')}>Ghi nhanh</button>
              )}
            </div>
          </section>
        </div>
      );
    }

    // Batches
    if (kind === 'batches') {
      return (
        <div>
          {role === 'owner' && (
            <div className="actions" style={{ marginBottom: 20 }}>
              <button className="btn primary" onClick={() => navTo('batch-create')}>＋ Tạo lứa</button>
              <button className="btn" onClick={() => navTo('movements')}>Biến động đàn</button>
            </div>
          )}
          <section className="card">
            <h2>Danh sách lứa nuôi</h2>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr><th>Mã lứa</th><th>Giống</th><th>Bắt đầu</th><th>Nhập nuôi</th><th>Hiện tại</th><th>Trạng thái</th><th></th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>MB-2026-08</b></td><td>Gà lông màu</td><td>01/10/2026</td><td>3.000</td><td>{num(totalBirds())}</td>
                    <td><span className="badge">Đang nuôi</span></td>
                    <td className="num"><button className="btn small" onClick={() => navTo('batch')}>Chi tiết</button></td>
                  </tr>
                  <tr>
                    <td><b>MB-2026-07</b></td><td>Gà lông màu</td><td>01/07/2026</td><td>3.000</td><td>0</td>
                    <td><span className="badge gray">Đã kết thúc</span></td>
                    <td className="num"><button className="btn small" onClick={() => navTo('report-batch')}>Báo cáo</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      );
    }

    // Batch Wizard (batch-create 5 steps)
    if (kind === 'wizard') {
      const step = +(searchParams.get('step') || 1);
      const steps = ['Thông tin lứa', 'Nhập con giống', 'Phân chuồng', 'Chương trình nuôi', 'Xác nhận'];
      return (
        <div>
          <div className="steps">
            {steps.map((s, n) => (
              <span key={s} className={n + 1 === step ? 'on' : ''}>
                {n + 1}. {s}
              </span>
            ))}
          </div>
          <section className="card">
            <h2>Bước {step}: {steps[step - 1]}</h2>
            <form onSubmit={e => {
              e.preventDefault();
              if (step < 5) navTo('batch-create', `step=${step + 1}`);
              else {
                toast('Đã tạo lứa nuôi thành công.');
                navTo('batches');
              }
            }}>
              <div className="formgrid">
                {step === 1 && (
                  <>
                    <label className="field">Mã lứa<input name="code" defaultValue="MB-2026-09" /></label>
                    <label className="field">Ngày bắt đầu<input type="date" name="date" defaultValue="2026-10-22" /></label>
                    <label className="field full">Giống gà<input name="breed" defaultValue="Gà lông màu" /></label>
                  </>
                )}
                {step === 2 && (
                  <>
                    <label className="field">Số con dự kiến<input type="number" name="quantity" defaultValue={1000} /></label>
                    <label className="field">Nhà cung cấp<input name="supplier" defaultValue="Trại giống An Phú" /></label>
                    <label className="field">Giá con giống (₫/con)<input type="number" name="price" defaultValue={15000} /></label>
                  </>
                )}
                {step === 3 && (
                  <>
                    <label className="field">Chuồng nuôi dự kiến<select name="coop"><option>B5</option><option>B6</option></select></label>
                    <label className="field">Ngày tuổi nhập<input type="number" defaultValue={1} /></label>
                  </>
                )}
                {step === 4 && (
                  <label className="field full">Chương trình nuôi<select name="program"><option>Gà lông màu · 90 ngày</option><option>Chưa áp dụng</option></select></label>
                )}
                {step === 5 && (
                  <div className="field full">
                    <div className="note">
                      Kiểm tra sức chứa chuồng và chuẩn bị sát trùng trước khi tiếp nhận đàn giống.
                    </div>
                  </div>
                )}
              </div>
              <div className="formfoot">
                {step > 1 && (
                  <button type="button" className="btn" onClick={() => navTo('batch-create', `step=${step - 1}`)}>Quay lại</button>
                )}
                <button type="submit" className="btn primary">
                  {step === 5 ? 'Tạo lứa chuẩn bị' : 'Tiếp tục'}
                </button>
              </div>
            </form>
          </section>
        </div>
      );
    }

    // Batch Details & Tabs
    if (['batch', 'flocks', 'growth', 'feed', 'health', 'batch-cost', 'harvest', 'batch-close'].includes(kind)) {
      return (
        <div>
          {batchTabs()}
          {kind === 'batch' && (
            <div>
              <div className="grid four">
                <div className="card kpi"><span className="round"><Bird size={20} /></span><div><span>Hiện tại</span><strong>{num(totalBirds())}</strong><small>con</small></div></div>
                <div className="card kpi"><span className="round"><CalendarIcon size={20} /></span><div><span>Ngày tuổi</span><strong>21</strong><small>ngày</small></div></div>
                <div className="card kpi"><span className="round"><TrendingUp size={20} /></span><div><span>Cân nặng TB</span><strong>450</strong><small>g/con</small></div></div>
                <div className="card kpi"><span className="round"><Package size={20} /></span><div><span>Cám đã dùng</span><strong>1.800</strong><small>kg</small></div></div>
              </div>
              <div className="grid two">
                <section className="card">
                  <h2>Tăng trưởng của lứa</h2>
                  <div className="legend"><span><i className="dot" />Thực tế</span><span><i className="dot" style={{ background: '#a9bbad' }} />Mục tiêu</span></div>
                  <svg className="chart" viewBox="0 0 600 190">
                    <g stroke="#e7eee8"><path d="M45 20H580M45 60H580M45 100H580M45 140H580" /></g>
                    <path d="M50 129 220 106 390 68 555 27" fill="none" stroke="#a9bbad" strokeWidth="3" strokeDasharray="6 6" />
                    <path d="M50 129 220 109 390 70 555 32" fill="none" stroke="#367957" strokeWidth="3" />
                  </svg>
                </section>
                <section className="card">
                  <h2>Trạng thái lứa MB-2026-08</h2>
                  <p>Giống: Gà lông màu · Nhập nuôi: 3.000 con</p>
                  <p>Bắt đầu: 01/10/2026</p>
                  <span className="badge">Đang nuôi</span>
                  <div style={{ marginTop: 20 }}>
                    {role === 'owner' && <button className="btn small" onClick={() => navTo('batch-close')}>Kết thúc lứa</button>}
                  </div>
                </section>
              </div>
            </div>
          )}
          {kind === 'flocks' && (
            <section className="card">
              <h2>Đàn trong lứa</h2>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Mã đàn</th><th>Chuồng</th><th>Số lượng</th><th></th></tr></thead>
                  <tbody>
                    {db.coops.map(c => (
                      <tr key={c.id}>
                        <td><b>D-08-{c.id}</b></td><td>Chuồng {c.id}</td><td>{num(c.n)} con</td>
                        <td className="num">{role === 'owner' ? <button className="btn small" onClick={() => navTo('movements')}>Biến động</button> : <span className="badge gray">Chỉ xem</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {kind === 'growth' && (
            <section className="card">
              <h2>Theo dõi tăng trưởng & Cân mẫu</h2>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Ngày tuổi</th><th>Thực tế</th><th>Mục tiêu</th></tr></thead>
                  <tbody>
                    <tr><td>Ngày 1</td><td>45 g</td><td>45 g</td></tr>
                    <tr><td>Ngày 7</td><td>130 g</td><td>140 g</td></tr>
                    <tr><td>Ngày 14</td><td>290 g</td><td>300 g</td></tr>
                    <tr><td>Ngày 21</td><td>450 g</td><td>470 g</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {kind === 'feed' && (
            <section className="card">
              <h2>Tiêu thụ thức ăn lũy kế</h2>
              <div className="note">Tổng cám dùng lũy kế mẫu: 1.800 kg. Phiếu xuất kho và nhật ký sử dụng được đối chiếu riêng.</div>
            </section>
          )}
          {kind === 'health' && (
            <section className="card">
              <h2>Theo dõi sức khỏe đàn</h2>
              <div className="actions" style={{ marginBottom: 15 }}>
                <button className="btn primary small" onClick={() => navTo('health-log')}>＋ Ghi nhận sức khỏe</button>
              </div>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Ngày</th><th>Chuồng</th><th>Hiện tượng</th><th>Xử lý</th></tr></thead>
                  <tbody>
                    <tr><td>21/10/2026</td><td>B6</td><td>2 con hao hụt</td><td>Đã báo chủ trại, lập biên bản</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {kind === 'batch-cost' && (
            <section className="card">
              <h2>Chi phí lũy kế lứa MB-2026-08</h2>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Khoản mục</th><th className="num">Số tiền</th></tr></thead>
                  <tbody>
                    {costs.map(([name, val]) => (
                      <tr key={name}><td>{name}</td><td className="num">{money(val)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 15 }}>
                <button className="btn primary" onClick={() => navTo('cost-form')}>＋ Ghi nhận chi phí</button>
              </div>
            </section>
          )}
          {kind === 'harvest' && (
            <section className="card">
              <h2>Các lần xuất bán của lứa</h2>
              <div className="actions" style={{ marginBottom: 15 }}>
                <button className="btn primary small" onClick={() => navTo('sale-form')}>＋ Lập phiếu bán</button>
              </div>
              <p className="muted">Chưa có đợt xuất bán nào trong lứa hiện tại.</p>
            </section>
          )}
          {kind === 'batch-close' && (
            <section className="card">
              <h2>Đối soát kết thúc lứa</h2>
              <p>Tồn đàn hiện tại: <b>{num(totalBirds())} con</b></p>
              <div className="note warn">
                {totalBirds() > 0 ? 'Chưa thể kết thúc vì lứa vẫn còn đàn. Cần xuất bán hết đàn trước.' : 'Đủ điều kiện kết thúc lứa.'}
              </div>
              <button className="btn primary" disabled={totalBirds() > 0} onClick={() => toast('Đã chốt kết thúc lứa.')}>Xác nhận kết thúc lứa</button>
            </section>
          )}
        </div>
      );
    }

    // Movements
    if (kind === 'movements') {
      return (
        <div>
          <section className="card">
            <h2>Thao tác biến động đàn</h2>
            <div className="actions">
              <button className="btn" onClick={() => navTo('transfer')}>Chuyển đàn</button>
              <button className="btn" onClick={() => navTo('split')}>Tách đàn</button>
              <button className="btn" onClick={() => navTo('merge')}>Gộp đàn</button>
              <button className="btn danger" onClick={() => navTo('mortality')}>Ghi hao hụt</button>
            </div>
          </section>
          <section className="card">
            <h2>Lịch sử biến động</h2>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th></tr></thead>
                <tbody>
                  <tr><td>21/10/2026</td><td>Hao hụt</td><td>Chuồng B6 · 2 con</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      );
    }

    // Programs
    if (kind === 'programs') {
      return (
        <section className="card">
          <h2>Chương trình nuôi</h2>
          <div className="actions" style={{ marginBottom: 15 }}>
            <button className="btn primary small" onClick={() => navTo('program-form')}>＋ Tạo chương trình</button>
          </div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Tên chương trình</th><th>Giống</th><th>Thời gian</th><th></th></tr></thead>
              <tbody>
                <tr>
                  <td><b>Gà lông màu · 90 ngày</b></td><td>Gà lông màu</td><td>90 ngày</td>
                  <td className="num"><button className="btn small" onClick={() => navTo('program')}>Chi tiết</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      );
    }

    // Program Detail
    if (kind === 'program') {
      return (
        <section className="card">
          <h2>Chương trình: Gà lông màu · 90 ngày</h2>
          <div className="actions" style={{ marginBottom: 15 }}>
            <button className="btn small" onClick={() => navTo('program-form')}>Chỉnh sửa</button>
            <button className="btn small" onClick={() => navTo('targets')}>Chỉ tiêu mục tiêu</button>
          </div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Ngày tuổi</th><th>Hoạt động chăm sóc</th><th>Chỉ tiêu cân nặng</th></tr></thead>
              <tbody>
                <tr><td>Ngày 1</td><td>Tiếp nhận giống & uống nước đường</td><td>45 g/con</td></tr>
                <tr><td>Ngày 7</td><td>Cân mẫu & nhỏ vaccine Newcastle</td><td>140 g/con</td></tr>
                <tr><td>Ngày 14</td><td>Cân mẫu & tiêm Gumboro</td><td>300 g/con</td></tr>
                <tr><td>Ngày 21</td><td>Cân mẫu định kỳ</td><td>470 g/con</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      );
    }

    // Tasks, Kanban Board, Calendar
    if (['tasks', 'board', 'calendar'].includes(kind)) {
      return (
        <div>
          {renderNavTabs([['tasks', 'Danh sách'], ['task-board', 'Bảng Kanban'], ['calendar', 'Lịch chăm sóc']])}
          {role === 'owner' && (
            <div className="actions" style={{ marginBottom: 20 }}>
              <button className="btn primary" onClick={() => navTo('task-form')}>＋ Giao công việc</button>
            </div>
          )}
          {kind === 'tasks' && (
            <section className="card">
              <h2>Danh sách công việc</h2>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Công việc</th><th>Chuồng</th><th>Giờ</th><th>Trạng thái</th><th></th></tr></thead>
                  <tbody>
                    {scopedTasks().map((t, i) => (
                      <tr key={i}>
                        <td><b>{t.name}</b></td><td>{t.coop}</td><td>{t.time}</td>
                        <td><span className={`badge ${t.status === 'Hoàn thành' ? '' : 'warn'}`}>{t.status}</span></td>
                        <td className="num"><button className="btn small" onClick={() => navTo('task', `id=${i}`)}>Chi tiết</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {kind === 'board' && (
            <div className="kanban">
              {['Chưa bắt đầu', 'Đang thực hiện', 'Hoàn thành'].map(col => (
                <section key={col}>
                  <h2>{col}</h2>
                  {scopedTasks().filter(t => t.status === col).map((t, idx) => (
                    <div key={idx} className="task">
                      <h3>{t.name}</h3>
                      <p className="muted">{t.coop} · {t.time}</p>
                      <button className="btn small" onClick={() => navTo('task', `id=${db.tasks.indexOf(t)}`)}>Mở việc</button>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
          {kind === 'calendar' && (
            <section className="card">
              <h2>Lịch chăm sóc tháng 10/2026</h2>
              <div className="calendar">
                {Array.from({ length: 31 }, (_, d) => (
                  <div key={d} className="day">
                    <b>{d + 1}</b>
                    {d === 20 && scopedTasks().map((t, i) => (
                      <small key={i}>{t.time} {t.name}</small>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      );
    }

    // Task Detail
    if (kind === 'task') {
      const t = db.tasks[idParam] || db.tasks[0];
      return (
        <section className="card">
          <h2>{t.name}</h2>
          <div className="meta">
            <div><small>Chuồng</small><strong>{t.coop}</strong></div>
            <div><small>Giờ</small><strong>{t.time}</strong></div>
            <div><small>Trạng thái</small><span className="badge">{t.status}</span></div>
          </div>
          <div style={{ marginTop: 20 }}>
            <label className="field">Ghi chú thực hiện<textarea defaultValue={t.note || ''} /></label>
          </div>
          <div className="actions" style={{ marginTop: 20 }}>
            {t.status === 'Chưa bắt đầu' && (
              <button className="btn primary" onClick={() => {
                t.status = 'Đang thực hiện';
                persist({ ...db });
                toast('Đã bắt đầu công việc.');
              }}>Bắt đầu thực hiện</button>
            )}
            {t.status !== 'Hoàn thành' && (
              <button className="btn primary" onClick={() => {
                t.status = 'Hoàn thành';
                persist({ ...db });
                toast('Đã hoàn thành công việc!');
              }}>Đánh dấu hoàn thành</button>
            )}
            <button className="btn" onClick={() => navTo('quick')}>Ghi nhật ký liên quan</button>
          </div>
        </section>
      );
    }

    // Journal & Logs
    if (kind === 'journal') {
      return (
        <div>
          {role !== 'accountant' && (
            <div className="actions" style={{ marginBottom: 20 }}>
              <button className="btn primary" onClick={() => navTo('quick')}>＋ Ghi nhật ký</button>
              <button className="btn" onClick={() => navTo('voice')}>Nhập giọng nói</button>
            </div>
          )}
          <section className="card">
            <h2>Nhật ký chăn nuôi theo thời gian</h2>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Thời gian</th><th>Hoạt động</th><th>Chuồng</th><th>Giá trị</th><th>Người ghi</th><th></th></tr></thead>
                <tbody>
                  {scopedLogs().map((l, i) => (
                    <tr key={i}>
                      <td>{l.date} {l.time}</td>
                      <td><b>{l.type}</b></td>
                      <td>{l.coop}</td>
                      <td>{l.amount} {l.unit}</td>
                      <td>{l.person}</td>
                      <td className="num"><button className="btn small" onClick={() => navTo('log-detail', `id=${i}`)}>Chi tiết</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      );
    }

    // Quick Action Grid (6 buttons)
    if (kind === 'quick') {
      return (
        <div>
          <div className="quick">
            {[
              ['feeding', 'Cho ăn', Package],
              ['mortality', 'Hao hụt', Bird],
              ['weighing', 'Cân mẫu', TrendingUp],
              ['medication', 'Thuốc / Vaccine', FileText],
              ['health-log', 'Sức khỏe', Activity],
              ['work-log', 'Công việc khác', CheckSquare],
              ['voice', 'Giọng nói', Mic]
            ].map(([p, t, Icon]) => (
              <button
                key={p}
                className="card"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 25, cursor: 'pointer' }}
                onClick={() => navTo(p)}
              >
                <Icon size={28} color="var(--green)" />
                <b>{t}</b>
              </button>
            ))}
          </div>
          <div className="note">Chọn nội dung cần ghi. Nhật ký có thể ghi trực tiếp không bắt buộc gắn với công việc có sẵn.</div>
        </div>
      );
    }

    // Voice Recorder
    if (kind === 'voice') {
      return (
        <section className="card">
          <h2>Ghi âm nhật ký bằng giọng nói</h2>
          <div className="voice" style={{ textAlign: 'center', padding: 30 }}>
            <p>Bấm nút bên dưới rồi nói rõ tên chuồng và số lượng.</p>
            <button
              type="button"
              className="mic"
              style={{
                width: 90, height: 90, borderRadius: '50%',
                background: isRecording ? 'var(--red)' : 'var(--green)',
                color: 'white', border: '8px solid var(--mint)', cursor: 'pointer', margin: '20px auto', display: 'grid', placeItems: 'center'
              }}
              onClick={startVoiceRecord}
            >
              <Mic size={32} />
            </button>
            <p className="muted">{isRecording ? 'Đang ghi âm... Nhấn lại để kết thúc' : 'Sẵn sàng ghi âm nếu trình duyệt hỗ trợ'}</p>
            {audioUrl && <audio src={audioUrl} controls style={{ margin: '15px 0' }} />}
          </div>
          <label className="field full">
            Nội dung nhận diện
            <textarea
              defaultValue="Chuồng B6 hôm nay cho ăn 60 kg thức ăn tăng trưởng."
              id="voice-transcript"
            />
          </label>
          <div className="actions" style={{ marginTop: 20 }}>
            <button className="btn" onClick={() => {
              const el = document.getElementById('voice-transcript');
              if (el) el.value = 'Chuồng B6 hôm nay cho ăn 60 kg thức ăn tăng trưởng.';
            }}>Dùng câu mẫu</button>
            <button className="btn primary" onClick={() => navTo('voice-review')}>Kiểm tra thông tin trước khi lưu</button>
          </div>
        </section>
      );
    }

    // Voice Review
    if (kind === 'voice-review') {
      return (
        <div>
          <section className="card">
            <h2>Kiểm tra nội dung bóc tách</h2>
            <div className="note">Nội dung nghe được: "Chuồng B6 hôm nay cho ăn 60 kg thức ăn tăng trưởng."</div>
          </section>
          {/* Render feeding form */}
          {getFormDefs('feeding') && (
            <div className="grid two">
              <section className="card">
                <h2>Xác nhận ghi nhận cho ăn</h2>
                <button className="btn primary" onClick={() => {
                  toast('Đã lưu nhật ký từ giọng nói thành công!');
                  navTo('journal');
                }}>Lưu nhật ký</button>
              </section>
            </div>
          )}
        </div>
      );
    }

    // OCR Document Center
    if (kind === 'ocr') {
      return (
        <section className="card">
          <h2>Trung tâm chứng từ AI OCR</h2>
          <div className="actions" style={{ marginBottom: 20 }}>
            <button className="btn primary" onClick={() => navTo('ocr-upload')}>＋ Tải ảnh chứng từ</button>
          </div>
          <div className="row">
            <div><b>Hóa đơn mua cám mẫu</b><p className="muted">NCC An Phú · 21/10/2026</p></div>
            <button className="btn small" onClick={() => navTo('ocr-review', 'type=purchase')}>Xem kết quả</button>
          </div>
          <div className="row">
            <div><b>Phiếu cân gà xuất bán mẫu</b><p className="muted">Thương lái Hòa · 21/10/2026</p></div>
            <button className="btn small" onClick={() => navTo('ocr-review', 'type=sale')}>Xem kết quả</button>
          </div>
        </section>
      );
    }

    if (kind === 'ocr-upload') {
      return (
        <section className="card">
          <h2>Chọn ảnh chứng từ / hóa đơn</h2>
          <div className="upload" style={{ border: '2px dashed var(--line)', padding: 40, textAlign: 'center', borderRadius: 8 }}>
            <FileText size={48} color="var(--green)" style={{ margin: '0 auto 10px' }} />
            <h3>Kéo thả hoặc bấm để chọn ảnh</h3>
            <p className="muted">Hỗ trợ định dạng JPG, PNG, PDF (tối đa 10MB)</p>
            <input type="file" accept="image/*" style={{ marginTop: 10 }} />
          </div>
          <div className="actions" style={{ marginTop: 20 }}>
            <button className="btn primary" onClick={() => navTo('ocr-review', 'type=purchase')}>Dùng mẫu hóa đơn mua</button>
            <button className="btn" onClick={() => navTo('ocr-review', 'type=sale')}>Dùng mẫu phiếu cân bán</button>
          </div>
        </section>
      );
    }

    if (kind === 'ocr-review') {
      const type = searchParams.get('type') || 'purchase';
      return (
        <div>
          <section className="card">
            <h2>Kiểm tra thông tin trích xuất OCR</h2>
            <div className="note warn">
              AI đã trích xuất dữ liệu tự động. Vui lòng kiểm tra lại số liệu trước khi tạo phiếu.
            </div>
          </section>
          {/* Render corresponding form */}
          <div className="actions">
            <button className="btn primary" onClick={() => {
              toast('Đã tạo phiếu từ kết quả OCR!');
              navTo(type === 'sale' ? 'sales' : 'purchases');
            }}>Xác nhận lưu phiếu</button>
          </div>
        </div>
      );
    }

    // Reports Hub
    if (kind === 'reports') {
      return (
        <div className="grid three">
          {[
            ['report-batch', 'Hiệu quả lứa nuôi', 'Doanh thu, chi phí và lợi nhuận'],
            ['report-flock', 'Đàn & Hao hụt', 'Nhập, xuất, tồn và tỷ lệ sống'],
            ['report-growth', 'Tăng trưởng & Cám', 'Biểu đồ cân nặng và tiêu thụ thức ăn'],
            ['report-stock', 'Nhập xuất tồn kho', 'Số lượng và giá trị theo từng mặt hàng'],
            ['report-cash', 'Thu chi sổ quỹ', 'Dòng tiền và các chứng từ thu chi'],
            ['report-debt', 'Báo cáo công nợ', 'Tổng hợp công nợ phải thu và phải trả'],
            ['report-trade', 'Tổng hợp mua bán', 'Lịch sử giao dịch mua và bán hàng']
          ].map(([p, t, d]) => (
            <div key={p} className="card">
              <h2>{t}</h2>
              <p className="muted" style={{ minHeight: 40 }}>{d}</p>
              <button className="btn small" onClick={() => navTo(p)}>Xem báo cáo</button>
            </div>
          ))}
        </div>
      );
    }

    // Specific Report: report-batch
    if (kind === 'report-batch') {
      return (
        <div>
          <div className="actions" style={{ marginBottom: 20 }}>
            <button className="btn" onClick={handleExportCSV}>Xuất CSV</button>
            <button className="btn" onClick={() => window.print()}>In / Lưu PDF</button>
          </div>
          <section className="card">
            <div className="meta">
              <div><small>Mã lứa</small><strong>MB-2026-07</strong></div>
              <div><small>Giống gà</small><strong>Gà lông màu</strong></div>
              <div><small>Thời gian nuôi</small><strong>01/07/2026 – 30/09/2026</strong></div>
              <div><small>Trạng thái</small><span className="badge">Đã kết thúc</span></div>
            </div>
          </section>
          <div className="grid four">
            <div className="card kpi"><span className="round"><Bird size={20} /></span><div><span>Nhập nuôi</span><strong>3.000</strong><small>con</small></div></div>
            <div className="card kpi"><span className="round"><Package size={20} /></span><div><span>Đã bán</span><strong>2.998</strong><small>con</small></div></div>
            <div className="card kpi"><span className="round"><TrendingUp size={20} /></span><div><span>Hao hụt</span><strong>2</strong><small>con (0.07%)</small></div></div>
            <div className="card kpi"><span className="round"><DollarSign size={20} /></span><div><span>Lợi nhuận</span><strong>169.72M</strong><small>₫</small></div></div>
          </div>
          <div className="grid two">
            <section className="card">
              <h2>Chi tiết chi phí</h2>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Khoản mục</th><th className="num">Chi phí (₫)</th></tr></thead>
                  <tbody>
                    {costs.map(([name, val]) => (
                      <tr key={name}><td>{name}</td><td className="num">{money(val)}</td></tr>
                    ))}
                    <tr><td><b>Tổng chi phí</b></td><td className="num"><b>250.000.000 ₫</b></td></tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section className="card">
              <h2>Phạm vi báo cáo</h2>
              <p>Doanh thu ghi nhận: <b>419.720.000 ₫</b></p>
              <p>Lợi nhuận gộp: <b>169.720.000 ₫</b></p>
              <div className="note">Lứa MB-2026-07 đã kết thúc quyết toán đầy đủ.</div>
            </section>
          </div>
        </div>
      );
    }

    // AI Assistant Page
    if (kind === 'ai') {
      return (
        <section className="card">
          <h2>Hội thoại cùng Trợ lý FarmShift AI</h2>
          <div style={{ maxHeight: 380, overflowY: 'auto', padding: '10px 0' }}>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat ${msg.sender === 'user' ? 'user' : ''}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <form onSubmit={e => {
            e.preventDefault();
            if (!chatInput.trim()) return;
            const q = chatInput.trim();
            const ans = /nợ|tiền|chi|thu/i.test(q)
              ? `Công nợ phải trả trong hệ thống: ${money(db.purchases.reduce((a, p) => a + p.amount - p.paid, 0))}. Sổ quỹ hiện tại: 50.000.000 ₫.`
              : `Tổng đàn hiện tại: ${num(totalBirds())} con tại 2 chuồng (B5 và B6). Có ${scopedTasks().filter(t => t.status !== 'Hoàn thành').length} công việc chưa hoàn thành.`;
            setChatMessages(prev => [...prev, { sender: 'user', text: q }, { sender: 'ai', text: ans }]);
            setChatInput('');
          }}>
            <div className="filters" style={{ marginTop: 15 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Nhập câu hỏi tra cứu (ví dụ: Tổng đàn, công nợ, chi phí...)..."
              />
              <button className="btn primary">Gửi</button>
            </div>
          </form>
        </section>
      );
    }

    // Fallback default list views
    return (
      <section className="card">
        <h2>{currentRoute.title}</h2>
        <p className="muted">Màn hình đang hiển thị dữ liệu mẫu theo vai trò {role.toUpperCase()}.</p>
        <button className="btn primary" onClick={() => navTo('catalog')}>Mở danh mục màn hình</button>
      </section>
    );
  };

  return (
    <DashboardLayout
      pageTitle={currentRoute.title}
      pageSub={currentRoute.group ? `Phân hệ ${currentRoute.group} · Trang trại Miền Bính` : 'Trang trại Miền Bính · Quản lý chăn nuôi gà'}
    >
      {toastMsg && <div className="toast">{toastMsg}</div>}
      {renderScreenContent()}
    </DashboardLayout>
  );
};
