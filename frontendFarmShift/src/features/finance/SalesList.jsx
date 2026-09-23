// src/features/finance/SalesList.jsx
// Quản lý đợt xuất bán gà — liên kết với lứa nuôi
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Plus, X, Save, Camera, ScanLine } from 'lucide-react';
import { OcrUploadModal } from '../ocr/OcrUploadModal';
import styles from './Finance.module.css';

/* ── Mock data ──────────────────────────────────────────── */
const INIT_SALES = [
  {
    id: 'XB-001', maLua: 'GÀ-2024-07', chuong: 'Chuồng 1',
    ngayBan: '05/07/2026', khachHang: 'Anh Hùng (Thương lái)',
    soConXuat: 1850, tongKg: 3700, donGia: 17000,
    tongTien: 62900000, trangThai: 'Đã thu tiền',
    coAnhPhieu: true,
  },
  {
    id: 'XB-002', maLua: 'GÀ-2024-06', chuong: 'Chuồng 3',
    ngayBan: '05/08/2026', khachHang: 'Chị Lan (Chợ đầu mối)',
    soConXuat: 3870, tongKg: 8514, donGia: 15500,
    tongTien: 131967000, trangThai: 'Đã thu tiền',
    coAnhPhieu: true,
  },
  {
    id: 'XB-003', maLua: 'GÀ-2024-05', chuong: 'Chuồng 2',
    ngayBan: '20/07/2026', khachHang: 'Anh Đức (Nhà hàng)',
    soConXuat: 1960, tongKg: 4312, donGia: 16800,
    tongTien: 72441600, trangThai: 'Chờ thanh toán',
    coAnhPhieu: false,
  },
];

/* ── Add Sale Modal ─────────────────────────────────────── */
function AddSaleModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    maLua: 'GÀ-2024-08', chuong: 'Chuồng 1',
    ngayBan: '', khachHang: '',
    soConXuat: '', tongKg: '', donGia: '',
  });
  const [showOcr, setShowOcr] = useState(false);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const tongTien = (parseInt(form.tongKg) || 0) * (parseInt(form.donGia) || 0);

  const handleSave = () => {
    if (!form.khachHang || !form.tongKg || !form.donGia) return;
    onSave({
      ...form,
      id: `XB-${Date.now()}`,
      tongTien,
      soConXuat: parseInt(form.soConXuat) || 0,
      tongKg: parseInt(form.tongKg),
      donGia: parseInt(form.donGia),
      trangThai: 'Chờ thanh toán',
      coAnhPhieu: false,
    });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>📋 Ghi nhận đợt xuất bán gà</div>

        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Lứa xuất bán *</label>
            <select className={styles.formSelect} value={form.maLua} onChange={set('maLua')}>
              <option value="GÀ-2024-08">GÀ-2024-08 – Chuồng 1</option>
              <option value="GÀ-2024-09">GÀ-2024-09 – Chuồng 2</option>
              <option value="GÀ-2024-10">GÀ-2024-10 – Chuồng 3</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ngày bán *</label>
            <input type="date" className={styles.formInput} value={form.ngayBan} onChange={set('ngayBan')} required />
          </div>
          <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
            <label className={styles.formLabel}>Khách hàng *</label>
            <select className={styles.formSelect} value={form.khachHang} onChange={set('khachHang')}>
              <option value="">-- Chọn khách hàng --</option>
              <option>Anh Hùng (Thương lái)</option>
              <option>Chị Lan (Chợ đầu mối)</option>
              <option>Cty TNHH Thực phẩm Sao Vàng</option>
              <option>Anh Đức (Nhà hàng)</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Số con xuất</label>
            <input type="number" className={styles.formInput} placeholder="0" value={form.soConXuat} onChange={set('soConXuat')} min="0" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tổng kg *</label>
            <input type="number" className={styles.formInput} placeholder="0" value={form.tongKg} onChange={set('tongKg')} min="0" step="0.1" required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Đơn giá (đ/kg) *</label>
            <input type="number" className={styles.formInput} placeholder="VD: 17000" value={form.donGia} onChange={set('donGia')} min="0" required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tổng tiền (tự tính)</label>
            <div style={{ padding: '8px 12px', background: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-sm)', fontWeight: 700, color: 'var(--color-farm-green)', fontSize: 16 }}>
              {tongTien.toLocaleString('vi-VN')}đ
            </div>
          </div>
        </div>

        {/* OCR hint -> OCR Action */}
        <div 
          onClick={() => setShowOcr(true)}
          style={{ cursor: 'pointer', background: 'var(--color-farm-green-light)', border: '1px solid var(--color-farm-green)', borderRadius: 'var(--rounded-sm)', padding: 'var(--sp-md)', marginBottom: 'var(--sp-md)', fontSize: 13, color: 'var(--color-farm-green)', display: 'flex', gap: 'var(--sp-sm)', alignItems: 'center', transition: 'all 0.2s' }}
        >
          <ScanLine size={16} />
          <span>Bạn có phiếu bán A4? <strong>Bấm vào đây để Scan bằng AI OCR</strong> (Tự động điền).</span>
        </div>

        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}><X size={14} /> Hủy</Button>
          <Button variant="green" onClick={handleSave}><Save size={14} /> Lưu đợt bán</Button>
        </div>
      </div>

      {showOcr && (
        <OcrUploadModal
          type="sale"
          onClose={() => setShowOcr(false)}
          onConfirm={(data) => {
            setForm(prev => ({
              ...prev,
              khachHang: data.khachHang,
              soLong: data.soLong,
              soCon: data.soCon,
              tongKg: data.tongKg,
              donGia: data.donGia,
            }));
          }}
        />
      )}
    </div>
  );
}

/* ── SalesList ──────────────────────────────────────────── */
export const SalesList = () => {
  const navigate  = useNavigate();
  const [sales, setSales] = useState(INIT_SALES);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter]       = useState('all');

  const filtered = sales.filter(s => {
    if (filter === 'paid')    return s.trangThai === 'Đã thu tiền';
    if (filter === 'pending') return s.trangThai === 'Chờ thanh toán';
    return true;
  });

  const tongDoanhThu = sales.reduce((s, x) => s + x.tongTien, 0);
  const tongKg       = sales.reduce((s, x) => s + x.tongKg, 0);
  const tongCon      = sales.reduce((s, x) => s + x.soConXuat, 0);
  const choThu       = sales.filter(x => x.trangThai === 'Chờ thanh toán').reduce((s, x) => s + x.tongTien, 0);

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Bán gà' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Quản lý xuất bán gà</h1>
          <p className={styles.pageSub}>{sales.length} đợt bán · Tổng {tongCon.toLocaleString('vi-VN')} con / {tongKg.toLocaleString('vi-VN')} kg</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="green" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Ghi nhận đợt bán
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng doanh thu</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-green)', fontSize: 18 }}>
            {tongDoanhThu.toLocaleString('vi-VN')}đ
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Chờ thu tiền</div>
          <div className={styles.kpiValue} style={{ color: choThu > 0 ? 'var(--color-farm-orange)' : 'var(--color-farm-green)', fontSize: 18 }}>
            {choThu > 0 ? `${choThu.toLocaleString('vi-VN')}đ` : 'Đã thu đủ'}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng kg đã bán</div>
          <div className={styles.kpiValue}>{tongKg.toLocaleString('vi-VN')} kg</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Giá trung bình</div>
          <div className={styles.kpiValue} style={{ fontSize: 16 }}>
            {tongKg > 0 ? Math.round(tongDoanhThu / tongKg).toLocaleString('vi-VN') : 0}đ/kg
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        {[['all','Tất cả'],['paid','Đã thu tiền'],['pending','Chờ thanh toán']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 'var(--rounded-sm)', border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            background: filter === v ? 'var(--color-farm-green)' : 'var(--color-canvas)',
            color: filter === v ? '#fff' : 'var(--color-ink)',
            borderColor: filter === v ? 'var(--color-farm-green)' : 'var(--color-hairline)',
          }}>{l}</button>
        ))}
        <span className={styles.filterCount}>{filtered.length} đợt bán</span>
      </div>

      {/* Table */}
      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Mã đợt bán</th>
              <th>Lứa / Chuồng</th>
              <th>Ngày bán</th>
              <th>Khách hàng</th>
              <th style={{ textAlign:'center' }}>Số con</th>
              <th style={{ textAlign:'center' }}>Tổng kg</th>
              <th style={{ textAlign:'right' }}>Đơn giá</th>
              <th style={{ textAlign:'right' }}>Tổng tiền</th>
              <th>Phiếu</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className={styles.tableRow}
                onClick={() => navigate(`/owner-dashboard/batches/${s.maLua}`)}>
                <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-farm-green)', whiteSpace: 'nowrap' }}>{s.id}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{s.maLua}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{s.chuong}</div>
                </td>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--color-muted)' }}>{s.ngayBan}</td>
                <td style={{ fontWeight: 500 }}>{s.khachHang}</td>
                <td style={{ textAlign: 'center' }}>{s.soConXuat.toLocaleString('vi-VN')}</td>
                <td style={{ textAlign: 'center', fontWeight: 500 }}>{s.tongKg.toLocaleString('vi-VN')} kg</td>
                <td style={{ textAlign: 'right' }}>{s.donGia.toLocaleString('vi-VN')}đ</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-farm-green)', whiteSpace: 'nowrap' }}>
                  {s.tongTien.toLocaleString('vi-VN')}đ
                </td>
                <td style={{ textAlign: 'center' }}>
                  {s.coAnhPhieu
                    ? <span title="Có ảnh phiếu bán" style={{ cursor: 'default' }}>📄</span>
                    : <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>—</span>
                  }
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <Badge variant={s.trangThai === 'Đã thu tiền' ? 'active' : 'warning'}>
                    {s.trangThai}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddSaleModal
          onClose={() => setShowModal(false)}
          onSave={s => setSales(p => [s, ...p])}
        />
      )}
    </DashboardLayout>
  );
};
