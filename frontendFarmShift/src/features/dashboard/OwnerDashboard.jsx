// src/features/dashboard/OwnerDashboard.jsx
// Farm Owner Dashboard — matches UI_FarmShift.pdf page 1
// Layout: Staff cards row → Task list + Metric cards → Chart + Events table
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { MetricCard } from '../../components/MetricCard/MetricCard';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import {
  Scale, Leaf, Thermometer, Briefcase,
  TrendingUp, DollarSign, Clock, Star,
  Plus, RefreshCw
} from 'lucide-react';
import styles from './Dashboard.module.css';

/* ── Mock data (mirrors backend shape) ─────────────────────
   Replace with real API calls via dashboardService when ready
   ─────────────────────────────────────────────────────────── */
const MOCK_DATA = {
  farm: {
    name: 'Livestock Farm',
    count: 2,
    sub: 'Quản lý vật nuôi / Trang trại của bạn',
  },
  staff: [
    { id: 1, name: 'Khẩu phần ăn', role: 'Quản lý khẩu phần', avatar: '🥩', color: '#e8f5ee' },
    { id: 2, name: 'Vật nuôi',     role: 'Theo dõi vật nuôi',  avatar: '🐄', color: '#fff4e6' },
    { id: 3, name: 'Môi trường',   role: 'Giám sát môi trường', avatar: '🌿', color: '#eff6ff' },
    { id: 4, name: 'Công việc',    role: 'Quản lý công việc',  avatar: '📋', color: '#faf5ff' },
  ],
  tasks: [
    { id: 1, name: 'ĐÀNO8 - Ngựa nhóm Tầm vóc trung 1770Kg', time: '08:00 - 11:00 Sáng', dot: 'green' },
    { id: 2, name: 'ĐÀNO9 - Trâu bò - Vỗ béo 1780Kg',         time: '01:00 - 03:00 Chiều', dot: 'orange' },
    { id: 3, name: 'ĐÀNO10 - Ngựa nhóm 2 - 1890Kg',            time: '04:00 - 05:00 Chiều', dot: 'blue' },
  ],
  metrics: [
    { id: 'm1', label: 'Sản lượng', value: '125 Kg',        icon: <Scale size={18}/>,      color: 'green'  },
    { id: 'm2', label: 'Thu nhập',  value: '6,000,000đ',    icon: <DollarSign size={18}/>, color: 'orange' },
    { id: 'm3', label: 'Trạng thái', value: '0d',           icon: <Clock size={18}/>,      color: 'blue'   },
    { id: 'm4', label: 'Đánh giá',  value: '5/5',           icon: <Star size={18}/>,       color: 'green'  },
  ],
  chart: {
    title: 'Thống kê sản lượng',
    segments: [
      { label: 'Trâu bò',  value: 40, color: '#2D8A4E' },
      { label: 'Heo',      value: 25, color: '#F4820A' },
      { label: 'Gà vịt',   value: 20, color: '#3B82F6' },
      { label: 'Khác',     value: 15, color: '#9CA3AF' },
    ],
  },
  events: [
    { id: 'E001', type: 'Nhập',   desc: 'CẢBO2 3 | Ngựa 3, Ngựa 2 Ngựa 1', time: 'Vừa xong', amount: '+500,000đ', status: 'success' },
    { id: 'E002', type: 'Xuất',   desc: 'Tên C2 | Ngựa 3A, Ngựa 2C Trâu bò...', time: '2p',    amount: '-200,000đ', status: 'warning' },
    { id: 'E003', type: 'Nhập',   desc: 'B.C Địa Công Dịch Gia Súc Chửa...', time: '5p',    amount: '+150,000đ', status: 'success' },
  ],
};

/* ── Simple SVG Donut Chart ────────────────────────────────── */
function DonutChart({ segments }) {
  const size   = 120;
  const r      = 44;
  const cx     = size / 2;
  const cy     = size / 2;
  const circ   = 2 * Math.PI * r;

  // Compute each segment arc
  let cumulative = 0;
  const arcs = segments.map(seg => {
    const pct    = seg.value / 100;
    const dash   = pct * circ;
    const offset = cumulative * circ;
    cumulative  += pct;
    return { ...seg, dash, offset };
  });

  return (
    <div className={styles.donutWrap}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={styles.donutSvg}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={14} />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={14}
            strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="round"
          />
        ))}
      </svg>
      {/* Legend */}
      <div className={styles.donutLegend}>
        {segments.map((seg, i) => (
          <div key={i} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: seg.color }} />
            <span>{seg.label}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 500, paddingLeft: 12 }}>
              {seg.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── OwnerDashboard ──────────────────────────────────────── */
export const OwnerDashboard = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulates async fetch — replace with real API call
    const timer = setTimeout(() => {
      setData(MOCK_DATA);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const BREADCRUMBS = [
    { label: 'Livestock Farm' },
    { label: 'Tổng quan' },
  ];

  if (loading) {
    return (
      <DashboardLayout breadcrumbs={BREADCRUMBS}>
        <div style={{ color: 'var(--color-muted)', padding: 'var(--sp-xl)' }}>
          Đang tải dữ liệu...
        </div>
      </DashboardLayout>
    );
  }

  const { farm, staff, tasks, metrics, chart, events } = data;

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* ── Page Header ────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.farmName}>
            <h1 className={styles.farmTitle}>{farm.name}</h1>
            <span className={styles.farmBadge}>{farm.count}</span>
          </div>
          <p className={styles.farmSub}>{farm.sub}</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm">
            <RefreshCw size={14} />
            Làm mới
          </Button>
          <Button variant="green" size="sm">
            <Plus size={14} />
            Tạo mới
          </Button>
        </div>
      </div>

      {/* ── Staff Module Cards ──────────────────────────────── */}
      <div className={styles.staffRow}>
        {staff.map(s => (
          <div key={s.id} className={styles.staffCard}>
            <div className={styles.staffAvatar} style={{ backgroundColor: s.color }}>
              {s.avatar}
            </div>
            <div className={styles.staffInfo}>
              <div className={styles.staffName}>{s.name}</div>
              <div className={styles.staffRole}>{s.role}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Content Grid: Task List | Metric Cards ──────── */}
      <div className={styles.contentGrid}>
        {/* Task List */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionCardHeader}>
            <span className={styles.sectionTitle}>Bạn làm gì</span>
          </div>
          <div className={styles.taskList}>
            {tasks.map(task => (
              <div key={task.id} className={styles.taskItem}>
                <span className={`${styles.taskDot} ${styles[`taskDot${task.dot.charAt(0).toUpperCase() + task.dot.slice(1)}`]}`} />
                <span className={styles.taskName}>{task.name}</span>
                <span className={styles.taskTime}>{task.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Metric Cards 2×2 */}
        <div className={styles.metricsGrid}>
          {metrics.map(m => (
            <MetricCard
              key={m.id}
              label={m.label}
              value={m.value}
              icon={m.icon}
              color={m.color}
            />
          ))}
        </div>
      </div>

      {/* ── Bottom: Chart | Events ──────────────────────────── */}
      <div className={styles.bottomGrid}>
        {/* Donut Chart */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionCardHeader}>
            <span className={styles.sectionTitle}>{chart.title}</span>
          </div>
          <div className={styles.chartWrap}>
            <DonutChart segments={chart.segments} />
          </div>
        </div>

        {/* Recent Events */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionCardHeader}>
            <span className={styles.sectionTitle}>Sự kiện gần đây</span>
          </div>
          <table className={styles.eventsTable}>
            <thead>
              <tr>
                <th>Loại</th>
                <th>Mô tả</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{ev.type}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.desc}
                  </td>
                  <td style={{
                    fontWeight: 500,
                    color: ev.amount.startsWith('+') ? 'var(--color-farm-green)' : 'var(--color-farm-red)'
                  }}>
                    {ev.amount}
                  </td>
                  <td>
                    <Badge variant={ev.status}>
                      {ev.status === 'success' ? 'Hoàn thành' : 'Chờ xử lý'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};
