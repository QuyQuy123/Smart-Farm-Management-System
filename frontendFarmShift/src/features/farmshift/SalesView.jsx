// src/features/farmshift/SalesView.jsx
// Quản lý bán hàng, Đơn thu hoạch & Khách hàng chuẩn FarmShift & DESIGN.md
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listSalesCustomers } from '../../services/salesCustomerService';
import { Plus, Search, FileSpreadsheet } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';

export const SalesView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'customers' ? 'customers' : 'orders';
  const setActiveTab = tab => setSearchParams({ tab });
  const [sales, setSales] = useState(INITIAL_FARMSHIFT_DATA.sales);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState('');
  const [customerRevision, setCustomerRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    listSalesCustomers().then(data => {
      if (!cancelled) setCustomers(data);
    }).catch(() => {
      if (!cancelled) setCustomersError('Không thể tải danh sách khách hàng. Vui lòng thử lại.');
    }).finally(() => { if (!cancelled) setCustomersLoading(false); });
    return () => { cancelled = true; };
  }, [customerRevision]);
  const formatMoney = value => value == null ? '—' : `${Number(value).toLocaleString('vi-VN')} đ`;

  // New Sale state
  const [newSale, setNewSale] = useState({
    customer: '',
    date: new Date().toISOString().split('T')[0],
    flock: 'Khu J Thịt - Lứa J01',
    quantity: '',
    totalWeight: '',
    unitPrice: '',
    note: ''
  });

  const handleCreateSale = (e) => {
    e.preventDefault();
    const qty = Number(newSale.quantity) || 0;
    const weight = Number(newSale.totalWeight) || 0;
    const price = Number(newSale.unitPrice) || 0;
    const totalAmount = weight * price;

    const created = {
      id: `so-${Date.now()}`,
      code: `BH0000${sales.length + 47}`,
      date: newSale.date,
      customer: newSale.customer,
      flock: newSale.flock,
      quantity: qty,
      totalWeight: weight,
      unitPrice: price,
      totalAmount,
      paidAmount: totalAmount,
      status: 'Đã thu tiền',
      note: newSale.note
    };

    setSales([created, ...sales]);
    setShowAddModal(false);
  };

  const filteredSales = sales.filter(s =>
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.flock.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <FarmShiftLayout
      pageTitle="Quản lý bán hàng"
      breadcrumbTitle={activeTab === 'customers' ? 'Khách hàng' : 'Danh sách đơn bán'}
      breadcrumbs={[{ label: 'Quản lý bán hàng' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button
            className="farmshift-btn farmshift-btn-mint"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> Tạo đơn bán hàng
          </button>
        </div>
      }
    >
      {/* ── Tabs Navigation ──────────────────────────────── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Danh sách đơn bán
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Khách hàng
        </button>
      </div>

      {/* ── Tab 1: Đơn bán hàng ──────────────────────────── */}
      {activeTab === 'orders' && (
        <>
          <div className="farmshift-toolbar">
            <div className="farmshift-search-box">
              <Search size={16} color="var(--color-muted)" />
              <input
                type="text"
                placeholder="Tìm theo mã đơn bán, khách hàng, khu chuồng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="farmshift-card">
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Ngày xuất</th>
                    <th>Khách hàng</th>
                    <th>Lứa / Chuồng</th>
                    <th>Số lượng xuất</th>
                    <th>Tổng trọng lượng</th>
                    <th>Đơn giá</th>
                    <th>Tổng doanh thu</th>
                    <th>Trạng thái thu tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(s => (
                    <tr key={s.id}>
                      <td>
                        <strong style={{ color: 'var(--color-ink)', fontFamily: 'monospace', fontSize: '14px' }}>
                          {s.code}
                        </strong>
                      </td>
                      <td>{s.date}</td>
                      <td><strong>{s.customer}</strong></td>
                      <td>{s.flock}</td>
                      <td><strong>{s.quantity.toLocaleString()}</strong> con</td>
                      <td><strong>{s.totalWeight.toLocaleString()}</strong> kg (TB {(s.totalWeight / s.quantity).toFixed(2)} kg/con)</td>
                      <td>{s.unitPrice.toLocaleString('vi-VN')} đ/kg</td>
                      <td>
                        <strong style={{ fontSize: '14.5px', color: 'var(--color-ink)' }}>
                          {s.totalAmount.toLocaleString('vi-VN')} đ
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`farmshift-badge ${s.status.includes('Đã thu') ? 'farmshift-badge-success' : 'farmshift-badge-warning'
                            }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab 3: Khách hàng thương lái ─────────────────── */}
      {activeTab === 'customers' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Khách hàng</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Họ và tên/ đơn vị</th>
                  <th>Số điện thoại</th>
                  <th>Địa chỉ</th>
                  <th>Tổng mua lũy kế</th>
                  <th>Công nợ</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {customersLoading ? <tr><td colSpan={6} role="status">Đang tải khách hàng...</td></tr>
                  : customersError ? <tr><td colSpan={6} role="alert">{customersError} <button className="farmshift-btn farmshift-btn-secondary" onClick={() => { setCustomersLoading(true); setCustomersError(''); setCustomerRevision(value => value + 1); }}>Thử lại</button></td></tr>
                  : customers.length === 0 ? <tr><td colSpan={6}>Chưa có khách hàng.</td></tr>
                  : customers.map(c => (
                  <tr key={c.id}>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{c.name}</strong></td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.address || '—'}</td>
                    <td><strong>{formatMoney(c.totalBought)}</strong></td>
                    <td>
                      {formatMoney(c.debt)}
                    </td>
                    <td style={{ color: 'var(--color-muted)' }}>{c.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Tạo đơn bán mới ───────────────────────── */}
      {showAddModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Tạo đơn bán gà thương phẩm</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSale}>
              <div className="farmshift-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Khách hàng / Thương lái *</label>
                    <select
                      className="farmshift-form-control"
                      required
                      value={newSale.customer}
                      onChange={(e) => setNewSale({ ...newSale, customer: e.target.value })}
                    >
                      <option value="">Chọn khách hàng</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngày xuất chuồng *</label>
                    <input
                      type="date"
                      className="farmshift-form-control"
                      value={newSale.date}
                      onChange={(e) => setNewSale({ ...newSale, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Lứa nuôi / Chuồng xuất *</label>
                  <select
                    className="farmshift-form-control"
                    value={newSale.flock}
                    onChange={(e) => setNewSale({ ...newSale, flock: e.target.value })}
                  >
                    <option value="Khu J Thịt - Lứa J01">Khu J Thịt - Nhà J1</option>
                    <option value="Khu J Thịt - Lứa J02">Khu J Thịt - Nhà J2</option>
                    <option value="Khu Mía Thịt - Lứa M01">Khu Mía Thịt - Nhà Mía 1</option>
                    <option value="Khu Nhà A - Lứa A01">Khu Nhà A - Nhà A1</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số con xuất</label>
                    <input
                      type="number"
                      required
                      placeholder="VD: 1000"
                      className="farmshift-form-control"
                      value={newSale.quantity}
                      onChange={(e) => setNewSale({ ...newSale, quantity: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Tổng khối lượng (kg)</label>
                    <input
                      type="number"
                      required
                      placeholder="VD: 2150"
                      className="farmshift-form-control"
                      value={newSale.totalWeight}
                      onChange={(e) => setNewSale({ ...newSale, totalWeight: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Đơn giá (đ/kg)</label>
                    <input
                      type="number"
                      required
                      placeholder="VD: 78000"
                      className="farmshift-form-control"
                      value={newSale.unitPrice}
                      onChange={(e) => setNewSale({ ...newSale, unitPrice: e.target.value })}
                    />
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Ghi chú xuất bán</label>
                  <input
                    type="text"
                    placeholder="Giao xe tải biển 29C-xxx..."
                    className="farmshift-form-control"
                    value={newSale.note}
                    onChange={(e) => setNewSale({ ...newSale, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-mint">
                  Lưu đơn bán
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </FarmShiftLayout>
  );
};
