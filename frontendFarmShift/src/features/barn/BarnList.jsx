// src/features/barn/BarnList.jsx
// Danh sách chuồng trại — Trang trại Miền Bình
// 3 chuồng: Chuồng 1 & 2 (~2,000 con), Chuồng 3 (~4,000 con)
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Thermometer, Users, Calendar, Plus, ChevronRight } from 'lucide-react';
import styles from './Barn.module.css';

/* ── Mock data – 3 chuồng trang trại Miền Bình ──────────── */
const MOCK_BARNS = [
  {
    id: 'chuong-1',
    ten: 'Chuồng 1',
    dienTich: '300 m²',
    sucChua: 2000,
    luongDangNuoi: 'GÀ-2024-08',
    soConHienTai: 1950,
    ngayVao: '10/08/2026',
    ngayTuoi: 45,
    nhietDo: 28.5,
    trangThai: 'active',        // active | empty | maintenance
    ngayTuoiDuKien: '~60 ngày',
  },
  {
    id: 'chuong-2',
    ten: 'Chuồng 2',
    dienTich: '300 m²',
    sucChua: 2000,
    luongDangNuoi: 'GÀ-2024-09',
    soConHienTai: 1980,
    ngayVao: '25/08/2026',
    ngayTuoi: 30,
    nhietDo: 29.1,
    trangThai: 'active',
    ngayTuoiDuKien: '~75 ngày',
  },
  {
    id: 'chuong-3',
    ten: 'Chuồng 3',
    dienTich: '520 m²',
    sucChua: 4000,
    luongDangNuoi: 'GÀ-2024-10',
    soConHienTai: 3950,
    ngayVao: '12/09/2026',
    ngayTuoi: 12,
    nhietDo: 33.2,              // cao hơn bình thường
    trangThai: 'active',
    ngayTuoiDuKien: '~93 ngày',
  },
];

/* ── Nhiệt độ helper ────────────────────────────────────── */
function TempIndicator({ temp }) {
  let cls = styles.tempSafe;
  let label = 'An toàn';
  if (temp >= 35) { cls = styles.tempDanger; label = 'Nguy hiểm'; }
  else if (temp >= 32) { cls = styles.tempWarn; label = 'Cần chú ý'; }

  return (
    <div className={`${styles.tempRow} ${cls}`}>
      <Thermometer size={14} />
      <span>{temp}°C — {label}</span>
    </div>
  );
}

/* ── BarnList ───────────────────────────────────────────── */
export const BarnList = () => {
  const navigate = useNavigate();

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Quản lý chuồng' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* ── Header ────────────────────────────────────────── */}
      <div className={styles.pageHeader ?? ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-lg)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-title-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-ink)', marginBottom: 4 }}>
            Quản lý chuồng trại
          </h1>
          <p style={{ fontSize: 'var(--fs-body-md)', color: 'var(--color-muted)' }}>
            {MOCK_BARNS.length} chuồng · Tổng {MOCK_BARNS.reduce((s, b) => s + b.soConHienTai, 0).toLocaleString('vi-VN')} con đang nuôi
          </p>
        </div>
        <Button variant="green">
          <Plus size={14} />
          Tạo lứa mới
        </Button>
      </div>

      {/* ── Barn Cards ────────────────────────────────────── */}
      <div className={styles.barnGrid}>
        {MOCK_BARNS.map(barn => (
          <div
            key={barn.id}
            className={`${styles.barnCard} ${barn.trangThai !== 'active' ? styles.barnCardInactive : ''}`}
            onClick={() => navigate(`/owner-dashboard/barns/${barn.id}`)}
            role="button"
            tabIndex={0}
            aria-label={`Xem chi tiết ${barn.ten}`}
            onKeyDown={e => e.key === 'Enter' && navigate(`/owner-dashboard/barns/${barn.id}`)}
          >
            {/* Header */}
            <div className={styles.barnCardHeader}>
              <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'center' }}>
                <div className={styles.barnIcon}>🏠</div>
                <div>
                  <div className={styles.barnName}>{barn.ten}</div>
                  <div className={styles.barnSize}>{barn.dienTich} · Sức chứa {barn.sucChua.toLocaleString('vi-VN')} con</div>
                </div>
              </div>
              <Badge variant={barn.trangThai === 'active' ? 'active' : 'inactive'}>
                {barn.trangThai === 'active' ? 'Đang nuôi' : 'Trống'}
              </Badge>
            </div>

            {/* Lứa hiện tại */}
            {barn.trangThai === 'active' && (
              <>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', background: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-sm)', padding: '6px 10px' }}>
                  📋 Lứa: <strong style={{ color: 'var(--color-ink)' }}>{barn.luongDangNuoi}</strong>
                  &nbsp;·&nbsp; Vào: {barn.ngayVao}
                </div>

                {/* Stats */}
                <div className={styles.barnStats}>
                  <div className={styles.barnStat}>
                    <div className={styles.barnStatLabel}>Số con hiện tại</div>
                    <div className={styles.barnStatValue}>{barn.soConHienTai.toLocaleString('vi-VN')} con</div>
                  </div>
                  <div className={styles.barnStat}>
                    <div className={styles.barnStatLabel}>Ngày tuổi</div>
                    <div className={styles.barnStatValue}>{barn.ngayTuoi} ngày</div>
                  </div>
                  <div className={styles.barnStat}>
                    <div className={styles.barnStatLabel}>Tỷ lệ sống</div>
                    <div className={styles.barnStatValue} style={{ color: 'var(--color-farm-green)' }}>
                      {((barn.soConHienTai / barn.sucChua) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className={styles.barnStat}>
                    <div className={styles.barnStatLabel}>Dự kiến xuất</div>
                    <div className={styles.barnStatValue}>{barn.ngayTuoiDuKien}</div>
                  </div>
                </div>

                {/* Temperature */}
                <TempIndicator temp={barn.nhietDo} />
              </>
            )}

            {/* Footer */}
            <div className={styles.barnCardFooter}>
              <Button variant="ghost" size="sm" style={{ flex: 1 }}
                onClick={e => { e.stopPropagation(); navigate(`/owner-dashboard/batches?barn=${barn.id}`); }}>
                Xem lứa nuôi
              </Button>
              <Button variant="secondary" size="sm" style={{ flex: 1 }}>
                <ChevronRight size={14} />
                Chi tiết
              </Button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};
