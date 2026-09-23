// src/features/orders/StockRecords.jsx
// Tồn kho / Phiếu — UI_FarmShift.pdf page 8
import React from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DataTable } from '../../components/DataTable/DataTable';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Download, Plus, Filter, MoreVertical } from 'lucide-react';
import styles from './Orders.module.css';

/* ── Mock data ─────────────────────────────────────────────── */
const MOCK_RECORDS = [
  { id: 'NHC0001304', so_ma: '??', so_luong: 1200, danh_muc: 'Thức ăn bổ dưỡng', loai: 'Nhập kho', ngay: '09/13/2024' },
  { id: 'NHC0001323', so_ma: '4',  so_luong: 127,  danh_muc: 'Thức ăn bổ dưỡng', loai: 'Nhập kho', ngay: '09/13/2024' },
  { id: 'NHC0001322', so_ma: '3',  so_luong: 180,  danh_muc: 'Thức ăn bổ dưỡng', loai: 'Nhập kho', ngay: '01/13/2024' },
  { id: 'NHC0001323', so_ma: '3',  so_luong: 220222,danh_muc: 'Thức ăn bổ dưỡng', loai: 'Nhập kho', ngay: '01/13/2024' },
  { id: 'NHC0001330', so_ma: '9',  so_luong: 96,   danh_muc: 'Thức ăn bổ dưỡng', loai: 'Nhập kho', ngay: '01/13/2024' },
];

const LOAI_MAP = {
  'Nhập kho': 'info',
  'Xuất kho': 'orange',
  'Kiểm kê':  'neutral',
};

const COLUMNS = [
  { key: 'id',       label: 'Mã Phiếu',
    render: v => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-link)', fontWeight: 500 }}>{v}</span> },
  { key: 'so_ma',    label: 'Số Mã Hàng', align: 'center' },
  { key: 'so_luong', label: 'Số Lượng',   align: 'center',
    render: v => <span style={{ fontWeight: 500 }}>{v.toLocaleString('vi-VN')}</span> },
  { key: 'danh_muc', label: 'Danh Mục' },
  { key: 'loai',     label: 'Loại Phiếu',
    render: v => <Badge variant={LOAI_MAP[v] || 'neutral'}>{v}</Badge> },
  { key: 'ngay',     label: 'Ngày Chứng Từ' },
  { key: 'actions',  label: '', width: '48px', align: 'center',
    render: () => <button className={styles.moreBtn}><MoreVertical size={16}/></button> },
];

export const StockRecords = () => {
  const BREADCRUMBS = [
    { label: 'Livestock Farm', path: '/owner-dashboard' },
    { label: 'Đơn hàng', path: '/owner-dashboard/orders' },
    { label: 'Tồn kho / Phiếu' },
  ];

  const toolbar = (
    <>
      <input
        type="text"
        placeholder="Tìm mã phiếu..."
        style={{
          height: 34, padding: '0 12px',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--rounded-sm)',
          fontSize: 'var(--fs-body-md)',
          fontFamily: 'inherit',
          outline: 'none',
          width: 180,
        }}
      />
      <div style={{ flex: 1 }} />
      <Button variant="secondary" size="sm"><Download size={14}/> Xuất Excel</Button>
      <Button variant="secondary" size="sm"><Filter size={14}/> Lọc</Button>
      <Button variant="green" size="sm"><Plus size={14}/> Tạo phiếu</Button>
    </>
  );

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      <DataTable
        columns={COLUMNS}
        data={MOCK_RECORDS}
        rowKey="id"
        toolbar={toolbar}
        emptyState="Chưa có phiếu tồn kho nào"
      />
    </DashboardLayout>
  );
};
