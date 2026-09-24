// src/features/barn/BarnDetail.jsx
// Chi tiết chuồng — thông tin + lịch sử lứa nuôi
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Thermometer, ArrowLeft, Plus } from 'lucide-react';
import styles from './Barn.module.css';

/* ── Mock data ──────────────────────────────────────────── */
const BARNS_MAP = {
  'chuong-1': {
    id: 'chuong-1', ten: 'Chuồng 1', dienTich: '300 m²', sucChua: 2000,
    loai: 'Chuồng nuôi thịt', namXayDung: '2019',
    luongHienTai: {
      ma: 'GÀ-2024-08', soConVao: 2000, soConHienTai: 1950,
      ngayVao: '10/08/2026', ngayTuoi: 45, nhietDo: 28.5,
      nccGiong: 'Cty Giống gia cầm Miền Bắc', donGiaGiong: '12,000đ/con',
    },
    lichSuLua: [
      { ma: 'GÀ-2024-04', ngayVao: '01/04/2026', ngayXuat: '05/07/2026', soConVao: 2000, soConXuat: 1940, doanhThu: '65,000,000đ', chiPhi: '44,000,000đ', laiLo: '+21,000,000đ' },
      { ma: 'GÀ-2023-10', ngayVao: '05/10/2025', ngayXuat: '12/01/2026', soConVao: 1950, soConXuat: 1880, doanhThu: '58,500,000đ', chiPhi: '40,200,000đ', laiLo: '+18,300,000đ' },
      { ma: 'GÀ-2023-06', ngayVao: '10/06/2025', ngayXuat: '20/09/2025', soConVao: 2000, soConXuat: 1820, doanhThu: '52,000,000đ', chiPhi: '39,500,000đ', laiLo: '+12,500,000đ' },
    ],
  },
  'chuong-2': {
    id: 'chuong-2', ten: 'Chuồng 2', dienTich: '300 m²', sucChua: 2000,
    loai: 'Chuồng nuôi thịt', namXayDung: '2020',
    luongHienTai: {
      ma: 'GÀ-2024-09', soConVao: 2000, soConHienTai: 1980,
      ngayVao: '25/08/2026', ngayTuoi: 30, nhietDo: 29.1,
      nccGiong: 'Cty Giống gia cầm Miền Bắc', donGiaGiong: '12,000đ/con',
    },
    lichSuLua: [
      { ma: 'GÀ-2024-05', ngayVao: '15/04/2026', ngayXuat: '20/07/2026', soConVao: 2000, soConXuat: 1960, doanhThu: '67,200,000đ', chiPhi: '45,000,000đ', laiLo: '+22,200,000đ' },
      { ma: 'GÀ-2023-11', ngayVao: '18/10/2025', ngayXuat: '25/01/2026', soConVao: 2000, soConXuat: 1910, doanhThu: '60,000,000đ', chiPhi: '42,000,000đ', laiLo: '+18,000,000đ' },
    ],
  },
  'chuong-3': {
    id: 'chuong-3', ten: 'Chuồng 3', dienTich: '520 m²', sucChua: 4000,
    loai: 'Chuồng nuôi thịt (chuồng lớn)', namXayDung: '2022',
    luongHienTai: {
      ma: 'GÀ-2024-10', soConVao: 4000, soConHienTai: 3950,
      ngayVao: '12/09/2026', ngayTuoi: 12, nhietDo: 33.2,
      nccGiong: 'Cty TNHH Giống Gia Cầm Hà Nội', donGiaGiong: '13,500đ/con',
    },
    lichSuLua: [
      { ma: 'GÀ-2024-06', ngayVao: '01/05/2026', ngayXuat: '05/08/2026', soConVao: 4000, soConXuat: 3870, doanhThu: '128,000,000đ', chiPhi: '88,000,000đ', laiLo: '+40,000,000đ' },
    ],
  },
};

export const BarnDetail = () => {
  const { barnId } = useParams();
  const navigate   = useNavigate();
  const barn       = BARNS_MAP[barnId];

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Quản lý chuồng', path: '/owner-dashboard/barns' },
    { label: barn?.ten ?? 'Chi tiết' },
  ];

  if (!barn) {
    return (
      <DashboardLayout breadcrumbs={BREADCRUMBS}>
        <div style={{ padding: 'var(--sp-xl)', color: 'var(--color-muted)' }}>
          Không tìm thấy chuồng này.
        </div>
      </DashboardLayout>
    );
  }

  const l = barn.luongHienTai;
  const tiLeSong = ((l.soConHienTai / l.soConVao) * 100).toFixed(1);

  const tempCls = l.nhietDo >= 35 ? styles.tempDanger
                : l.nhietDo >= 32 ? styles.tempWarn
                : styles.tempSafe;
  const tempLabel = l.nhietDo >= 35 ? 'Nguy hiểm' : l.nhietDo >= 32 ? 'Cần chú ý' : 'An toàn';

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
          <Button variant="ghost" size="sm" onClick={() => navigate('/owner-dashboard/barns')}>
            <ArrowLeft size={14} /> Quay lại
          </Button>
          <div>
            <h1 style={{ fontSize: 'var(--fs-title-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-ink)' }}>
              {barn.ten}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>{barn.loai} · {barn.dienTich} · Sức chứa {barn.sucChua.toLocaleString('vi-VN')} con</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
          <Button variant="secondary" onClick={() => navigate(`/owner-dashboard/batches/${l.ma}`)}>
            Xem lứa hiện tại
          </Button>
          <Button variant="green">
            <Plus size={14} /> Tạo lứa mới
          </Button>
        </div>
      </div>

      <div className={styles.detailGrid}>
        {/* ── Info Panel ──────────────────────────────────── */}
        <div className={styles.infoPanel}>
          {/* Thông tin chuồng */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Thông tin chuồng</div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Diện tích</span><span className={styles.infoRowValue}>{barn.dienTich}</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Sức chứa</span><span className={styles.infoRowValue}>{barn.sucChua.toLocaleString('vi-VN')} con</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Loại chuồng</span><span className={styles.infoRowValue}>{barn.loai}</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Năm xây dựng</span><span className={styles.infoRowValue}>{barn.namXayDung}</span></div>
          </div>

          {/* Lứa đang nuôi */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Lứa đang nuôi</div>
            <div className={styles.infoRow}>
              <span className={styles.infoRowLabel}>Mã lứa</span>
              <span className={styles.infoRowValue} style={{ fontFamily: 'monospace', color: 'var(--color-farm-green)' }}>{l.ma}</span>
            </div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Ngày vào đàn</span><span className={styles.infoRowValue}>{l.ngayVao}</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Ngày tuổi</span><span className={styles.infoRowValue}>{l.ngayTuoi} ngày</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Số con vào</span><span className={styles.infoRowValue}>{l.soConVao.toLocaleString('vi-VN')} con</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Số con hiện tại</span><span className={styles.infoRowValue}>{l.soConHienTai.toLocaleString('vi-VN')} con</span></div>
            <div className={styles.infoRow}>
              <span className={styles.infoRowLabel}>Tỷ lệ sống</span>
              <span className={styles.infoRowValue} style={{ color: 'var(--color-farm-green)' }}>{tiLeSong}%</span>
            </div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>NCC giống</span><span className={styles.infoRowValue}>{l.nccGiong}</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Đơn giá giống</span><span className={styles.infoRowValue}>{l.donGiaGiong}</span></div>
          </div>

          {/* Nhiệt độ */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Nhiệt độ chuồng (IoT)</div>
            <div className={`${styles.tempRow} ${tempCls}`} style={{ justifyContent: 'center', padding: 'var(--sp-md)', fontSize: 18, fontWeight: 600, borderRadius: 'var(--rounded-md)' }}>
              <Thermometer size={20} />
              {l.nhietDo}°C — {tempLabel}
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 'var(--sp-sm)', textAlign: 'center' }}>
              Cập nhật real-time từ cảm biến IoT (Sprint 3)
            </p>
          </div>
        </div>

        {/* ── Lịch sử lứa nuôi ────────────────────────────── */}
        <div>
          <div className={styles.infoCard} style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
              <div className={styles.infoCardTitle} style={{ marginBottom: 0 }}>Lịch sử lứa nuôi</div>
              <Badge variant="inactive">{barn.lichSuLua.length} lứa đã hoàn thành</Badge>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className={styles.historyTable} style={{ whiteSpace: 'nowrap' }}>
                <thead>
                  <tr>
                    <th>Mã lứa</th>
                  <th>Ngày vào</th>
                  <th>Ngày xuất</th>
                  <th>Con vào</th>
                  <th>Con xuất</th>
                  <th>Doanh thu</th>
                  <th>Chi phí</th>
                  <th>Lãi/Lỗ</th>
                </tr>
              </thead>
              <tbody>
                {barn.lichSuLua.map(lua => (
                  <tr key={lua.ma} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/owner-dashboard/batches/${lua.ma}`)}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-farm-green)' }}>{lua.ma}</td>
                    <td>{lua.ngayVao}</td>
                    <td>{lua.ngayXuat}</td>
                    <td>{lua.soConVao.toLocaleString('vi-VN')}</td>
                    <td>{lua.soConXuat.toLocaleString('vi-VN')}</td>
                    <td style={{ color: 'var(--color-farm-green)', fontWeight: 500 }}>{lua.doanhThu}</td>
                    <td style={{ color: 'var(--color-farm-red)' }}>{lua.chiPhi}</td>
                    <td className={lua.laiLo.startsWith('+') ? styles.profitPos : styles.profitNeg}>{lua.laiLo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
