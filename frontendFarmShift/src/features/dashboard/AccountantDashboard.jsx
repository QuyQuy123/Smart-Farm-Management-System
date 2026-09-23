// src/features/dashboard/AccountantDashboard.jsx
// Kế toán Dashboard — Trang trại Miền Bình (Gà thịt)
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DollarSign, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import styles from './Dashboard.module.css';

/* ── Mock data – điều chỉnh khi nối API ──────────────────── */
const MOCK_METRICS = {
  totalRevenue:       '62,900,000đ',
  totalRevenueChange: '+12%',
  totalCost:          '42,500,000đ',
  totalCostChange:    '+8%',
  supplierDebt:       '18,200,000đ',
  supplierDebtChange: '-3,000,000đ',
  netProfit:          '20,400,000đ',
  netProfitChange:    '+4,200,000đ',
};

const MOCK_TRANSACTIONS = [
  { id: 'GD-001', ngay: '23/09/2026', loai: 'Nhập kho',     moTa: 'Cám CP 511 – 50 bao | Chuồng 1 & 2',           soTien: '-4,500,000đ',  trangThai: 'Đã ghi sổ' },
  { id: 'GD-002', ngay: '23/09/2026', loai: 'Tiêm vaccine', moTa: 'Vaccine ND-IB | Chuồng 3 – 12 ngày tuổi',       soTien: '-350,000đ',    trangThai: 'Đã ghi sổ' },
  { id: 'GD-003', ngay: '22/09/2026', loai: 'Xuất bán',     moTa: 'Lứa GÀ-2024-07 – 1,850 con | KH: Anh Hùng',    soTien: '+62,900,000đ', trangThai: 'Chờ thanh toán' },
  { id: 'GD-004', ngay: '21/09/2026', loai: 'Nhập kho',     moTa: 'Thuốc Amoxicillin – 10 lọ | NCC: DS Thành',     soTien: '-1,200,000đ',  trangThai: 'Đã ghi sổ' },
  { id: 'GD-005', ngay: '20/09/2026', loai: 'Thanh toán NCC', moTa: 'Trả nợ Cty CP – Hóa đơn tháng 8/2026',        soTien: '-12,000,000đ', trangThai: 'Đã ghi sổ' },
  { id: 'GD-006', ngay: '19/09/2026', loai: 'Nhập kho',     moTa: 'Cám CP 551 – 80 bao | Chuồng 3 (lứa mới)',      soTien: '-7,200,000đ',  trangThai: 'Đã ghi sổ' },
];

export const AccountantDashboard = () => {
  const BREADCRUMBS = [
    { label: 'Tổng quan tài chính' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* ── Trang tiêu đề ───────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.farmName}>
            <h1 className={styles.farmTitle}>Tổng quan tài chính</h1>
          </div>
          <p className={styles.farmSub}>Doanh thu · Chi phí · Công nợ · Lãi/Lỗ</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" size="sm">Xuất báo cáo CSV</Button>
          <Button variant="green" size="sm">+ Ghi giao dịch</Button>
        </div>
      </div>

      {/* ── Metric Cards ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Tổng doanh thu</span>
            <div className={styles.statIcon} style={{ color: 'var(--color-farm-green)' }}><TrendingUp size={18} /></div>
          </div>
          <div className={styles.statValue}>{MOCK_METRICS.totalRevenue}</div>
          <div className={`${styles.statChange} ${styles.positive}`}>
            {MOCK_METRICS.totalRevenueChange} so với tháng trước
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Tổng chi phí</span>
            <div className={styles.statIcon} style={{ color: 'var(--color-farm-orange)' }}><TrendingDown size={18} /></div>
          </div>
          <div className={styles.statValue}>{MOCK_METRICS.totalCost}</div>
          <div className={`${styles.statChange} ${styles.negative}`}>
            {MOCK_METRICS.totalCostChange} so với tháng trước
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Công nợ NCC</span>
            <div className={styles.statIcon} style={{ color: 'var(--color-farm-red)' }}><FileText size={18} /></div>
          </div>
          <div className={styles.statValue}>{MOCK_METRICS.supplierDebt}</div>
          <div className={`${styles.statChange} ${styles.positive}`}>
            {MOCK_METRICS.supplierDebtChange} so với tháng trước
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Lãi / Lỗ tháng này</span>
            <div className={styles.statIcon} style={{ color: 'var(--color-farm-green)' }}><DollarSign size={18} /></div>
          </div>
          <div className={styles.statValue} style={{ color: 'var(--color-farm-green)' }}>{MOCK_METRICS.netProfit}</div>
          <div className={`${styles.statChange} ${styles.positive}`}>
            {MOCK_METRICS.netProfitChange} so với tháng trước
          </div>
        </div>
      </div>

      {/* ── Bảng giao dịch gần đây ──────────────────────────── */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionCardHeader}>
          <span className={styles.sectionTitle}>Giao dịch gần đây</span>
          <Button variant="ghost" size="sm">Xem tất cả</Button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.eventsTable}>
            <thead>
              <tr>
                <th>Mã GD</th>
                <th>Ngày</th>
                <th>Loại</th>
                <th>Mô tả</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TRANSACTIONS.map(trx => (
                <tr key={trx.id}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--color-muted)', fontSize: 13 }}>{trx.id}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{trx.ngay}</td>
                  <td>
                    <Badge variant={
                      trx.loai === 'Xuất bán' ? 'active'
                      : trx.loai === 'Thanh toán NCC' ? 'warning'
                      : 'inactive'
                    }>
                      {trx.loai}
                    </Badge>
                  </td>
                  <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {trx.moTa}
                  </td>
                  <td style={{
                    fontWeight: 600,
                    color: trx.soTien.startsWith('+') ? 'var(--color-farm-green)' : 'var(--color-farm-red)',
                    whiteSpace: 'nowrap',
                  }}>
                    {trx.soTien}
                  </td>
                  <td>
                    <Badge variant={trx.trangThai === 'Đã ghi sổ' ? 'active' : 'warning'}>
                      {trx.trangThai}
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
