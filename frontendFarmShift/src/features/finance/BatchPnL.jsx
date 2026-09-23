// src/features/finance/BatchPnL.jsx
// Báo cáo Lãi/Lỗ từng lứa gà — tổng hợp cho Owner & Accountant
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { TrendingUp, TrendingDown, ChevronRight, BarChart3 } from 'lucide-react';
import styles from './Finance.module.css';

/* ── Mock P&L data ──────────────────────────────────────── */
const MOCK_PNL = [
  {
    maLua: 'GÀ-2024-08', chuong: 'Chuồng 1',
    ngayVao: '10/08/2026', ngayXuat: null,        // chưa xuất bán
    soConVao: 2000, soConXuat: null, tongKgXuat: null,
    donGiaBan: null,
    chiPhi: {
      giong:  24000000,
      cam:    145860000,  // tích lũy đến ngày 45
      thuoc:  1585000,
      khac:   0,
    },
    doanhThu: null,
    trangThai: 'Đang nuôi',
    fcr: null,
    ngayTuoi: 45,
  },
  {
    maLua: 'GÀ-2024-07', chuong: 'Chuồng 1',
    ngayVao: '01/04/2026', ngayXuat: '05/07/2026',
    soConVao: 2000, soConXuat: 1850, tongKgXuat: 3700,
    donGiaBan: 17000,
    chiPhi: {
      giong:  24000000,
      cam:    176400000,
      thuoc:  2300000,
      khac:   500000,
    },
    doanhThu: 62900000,
    trangThai: 'Đã xuất bán',
    fcr: 1.82,
    ngayTuoi: 95,
  },
  {
    maLua: 'GÀ-2024-06', chuong: 'Chuồng 3',
    ngayVao: '01/05/2026', ngayXuat: '05/08/2026',
    soConVao: 4000, soConXuat: 3870, tongKgXuat: 8514,
    donGiaBan: 15500,
    chiPhi: {
      giong:  54000000,
      cam:    357840000,
      thuoc:  4200000,
      khac:   800000,
    },
    doanhThu: 131967000,
    trangThai: 'Đã xuất bán',
    fcr: 1.88,
    ngayTuoi: 96,
  },
  {
    maLua: 'GÀ-2024-05', chuong: 'Chuồng 2',
    ngayVao: '15/04/2026', ngayXuat: '20/07/2026',
    soConVao: 2000, soConXuat: 1960, tongKgXuat: 4312,
    donGiaBan: 16800,
    chiPhi: {
      giong:  24000000,
      cam:    184400000,
      thuoc:  2100000,
      khac:   300000,
    },
    doanhThu: 72441600,
    trangThai: 'Đã xuất bán',
    fcr: 1.79,
    ngayTuoi: 96,
  },
];

/* ── Helper ─────────────────────────────────────────────── */
function calcPnL(b) {
  const tongCP = b.chiPhi.giong + b.chiPhi.cam + b.chiPhi.thuoc + b.chiPhi.khac;
  const laiLo  = b.doanhThu != null ? b.doanhThu - tongCP : null;
  const margin = b.doanhThu != null && b.doanhThu > 0 ? ((laiLo / b.doanhThu) * 100).toFixed(1) : null;
  return { tongCP, laiLo, margin };
}

/* ── BatchPnL ───────────────────────────────────────────── */
export const BatchPnL = () => {
  const navigate  = useNavigate();
  const [filter, setFilter] = useState('all');

  const filtered = MOCK_PNL.filter(b => {
    if (filter === 'active') return b.trangThai === 'Đang nuôi';
    if (filter === 'done')   return b.trangThai === 'Đã xuất bán';
    return true;
  });

  // Aggregate KPIs từ các lứa đã xuất bán
  const done    = MOCK_PNL.filter(b => b.doanhThu != null);
  const tongDT  = done.reduce((s, b) => s + b.doanhThu, 0);
  const tongCP  = done.reduce((s, b) => s + b.chiPhi.giong + b.chiPhi.cam + b.chiPhi.thuoc + b.chiPhi.khac, 0);
  const tongLai = tongDT - tongCP;
  const avgFcr  = done.length > 0 ? (done.reduce((s,b) => s + (b.fcr ?? 0), 0) / done.length).toFixed(2) : '—';

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Báo cáo Lãi/Lỗ từng lứa' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Báo cáo Lãi/Lỗ từng lứa gà</h1>
          <p className={styles.pageSub}>{MOCK_PNL.length} lứa · {done.length} đã hoàn thành</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary">Xuất Excel</Button>
        </div>
      </div>

      {/* Aggregate KPIs */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng doanh thu (YTD)</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-green)', fontSize: 18 }}>
            {tongDT.toLocaleString('vi-VN')}đ
          </div>
          <div className={styles.kpiSub}>{done.length} lứa đã xuất bán</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng chi phí (YTD)</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-red)', fontSize: 18 }}>
            {tongCP.toLocaleString('vi-VN')}đ
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng lãi / lỗ (YTD)</div>
          <div className={styles.kpiValue} style={{
            color: tongLai >= 0 ? 'var(--color-farm-green)' : 'var(--color-farm-red)',
            fontSize: 18,
          }}>
            {tongLai >= 0 ? '+' : ''}{tongLai.toLocaleString('vi-VN')}đ
          </div>
          <div className={styles.kpiSub}>
            {tongDT > 0 ? `Biên lợi nhuận: ${((tongLai/tongDT)*100).toFixed(1)}%` : ''}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>FCR trung bình</div>
          <div className={styles.kpiValue}>{avgFcr}</div>
          <div className={styles.kpiSub}>Hệ số chuyển đổi cám (thấp hơn = tốt hơn)</div>
        </div>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        {[['all','Tất cả'],['done','Đã xuất bán'],['active','Đang nuôi']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 'var(--rounded-sm)', border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            background: filter === v ? 'var(--color-farm-green)' : 'var(--color-canvas)',
            color: filter === v ? '#fff' : 'var(--color-ink)',
            borderColor: filter === v ? 'var(--color-farm-green)' : 'var(--color-hairline)',
          }}>{l}</button>
        ))}
      </div>

      {/* P&L Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
        {filtered.map(batch => {
          const { tongCP: bCP, laiLo, margin } = calcPnL(batch);
          const isProfit = laiLo != null && laiLo >= 0;
          const isActive = batch.trangThai === 'Đang nuôi';

          return (
            <div key={batch.maLua} style={{
              background: 'var(--color-canvas)',
              border: `1px solid ${isActive ? 'var(--color-hairline)' : laiLo != null && laiLo < 0 ? 'var(--color-farm-red)' : 'var(--color-hairline)'}`,
              borderRadius: 'var(--rounded-lg)',
              padding: 'var(--sp-lg)',
              cursor: 'pointer',
              transition: 'box-shadow 0.15s',
            }}
              onClick={() => navigate(`/owner-dashboard/batches/${batch.maLua}`)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-md)' }}>
                {/* Left: Batch info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: 'var(--color-farm-green)' }}>{batch.maLua}</span>
                    <Badge variant={isActive ? 'active' : 'inactive'}>{batch.trangThai}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                    {batch.chuong} · Vào: {batch.ngayVao}
                    {batch.ngayXuat && ` · Xuất: ${batch.ngayXuat}`}
                    {isActive && ` · ${batch.ngayTuoi} ngày tuổi`}
                  </div>
                </div>

                {/* Right: P&L result */}
                {isActive ? (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>Chi phí tích lũy</div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-farm-red)' }}>
                      {bCP.toLocaleString('vi-VN')}đ
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Chưa xuất bán</div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
                      {isProfit ? <TrendingUp size={18} color="var(--color-farm-green)" /> : <TrendingDown size={18} color="var(--color-farm-red)" />}
                      <span style={{ fontWeight: 700, fontSize: 22, color: isProfit ? 'var(--color-farm-green)' : 'var(--color-farm-red)' }}>
                        {laiLo >= 0 ? '+' : ''}{laiLo?.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Biên lợi nhuận: {margin}%</div>
                  </div>
                )}
              </div>

              {/* Cost breakdown mini bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--sp-sm)', fontSize: 13 }}>
                {[
                  { label: 'Con giống', val: batch.chiPhi.giong, color: '#6366f1' },
                  { label: 'Thức ăn',  val: batch.chiPhi.cam,   color: '#f59e0b' },
                  { label: 'Thuốc',    val: batch.chiPhi.thuoc,  color: '#ef4444' },
                  { label: 'Doanh thu', val: batch.doanhThu,     color: 'var(--color-farm-green)', isRevenue: true },
                  { label: 'FCR',      val: batch.fcr != null ? `${batch.fcr}` : '—', color: '#64748b', isLabel: true },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-sm)', padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontWeight: 600, color: item.color, fontSize: 13 }}>
                      {item.isLabel
                        ? item.val
                        : item.val != null
                          ? `${(item.val/1000000).toFixed(1)}tr`
                          : '—'
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
};
