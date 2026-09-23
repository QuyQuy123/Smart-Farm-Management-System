// src/features/batch/BatchDetail.jsx
// Chi tiết lứa gà thịt — 4 tabs: Tổng quan / Nhật ký / Vaccine / Chi phí
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { ArrowLeft, Plus, ClipboardList } from 'lucide-react';
import styles from './Batch.module.css';

/* ── Mock data – một lứa mẫu ──────────────────────────────── */
const BATCHES = {
  'GÀ-2024-08': {
    ma: 'GÀ-2024-08', chuong: 'Chuồng 1', chuongId: 'chuong-1',
    ngayVao: '10/08/2026', ngayTuoi: 45, soConVao: 2000, soConHienTai: 1950,
    nccGiong: 'Cty Giống gia cầm Miền Bắc', donGiaGiong: '12,000đ/con',
    tongTienGiong: '24,000,000đ',
    trangThai: 'Đang nuôi',
    nhatKy: [
      { ngay: '23/09/2026', ngayTuoi: 45, soConChet: 2, kgCam: 320, ghiChu: 'Đàn khỏe, ăn đều' },
      { ngay: '22/09/2026', ngayTuoi: 44, soConChet: 1, kgCam: 315, ghiChu: '' },
      { ngay: '21/09/2026', ngayTuoi: 43, soConChet: 0, kgCam: 310, ghiChu: 'Phun thuốc sát trùng chuồng' },
      { ngay: '20/09/2026', ngayTuoi: 42, soConChet: 3, kgCam: 308, ghiChu: 'Phát hiện 3 con ho, cách ly' },
      { ngay: '19/09/2026', ngayTuoi: 41, soConChet: 1, kgCam: 302, ghiChu: '' },
    ],
    vaccine: [
      { ngayTuoi: 1,  tenVaccine: 'Marek (1 ngày tuổi)',     loai: 'Tiêm dưới da',   ncc: 'Merial',    trangThai: 'done', ngayThuc: '11/08/2026' },
      { ngayTuoi: 7,  tenVaccine: 'Newcastle + IB (lần 1)',  loai: 'Nhỏ mắt/mũi',   ncc: 'Intervet',  trangThai: 'done', ngayThuc: '17/08/2026' },
      { ngayTuoi: 14, tenVaccine: 'Gumboro (lần 1)',          loai: 'Nhỏ mắt',       ncc: 'Intervet',  trangThai: 'done', ngayThuc: '24/08/2026' },
      { ngayTuoi: 21, tenVaccine: 'Newcastle + IB (lần 2)',  loai: 'Nhỏ mắt/mũi',   ncc: 'Intervet',  trangThai: 'done', ngayThuc: '31/08/2026' },
      { ngayTuoi: 28, tenVaccine: 'Gumboro (lần 2)',          loai: 'Nhỏ mắt',       ncc: 'Intervet',  trangThai: 'done', ngayThuc: '07/09/2026' },
      { ngayTuoi: 42, tenVaccine: 'Newcastle (lần 3 – uống)', loai: 'Uống nước',     ncc: 'Merial',    trangThai: 'done', ngayThuc: '21/09/2026' },
      { ngayTuoi: 56, tenVaccine: 'Cúm gia cầm H5N1',        loai: 'Tiêm bắp',      ncc: 'NAVETCO', trangThai: 'upcoming', ngayThuc: '05/10/2026' },
    ],
    chiPhi: {
      giong: 24000000,
      cam: [
        { loai: 'CP 510 (GĐ 1, 0–14 ngày)', kgTieu: 1400, donGia: 12500, thanh: 17500000 },
        { loai: 'CP 511 (GĐ 2, 15–35 ngày)', kgTieu: 6200, donGia: 11800, thanh: 73160000 },
        { loai: 'CP 512 (GĐ 3, 36+ngày)',   kgTieu: 4800, donGia: 11500, thanh: 55200000 },
      ],
      thuoc: [
        { ten: 'Amoxicillin + Colistin', don: 'lọ', soLuong: 5, donGia: 85000, thanh: 425000 },
        { ten: 'Vitamin C + Điện giải',   don: 'kg',  soLuong: 3, donGia: 120000, thanh: 360000 },
        { ten: 'Vaccine ND-IB (Lần 1+2)', don: 'liều', soLuong: 4000, donGia: 80, thanh: 320000 },
        { ten: 'Vaccine Gumboro (Lần 1+2)', don: 'liều', soLuong: 4000, donGia: 75, thanh: 300000 },
        { ten: 'Vaccine Newcastle uống',   don: 'liều', soLuong: 2000, donGia: 90, thanh: 180000 },
      ],
    },
    doanhThu: null, // null = chưa xuất bán
  },
};

/* ── Tabs ────────────────────────────────────────────────── */
const TABS = ['Tổng quan', 'Nhật ký hàng ngày', 'Lịch vaccine', 'Chi phí & Lãi/Lỗ'];

export const BatchDetail = () => {
  const { batchId } = useParams();
  const navigate    = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  // Fallback mock nếu ID không tồn tại
  const batch = BATCHES[batchId] ?? BATCHES['GÀ-2024-08'];

  const tongCam   = batch.chiPhi.cam.reduce((s, c) => s + c.thanh, 0);
  const tongThuoc = batch.chiPhi.thuoc.reduce((s, t) => s + t.thanh, 0);
  const tongCP    = batch.chiPhi.giong + tongCam + tongThuoc;
  const soConChetTotal = batch.nhatKy.reduce((s, n) => s + n.soConChet, 0);
  const tiLeSong  = ((batch.soConHienTai / batch.soConVao) * 100).toFixed(1);

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Lứa gà', path: '/owner-dashboard/batches' },
    { label: batch.ma },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
          <Button variant="ghost" size="sm" onClick={() => navigate('/owner-dashboard/batches')}>
            <ArrowLeft size={14} /> Quay lại
          </Button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', marginBottom: 4 }}>
              <h1 style={{ fontSize: 'var(--fs-title-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-ink)', fontFamily: 'monospace' }}>
                {batch.ma}
              </h1>
              <Badge variant={batch.trangThai === 'Đang nuôi' ? 'active' : 'inactive'}>
                {batch.trangThai}
              </Badge>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              {batch.chuong} · Vào đàn: {batch.ngayVao} · {batch.ngayTuoi} ngày tuổi
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
          <Button variant="secondary" onClick={() => navigate(`/owner-dashboard/batches/${batchId}/log`)}>
            <ClipboardList size={14} /> Ghi nhật ký
          </Button>
          {batch.trangThai === 'Đang nuôi' && (
            <Button variant="green">Ghi nhận xuất bán</Button>
          )}
        </div>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Số con hiện tại</div>
          <div className={styles.kpiValue}>{batch.soConHienTai.toLocaleString('vi-VN')}</div>
          <div className={styles.kpiSub}>/ {batch.soConVao.toLocaleString('vi-VN')} con vào</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tỷ lệ sống</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-green)' }}>{tiLeSong}%</div>
          <div className={styles.kpiSub}>Chết: {soConChetTotal} con</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Ngày tuổi</div>
          <div className={styles.kpiValue}>{batch.ngayTuoi}</div>
          <div className={styles.kpiSub}>Vào: {batch.ngayVao}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng chi phí</div>
          <div className={styles.kpiValue} style={{ fontSize: 18 }}>
            {tongCP.toLocaleString('vi-VN')}đ
          </div>
          <div className={styles.kpiSub}>Giống + Cám + Thuốc</div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className={styles.tabs}>
        {TABS.map((t, i) => (
          <button key={i} className={`${styles.tab} ${activeTab === i ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(i)}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab: Tổng quan ────────────────────────────────── */}
      {activeTab === 0 && (
        <div className={styles.detailLayout}>
          <div>
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}>Thông tin lứa nuôi</div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Mã lứa</span><span className={styles.infoValue} style={{ fontFamily: 'monospace', color: 'var(--color-farm-green)' }}>{batch.ma}</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Chuồng</span><span className={styles.infoValue}>{batch.chuong}</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Ngày vào đàn</span><span className={styles.infoValue}>{batch.ngayVao}</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Ngày tuổi hiện tại</span><span className={styles.infoValue}>{batch.ngayTuoi} ngày</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Số con vào</span><span className={styles.infoValue}>{batch.soConVao.toLocaleString('vi-VN')} con</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Số con hiện tại</span><span className={styles.infoValue}>{batch.soConHienTai.toLocaleString('vi-VN')} con</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Tổng số chết (ghi nhận)</span><span className={styles.infoValue} style={{ color: 'var(--color-farm-red)' }}>{soConChetTotal} con</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>NCC giống</span><span className={styles.infoValue}>{batch.nccGiong}</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Đơn giá giống</span><span className={styles.infoValue}>{batch.donGiaGiong}</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Tiền giống</span><span className={styles.infoValue} style={{ color: 'var(--color-farm-red)' }}>{batch.tongTienGiong}</span></div>
            </div>
          </div>
          <div>
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}>Nhật ký 5 ngày gần nhất</div>
              <div className={styles.logTimeline}>
                {batch.nhatKy.slice(0, 5).map((entry, i) => (
                  <div key={i} className={styles.logEntry}>
                    <div className={styles.logDate}>📅 {entry.ngay}</div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.logStats}>
                        <div className={styles.logStat}><span className={styles.logStatLabel}>Chết:</span><span className={styles.logStatValue} style={{ color: entry.soConChet > 0 ? 'var(--color-farm-red)' : 'var(--color-farm-green)' }}>{entry.soConChet} con</span></div>
                        <div className={styles.logStat}><span className={styles.logStatLabel}>Cám:</span><span className={styles.logStatValue}>{entry.kgCam} kg</span></div>
                      </div>
                      {entry.ghiChu && <div className={styles.logNote}>💬 {entry.ghiChu}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Nhật ký hàng ngày ────────────────────────── */}
      {activeTab === 1 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-md)' }}>
            <Button variant="green" onClick={() => navigate(`/owner-dashboard/batches/${batchId}/log`)}>
              <Plus size={14} /> Ghi nhật ký hôm nay
            </Button>
          </div>
          <div className={styles.logTimeline}>
            {batch.nhatKy.map((entry, i) => (
              <div key={i} className={styles.logEntry}>
                <div className={styles.logDate}>
                  📅 {entry.ngay}<br/>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>({entry.ngayTuoi} ngày tuổi)</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.logStats}>
                    <div className={styles.logStat}><span className={styles.logStatLabel}>Chết:</span><span className={styles.logStatValue} style={{ color: entry.soConChet > 0 ? 'var(--color-farm-red)' : 'var(--color-farm-green)' }}>{entry.soConChet} con</span></div>
                    <div className={styles.logStat}><span className={styles.logStatLabel}>Cám tiêu thụ:</span><span className={styles.logStatValue}>{entry.kgCam} kg</span></div>
                  </div>
                  {entry.ghiChu && <div className={styles.logNote}>💬 {entry.ghiChu}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Lịch vaccine ────────────────────────────── */}
      {activeTab === 2 && (
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>Lịch tiêm vaccine – {batch.ma}</div>
          <table className={styles.vaccineTable}>
            <thead>
              <tr>
                <th>Ngày tuổi</th>
                <th>Tên vaccine</th>
                <th>Cách dùng</th>
                <th>NCC</th>
                <th>Ngày thực hiện</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {batch.vaccine.map((v, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>Ngày {v.ngayTuoi}</td>
                  <td style={{ fontWeight: 500 }}>{v.tenVaccine}</td>
                  <td style={{ color: 'var(--color-muted)' }}>{v.loai}</td>
                  <td style={{ color: 'var(--color-muted)' }}>{v.ncc}</td>
                  <td>{v.ngayThuc}</td>
                  <td>
                    <Badge variant={v.trangThai === 'done' ? 'active' : 'warning'}>
                      {v.trangThai === 'done' ? '✓ Đã tiêm' : '⏳ Sắp tới'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Chi phí & Lãi/Lỗ ───────────────────────── */}
      {activeTab === 3 && (
        <div>
          <div className={styles.costSection}>
            {/* Chi phí */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}>Bảng chi phí</div>

              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8 }}>Con giống</p>
              <div className={styles.costTotal} style={{ marginBottom: 'var(--sp-md)' }}>
                <span>{batch.nccGiong} · {batch.soConVao.toLocaleString()} con × {batch.donGiaGiong}</span>
                <span style={{ color: 'var(--color-farm-red)', fontWeight: 700 }}>{batch.tongTienGiong}</span>
              </div>

              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8 }}>Thức ăn (Cám)</p>
              <table className={styles.costTable}>
                <thead><tr><th>Loại cám</th><th>Kg tiêu thụ</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
                <tbody>
                  {batch.chiPhi.cam.map((c, i) => (
                    <tr key={i}>
                      <td>{c.loai}</td>
                      <td style={{ textAlign: 'right' }}>{c.kgTieu.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{c.donGia.toLocaleString()}đ</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-farm-red)' }}>{c.thanh.toLocaleString()}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.costTotal}>
                <span>Tổng cám</span>
                <span style={{ color: 'var(--color-farm-red)' }}>{tongCam.toLocaleString('vi-VN')}đ</span>
              </div>

              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-muted)', margin: 'var(--sp-md) 0 8px' }}>Thuốc & Vaccine</p>
              <table className={styles.costTable}>
                <thead><tr><th>Tên</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
                <tbody>
                  {batch.chiPhi.thuoc.map((t, i) => (
                    <tr key={i}>
                      <td>{t.ten}</td>
                      <td style={{ textAlign: 'right' }}>{t.soLuong} {t.don}</td>
                      <td style={{ textAlign: 'right' }}>{t.donGia.toLocaleString()}đ</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-farm-red)' }}>{t.thanh.toLocaleString()}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.costTotal}>
                <span>Tổng thuốc + vaccine</span>
                <span style={{ color: 'var(--color-farm-red)' }}>{tongThuoc.toLocaleString('vi-VN')}đ</span>
              </div>

              <div className={styles.costTotal} style={{ background: '#fee2e2', marginTop: 'var(--sp-md)' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>TỔNG CHI PHÍ</span>
                <span style={{ color: 'var(--color-farm-red)', fontSize: 17 }}>{tongCP.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>

            {/* Lãi/Lỗ */}
            <div>
              {batch.doanhThu ? (
                <div className={`${styles.profitBox} ${styles.profitBoxGreen}`}>
                  <div className={styles.profitBoxLabel}>Lãi/Lỗ ước tính</div>
                  <div className={`${styles.profitBoxValue} ${styles.profitPos}`}>
                    +{(batch.doanhThu - tongCP).toLocaleString('vi-VN')}đ
                  </div>
                </div>
              ) : (
                <div className={styles.infoCard} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 'var(--sp-xl)' }}>
                  <div style={{ fontSize: 32, marginBottom: 'var(--sp-sm)' }}>📊</div>
                  <p style={{ fontWeight: 500, marginBottom: 8 }}>Lứa chưa xuất bán</p>
                  <p style={{ fontSize: 13 }}>Lãi/Lỗ sẽ được tính sau khi ghi nhận đợt xuất bán.</p>
                  <p style={{ fontSize: 13, marginTop: 8 }}>Chi phí tích lũy hiện tại:<br/>
                    <strong style={{ color: 'var(--color-farm-red)', fontSize: 16 }}>{tongCP.toLocaleString('vi-VN')}đ</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
