// src/features/inventory/InternalTransfer.jsx
// Quản lý Xuất nhập nội bộ — Feature 7 theo tài liệu
// Phiếu xuất cám/thuốc từ kho tổng → Chuồng cụ thể
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Plus, X, Save, ArrowRight, ArrowLeft } from 'lucide-react';
import styles from '../finance/Finance.module.css';

/* ── Mock data ──────────────────────────────────────────── */
const INIT_TRANSFERS = [
  {
    id: 'XNB-001', loai: 'xuat', // xuất kho ra chuồng
    hangHoa: 'Cám CP 511 (Giai đoạn 2)',
    soLuong: 25, donViTinh: 'bao (25kg)',
    chuong: 'Chuồng 2', maLua: 'GÀ-2024-09',
    ngay: '20/09/2026', nguoiThucHien: 'Công nhân A',
    ghiChu: 'Cấp cám cho đàn 30 ngày tuổi',
    trangThai: 'Đã xác nhận',
  },
  {
    id: 'XNB-002', loai: 'xuat',
    hangHoa: 'Vaccine ND-IB (Intervet)',
    soLuong: 4000, donViTinh: 'liều',
    chuong: 'Chuồng 3', maLua: 'GÀ-2024-10',
    ngay: '23/09/2026', nguoiThucHien: 'Công nhân B',
    ghiChu: 'Vaccine lứa 12 ngày tuổi',
    trangThai: 'Đã xác nhận',
  },
  {
    id: 'XNB-003', loai: 'xuat',
    hangHoa: 'Cám CP 512 (Giai đoạn 3)',
    soLuong: 30, donViTinh: 'bao (25kg)',
    chuong: 'Chuồng 1', maLua: 'GÀ-2024-08',
    ngay: '23/09/2026', nguoiThucHien: 'Công nhân A',
    ghiChu: '', trangThai: 'Chờ xác nhận',
  },
  {
    id: 'XNB-004', loai: 'nhap', // nhập trả về kho
    hangHoa: 'Amoxicillin + Colistin',
    soLuong: 2, donViTinh: 'lọ',
    chuong: 'Chuồng 2', maLua: 'GÀ-2024-09',
    ngay: '21/09/2026', nguoiThucHien: 'Công nhân B',
    ghiChu: 'Xuất thừa 2 lọ, nhập trả kho',
    trangThai: 'Đã xác nhận',
  },
];

const ITEMS = [
  'Cám CP 510 (Giai đoạn 1)', 'Cám CP 511 (Giai đoạn 2)', 'Cám CP 512 (Giai đoạn 3)',
  'Vaccine ND-IB (Intervet)', 'Vaccine Gumboro (Intervet)', 'Vaccine Newcastle (Merial)',
  'Amoxicillin + Colistin', 'Vitamin C + Điện giải', 'Thuốc sát trùng (Virkon)',
  'Vôi bột', 'Trấu (độn chuồng)',
];
const DVT = ['bao (25kg)', 'bao (50kg)', 'lọ', 'kg', 'lít', 'liều', 'gói'];
const CHUONG = ['Chuồng 1', 'Chuồng 2', 'Chuồng 3'];
const LUA = { 'Chuồng 1': 'GÀ-2024-08', 'Chuồng 2': 'GÀ-2024-09', 'Chuồng 3': 'GÀ-2024-10' };

/* ── Transfer Modal ─────────────────────────────────────── */
function TransferModal({ loai, onClose, onSave }) {
  const isXuat = loai === 'xuat';
  const [form, setForm] = useState({
    hangHoa: ITEMS[0], soLuong: '', donViTinh: DVT[0],
    chuong: 'Chuồng 1', ngay: new Date().toISOString().slice(0, 10),
    nguoiThucHien: '', ghiChu: '',
  });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSave = () => {
    if (!form.soLuong || parseInt(form.soLuong) <= 0) return;
    const d = form.ngay.split('-').reverse().join('/');
    onSave({
      id: `XNB-${Date.now()}`, loai,
      hangHoa: form.hangHoa, soLuong: parseInt(form.soLuong), donViTinh: form.donViTinh,
      chuong: form.chuong, maLua: LUA[form.chuong],
      ngay: d, nguoiThucHien: form.nguoiThucHien,
      ghiChu: form.ghiChu, trangThai: 'Chờ xác nhận',
    });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>
          {isXuat ? '📤 Tạo phiếu xuất kho → Chuồng' : '📥 Tạo phiếu nhập trả → Kho tổng'}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Hàng hóa *</label>
          <select className={styles.formSelect} value={form.hangHoa} onChange={set('hangHoa')}>
            {ITEMS.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>

        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Số lượng *</label>
            <input type="number" className={styles.formInput} min="1"
              placeholder="0" value={form.soLuong} onChange={set('soLuong')} autoFocus />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Đơn vị tính</label>
            <select className={styles.formSelect} value={form.donViTinh} onChange={set('donViTinh')}>
              {DVT.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{isXuat ? 'Xuất cho chuồng' : 'Từ chuồng'} *</label>
            <select className={styles.formSelect} value={form.chuong} onChange={set('chuong')}>
              {CHUONG.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ngày *</label>
            <input type="date" className={styles.formInput} value={form.ngay} onChange={set('ngay')} />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Người thực hiện</label>
          <input type="text" className={styles.formInput}
            placeholder="Tên công nhân..." value={form.nguoiThucHien} onChange={set('nguoiThucHien')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Ghi chú</label>
          <textarea className={styles.formTextarea} rows={2}
            placeholder={isXuat ? 'VD: Cấp cám giai đoạn 3 cho lứa 45 ngày...' : 'VD: Xuất thừa 2 bao, nhập trả...'}
            value={form.ghiChu} onChange={set('ghiChu')} />
        </div>

        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}><X size={14} /> Hủy</Button>
          <Button variant="green" onClick={handleSave}><Save size={14} /> Lưu phiếu</Button>
        </div>
      </div>
    </div>
  );
}

/* ── InternalTransfer ───────────────────────────────────── */
export const InternalTransfer = () => {
  const [transfers, setTransfers] = useState(INIT_TRANSFERS);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('all');

  const filtered = transfers.filter(t => {
    if (filter === 'xuat') return t.loai === 'xuat';
    if (filter === 'nhap') return t.loai === 'nhap';
    return true;
  });

  const tongXuat = transfers.filter(t => t.loai === 'xuat').length;
  const tongNhap = transfers.filter(t => t.loai === 'nhap').length;
  const choXacNhan = transfers.filter(t => t.trangThai === 'Chờ xác nhận').length;

  const confirmTransfer = (id) => {
    setTransfers(p => p.map(t => t.id === id ? { ...t, trangThai: 'Đã xác nhận' } : t));
  };

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Xuất nhập nội bộ' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Xuất nhập nội bộ</h1>
          <p className={styles.pageSub}>Cấp phát vật tư từ kho tổng → Chuồng nuôi</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => setModal('nhap')}>
            <ArrowLeft size={14} /> Phiếu nhập trả kho
          </Button>
          <Button variant="green" onClick={() => setModal('xuat')}>
            <ArrowRight size={14} /> Phiếu xuất kho → Chuồng
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng phiếu xuất kho</div>
          <div className={styles.kpiValue}>{tongXuat}</div>
          <div className={styles.kpiSub}>Cấp vật tư ra chuồng</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng phiếu nhập trả</div>
          <div className={styles.kpiValue}>{tongNhap}</div>
          <div className={styles.kpiSub}>Trả thừa về kho</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Chờ xác nhận</div>
          <div className={styles.kpiValue} style={{ color: choXacNhan > 0 ? 'var(--color-farm-orange)' : 'var(--color-farm-green)' }}>
            {choXacNhan}
          </div>
          <div className={styles.kpiSub}>Phiếu chưa xác nhận</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng phiếu</div>
          <div className={styles.kpiValue}>{transfers.length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        {[['all','Tất cả'],['xuat','Phiếu xuất kho'],['nhap','Phiếu nhập trả']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 'var(--rounded-sm)', border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            background: filter === v ? 'var(--color-farm-green)' : 'var(--color-canvas)',
            color: filter === v ? '#fff' : 'var(--color-ink)',
            borderColor: filter === v ? 'var(--color-farm-green)' : 'var(--color-hairline)',
          }}>{l}</button>
        ))}
        <span className={styles.filterCount}>{filtered.length} phiếu</span>
      </div>

      {/* Table */}
      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Ngày</th>
              <th>Loại</th>
              <th>Hàng hóa</th>
              <th style={{ textAlign:'center' }}>Số lượng</th>
              <th>Chuồng / Lứa</th>
              <th>Người thực hiện</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                  color: t.loai === 'xuat' ? 'var(--color-farm-green)' : 'var(--color-farm-orange)', whiteSpace:'nowrap' }}>
                  {t.id}
                </td>
                <td style={{ whiteSpace:'nowrap', fontSize:13, color:'var(--color-muted)' }}>{t.ngay}</td>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, fontWeight:500, color: t.loai === 'xuat' ? 'var(--color-farm-green)' : 'var(--color-farm-orange)' }}>
                    {t.loai === 'xuat' ? <ArrowRight size={13}/> : <ArrowLeft size={13}/>}
                    {t.loai === 'xuat' ? 'Xuất kho' : 'Nhập trả'}
                  </div>
                </td>
                <td style={{ fontWeight:500 }}>
                  {t.hangHoa}
                  {t.ghiChu && <div style={{ fontSize:12, color:'var(--color-muted)', marginTop:2 }}>{t.ghiChu}</div>}
                </td>
                <td style={{ textAlign:'center', fontWeight:600 }}>{t.soLuong} {t.donViTinh}</td>
                <td>
                  <div style={{ fontWeight:500 }}>{t.chuong}</div>
                  <div style={{ fontSize:12, color:'var(--color-muted)', fontFamily:'monospace' }}>{t.maLua}</div>
                </td>
                <td style={{ fontSize:13, color:'var(--color-muted)' }}>{t.nguoiThucHien}</td>
                <td>
                  <Badge variant={t.trangThai === 'Đã xác nhận' ? 'active' : 'warning'}>
                    {t.trangThai}
                  </Badge>
                </td>
                <td>
                  {t.trangThai === 'Chờ xác nhận' && (
                    <Button variant="green" size="sm" onClick={() => confirmTransfer(t.id)}>
                      Xác nhận
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <TransferModal
          loai={modal}
          onClose={() => setModal(null)}
          onSave={t => setTransfers(p => [t, ...p])}
        />
      )}
    </DashboardLayout>
  );
};
