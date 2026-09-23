// src/features/finance/CustomerList.jsx
// Danh sách khách hàng mua gà
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Plus, X, Save, Phone, MapPin } from 'lucide-react';
import styles from './Finance.module.css';

/* ── Mock data ──────────────────────────────────────────── */
const INIT_CUSTOMERS = [
  {
    id: 'KH-001', ten: 'Anh Hùng (Thương lái)',
    dienThoai: '0971234567', diaChi: 'Thái Nguyên',
    soLanMua: 4, tongKgMua: 14800, tongTienMua: 251600000,
    luaGanNhat: 'GÀ-2024-07', trangThai: 'active',
  },
  {
    id: 'KH-002', ten: 'Chị Lan (Chợ đầu mối)',
    dienThoai: '0982345678', diaChi: 'Hà Nội',
    soLanMua: 6, tongKgMua: 22400, tongTienMua: 358400000,
    luaGanNhat: 'GÀ-2024-06', trangThai: 'active',
  },
  {
    id: 'KH-003', ten: 'Cty TNHH Thực phẩm Sao Vàng',
    dienThoai: '02432345678', diaChi: 'Cầu Giấy, Hà Nội',
    soLanMua: 2, tongKgMua: 7600, tongTienMua: 129200000,
    luaGanNhat: 'GÀ-2024-04', trangThai: 'active',
  },
  {
    id: 'KH-004', ten: 'Anh Đức (Nhà hàng)',
    dienThoai: '0943456789', diaChi: 'Sóc Sơn, Hà Nội',
    soLanMua: 3, tongKgMua: 4200, tongTienMua: 71400000,
    luaGanNhat: 'GÀ-2024-05', trangThai: 'active',
  },
];

/* ── Add Customer Modal ─────────────────────────────────── */
function AddCustomerModal({ onClose, onSave }) {
  const [form, setForm] = useState({ ten: '', dienThoai: '', diaChi: '', ghiChu: '' });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const handleSave = () => {
    if (!form.ten.trim()) return;
    onSave({ ...form, id: `KH-${Date.now()}`, soLanMua: 0, tongKgMua: 0, tongTienMua: 0, luaGanNhat: '—', trangThai: 'active' });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>Thêm khách hàng mới</div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Tên khách hàng *</label>
          <input className={styles.formInput} placeholder="VD: Anh Hùng (Thương lái)" value={form.ten} onChange={set('ten')} autoFocus />
        </div>
        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Điện thoại</label>
            <input className={styles.formInput} placeholder="0901234567" value={form.dienThoai} onChange={set('dienThoai')} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Địa chỉ</label>
            <input className={styles.formInput} placeholder="Tỉnh/Thành phố" value={form.diaChi} onChange={set('diaChi')} />
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Ghi chú</label>
          <textarea className={styles.formTextarea} placeholder="Thương lái, nhà hàng, chợ đầu mối..." value={form.ghiChu} onChange={set('ghiChu')} rows={2} />
        </div>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}><X size={14} /> Hủy</Button>
          <Button variant="green" onClick={handleSave}><Save size={14} /> Lưu</Button>
        </div>
      </div>
    </div>
  );
}

/* ── CustomerList ───────────────────────────────────────── */
export const CustomerList = () => {
  const [customers, setCustomers] = useState(INIT_CUSTOMERS);
  const [showModal, setShowModal] = useState(false);

  const tongDoanhThu = customers.reduce((s, c) => s + c.tongTienMua, 0);
  const tongKg       = customers.reduce((s, c) => s + c.tongKgMua, 0);

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Khách hàng' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Danh sách khách hàng</h1>
          <p className={styles.pageSub}>{customers.length} khách hàng · Tổng {tongKg.toLocaleString('vi-VN')} kg đã mua</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="green" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Thêm khách hàng
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng khách hàng</div>
          <div className={styles.kpiValue}>{customers.length}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng doanh thu</div>
          <div className={styles.kpiValue} style={{ fontSize: 16, color: 'var(--color-farm-green)' }}>{tongDoanhThu.toLocaleString('vi-VN')}đ</div>
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

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--sp-md)' }}>
        {customers.map(c => (
          <div key={c.id} className={styles.infoCard} style={{ marginBottom: 0, cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-sm)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-ink)', marginBottom: 4 }}>{c.ten}</div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', display: 'flex', gap: 'var(--sp-md)' }}>
                  {c.dienThoai && <span><Phone size={11} style={{ display: 'inline', marginRight: 3 }} />{c.dienThoai}</span>}
                  {c.diaChi   && <span><MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />{c.diaChi}</span>}
                </div>
              </div>
              <Badge variant="active">Đang hợp tác</Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-xs)', marginTop: 'var(--sp-sm)' }}>
              <div style={{ background: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-sm)', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Lần mua</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{c.soLanMua}</div>
              </div>
              <div style={{ background: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-sm)', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Tổng kg</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{(c.tongKgMua/1000).toFixed(1)}t</div>
              </div>
              <div style={{ background: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-sm)', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Tổng tiền</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-farm-green)' }}>{(c.tongTienMua/1000000).toFixed(0)}tr</div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--sp-sm)', fontSize: 12, color: 'var(--color-muted)', fontFamily: 'monospace' }}>
              Lứa gần nhất: {c.luaGanNhat}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <AddCustomerModal
          onClose={() => setShowModal(false)}
          onSave={c => setCustomers(p => [...p, c])}
        />
      )}
    </DashboardLayout>
  );
};
