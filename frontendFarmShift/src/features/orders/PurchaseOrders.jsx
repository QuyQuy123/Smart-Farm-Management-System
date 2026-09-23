// src/features/orders/PurchaseOrders.jsx
// Nhà đơn đặt hàng — UI_FarmShift.pdf page 7
import React from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DataTable } from '../../components/DataTable/DataTable';
import { MetricCard } from '../../components/MetricCard/MetricCard';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, Plus, Download, Users, MoreVertical } from 'lucide-react';
import styles from './Orders.module.css';

/* ── Mock data ─────────────────────────────────────────────── */
const METRICS = [
  { id: 'm1', label: 'Tổng tiền nhập',  value: '10,050,000đ', icon: <DollarSign size={18}/>, color: 'green'  },
  { id: 'm2', label: 'Đã thanh toán',   value: '6,050,000đ',  icon: <TrendingUp size={18}/>, color: 'blue'   },
  { id: 'm3', label: 'Còn thiếu',       value: '3,100,000đ',  icon: <TrendingDown size={18}/>, color: 'orange' },
  { id: 'm4', label: 'Tồn thiếu hàng', value: '0đ',           icon: <AlertCircle size={18}/>, color: 'red'    },
];

const MOCK_ORDERS = [
  { id: 'NHC00001', ma_tra: '',         nha_cc: 'Gà ý Thiên Bình', tt: 'Chua thanh toan', kho: 'Nhập kho ở', tong: '1,703,000đ', ngay: '31/12/2024' },
  { id: 'NHC00002', ma_tra: '',         nha_cc: '',                 tt: 'Hoàn tất',        kho: 'Nhập kho ở', tong: '6,009,000đ', ngay: '21/12/2024' },
  { id: 'NHC00003', ma_tra: 'NHC00003', nha_cc: 'Gà ý Thiên Bình', tt: 'Chua thanh toan', kho: 'Nhập kho ở', tong: '1,282,000đ', ngay: '21/12/2024' },
  { id: 'NHC00004', ma_tra: '',         nha_cc: 'Gà ý Lướt Cảng',  tt: 'Chua thanh toan', kho: 'Nhập kho ở', tong: '960,000đ',   ngay: '21/12/2024' },
];

const STATUS_MAP = {
  'Chua thanh toan': 'warning',
  'Hoàn tất':        'success',
  'Đang xử lý':      'info',
};

const COLUMNS = [
  { key: 'id',     label: 'Mã Đơn',
    render: v => <span style={{ fontWeight: 500, color: 'var(--color-link)', fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
  { key: 'ma_tra', label: 'Mã Trả Hàng',
    render: v => v ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> : <span style={{ color: 'var(--color-muted)' }}>—</span> },
  { key: 'nha_cc', label: 'Nhà Cung Cấp',
    render: v => v || <span style={{ color: 'var(--color-muted)' }}>—</span> },
  { key: 'tt',     label: 'Thanh Toán',
    render: v => <Badge variant={STATUS_MAP[v] || 'neutral'}>{v}</Badge> },
  { key: 'kho',    label: 'Kho Hàng' },
  { key: 'tong',   label: 'Tổng Tiền', align: 'right',
    render: v => <span style={{ fontWeight: 500 }}>{v}</span> },
  { key: 'ngay',   label: 'Ngày Nhập Hàng' },
  { key: 'actions', label: '', width: '48px', align: 'center',
    render: () => <button className={styles.moreBtn}><MoreVertical size={16}/></button> },
];

export const PurchaseOrders = () => {
  const BREADCRUMBS = [
    { label: 'Livestock Farm', path: '/owner-dashboard' },
    { label: 'Đơn hàng' },
    { label: 'Nhà đơn đặt hàng' },
  ];

  const toolbar = (
    <>
      <div style={{ flex: 1 }} />
      <Button variant="secondary" size="sm"><Download size={14}/> Xuất Excel</Button>
      <Button variant="secondary" size="sm"><Users size={14}/> Nhà cung cấp</Button>
      <Button variant="green" size="sm"><Plus size={14}/> Tạo đơn</Button>
    </>
  );

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      <div className={styles.metricsRow}>
        {METRICS.map(m => (
          <MetricCard key={m.id} label={m.label} value={m.value} icon={m.icon} color={m.color} />
        ))}
      </div>
      <DataTable columns={COLUMNS} data={MOCK_ORDERS} rowKey="id" toolbar={toolbar} />
    </DashboardLayout>
  );
};
