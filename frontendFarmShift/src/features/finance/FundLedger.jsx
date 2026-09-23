// src/features/finance/FundLedger.jsx
// Sổ quỹ tiền mặt — Phiếu thu / Phiếu chi / Số dư
// Feature 3 theo tài liệu: Cash & Fund Management
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Plus, TrendingUp, TrendingDown, X, Save } from 'lucide-react';
import styles from './Finance.module.css';

/* ── Loại thu/chi ────────────────────────────────────────── */
const LOAI_THU = [
  'Thu bán gà', 'Thu nợ thương lái', 'Thu hồi vốn', 'Thu khác',
];
const LOAI_CHI = [
  'Chi mua cám', 'Chi mua thuốc/vaccine', 'Chi mua con giống',
  'Chi lương nhân công', 'Chi tiền điện', 'Chi tiền nước',
  'Chi trả nợ NCC', 'Chi phí vận chuyển', 'Chi khác',
];

/* ── Mock data sổ quỹ ───────────────────────────────────── */
const INIT_LEDGER = [
  {
    id: 'PT-001', loai: 'thu', tenLoai: 'Thu bán gà',
    moTa: 'Bán lứa GÀ-2024-07 – Chuồng 1 | Anh Hùng (Thương lái)',
    soTien: 62900000, ngay: '05/07/2026', nguoiThucHien: 'Nguyễn Văn Chủ',
    trangThai: 'Đã ghi sổ', lienKet: 'XB-001',
  },
  {
    id: 'PC-001', loai: 'chi', tenLoai: 'Chi mua cám',
    moTa: 'Mua cám CP 511 – 100 bao | Cty CP Việt Nam | Chuồng 1 & 2',
    soTien: 9000000, ngay: '12/08/2026', nguoiThucHien: 'Trần Thị Kế Toán',
    trangThai: 'Đã ghi sổ', lienKet: null,
  },
  {
    id: 'PT-002', loai: 'thu', tenLoai: 'Thu bán gà',
    moTa: 'Bán lứa GÀ-2024-06 – Chuồng 3 | Chị Lan (Chợ đầu mối)',
    soTien: 131967000, ngay: '05/08/2026', nguoiThucHien: 'Nguyễn Văn Chủ',
    trangThai: 'Đã ghi sổ', lienKet: 'XB-002',
  },
  {
    id: 'PC-002', loai: 'chi', tenLoai: 'Chi trả nợ NCC',
    moTa: 'Trả nợ Cty CP Việt Nam – HĐ tháng 8/2026',
    soTien: 12000000, ngay: '15/09/2026', nguoiThucHien: 'Trần Thị Kế Toán',
    trangThai: 'Đã ghi sổ', lienKet: null,
  },
  {
    id: 'PC-003', loai: 'chi', tenLoai: 'Chi mua con giống',
    moTa: 'Mua 4,000 con giống lứa GÀ-2024-10 – Chuồng 3 | Cty TNHH Giống GC Hà Nội',
    soTien: 54000000, ngay: '12/09/2026', nguoiThucHien: 'Nguyễn Văn Chủ',
    trangThai: 'Đã ghi sổ', lienKet: null,
  },
  {
    id: 'PC-004', loai: 'chi', tenLoai: 'Chi lương nhân công',
    moTa: 'Lương tháng 9/2026 – 3 công nhân',
    soTien: 18000000, ngay: '30/09/2026', nguoiThucHien: 'Trần Thị Kế Toán',
    trangThai: 'Đã ghi sổ', lienKet: null,
  },
  {
    id: 'PC-005', loai: 'chi', tenLoai: 'Chi tiền điện',
    moTa: 'Tiền điện tháng 9/2026 – Quạt thông gió + đèn sưởi',
    soTien: 4500000, ngay: '28/09/2026', nguoiThucHien: 'Nguyễn Văn Chủ',
    trangThai: 'Đã ghi sổ', lienKet: null,
  },
  {
    id: 'PC-006', loai: 'chi', tenLoai: 'Chi mua cám',
    moTa: 'Mua cám CP 512 – 80 bao | Chuồng 3 giai đoạn 1',
    soTien: 7200000, ngay: '20/09/2026', nguoiThucHien: 'Trần Thị Kế Toán',
    trangThai: 'Đã ghi sổ', lienKet: null,
  },
];

/* ── Voucher Modal ──────────────────────────────────────── */
function VoucherModal({ type, onClose, onSave }) {
  const isThu = type === 'thu';
  const [form, setForm] = useState({
    loai: isThu ? LOAI_THU[0] : LOAI_CHI[0],
    moTa: '', soTien: '', ngay: new Date().toISOString().slice(0, 10),
    nguoiThucHien: '',
  });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSave = () => {
    const amount = parseInt(form.soTien);
    if (!amount || amount <= 0 || !form.moTa) return;
    const prefix = isThu ? 'PT' : 'PC';
    const d = form.ngay.split('-').reverse().join('/');
    onSave({
      id: `${prefix}-${Date.now()}`,
      loai: type, tenLoai: form.loai,
      moTa: form.moTa, soTien: amount,
      ngay: d, nguoiThucHien: form.nguoiThucHien,
      trangThai: 'Đã ghi sổ', lienKet: null,
    });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>
          {isThu ? '📥 Tạo phiếu thu' : '📤 Tạo phiếu chi'}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Loại {isThu ? 'thu' : 'chi'} *</label>
          <select className={styles.formSelect} value={form.loai} onChange={set('loai')}>
            {(isThu ? LOAI_THU : LOAI_CHI).map(l => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Mô tả chi tiết *</label>
          <textarea
            className={styles.formTextarea}
            placeholder={isThu
              ? 'VD: Bán lứa GÀ-2024-08 – Anh Hùng (Thương lái)...'
              : 'VD: Mua cám CP 511 – 50 bao | Cty CP Việt Nam...'}
            value={form.moTa} onChange={set('moTa')} rows={2} autoFocus />
        </div>

        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Số tiền (đ) *</label>
            <input type="number" className={styles.formInput}
              placeholder="0" min="1" value={form.soTien} onChange={set('soTien')} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ngày *</label>
            <input type="date" className={styles.formInput} value={form.ngay} onChange={set('ngay')} />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Người thực hiện</label>
          <input type="text" className={styles.formInput}
            placeholder="Tên người lập phiếu..." value={form.nguoiThucHien} onChange={set('nguoiThucHien')} />
        </div>

        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}><X size={14} /> Hủy</Button>
          <Button variant={isThu ? 'green' : 'danger'} onClick={handleSave}>
            <Save size={14} /> Lưu phiếu {isThu ? 'thu' : 'chi'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── FundLedger ─────────────────────────────────────────── */
export const FundLedger = () => {
  const [ledger, setLedger] = useState(INIT_LEDGER);
  const [modal, setModal] = useState(null); // 'thu' | 'chi' | null
  const [filter, setFilter] = useState('all');

  // Sort newest first
  const sorted = [...ledger].sort((a, b) => {
    const toMs = d => new Date(d.ngay.split('/').reverse().join('-')).getTime();
    return toMs(b) - toMs(a);
  });
  const filtered = sorted.filter(t => {
    if (filter === 'thu') return t.loai === 'thu';
    if (filter === 'chi') return t.loai === 'chi';
    return true;
  });

  const tongThu   = ledger.filter(t => t.loai === 'thu').reduce((s, t) => s + t.soTien, 0);
  const tongChi   = ledger.filter(t => t.loai === 'chi').reduce((s, t) => s + t.soTien, 0);
  const soDu      = tongThu - tongChi;

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Sổ quỹ tiền mặt' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Sổ quỹ tiền mặt</h1>
          <p className={styles.pageSub}>{ledger.length} giao dịch · Số dư hiện tại</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => setModal('chi')}>
            <TrendingDown size={14} /> Lập phiếu chi
          </Button>
          <Button variant="green" onClick={() => setModal('thu')}>
            <TrendingUp size={14} /> Lập phiếu thu
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard} style={{ borderLeft: '4px solid var(--color-farm-green)' }}>
          <div className={styles.kpiLabel}>Tổng thu</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-green)', fontSize: 18 }}>
            +{tongThu.toLocaleString('vi-VN')}đ
          </div>
          <div className={styles.kpiSub}>{ledger.filter(t => t.loai === 'thu').length} phiếu thu</div>
        </div>
        <div className={styles.kpiCard} style={{ borderLeft: '4px solid var(--color-farm-red)' }}>
          <div className={styles.kpiLabel}>Tổng chi</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-red)', fontSize: 18 }}>
            -{tongChi.toLocaleString('vi-VN')}đ
          </div>
          <div className={styles.kpiSub}>{ledger.filter(t => t.loai === 'chi').length} phiếu chi</div>
        </div>
        <div className={styles.kpiCard}
          style={{ borderLeft: `4px solid ${soDu >= 0 ? 'var(--color-farm-green)' : 'var(--color-farm-red)'}`, gridColumn: 'span 2' }}>
          <div className={styles.kpiLabel}>SỐ DƯ QUỸ TIỀN MẶT HIỆN TẠI</div>
          <div style={{
            fontSize: 28, fontWeight: 800, lineHeight: 1.1,
            color: soDu >= 0 ? 'var(--color-farm-green)' : 'var(--color-farm-red)',
          }}>
            {soDu >= 0 ? '+' : ''}{soDu.toLocaleString('vi-VN')}đ
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className={styles.filterBar}>
        {[['all','Tất cả'],['thu','Phiếu thu'],['chi','Phiếu chi']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 'var(--rounded-sm)', border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            background: filter === v ? 'var(--color-farm-green)' : 'var(--color-canvas)',
            color: filter === v ? '#fff' : 'var(--color-ink)',
            borderColor: filter === v ? 'var(--color-farm-green)' : 'var(--color-hairline)',
          }}>{l}</button>
        ))}
        <span className={styles.filterCount}>{filtered.length} giao dịch</span>
      </div>

      {/* Table */}
      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Ngày</th>
              <th>Loại</th>
              <th>Mô tả</th>
              <th>Người lập</th>
              <th style={{ textAlign:'right' }}>Số tiền</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                  color: t.loai === 'thu' ? 'var(--color-farm-green)' : 'var(--color-farm-red)', whiteSpace: 'nowrap' }}>
                  {t.id}
                </td>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--color-muted)', fontSize: 13 }}>{t.ngay}</td>
                <td>
                  <Badge variant={t.loai === 'thu' ? 'active' : 'warning'}>{t.tenLoai}</Badge>
                </td>
                <td style={{ maxWidth: 340, fontSize: 13 }}>{t.moTa}</td>
                <td style={{ fontSize: 13, color: 'var(--color-muted)' }}>{t.nguoiThucHien}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap',
                  color: t.loai === 'thu' ? 'var(--color-farm-green)' : 'var(--color-farm-red)',
                  fontSize: 15 }}>
                  {t.loai === 'thu' ? '+' : '-'}{t.soTien.toLocaleString('vi-VN')}đ
                </td>
                <td><Badge variant="inactive">{t.trangThai}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <VoucherModal
          type={modal}
          onClose={() => setModal(null)}
          onSave={v => { setLedger(p => [v, ...p]); }}
        />
      )}
    </DashboardLayout>
  );
};
