// src/features/inventory/InventoryCategories.jsx
// Loại hàng hóa — UI_FarmShift.pdf page 4
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DataTable } from '../../components/DataTable/DataTable';
import { MetricCard } from '../../components/MetricCard/MetricCard';
import { Button } from '../../components/Button/Button';
import { TabBar } from '../../components/TabBar/TabBar';
import { DollarSign, Weight, BarChart2, AlertCircle, Plus, Download, Upload, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './Inventory.module.css';

const METRICS = [
  { id: 'm1', label: 'Tổng giá trị',    value: '43,600,000đ', icon: <DollarSign size={18}/>, color: 'green'  },
  { id: 'm2', label: 'Tổng khối lượng', value: '3050 Kg',     icon: <Weight size={18}/>,     color: 'orange' },
  { id: 'm3', label: 'Tổng loại',       value: '122',          icon: <BarChart2 size={18}/>,  color: 'blue'   },
  { id: 'm4', label: 'Sắp hết hàng',   value: '0',            icon: <AlertCircle size={18}/>,color: 'red'    },
];

const TABS = [
  { key: 'list',       label: 'Bán hàng' },
  { key: 'categories', label: 'Loại hàng hóa' },
  { key: 'import',     label: 'Kho hàng vào' },
  { key: 'export',     label: 'Lần lược' },
  { key: 'staff',      label: 'Nhân viên' },
];

const MOCK_CATEGORIES = [
  { id: 'CAT01', ten: 'Ngựa 04', gia: '270,000đ', loai: '22 Bao (577Kg)', quy_cach: '25 Bêu Bao', thanh_hanh: 'CP',  ngay: '01/12/2024' },
  { id: 'CAT02', ten: 'Ngựa 05', gia: '270,000đ', loai: '22 Bao (577Kg)', quy_cach: '25 Bêu Bao', thanh_hanh: 'CP',  ngay: '01/12/2024' },
  { id: 'CAT03', ten: 'Ngựa 02', gia: '290,000đ', loai: '22 Bao (577Kg)', quy_cach: '26 Bêu Bao', thanh_hanh: 'UNI', ngay: '01/12/2024' },
  { id: 'CAT04', ten: 'Ngựa 006', gia: '290,000đ', loai: '44 Bao (11 Ung)', quy_cach: '26 Bêu Bao', thanh_hanh: 'UNI', ngay: '01/12/2024' },
];

const COLUMNS = [
  { key: 'stt', label: 'STT', width: '56px', align: 'center',
    render: (_, row, idx) => <span style={{ color: 'var(--color-muted)' }}>{idx + 1}</span> },
  { key: 'id', label: 'Mã Loại',
    render: v => <span style={{ fontWeight: 500, color: 'var(--color-link)', fontFamily: 'monospace' }}>{v}</span> },
  { key: 'ten', label: 'Tên Hàng Hóa' },
  { key: 'gia', label: 'Giá Tiền', align: 'right',
    render: v => <span style={{ fontWeight: 500 }}>{v}</span> },
  { key: 'loai', label: 'Tên Loại' },
  { key: 'quy_cach', label: 'Quy Cách' },
  { key: 'thanh_hanh', label: 'Thành Hành' },
  { key: 'actions', label: '', width: '48px', align: 'center',
    render: () => <button className={styles.moreBtn}><MoreVertical size={16}/></button> },
];

export const InventoryCategories = () => {
  const [activeTab, setActiveTab] = useState('categories');
  const navigate = useNavigate();

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'list')   navigate('/owner-dashboard/inventory');
    if (key === 'import') navigate('/owner-dashboard/inventory/warehouse');
  };

  const BREADCRUMBS = [
    { label: 'Livestock Farm', path: '/owner-dashboard' },
    { label: 'Hàng hóa', path: '/owner-dashboard/inventory' },
    { label: 'Loại hàng hóa' },
  ];

  const toolbar = (
    <>
      <div style={{ flex: 1 }} />
      <Button variant="secondary" size="sm"><Download size={14}/> Xuất Excel</Button>
      <Button variant="secondary" size="sm"><Upload size={14}/> Nhập Excel</Button>
      <Button variant="green" size="sm"><Plus size={14}/> Thêm loại hàng</Button>
    </>
  );

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      <div className={styles.metricsRow}>
        {METRICS.map(m => (
          <MetricCard key={m.id} label={m.label} value={m.value} icon={m.icon} color={m.color} />
        ))}
      </div>
      <div className={styles.tabCard}>
        <TabBar tabs={TABS} active={activeTab} onChange={handleTabChange} />
      </div>
      <DataTable columns={COLUMNS} data={MOCK_CATEGORIES} rowKey="id" toolbar={toolbar} />
    </DashboardLayout>
  );
};
