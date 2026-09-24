// src/features/employee/EmployeeList.jsx
// Quản lý Nhân sự — Feature 1
import React, { useState } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Plus, X, Save, Edit, Trash2, Key, Shield, User } from 'lucide-react';
import styles from './Employee.module.css';

/* ── Mock data ──────────────────────────────────────────── */
const INIT_EMPLOYEES = [
  {
    id: 'NV-001', ten: 'Trần Thị Kế Toán', vaiTro: 'Kế toán',
    dienThoai: '0911222333', email: 'ketoan@farmshift.vn',
    trangThai: 'Hoạt động', ngayVao: '15/02/2026',
    luong: 12000000,
  },
  {
    id: 'NV-002', ten: 'Nguyễn Văn Công', vaiTro: 'Công nhân',
    dienThoai: '0988777666', email: 'cong.nv@farmshift.vn',
    trangThai: 'Hoạt động', ngayVao: '01/03/2026',
    luong: 8000000,
  },
  {
    id: 'NV-003', ten: 'Lê Thế Bình', vaiTro: 'Công nhân',
    dienThoai: '0900999888', email: 'binh.lt@farmshift.vn',
    trangThai: 'Khóa', ngayVao: '10/05/2026',
    luong: 7500000,
  },
];

const ROLES = ['Công nhân', 'Kế toán', 'Chủ trại'];

/* ── Employee Modal ─────────────────────────────────────── */
function EmployeeModal({ employee, onClose, onSave }) {
  const isEdit = !!employee;
  const [form, setForm] = useState(employee || {
    ten: '', vaiTro: 'Công nhân', dienThoai: '', email: '',
    luong: '', trangThai: 'Hoạt động', ngayVao: new Date().toISOString().slice(0, 10),
  });

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleSave = () => {
    if (!form.ten || !form.dienThoai) return;
    const d = form.ngayVao.includes('-') ? form.ngayVao.split('-').reverse().join('/') : form.ngayVao;
    onSave({
      ...form,
      id: isEdit ? form.id : `NV-${Date.now()}`,
      ngayVao: d,
      luong: parseInt(form.luong) || 0,
    });
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalTitle}>
          {isEdit ? '✏️ Cập nhật nhân viên' : '👤 Thêm nhân viên mới'}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Họ và tên *</label>
          <input className={styles.formInput} placeholder="VD: Nguyễn Văn A" value={form.ten} onChange={set('ten')} autoFocus />
        </div>

        <div className={styles.formGrid2}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Điện thoại *</label>
            <input className={styles.formInput} placeholder="09..." value={form.dienThoai} onChange={set('dienThoai')} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email</label>
            <input type="email" className={styles.formInput} placeholder="email@example.com" value={form.email} onChange={set('email')} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Vai trò *</label>
            <select className={styles.formSelect} value={form.vaiTro} onChange={set('vaiTro')}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Lương cơ bản (đ)</label>
            <input type="number" className={styles.formInput} placeholder="0" value={form.luong} onChange={set('luong')} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ngày vào làm</label>
            <input type="date" className={styles.formInput} value={form.ngayVao.includes('/') ? form.ngayVao.split('/').reverse().join('-') : form.ngayVao} onChange={set('ngayVao')} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Trạng thái</label>
            <select className={styles.formSelect} value={form.trangThai} onChange={set('trangThai')}>
              <option>Hoạt động</option>
              <option>Khóa</option>
            </select>
          </div>
        </div>

        {!isEdit && (
          <div style={{ padding: '12px', background: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-sm)', marginTop: 'var(--sp-sm)', fontSize: 13, color: 'var(--color-muted)' }}>
            <Key size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--color-ink)' }}/>
            Tài khoản đăng nhập sẽ tự động gửi qua email/SMS. Mật khẩu mặc định là: <strong>123456</strong>
          </div>
        )}

        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}><X size={14} /> Hủy</Button>
          <Button variant="green" onClick={handleSave}><Save size={14} /> Lưu thông tin</Button>
        </div>
      </div>
    </div>
  );
}

/* ── EmployeeList ───────────────────────────────────────── */
export const EmployeeList = () => {
  const [employees, setEmployees] = useState(INIT_EMPLOYEES);
  const [modal, setModal] = useState(null); // 'add' | employee_object | null
  const [filter, setFilter] = useState('all');

  const filtered = employees.filter(e => {
    if (filter === 'active') return e.trangThai === 'Hoạt động';
    if (filter === 'locked') return e.trangThai === 'Khóa';
    return true;
  });

  const tongLuong = employees.filter(e => e.trangThai === 'Hoạt động').reduce((s, e) => s + e.luong, 0);

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
      setEmployees(p => p.filter(e => e.id !== id));
    }
  };

  const handleToggleLock = (emp) => {
    setEmployees(p => p.map(e => e.id === emp.id ? { ...e, trangThai: e.trangThai === 'Hoạt động' ? 'Khóa' : 'Hoạt động' } : e));
  };

  const BREADCRUMBS = [
    { label: 'Trang trại Miền Bình', path: '/owner-dashboard' },
    { label: 'Quản lý nhân sự' },
  ];

  return (
    <DashboardLayout breadcrumbs={BREADCRUMBS}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Danh sách nhân sự</h1>
          <p className={styles.pageSub}>{employees.filter(e => e.trangThai === 'Hoạt động').length} nhân sự đang hoạt động</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="green" onClick={() => setModal('add')}>
            <Plus size={14} /> Thêm nhân viên
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng nhân sự</div>
          <div className={styles.kpiValue}>{employees.length}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Đang hoạt động</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-green)' }}>
            {employees.filter(e => e.trangThai === 'Hoạt động').length}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Đang khóa</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-farm-red)' }}>
            {employees.filter(e => e.trangThai === 'Khóa').length}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng quỹ lương/tháng</div>
          <div className={styles.kpiValue} style={{ fontSize: 18 }}>
            {tongLuong.toLocaleString('vi-VN')}đ
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        {[['all','Tất cả'],['active','Đang hoạt động'],['locked','Đã khóa']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 'var(--rounded-sm)', border: '1px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            background: filter === v ? 'var(--color-farm-green)' : 'var(--color-canvas)',
            color: filter === v ? '#fff' : 'var(--color-ink)',
            borderColor: filter === v ? 'var(--color-farm-green)' : 'var(--color-hairline)',
          }}>{l}</button>
        ))}
      </div>

      {/* Table */}
      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Mã NV</th>
              <th>Họ và tên</th>
              <th>Vai trò</th>
              <th>Điện thoại</th>
              <th>Ngày vào</th>
              <th style={{ textAlign:'right' }}>Lương CB</th>
              <th style={{ textAlign:'center' }}>Trạng thái</th>
              <th style={{ textAlign:'right' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className={styles.tableRow} style={{ opacity: e.trangThai === 'Khóa' ? 0.6 : 1 }}>
                <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-muted)' }}>{e.id}</td>
                <td>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={14} color="var(--color-muted)" />
                    {e.ten}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{e.email}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500, color: e.vaiTro === 'Kế toán' ? '#8b5cf6' : 'var(--color-farm-green)' }}>
                    {e.vaiTro === 'Kế toán' && <Shield size={13} />}
                    {e.vaiTro}
                  </div>
                </td>
                <td style={{ color: 'var(--color-muted)' }}>{e.dienThoai}</td>
                <td style={{ color: 'var(--color-muted)' }}>{e.ngayVao}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{e.luong.toLocaleString('vi-VN')}đ</td>
                <td style={{ textAlign: 'center' }}>
                  <Badge variant={e.trangThai === 'Hoạt động' ? 'active' : 'inactive'}>{e.trangThai}</Badge>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <Button variant="ghost" size="sm" onClick={() => setModal(e)} title="Sửa">
                      <Edit size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleLock(e)} title={e.trangThai === 'Hoạt động' ? 'Khóa tài khoản' : 'Mở khóa'}>
                      <Key size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)} title="Xóa" style={{ color: 'var(--color-farm-red)' }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <EmployeeModal
          employee={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={(emp) => {
            if (modal === 'add') {
              setEmployees(p => [emp, ...p]);
            } else {
              setEmployees(p => p.map(x => x.id === emp.id ? emp : x));
            }
          }}
        />
      )}
    </DashboardLayout>
  );
};
