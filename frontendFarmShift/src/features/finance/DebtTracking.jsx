// src/features/finance/DebtTracking.jsx
// Theo dõi công nợ tất cả nhà cung cấp
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { CheckCircle, AlertTriangle, X, Save } from 'lucide-react';
import styles from './Finance.module.css';

/* ── Mock data ──────────────────────────────────────────── */
const INIT_DEBTS = [
  {
    id: 'NCC-001', ten: 'Công ty CP Việt Nam', loai: 'Thức ăn chăn nuôi',
    tongNo: 18200000, daThanhToan: 0, hanThanhToan: '30/09/2026',
    lichSuThanhToan: [
      { ngay: '15/09/2026', soTien: 12000000, ghiChu: 'Trả kỳ 1 HĐ tháng 8' },
      { ngay: '01/09/2026', soTien: 8000000,  ghiChu: 'Thanh toán cám CP 510 lứa GÀ-2024-10' },
    ],
  },
  {
    id: 'NCC-003', ten: 'Cty Giống gia cầm Miền Bắc', loai: 'Con giống',
    tongNo: 12000000, daThanhToan: 0, hanThanhToan: '05/10/2026',
    lichSuThanhToan: [
      { ngay: '10/09/2026', soTien: 24000000, ghiChu: 'Thanh toán đủ giống lứa GÀ-2024-08' },
    ],
  },
  {
    id: 'NCC-002', ten: 'DS Thú y Thành Đạt', loai: 'Thuốc & Vaccine',
    tongNo: 0, daThanhToan: 8750000, hanThanhToan: '—',
    lichSuThanhToan: [
      { ngay: '20/09/2026', soTien: 8750000, ghiChu: 'Thanh toán đủ - Vaccine + Thuốc tháng 9' },
    ],
  },
  {
    id: 'NCC-004', ten: 'Cty TNHH Giống GC Hà Nội', loai: 'Con giống',
    tongNo: 0, daThanhToan: 54000000, hanThanhToan: '—',
    lichSuThanhToan: [
      { ngay: '18/09/2026', soTien: 54000000, ghiChu: 'Thanh toán giống lứa GÀ-2024-10 (Chuồng 3)' },
    ],
  },
];

/* ── Pay Modal ──────────────────────────────────────────── */
function PayModal({ supplier, onClose, onSave }) {
  const [soTien, setSoTien] = useState('');
  const [ghiChu, setGhiChu] = useState('');

  const handlePay = () => {
    const amount = parseInt(soTien.replace(/[^\d]/g, ''));
    if (!amount || amount <= 0) return;
    onSave(supplier.id, amount, ghiChu);
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>
          💳 Ghi nhận thanh toán — {supplier.ten}
        </div>
        <div style={{ background: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-sm)', padding: 'var(--sp-md)', marginBottom: 'var(--sp-md)', fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-muted)' }}>Còn nợ:</span>
            <strong style={{ color: 'var(--color-farm-red)' }}>{supplier.tongNo.toLocaleString('vi-VN')}đ</strong>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Số tiền thanh toán (đ) *</label>
          <input
            type="number"
            className={styles.formInput}
            placeholder={`Tối đa ${supplier.tongNo.toLocaleString('vi-VN')}`}
            value={soTien}
            onChange={e => setSoTien(e.target.value)}
            max={supplier.tongNo}
            min={1}
            autoFocus
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Ghi chú</label>
          <textarea
            className={styles.formTextarea}
            placeholder="VD: Trả nợ HĐ tháng 9/2026..."
            value={ghiChu}
            onChange={e => setGhiChu(e.target.value)}
            rows={2}
          />
        </div>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}><X size={14} /> Hủy</Button>
          <Button variant="green" onClick={handlePay}><Save size={14} /> Xác nhận thanh toán</Button>
        </div>
      </div>
    </div>
  );
}

/* ── DebtTracking ───────────────────────────────────────── */
export const DebtTracking = () => {
  const navigate = useNavigate();
  const [debts, setDebts] = useState(INIT_DEBTS);
  const [filter, setFilter] = useState('all');   // all | unpaid | paid
  const [paying, setPaying] = useState(null);

  const filtered = debts.filter(d => {
    if (filter === 'unpaid') return d.tongNo > 0;
    if (filter === 'paid')   return d.tongNo === 0;
    return true;
  });

  const tongConNo = debts.reduce((s, d) => s + d.tongNo, 0);
  const soNccConNo = debts.filter(d => d.tongNo > 0).length;

  const handlePay = (id, amount, ghiChu) => {
    const today = new Date().toLocaleDateString('vi-VN');
    setDebts(prev => prev.map(d => {
      if (d.id !== id) return d;
      const remaining = Math.max(0, d.tongNo - amount);
      return {
        ...d,
        tongNo: remaining,
        daThanhToan: d.daThanhToan + amount,
        hanThanhToan: remaining === 0 ? '—' : d.hanThanhToan,
        lichSuThanhToan: [{ ngay: today, soTien: amount, ghiChu }, ...d.lichSuThanhToan],
      };
    }));
  };

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Nhà cung cấp', path: '/owner-dashboard/suppliers' },
    { label: 'Theo dõi công nợ' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Theo dõi công nợ NCC</h1>
          <p className={styles.pageSub}>{soNccConNo} nhà cung cấp chưa thanh toán đủ</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => navigate('/owner-dashboard/suppliers')}>
            ← Danh sách NCC
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng còn nợ</div>
          <div className={styles.kpiValue} style={{ color: tongConNo > 0 ? 'var(--color-farm-red)' : 'var(--color-farm-green)', fontSize: 18 }}>
            {tongConNo.toLocaleString('vi-VN')}đ
          </div>
          <div className={styles.kpiSub}>{soNccConNo} NCC</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Đã thanh toán (tổng)</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-green)', fontSize: 18 }}>
            {debts.reduce((s,d) => s + d.daThanhToan, 0).toLocaleString('vi-VN')}đ
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>NCC đã trả đủ</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-green)' }}>
            {debts.filter(d => d.tongNo === 0).length} / {debts.length}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Đến hạn sớm nhất</div>
          <div className={styles.kpiValue} style={{ fontSize: 15 }}>
            {debts.filter(d => d.tongNo > 0 && d.hanThanhToan !== '—').sort((a,b) => a.hanThanhToan.localeCompare(b.hanThanhToan))[0]?.hanThanhToan ?? '—'}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        {[['all','Tất cả'],['unpaid','Còn nợ'],['paid','Đã trả đủ']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 'var(--rounded-sm)', border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            background: filter === v ? 'var(--color-farm-green)' : 'var(--color-canvas)',
            color: filter === v ? '#fff' : 'var(--color-ink)',
            borderColor: filter === v ? 'var(--color-farm-green)' : 'var(--color-hairline)',
          }}>{l}</button>
        ))}
      </div>

      {/* Debt cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
        {filtered.map(d => {
          const pct = d.daThanhToan + d.tongNo > 0
            ? Math.round((d.daThanhToan / (d.daThanhToan + d.tongNo)) * 100)
            : 100;
          const isPaid = d.tongNo === 0;

          return (
            <div key={d.id} className={styles.infoCard} style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-md)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-ink)', marginBottom: 3 }}>{d.ten}</div>
                  <Badge variant="inactive">{d.loai}</Badge>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {isPaid
                    ? <div style={{ display:'flex', alignItems:'center', gap: 6, color: 'var(--color-farm-green)', fontWeight: 600 }}><CheckCircle size={16}/> Đã thanh toán đủ</div>
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <div style={{ color: 'var(--color-farm-red)', fontWeight: 700, fontSize: 15 }}>
                          <AlertTriangle size={14} style={{ display: 'inline', marginRight: 4 }} />
                          Còn nợ: {d.tongNo.toLocaleString('vi-VN')}đ
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Hạn: {d.hanThanhToan}</div>
                        <Button variant="green" size="sm" onClick={() => setPaying(d)}>
                          💳 Thanh toán
                        </Button>
                      </div>
                    )
                  }
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 'var(--sp-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>
                  <span>Đã thanh toán: {d.daThanhToan.toLocaleString('vi-VN')}đ</span>
                  <span>{pct}%</span>
                </div>
                <div className={styles.debtBar}>
                  <div className={`${styles.debtBarFill} ${!isPaid && pct < 50 ? styles.debtBarFillDanger : ''}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Lịch sử thanh toán */}
              {d.lichSuThanhToan.length > 0 && (
                <div style={{ marginTop: 'var(--sp-sm)', borderTop: '1px solid var(--color-hairline)', paddingTop: 'var(--sp-sm)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 6 }}>LỊCH SỬ THANH TOÁN</div>
                  {d.lichSuThanhToan.slice(0, 3).map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: i < d.lichSuThanhToan.slice(0,3).length - 1 ? '1px solid var(--color-hairline)' : 'none' }}>
                      <span style={{ color: 'var(--color-muted)' }}>{h.ngay} · {h.ghiChu}</span>
                      <span style={{ color: 'var(--color-farm-green)', fontWeight: 600 }}>{h.soTien.toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {paying && (
        <PayModal
          supplier={paying}
          onClose={() => setPaying(null)}
          onSave={handlePay}
        />
      )}
    </DashboardLayout>
  );
};
