// src/features/inventory/InventoryList.jsx
// Danh sách hàng hóa — UI_FarmShift.pdf page 3
// 4 metric cards + tabs + table with export/import buttons
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DataTable } from '../../components/DataTable/DataTable';
import { MetricCard } from '../../components/MetricCard/MetricCard';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { TabBar } from '../../components/TabBar/TabBar';
import { DollarSign, Weight, BarChart2, AlertCircle, Plus, Download, Upload, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './Inventory.module.css';

/* ── Mock data ─────────────────────────────────────────────── */
const METRICS = [
  { id: 'm1', label: 'Tổng giá trị',    value: '125,432,672đ', icon: <DollarSign size={18}/>, color: 'green'  },
  { id: 'm2', label: 'Tổng khối lượng', value: '296.5 Kg',     icon: <Weight size={18}/>,     color: 'orange' },
  { id: 'm3', label: 'Tổng loại',       value: '371.86',        icon: <BarChart2 size={18}/>,  color: 'blue'   },
  { id: 'm4', label: 'Sắp hết hàng',   value: '0',             icon: <AlertCircle size={18}/>,color: 'red'    },
];

const TABS = [
  { key: 'list',       label: 'Bán hàng' },
  { key: 'categories', label: 'Loại hàng hóa' },
  { key: 'import',     label: 'Kho hàng vào' },
  { key: 'export',     label: 'Lần lược' },
  { key: 'staff',      label: 'Nhân viên' },
];

const MOCK_ITEMS = [
  { id: 'HH001', ten: 'Ngựa 04', gia: '270,000đ', loai: 'SCC Bus (1770Kg)', quy_cach: '25 Bêu Bao', thanh_hanh: 'CP',   ngay: '01/12/2024' },
  { id: 'HH002', ten: 'Ngựa 05', gia: '270,000đ', loai: 'SCC Bus (1770Kg)', quy_cach: '25 Bêu Bao', thanh_hanh: 'CP',   ngay: '01/12/2024' },
  { id: 'HH003', ten: 'Ngựa 02', gia: '290,000đ', loai: 'SCC Bus (1770Kg)', quy_cach: '26 Bêu Bao', thanh_hanh: 'UNI',  ngay: '01/12/2024' },
  { id: 'HH004', ten: 'Ngựa 006', gia: '290,000đ', loai: '71 Bao bus (11 Ung)', quy_cach: '26 Bêu Bao', thanh_hanh: 'UNI', ngay: '01/12/2024' },
];

const COLUMNS = [
  { key: 'stt',    label: 'STT',         width: '56px', align: 'center',
    render: (_, row, idx) => <span style={{ color: 'var(--color-muted)' }}>{idx + 1}</span> },
  { key: 'id',     label: 'Mã Hàng Hóa',
    render: v => <span style={{ fontWeight: 500, color: 'var(--color-link)', fontFamily: 'monospace' }}>{v}</span> },
  { key: 'ten',    label: 'Tên Hàng Hóa' },
  { key: 'gia',    label: 'Giá Tiền',     align: 'right',
    render: v => <span style={{ fontWeight: 500 }}>{v}</span> },
  { key: 'loai',   label: 'Tên Loại' },
  { key: 'quy_cach', label: 'Quy Cách' },
  { key: 'thanh_hanh', label: 'Thành Hành' },
  { key: 'actions', label: '', width: '48px', align: 'center',
    render: () => <button className={styles.moreBtn}><MoreVertical size={16}/></button> },
];

/* ── Component ─────────────────────────────────────────────── */
export const InventoryList = () => {
  const [activeTab, setActiveTab] = useState('list');
  const navigate = useNavigate();

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'categories') navigate('/owner-dashboard/inventory/categories');
    if (key === 'import')     navigate('/owner-dashboard/inventory/warehouse');
  };

  const BREADCRUMBS = [
    { label: 'Livestock Farm', path: '/owner-dashboard' },
    { label: 'Hàng hóa' },
    { label: 'Danh sách hàng hóa' },
  ];

  const toolbar = (
    <>
      <input type="text" placeholder="Tìm tên hàng..." className={styles.searchSmall} />
      <input type="text" placeholder="Tìm tên loại..." className={styles.searchSmall} />
      <div style={{ flex: 1 }} />
      <Button variant="secondary" size="sm"><Download size={14}/> Xuất Excel</Button>
      <Button variant="secondary" size="sm"><Upload size={14}/> Nhập Excel</Button>
      <Button variant="green" size="sm"><Plus size={14}/> Thêm hàng hóa</Button>
    </>
  );

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* Metric cards */}
      <div className={styles.metricsRow}>
        {METRICS.map(m => (
          <MetricCard key={m.id} label={m.label} value={m.value} icon={m.icon} color={m.color} />
        ))}
      </div>

      {/* Tabs */}
      <div className={styles.tabCard}>
        <TabBar tabs={TABS} active={activeTab} onChange={handleTabChange} />
      </div>

      {/* Table */}
      <DataTable columns={COLUMNS} data={MOCK_ITEMS} rowKey="id" toolbar={toolbar} />
    </DashboardLayout>
  );
};
