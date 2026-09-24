// src/features/batch/BatchList.jsx
// Danh sách lứa gà thịt — tất cả lứa đang nuôi và đã hoàn thành
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Plus, ChevronRight, Filter } from 'lucide-react';
import styles from './Batch.module.css';

/* ── Mock data ──────────────────────────────────────────── */
const MOCK_BATCHES = [
  {
    ma: 'GÀ-2024-10', chuong: 'Chuồng 3', chuongId: 'chuong-3',
    ngayVao: '12/09/2026', ngayTuoi: 12, soConVao: 4000, soConHienTai: 3950,
    nccGiong: 'Cty TNHH Giống GC Hà Nội', trangThai: 'Đang nuôi',
    giai_doan: 'Giai đoạn 1 (0–14 ngày)',
  },
  {
    ma: 'GÀ-2024-09', chuong: 'Chuồng 2', chuongId: 'chuong-2',
    ngayVao: '25/08/2026', ngayTuoi: 30, soConVao: 2000, soConHienTai: 1980,
    nccGiong: 'Cty Giống gia cầm Miền Bắc', trangThai: 'Đang nuôi',
    giai_doan: 'Giai đoạn 2 (15–35 ngày)',
  },
  {
    ma: 'GÀ-2024-08', chuong: 'Chuồng 1', chuongId: 'chuong-1',
    ngayVao: '10/08/2026', ngayTuoi: 45, soConVao: 2000, soConHienTai: 1950,
    nccGiong: 'Cty Giống gia cầm Miền Bắc', trangThai: 'Đang nuôi',
    giai_doan: 'Giai đoạn 3 (36–60 ngày)',
  },
  {
    ma: 'GÀ-2024-07', chuong: 'Chuồng 1', chuongId: 'chuong-1',
    ngayVao: '01/04/2026', ngayXuat: '05/07/2026', ngayTuoi: 95, soConVao: 2000, soConHienTai: 1940,
    nccGiong: 'Cty Giống gia cầm Miền Bắc', trangThai: 'Đã xuất bán',
    laiLo: '+21,000,000đ',
  },
  {
    ma: 'GÀ-2024-06', chuong: 'Chuồng 3', chuongId: 'chuong-3',
    ngayVao: '01/05/2026', ngayXuat: '05/08/2026', ngayTuoi: 96, soConVao: 4000, soConHienTai: 3870,
    nccGiong: 'Cty TNHH Giống GC Hà Nội', trangThai: 'Đã xuất bán',
    laiLo: '+40,000,000đ',
  },
];

export const BatchList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const barnFilter = searchParams.get('barn') ?? '';
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = MOCK_BATCHES.filter(b => {
    if (barnFilter   && b.chuongId !== barnFilter) return false;
    if (statusFilter && b.trangThai !== statusFilter) return false;
    return true;
  });

  const dangNuoi  = MOCK_BATCHES.filter(b => b.trangThai === 'Đang nuôi').length;
  const daXuat    = MOCK_BATCHES.filter(b => b.trangThai === 'Đã xuất bán').length;

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Quản lý lứa gà' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Quản lý lứa gà thịt</h1>
          <p className={styles.pageSub}>
            {dangNuoi} lứa đang nuôi · {daXuat} lứa đã hoàn thành
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="green">
            <Plus size={14} /> Tạo lứa mới
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)', alignItems: 'center' }}>
        <Filter size={15} color="var(--color-muted)" />
        <select
          style={{ padding: '6px 12px', border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-sm)', fontSize: 14, background: 'var(--color-canvas)' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="Đang nuôi">Đang nuôi</option>
          <option value="Đã xuất bán">Đã xuất bán</option>
        </select>
        <select
          style={{ padding: '6px 12px', border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-sm)', fontSize: 14, background: 'var(--color-canvas)' }}
          value={barnFilter}
          onChange={() => {}}
        >
          <option value="">Tất cả chuồng</option>
          <option value="chuong-1">Chuồng 1</option>
          <option value="chuong-2">Chuồng 2</option>
          <option value="chuong-3">Chuồng 3</option>
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-muted)', marginLeft: 'auto' }}>
          {filtered.length} lứa
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-lg)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-soft)' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--color-hairline)' }}>Mã lứa</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--color-hairline)' }}>Chuồng</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--color-hairline)' }}>Ngày vào</th>
              <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--color-hairline)' }}>Ngày tuổi</th>
              <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--color-hairline)' }}>Số con vào</th>
              <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--color-hairline)' }}>Số con hiện tại</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--color-hairline)' }}>Trạng thái</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--color-hairline)' }}>Lãi/Lỗ</th>
              <th style={{ borderBottom: '1px solid var(--color-hairline)' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(batch => (
              <tr
                key={batch.ma}
                onClick={() => navigate(`/owner-dashboard/batches/${batch.ma}`)}
                style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-soft)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-farm-green)', borderBottom: '1px solid var(--color-hairline)' }}>
                  {batch.ma}
                </td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-hairline)' }}>
                  <span style={{ fontWeight: 500 }}>{batch.chuong}</span>
                </td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-hairline)', color: 'var(--color-muted)' }}>
                  {batch.ngayVao}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--color-hairline)', fontWeight: 500 }}>
                  {batch.ngayTuoi} ngày
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--color-hairline)' }}>
                  {batch.soConVao.toLocaleString('vi-VN')}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--color-hairline)', fontWeight: 500 }}>
                  {batch.soConHienTai.toLocaleString('vi-VN')}
                  <span style={{ fontSize: 12, color: 'var(--color-farm-green)', marginLeft: 4 }}>
                    ({((batch.soConHienTai / batch.soConVao) * 100).toFixed(0)}%)
                  </span>
                </td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-hairline)' }}>
                  <Badge variant={batch.trangThai === 'Đang nuôi' ? 'active' : 'inactive'}>
                    {batch.trangThai}
                  </Badge>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid var(--color-hairline)', fontWeight: 600,
                  color: batch.laiLo
                    ? (batch.laiLo.startsWith('+') ? 'var(--color-farm-green)' : 'var(--color-farm-red)')
                    : 'var(--color-muted)'
                }}>
                  {batch.laiLo ?? '—'}
                </td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-hairline)', textAlign: 'center' }}>
                  <ChevronRight size={16} color="var(--color-muted)" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
};
