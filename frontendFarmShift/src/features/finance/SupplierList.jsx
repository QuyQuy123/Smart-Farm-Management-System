// src/features/finance/SupplierList.jsx
// Danh sách nhà cung cấp — cám, thuốc thú y, con giống
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Plus, ChevronRight, X, Save } from 'lucide-react';
import styles from './Finance.module.css';

/* ── Mock data ──────────────────────────────────────────── */
const INIT_SUPPLIERS = [
  {
    id: 'NCC-001', ten: 'Công ty CP Việt Nam', loai: 'Thức ăn chăn nuôi',
    dienThoai: '0901234567', diaChi: 'KCN Biên Hòa, Đồng Nai',
    tongDatHang: 145200000, daThanhToan: 127000000, conNo: 18200000,
    soHoaDon: 12, trangThai: 'active',
  },
  {
    id: 'NCC-002', ten: 'DS Thú y Thành Đạt', loai: 'Thuốc & Vaccine',
    dienThoai: '0912345678', diaChi: '45 Đinh Tiên Hoàng, Hà Nội',
    tongDatHang: 8750000, daThanhToan: 8750000, conNo: 0,
    soHoaDon: 8, trangThai: 'active',
  },
  {
    id: 'NCC-003', ten: 'Cty Giống gia cầm Miền Bắc', loai: 'Con giống',
    dienThoai: '0934567890', diaChi: 'Thái Nguyên',
    tongDatHang: 72000000, daThanhToan: 60000000, conNo: 12000000,
    soHoaDon: 6, trangThai: 'active',
  },
  {
    id: 'NCC-004', ten: 'Cty TNHH Giống GC Hà Nội', loai: 'Con giống',
    dienThoai: '0945678901', diaChi: 'Đông Anh, Hà Nội',
    tongDatHang: 54000000, daThanhToan: 54000000, conNo: 0,
    soHoaDon: 4, trangThai: 'active',
  },
  {
    id: 'NCC-005', ten: 'Intervet Việt Nam', loai: 'Thuốc & Vaccine',
    dienThoai: '0956789012', diaChi: '68 Nguyễn Huệ, TP HCM',
    tongDatHang: 4200000, daThanhToan: 4200000, conNo: 0,
    soHoaDon: 5, trangThai: 'active',
  },
];

const LOAI_NCC = ['Tất cả', 'Thức ăn chăn nuôi', 'Thuốc & Vaccine', 'Con giống'];

/* ── Add Supplier Modal ─────────────────────────────────── */
function AddSupplierModal({ onClose, onSave }) {
  const [form, setForm] = useState({ ten: '', loai: 'Thức ăn chăn nuôi', dienThoai: '', diaChi: '', ghiChu: '' });
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSave = () => {
    if (!form.ten.trim()) return;
    onSave({ ...form, id: `NCC-${Date.now()}`, tongDatHang: 0, daThanhToan: 0, conNo: 0, soHoaDon: 0, trangThai: 'active' });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>Thêm nhà cung cấp mới</div>

        <div className={styles.formGrid2}>
          <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
            <label className={styles.formLabel}>Tên nhà cung cấp *</label>
            <input className={styles.formInput} placeholder="VD: Công ty CP Việt Nam" value={form.ten} onChange={set('ten')} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Loại *</label>
            <select className={styles.formSelect} value={form.loai} onChange={set('loai')}>
              <option>Thức ăn chăn nuôi</option>
              <option>Thuốc & Vaccine</option>
              <option>Con giống</option>
              <option>Khác</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Điện thoại</label>
            <input className={styles.formInput} placeholder="0901234567" value={form.dienThoai} onChange={set('dienThoai')} />
          </div>
          <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
            <label className={styles.formLabel}>Địa chỉ</label>
            <input className={styles.formInput} placeholder="Địa chỉ nhà cung cấp" value={form.diaChi} onChange={set('diaChi')} />
          </div>
          <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
            <label className={styles.formLabel}>Ghi chú</label>
            <textarea className={styles.formTextarea} placeholder="Ghi chú thêm..." value={form.ghiChu} onChange={set('ghiChu')} />
          </div>
        </div>

        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}><X size={14} /> Hủy</Button>
          <Button variant="green" onClick={handleSave}><Save size={14} /> Lưu</Button>
        </div>
      </div>
    </div>
  );
}

/* ── SupplierList ───────────────────────────────────────── */
export const SupplierList = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState(INIT_SUPPLIERS);
  const [loaiFilter, setLoaiFilter] = useState('Tất cả');
  const [showModal, setShowModal] = useState(false);

  const filtered = loaiFilter === 'Tất cả' ? suppliers : suppliers.filter(s => s.loai === loaiFilter);

  const tongConNo   = suppliers.reduce((s, n) => s + n.conNo, 0);
  const tongMuaHang = suppliers.reduce((s, n) => s + n.tongDatHang, 0);
  const nccConNo    = suppliers.filter(s => s.conNo > 0).length;

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Nhà cung cấp' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Nhà cung cấp</h1>
          <p className={styles.pageSub}>{suppliers.length} NCC · {nccConNo} còn công nợ</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => navigate('/owner-dashboard/suppliers/debts')}>
            Theo dõi công nợ
          </Button>
          <Button variant="green" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Thêm NCC
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng NCC</div>
          <div className={styles.kpiValue}>{suppliers.length}</div>
          <div className={styles.kpiSub}>Đang hợp tác</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng mua hàng (YTD)</div>
          <div className={styles.kpiValue} style={{ fontSize: 16 }}>{tongMuaHang.toLocaleString('vi-VN')}đ</div>
          <div className={styles.kpiSub}>Tổng {suppliers.reduce((s,n)=>s+n.soHoaDon,0)} hoá đơn</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng công nợ còn lại</div>
          <div className={styles.kpiValue} style={{ fontSize: 16, color: tongConNo > 0 ? 'var(--color-farm-red)' : 'var(--color-farm-green)' }}>
            {tongConNo.toLocaleString('vi-VN')}đ
          </div>
          <div className={styles.kpiSub}>{nccConNo} NCC chưa thanh toán đủ</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>NCC đã thanh toán đủ</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-green)' }}>
            {suppliers.filter(s => s.conNo === 0).length}
          </div>
          <div className={styles.kpiSub}>Không còn nợ</div>
        </div>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        {LOAI_NCC.map(l => (
          <button
            key={l}
            onClick={() => setLoaiFilter(l)}
            style={{
              padding: '6px 14px', borderRadius: 'var(--rounded-sm)', border: '1px solid',
              fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              background: loaiFilter === l ? 'var(--color-farm-green)' : 'var(--color-canvas)',
              color: loaiFilter === l ? '#fff' : 'var(--color-ink)',
              borderColor: loaiFilter === l ? 'var(--color-farm-green)' : 'var(--color-hairline)',
            }}
          >
            {l}
          </button>
        ))}
        <span className={styles.filterCount}>{filtered.length} NCC</span>
      </div>

      {/* Table */}
      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tên nhà cung cấp</th>
              <th>Loại</th>
              <th>Điện thoại</th>
              <th style={{ textAlign: 'right' }}>Tổng mua hàng</th>
              <th style={{ textAlign: 'right' }}>Đã thanh toán</th>
              <th style={{ textAlign: 'right' }}>Còn nợ</th>
              <th style={{ textAlign: 'center' }}>Số HĐ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className={styles.tableRow}
                onClick={() => navigate(`/owner-dashboard/suppliers/${s.id}`)}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{s.ten}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{s.diaChi}</div>
                </td>
                <td><Badge variant="inactive">{s.loai}</Badge></td>
                <td style={{ color: 'var(--color-muted)' }}>{s.dienThoai}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{s.tongDatHang.toLocaleString('vi-VN')}đ</td>
                <td style={{ textAlign: 'right', color: 'var(--color-farm-green)' }}>{s.daThanhToan.toLocaleString('vi-VN')}đ</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: s.conNo > 0 ? 'var(--color-farm-red)' : 'var(--color-muted)' }}>
                  {s.conNo > 0 ? `${s.conNo.toLocaleString('vi-VN')}đ` : '—'}
                </td>
                <td style={{ textAlign: 'center' }}>{s.soHoaDon}</td>
                <td style={{ textAlign: 'center' }}><ChevronRight size={16} color="var(--color-muted)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddSupplierModal
          onClose={() => setShowModal(false)}
          onSave={ncc => setSuppliers(p => [...p, ncc])}
        />
      )}
    </DashboardLayout>
  );
};
