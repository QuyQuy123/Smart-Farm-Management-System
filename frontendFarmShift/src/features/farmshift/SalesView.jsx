// src/features/farmshift/SalesView.jsx
// Quản lý bán hàng và danh sách khách hàng.
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listSalesCustomers } from '../../services/salesCustomerService';
import { listBarns } from '../../services/farmAreaService';
import { listCycles } from '../../services/cycleService';
import styles from './SalesView.module.css';
import { Plus, Search, FileSpreadsheet, X } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';

export const SalesView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'customers' ? 'customers' : 'orders';
  const setActiveTab = tab => setSearchParams({ tab });
  const [sales, setSales] = useState([]);
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
    flock: '',
    quantity: '',
    totalWeight: '',
    unitPrice: '',
    note: ''
  });

  const [cycleOptions, setCycleOptions] = useState([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [cyclesError, setCyclesError] = useState('');
  const openSaleModal = async () => {
    setShowAddModal(true);
    setCyclesLoading(true);
    setCyclesError('');
    try {
      const barns = await listBarns();
      const options = await Promise.all(barns.map(async barn => {
        const cycles = await listCycles(barn.id);
        return cycles.map(cycle => ({
          id: String(cycle.id),
          label: `${barn.areaName} - ${barn.name} - ${cycle.code || `Lứa ${cycle.cycleNumber}`}`,
        }));
      }));
      setCycleOptions(options.flat());
    } catch {
      setCycleOptions([]);
      setCyclesError('Không thể tải khu nuôi - chuồng - lứa. Vui lòng thử lại.');
    } finally {
      setCyclesLoading(false);
    }
  };

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
      flock: cycleOptions.find(option => option.id === newSale.flock)?.label || '',
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
            onClick={openSaleModal}
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
                placeholder="Tìm theo mã hóa đơn, khách hàng, khu nuôi / chuồng / lứa..."
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
                    <th>Mã hóa đơn</th>
                    <th>Ngày xuất</th>
                    <th>Khách hàng</th>
                    <th>Khu nuôi/Chuồng/lứa</th>
                    <th>Số lượng xuất</th>
                    <th>Tổng trọng lượng</th>
                    <th>Đơn giá</th>
                    <th>Tổng doanh thu</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-muted)' }}>
                        <strong style={{ display: 'block', color: 'var(--color-ink)', marginBottom: '8px' }}>
                          {searchTerm ? 'Không tìm thấy đơn bán phù hợp' : 'Chưa có đơn bán hàng'}
                        </strong>
                        {searchTerm ? 'Thử tìm theo mã hóa đơn hoặc tên khách hàng khác.' : 'Các đơn bán sau khi được tạo sẽ hiển thị tại đây.'}
                      </td>
                    </tr>
                  )}
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
                      <td><strong>{s.totalWeight.toLocaleString('vi-VN')}</strong> kg</td>
                      <td>{s.unitPrice.toLocaleString('vi-VN')} đ/kg</td>
                      <td>
                        <strong style={{ fontSize: '14.5px', color: 'var(--color-ink)' }}>
                          {s.totalAmount.toLocaleString('vi-VN')} đ
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`farmshift-badge ${(s.totalAmount - s.paidAmount) <= 0 ? 'farmshift-badge-success' : 'farmshift-badge-warning'
                            }`}
                        >
                          {s.totalAmount - s.paidAmount > 0 ? `Còn nợ ${formatMoney(s.totalAmount - s.paidAmount)}` : 'Đã thanh toán'}
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
        <div className="farmshift-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) setShowAddModal(false); }}>
          <div className="farmshift-modal" role="dialog" aria-modal="true" aria-labelledby="sale-modal-title">
            <div className="farmshift-modal-header">
              <h3 id="sale-modal-title" className="farmshift-modal-title">Tạo đơn bán</h3>
              <button
                onClick={() => setShowAddModal(false)}
                type="button"
                className={styles.closeButton}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSale}>
              <div className="farmshift-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Khách hàng / Thương lái <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      className="farmshift-form-control"
                      required
                      value={newSale.customer}
                      onChange={(e) => setNewSale({ ...newSale, customer: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngày xuất chuồng <span className={styles.required}>*</span></label>
                    <input
                      type="date"
                      required
                      className="farmshift-form-control"
                      value={newSale.date}
                      onChange={(e) => setNewSale({ ...newSale, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Khu nuôi - chuồng - lứa <span className={styles.required}>*</span></label>
                  <select
                    className="farmshift-form-control"
                    required
                    disabled={cyclesLoading || !!cyclesError}
                    value={newSale.flock}
                    onChange={(e) => setNewSale({ ...newSale, flock: e.target.value })}
                  >
                    <option value="">{cyclesLoading ? 'Đang tải...' : 'Chọn khu nuôi - chuồng - lứa'}</option>
                    {cycleOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                  {cyclesError && <p role="alert" className={styles.error}>{cyclesError} <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={openSaleModal}>Thử lại</button></p>}
                  {!cyclesLoading && !cyclesError && cycleOptions.length === 0 && <p className={styles.hint}>Chưa có lứa nuôi trong cơ sở dữ liệu.</p>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số con xuất <span className={styles.required}>*</span></label>
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
                    <label className="farmshift-form-label">Tổng khối lượng (kg) <span className={styles.required}>*</span></label>
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
                    <label className="farmshift-form-label">Đơn giá (đ/kg) <span className={styles.required}>*</span></label>
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
