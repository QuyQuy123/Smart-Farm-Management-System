// src/features/livestock/LivestockList.jsx
// Danh sách đàn — UI_FarmShift.pdf page 2
// Table with dropdown filter, status badges, and action column
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DataTable } from '../../components/DataTable/DataTable';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { TabBar } from '../../components/TabBar/TabBar';
import { Plus, Download, Upload, Filter, MoreVertical } from 'lucide-react';
import styles from './Livestock.module.css';

/* ── Mock data ─────────────────────────────────────────────── */
const TABS = [
  { key: 'feed',    label: 'Khẩu phần ăn' },
  { key: 'animal',  label: 'Vật nuôi' },
  { key: 'env',     label: 'Môi trường' },
  { key: 'task',    label: 'Công việc' },
];

const MOCK_LIVESTOCK = [
  { id: 'NHA1', chuong: 'Khu A', khai_quat: 'Thư viện', tinh_trang: 'Hoạt động', hoat_dong: 'Bình thường', so_luong: 25, thuc_don: '30 Ngày', nhat_ky: '01/12/2024' },
  { id: 'NHA2', chuong: 'Khu A', khai_quat: 'Thư viện', tinh_trang: 'Hoạt động', hoat_dong: 'Bình thường', so_luong: 18, thuc_don: '30 Ngày', nhat_ky: '01/12/2024' },
  { id: 'NHA3', chuong: 'Khu A', khai_quat: 'Thư viện', tinh_trang: 'Hoạt động', hoat_dong: 'Bình thường', so_luong: 32, thuc_don: '30 Ngày', nhat_ky: '01/12/2024' },
  { id: 'NHA4', chuong: 'Khu A', khai_quat: 'Thư viện', tinh_trang: 'Dừng',      hoat_dong: 'Bình thường', so_luong: 10, thuc_don: '25 Ngày', nhat_ky: '01/12/2024' },
  { id: 'NHB1', chuong: 'Khu B', khai_quat: 'Thư viện', tinh_trang: 'Hoạt động', hoat_dong: 'Bình thường', so_luong: 44, thuc_don: '30 Ngày', nhat_ky: '01/12/2024' },
  { id: 'NHB2', chuong: 'Khu B', khai_quat: 'Thư viện', tinh_trang: 'Hoạt động', hoat_dong: 'Bình thường', so_luong: 38, thuc_don: '30 Ngày', nhat_ky: '01/12/2024' },
];

/* ── Columns ────────────────────────────────────────────────── */
const COLUMNS = [
  {
    key:    'stt',
    label:  'STT',
    width:  '56px',
    align:  'center',
    render: (_, row, idx) => <span style={{ color: 'var(--color-muted)' }}>{idx + 1}</span>,
  },
  {
    key:   'id',
    label: 'Chuồng',
    render: (v) => (
      <span style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{v}</span>
    ),
  },
  { key: 'khai_quat', label: 'Khái Quát' },
  {
    key:    'tinh_trang',
    label:  'Trạng Thái Hoạt Động',
    render: (v) => (
      <Badge variant={v === 'Hoạt động' ? 'active' : 'inactive'}>{v}</Badge>
    ),
  },
  { key: 'so_luong', label: 'Số Lượng', align: 'center' },
  { key: 'thuc_don', label: 'Thực Đơn' },
  { key: 'nhat_ky',  label: 'Nhật Ký' },
  {
    key:   'actions',
    label: '',
    width: '48px',
    align: 'center',
    render: () => (
      <button className={styles.moreBtn} aria-label="Thêm tùy chọn">
        <MoreVertical size={16} />
      </button>
    ),
  },
];

/* ── Component ─────────────────────────────────────────────── */
export const LivestockList = () => {
  const [activeTab, setActiveTab] = useState('feed');
  const [khuFilter, setKhuFilter]  = useState('');

  const filtered = khuFilter
    ? MOCK_LIVESTOCK.filter(r => r.chuong === khuFilter)
    : MOCK_LIVESTOCK;

  const colsWithIdx = COLUMNS.map(col =>
    col.key === 'stt'
      ? { ...col, render: (v, row) => {
          const idx = filtered.indexOf(row);
          return <span style={{ color: 'var(--color-muted)' }}>{idx + 1}</span>;
        }}
      : col
  );

  const BREADCRUMBS = [
    { label: 'Livestock Farm', path: '/owner-dashboard' },
    { label: 'Đàn', path: '/owner-dashboard/livestock' },
    { label: 'Danh sách Đàn' },
  ];

  const toolbar = (
    <>
      {/* Khu filter dropdown */}
      <select
        className={styles.filterSelect}
        value={khuFilter}
        onChange={e => setKhuFilter(e.target.value)}
        aria-label="Lọc theo khu"
      >
        <option value="">Tất cả khu</option>
        <option value="Khu A">Khu A</option>
        <option value="Khu B">Khu B</option>
        <option value="Khu C">Khu C</option>
      </select>
      <div style={{ flex: 1 }} />
      <Button variant="secondary" size="sm">
        <Download size={14} /> Xuất Excel
      </Button>
      <Button variant="secondary" size="sm">
        <Upload size={14} /> Nhập Excel
      </Button>
      <Button variant="green" size="sm">
        <Plus size={14} /> Thêm Đàn
      </Button>
    </>
  );

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* Tabs */}
      <div style={{ marginBottom: 'var(--sp-md)', background: 'var(--color-canvas)', borderRadius: 'var(--rounded-md)', overflow: 'hidden', border: '1px solid var(--color-hairline)' }}>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Table */}
      <DataTable
        columns={colsWithIdx}
        data={filtered}
        rowKey="id"
        toolbar={toolbar}
        emptyState="Không có đàn nào trong khu này"
      />
    </DashboardLayout>
  );
};
