// src/features/farmshift/SalesView.jsx
// Quản lý bán hàng, Đơn thu hoạch & Khách hàng chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import {
  ShoppingCart, Plus, Search, FileSpreadsheet, CheckCircle,
  TrendingUp, Users, DollarSign, Calendar, Scale, X, Building
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';

export const SalesView = () => {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'harvest' | 'customers'
  const [sales, setSales] = useState(INITIAL_FARMSHIFT_DATA.sales);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHarvestModal, setShowHarvestModal] = useState(false);

  // Harvest records (from FarmShift-clone/Tạo đơn thu hoạch.html)
  const [harvestRecords, setHarvestRecords] = useState([
    { id: 'hv-1', code: 'TH000012', date: '2026-10-04', barn: 'Nhà Mía 1', qty: 800, grade1Kg: 1520, grade2Kg: 200, totalKg: 1720, avgWeight: 2.15, note: 'Thu hoạch đợt 1 chuồng Mía 1' },
    { id: 'hv-2', code: 'TH000011', date: '2026-09-28', barn: 'Nhà J1', qty: 1200, grade1Kg: 2200, grade2Kg: 260, totalKg: 2460, avgWeight: 2.05, note: 'Thu hoạch xuất trọn chuồng J1' },
  ]);

  // Customers (from FarmShift-clone/Bán hàng - Khách hàng.html)
  const [customers, setCustomers] = useState([
    { id: 'cus-1', name: 'Thương lái Trần Văn Tuấn', phone: '0988 123 456', address: 'Chợ đầu mối gia cầm Hà Vỹ, Thường Tín, Hà Nội', totalBought: 191880000, debt: 0, note: 'Khách quen lấy sỉ theo xe tải' },
    { id: 'cus-2', name: 'Công ty Thực phẩm Sạch Minh Tâm', phone: '0977 654 321', address: 'Hoàng Mai, Hà Nội', totalBought: 144480000, debt: 44480000, note: 'Cung cấp chuỗi siêu thị thực phẩm sạch' },
    { id: 'cus-3', name: 'Hợp tác xã Chăn nuôi & Tiêu thụ An Phát', phone: '0912 345 678', address: 'Đông Anh, Hà Nội', totalBought: 75000000, debt: 0, note: 'Hợp tác bao tiêu sản phẩm' },
  ]);

  // New Sale state
  const [newSale, setNewSale] = useState({
    customer: 'Thương lái Trần Văn Tuấn',
    date: new Date().toISOString().split('T')[0],
    flock: 'Khu J Thịt - Lứa J01',
    quantity: '',
    totalWeight: '',
    unitPrice: '',
    note: ''
  });

  // New Harvest state
  const [newHarvest, setNewHarvest] = useState({
    barn: 'Nhà J2',
    date: new Date().toISOString().split('T')[0],
    qty: '',
    grade1Kg: '',
    grade2Kg: '',
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

  const handleCreateHarvest = (e) => {
    e.preventDefault();
    const q = Number(newHarvest.qty) || 0;
    const g1 = Number(newHarvest.grade1Kg) || 0;
    const g2 = Number(newHarvest.grade2Kg) || 0;
    const tot = g1 + g2;
    const avg = q > 0 ? (tot / q).toFixed(2) : 0;

    const created = {
      id: `hv-${Date.now()}`,
      code: `TH0000${harvestRecords.length + 13}`,
      date: newHarvest.date,
      barn: newHarvest.barn,
      qty: q,
      grade1Kg: g1,
      grade2Kg: g2,
      totalKg: tot,
      avgWeight: avg,
      note: newHarvest.note
    };

    setHarvestRecords([created, ...harvestRecords]);
    setShowHarvestModal(false);
  };

  const filteredSales = sales.filter(s =>
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.flock.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <FarmShiftLayout
      pageTitle="Quản lý bán hàng & Thu hoạch"
      breadcrumbs={[{ label: 'Quản lý bán hàng' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button
            className="farmshift-btn farmshift-btn-secondary"
            onClick={() => setShowHarvestModal(true)}
          >
            <Scale size={16} /> Tạo đơn thu hoạch
          </button>
          <button
            className="farmshift-btn farmshift-btn-primary"
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
          Đơn bán hàng ({sales.length})
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'harvest' ? 'active' : ''}`}
          onClick={() => setActiveTab('harvest')}
        >
          Đơn thu hoạch xuất chuồng ({harvestRecords.length})
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Khách hàng thương lái ({customers.length})
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

      {/* ── Tab 2: Đơn thu hoạch ─────────────────────────── */}
      {activeTab === 'harvest' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh sách các đợt thu hoạch từ chuồng</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Ngày thu hoạch</th>
                  <th>Chuồng xuất</th>
                  <th>Số lượng</th>
                  <th>Gà loại 1 (kg)</th>
                  <th>Gà loại 2 (kg)</th>
                  <th>Tổng khối lượng</th>
                  <th>Trọng lượng TB</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {harvestRecords.map(hv => (
                  <tr key={hv.id}>
                    <td><strong style={{ color: 'var(--color-ink)', fontFamily: 'monospace' }}>{hv.code}</strong></td>
                    <td>{hv.date}</td>
                    <td><strong style={{ color: 'var(--fg-teal)' }}>{hv.barn}</strong></td>
                    <td><strong>{hv.qty.toLocaleString()}</strong> con</td>
                    <td>{hv.grade1Kg} kg</td>
                    <td>{hv.grade2Kg} kg</td>
                    <td><strong>{hv.totalKg} kg</strong></td>
                    <td><span className="farmshift-badge farmshift-badge-neutral">{hv.avgWeight} kg/con</span></td>
                    <td style={{ color: 'var(--color-muted)' }}>{hv.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Khách hàng thương lái ─────────────────── */}
      {activeTab === 'customers' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh bạ thương lái & Khách hàng mua sỉ</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Họ và tên / Đơn vị</th>
                  <th>Số điện thoại</th>
                  <th>Địa chỉ giao hàng</th>
                  <th>Tổng mua lũy kế</th>
                  <th>Công nợ phải thu</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{c.name}</strong></td>
                    <td>{c.phone}</td>
                    <td>{c.address}</td>
                    <td><strong>{c.totalBought.toLocaleString('vi-VN')} đ</strong></td>
                    <td>
                      <span className={`farmshift-badge ${c.debt > 0 ? 'farmshift-badge-warning' : 'farmshift-badge-success'}`}>
                        {c.debt > 0 ? `Nợ: ${c.debt.toLocaleString('vi-VN')} đ` : 'Đã thanh toán hết'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-muted)' }}>{c.note}</td>
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
                      value={newSale.customer}
                      onChange={(e) => setNewSale({ ...newSale, customer: e.target.value })}
                    >
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
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Lưu đơn bán
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Tạo đơn thu hoạch ─────────────────────── */}
      {showHarvestModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Lập phiếu thu hoạch xuất chuồng</h3>
              <button
                onClick={() => setShowHarvestModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateHarvest}>
              <div className="farmshift-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Chuồng thu hoạch *</label>
                    <select
                      className="farmshift-form-control"
                      value={newHarvest.barn}
                      onChange={(e) => setNewHarvest({ ...newHarvest, barn: e.target.value })}
                    >
                      <option value="Nhà J1">Nhà J1 (Gà J-Dabaco)</option>
                      <option value="Nhà J2">Nhà J2 (Gà J-Dabaco)</option>
                      <option value="Nhà Mía 1">Nhà Mía 1 (Gà Mía)</option>
                      <option value="Nhà A1">Nhà A1 (Gà lai chọi)</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngày thu hoạch *</label>
                    <input
                      type="date"
                      className="farmshift-form-control"
                      value={newHarvest.date}
                      onChange={(e) => setNewHarvest({ ...newHarvest, date: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số con xuất</label>
                    <input
                      type="number"
                      required
                      placeholder="VD: 500"
                      className="farmshift-form-control"
                      value={newHarvest.qty}
                      onChange={(e) => setNewHarvest({ ...newHarvest, qty: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Gà loại 1 (kg)</label>
                    <input
                      type="number"
                      required
                      placeholder="VD: 950"
                      className="farmshift-form-control"
                      value={newHarvest.grade1Kg}
                      onChange={(e) => setNewHarvest({ ...newHarvest, grade1Kg: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Gà loại 2 (kg)</label>
                    <input
                      type="number"
                      placeholder="VD: 100"
                      className="farmshift-form-control"
                      value={newHarvest.grade2Kg}
                      onChange={(e) => setNewHarvest({ ...newHarvest, grade2Kg: e.target.value })}
                    />
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Ghi chú phân loại</label>
                  <input
                    type="text"
                    placeholder="Gà mã đẹp, lông mượt, phân loại đưa vào kho hàng thu hoạch..."
                    className="farmshift-form-control"
                    value={newHarvest.note}
                    onChange={(e) => setNewHarvest({ ...newHarvest, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowHarvestModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Lưu phiếu thu hoạch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
