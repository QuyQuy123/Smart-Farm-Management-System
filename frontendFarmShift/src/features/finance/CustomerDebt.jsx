// src/features/finance/CustomerDebt.jsx
// Công nợ khách hàng / Thương lái mua gà
// Feature 9 – Customer Debt Management (khác với NCC Debt)
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { CheckCircle, AlertTriangle, X, Save } from 'lucide-react';
import styles from './Finance.module.css';

/* ── Mock data ──────────────────────────────────────────── */
const INIT_RECEIVABLES = [
  {
    id: 'KH-003', ten: 'Cty TNHH Thực phẩm Sao Vàng',
    tongDoanhThu: 129200000, daThanhToan: 90000000, conNo: 39200000,
    hanThanhToan: '10/10/2026',
    lichSuThu: [
      { ngay: '15/09/2026', soTien: 50000000, ghiChu: 'Thu cọc + kỳ 1' },
      { ngay: '20/09/2026', soTien: 40000000, ghiChu: 'Thu kỳ 2' },
    ],
  },
  {
    id: 'KH-004', ten: 'Anh Đức (Nhà hàng)',
    tongDoanhThu: 72441600, daThanhToan: 50000000, conNo: 22441600,
    hanThanhToan: '05/10/2026',
    lichSuThu: [
      { ngay: '22/07/2026', soTien: 50000000, ghiChu: 'Thu tiền cọc trước' },
    ],
  },
  {
    id: 'KH-001', ten: 'Anh Hùng (Thương lái)',
    tongDoanhThu: 62900000, daThanhToan: 62900000, conNo: 0,
    hanThanhToan: '—',
    lichSuThu: [
      { ngay: '06/07/2026', soTien: 62900000, ghiChu: 'Thu đủ ngay sau khi bắt gà' },
    ],
  },
  {
    id: 'KH-002', ten: 'Chị Lan (Chợ đầu mối)',
    tongDoanhThu: 131967000, daThanhToan: 131967000, conNo: 0,
    hanThanhToan: '—',
    lichSuThu: [
      { ngay: '06/08/2026', soTien: 131967000, ghiChu: 'Chuyển khoản đủ' },
    ],
  },
];

/* ── Collect Modal ──────────────────────────────────────── */
function CollectModal({ customer, onClose, onSave }) {
  const [soTien, setSoTien] = useState('');
  const [ghiChu, setGhiChu] = useState('');

  const handleSave = () => {
    const amount = parseInt(soTien);
    if (!amount || amount <= 0) return;
    onSave(customer.id, amount, ghiChu);
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>📥 Thu nợ — {customer.ten}</div>
        <div style={{ background: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-sm)', padding: 'var(--sp-md)', marginBottom: 'var(--sp-md)', fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-muted)' }}>Còn nợ:</span>
            <strong style={{ color: 'var(--color-farm-red)' }}>{customer.conNo.toLocaleString('vi-VN')}đ</strong>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Số tiền thu (đ) *</label>
          <input type="number" className={styles.formInput}
            placeholder={`Tối đa ${customer.conNo.toLocaleString('vi-VN')}`}
            value={soTien} onChange={e => setSoTien(e.target.value)}
            max={customer.conNo} min={1} autoFocus />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Ghi chú</label>
          <textarea className={styles.formTextarea} rows={2}
            placeholder="VD: Thu nợ đợt bán gà tháng 9..."
            value={ghiChu} onChange={e => setGhiChu(e.target.value)} />
        </div>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}><X size={14}/> Hủy</Button>
          <Button variant="green" onClick={handleSave}><Save size={14}/> Xác nhận thu</Button>
        </div>
      </div>
    </div>
  );
}

/* ── CustomerDebt ───────────────────────────────────────── */
export const CustomerDebt = () => {
  const [receivables, setReceivables] = useState(INIT_RECEIVABLES);
  const [filter, setFilter] = useState('all');
  const [collecting, setCollecting] = useState(null);

  const filtered = receivables.filter(r => {
    if (filter === 'unpaid') return r.conNo > 0;
    if (filter === 'paid')   return r.conNo === 0;
    return true;
  });

  const tongConNo     = receivables.reduce((s, r) => s + r.conNo, 0);
  const tongDaThanhToan = receivables.reduce((s, r) => s + r.daThanhToan, 0);

  const handleCollect = (id, amount, ghiChu) => {
    const today = new Date().toLocaleDateString('vi-VN');
    setReceivables(prev => prev.map(r => {
      if (r.id !== id) return r;
      const remaining = Math.max(0, r.conNo - amount);
      return {
        ...r, conNo: remaining,
        daThanhToan: r.daThanhToan + amount,
        hanThanhToan: remaining === 0 ? '—' : r.hanThanhToan,
        lichSuThu: [{ ngay: today, soTien: amount, ghiChu }, ...r.lichSuThu],
      };
    }));
  };

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Công nợ khách hàng' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Công nợ khách hàng</h1>
          <p className={styles.pageSub}>
            {receivables.filter(r => r.conNo > 0).length} thương lái còn nợ tiền gà
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Còn phải thu</div>
          <div className={styles.kpiValue} style={{ color: tongConNo > 0 ? 'var(--color-farm-red)' : 'var(--color-farm-green)', fontSize: 18 }}>
            {tongConNo.toLocaleString('vi-VN')}đ
          </div>
          <div className={styles.kpiSub}>{receivables.filter(r=>r.conNo>0).length} khách nợ</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Đã thu được</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-green)', fontSize: 18 }}>
            {tongDaThanhToan.toLocaleString('vi-VN')}đ
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng doanh thu KH</div>
          <div className={styles.kpiValue} style={{ fontSize: 18 }}>
            {receivables.reduce((s,r)=>s+r.tongDoanhThu,0).toLocaleString('vi-VN')}đ
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>KH đã thu đủ</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-green)' }}>
            {receivables.filter(r=>r.conNo===0).length} / {receivables.length}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        {[['all','Tất cả'],['unpaid','Còn nợ'],['paid','Đã thu đủ']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 'var(--rounded-sm)', border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            background: filter === v ? 'var(--color-farm-green)' : 'var(--color-canvas)',
            color: filter === v ? '#fff' : 'var(--color-ink)',
            borderColor: filter === v ? 'var(--color-farm-green)' : 'var(--color-hairline)',
          }}>{l}</button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
        {filtered.map(r => {
          const pct = r.daThanhToan + r.conNo > 0
            ? Math.round((r.daThanhToan / (r.daThanhToan + r.conNo)) * 100) : 100;
          const isPaid = r.conNo === 0;
          return (
            <div key={r.id} className={styles.infoCard} style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-md)' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-ink)' }}>{r.ten}</div>
                {isPaid
                  ? <div style={{ display:'flex', alignItems:'center', gap:6, color:'var(--color-farm-green)', fontWeight:600 }}><CheckCircle size={16}/> Đã thu đủ</div>
                  : <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                      <div style={{ color:'var(--color-farm-red)', fontWeight:700 }}>
                        <AlertTriangle size={14} style={{ display:'inline', marginRight:4 }}/>
                        Còn nợ: {r.conNo.toLocaleString('vi-VN')}đ
                      </div>
                      <div style={{ fontSize:12, color:'var(--color-muted)' }}>Hạn: {r.hanThanhToan}</div>
                      <Button variant="green" size="sm" onClick={() => setCollecting(r)}>
                        📥 Thu nợ
                      </Button>
                    </div>
                }
              </div>

              <div style={{ marginBottom:'var(--sp-sm)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--color-muted)', marginBottom:4 }}>
                  <span>Đã thu: {r.daThanhToan.toLocaleString('vi-VN')}đ</span>
                  <span>{pct}%</span>
                </div>
                <div className={styles.debtBar}>
                  <div className={styles.debtBarFill} style={{ width:`${pct}%` }} />
                </div>
              </div>

              {r.lichSuThu.length > 0 && (
                <div style={{ borderTop:'1px solid var(--color-hairline)', paddingTop:'var(--sp-sm)', marginTop:'var(--sp-sm)' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--color-muted)', marginBottom:6 }}>LỊCH SỬ THU TIỀN</div>
                  {r.lichSuThu.slice(0,3).map((h,i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0', borderBottom: i < 2 ? '1px solid var(--color-hairline)' : 'none' }}>
                      <span style={{ color:'var(--color-muted)' }}>{h.ngay} · {h.ghiChu}</span>
                      <span style={{ color:'var(--color-farm-green)', fontWeight:600 }}>{h.soTien.toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {collecting && (
        <CollectModal
          customer={collecting}
          onClose={() => setCollecting(null)}
          onSave={handleCollect}
        />
      )}
    </DashboardLayout>
  );
};
