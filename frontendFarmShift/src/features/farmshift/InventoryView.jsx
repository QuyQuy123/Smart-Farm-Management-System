// src/features/farmshift/InventoryView.jsx
// Quản lý Kho hàng hóa & Vật tư chăn nuôi chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import {
  Package, Plus, Search, FileSpreadsheet, AlertTriangle,
  Layers, Tag, DollarSign, Filter, RefreshCw, X, CheckCircle,
  TrendingDown, ShieldCheck, Box
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';

export const InventoryView = () => {
  const [items, setItems] = useState([
    ...INITIAL_FARMSHIFT_DATA.inventory,
    {
      id: 'inv-th-1',
      code: 'SP000088',
      name: 'Gà thịt Dabaco loại 1 (sẵn sàng xuất)',
      category: 'Hàng thu hoạch',
      brand: 'Dabaco',
      unit: 'Kg',
      pack: 'Lồng',
      price: 82000,
      stock: 3500,
      minThreshold: 500,
      warehouse: 'Kho Con giống & Thành phẩm'
    },
    {
      id: 'inv-th-2',
      code: 'SP000089',
      name: 'Trứng gà vỏ dày (thu gom)',
      category: 'Hàng thu hoạch',
      brand: 'FarmShift',
      unit: 'Quả',
      pack: 'Khay 30 quả',
      price: 3200,
      stock: 450,
      minThreshold: 100,
      warehouse: 'Kho Con giống & Thành phẩm'
    }
  ]);

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState(null);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState(null);

  // New Item State
  const [newItem, setNewItem] = useState({
    code: '',
    name: '',
    category: 'Nguyên liệu sản xuất',
    brand: 'Dabaco',
    unit: 'Bao (25kg)',
    pack: 'Bao',
    price: '',
    stock: '',
    minThreshold: '20',
    warehouse: 'Kho Cám & Thức ăn'
  });

  // Adjust Form State
  const [adjustForm, setAdjustForm] = useState({
    itemId: '',
    actualStock: '',
    reason: 'Kiểm kê định kỳ cân đối',
    note: ''
  });

  const categories = [
    { key: 'ALL', label: 'Tất cả hàng hóa' },
    { key: 'Con giống', label: 'Con giống' },
    { key: 'Nguyên liệu sản xuất', label: 'Nguyên liệu / Cám' },
    { key: 'Kho thuốc', label: 'Thuốc thú y' },
    { key: 'Kho vaxin', label: 'Vắc-xin' },
    { key: 'Kho hóa chất', label: 'Hóa chất sát trùng' },
    { key: 'Hàng thu hoạch', label: 'Hàng thu hoạch' },
    { key: 'THRESHOLD', label: 'Hàng chạm ngưỡng' }
  ];

  const handleCreateItem = (e) => {
    e.preventDefault();
    const created = {
      id: `inv-${Date.now()}`,
      code: newItem.code || `SP0000${items.length + 10}`,
      name: newItem.name,
      category: newItem.category,
      brand: newItem.brand || 'Dabaco',
      unit: newItem.unit,
      pack: newItem.pack || 'Gói',
      price: Number(newItem.price) || 0,
      stock: Number(newItem.stock) || 0,
      minThreshold: Number(newItem.minThreshold) || 10,
      warehouse: newItem.warehouse
    };
    setItems([created, ...items]);
    setShowAddModal(false);
    setNewItem({
      code: '',
      name: '',
      category: 'Nguyên liệu sản xuất',
      brand: 'Dabaco',
      unit: 'Bao (25kg)',
      pack: 'Bao',
      price: '',
      stock: '',
      minThreshold: '20',
      warehouse: 'Kho Cám & Thức ăn'
    });
  };

  const openAdjustModal = (item) => {
    setSelectedItemForAdjust(item);
    setAdjustForm({
      itemId: item.id,
      actualStock: item.stock,
      reason: 'Kiểm kê định kỳ cân đối',
      note: ''
    });
    setShowAdjustModal(true);
  };

  const handleApplyAdjustment = (e) => {
    e.preventDefault();
    if (!selectedItemForAdjust) return;
    const newStockVal = Number(adjustForm.actualStock) || 0;
    setItems(items.map(it => it.id === selectedItemForAdjust.id ? { ...it, stock: newStockVal } : it));
    setShowAdjustModal(false);
    setSelectedItemForAdjust(null);
  };

  const filteredItems = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;

    if (selectedWarehouse !== 'ALL' && item.warehouse !== selectedWarehouse) {
      return false;
    }

    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'THRESHOLD') return item.stock <= item.minThreshold;
    return item.category === selectedCategory;
  });

  return (
    <FarmShiftLayout
      pageTitle="Kho hàng hóa"
      breadcrumbs={[{ label: 'Kho hàng hóa' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button
            className="farmshift-btn farmshift-btn-secondary"
            onClick={() => {
              if (items.length > 0) openAdjustModal(items[0]);
            }}
          >
            <RefreshCw size={15} /> Điều chỉnh tồn kho
          </button>
          <button
            className="farmshift-btn farmshift-btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> Tạo hàng hóa
          </button>
        </div>
      }
    >
      {/* ── Category Filter Tabs ─────────────────────────── */}
      <div className="farmshift-tabs">
        {categories.map(cat => (
          <button
            key={cat.key}
            className={`farmshift-tab-btn ${selectedCategory === cat.key ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Toolbar: Search & Select Filter ──────────────── */}
      <div className="farmshift-toolbar">
        <div className="farmshift-search-box">
          <Search size={16} color="var(--color-muted)" />
          <input
            type="text"
            placeholder="Tìm theo tên hàng, mã số, nhãn hiệu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="farmshift-filter-group">
          <select
            className="farmshift-select"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="ALL">Tất cả kho lưu trữ</option>
            <option value="Kho Cám & Thức ăn">Kho Cám & Thức ăn</option>
            <option value="Kho Thuốc thú y">Kho Thuốc thú y</option>
            <option value="Kho Vắc-xin">Kho Vắc-xin</option>
            <option value="Kho Hóa chất">Kho Hóa chất</option>
            <option value="Kho Con giống & Thành phẩm">Kho Con giống & Thành phẩm</option>
          </select>
        </div>
      </div>

      {/* ── Inventory Data Table ─────────────────────────── */}
      <div className="farmshift-card">
        <div className="farmshift-table-container" style={{ border: 'none' }}>
          <table className="farmshift-table">
            <thead>
              <tr>
                <th>Mã hàng</th>
                <th>Tên hàng hoá</th>
                <th>Kho lưu trữ</th>
                <th>Nhãn hiệu</th>
                <th>Quy cách / Đơn vị</th>
                <th>Giá đơn vị (đ)</th>
                <th>Tồn kho</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--color-muted)', fontSize: '13px' }}>
                      {item.code}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--color-ink)', fontSize: '14px' }}>
                      {item.name}
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                      {item.category}
                    </div>
                  </td>
                  <td>{item.warehouse}</td>
                  <td>
                    <span className="farmshift-badge farmshift-badge-neutral">{item.brand}</span>
                  </td>
                  <td>{item.unit}</td>
                  <td>
                    <strong>{item.price > 0 ? `${item.price.toLocaleString('vi-VN')} đ` : '—'}</strong>
                  </td>
                  <td>
                    <strong
                      style={{
                        fontSize: '14px',
                        color: item.stock <= item.minThreshold ? 'var(--color-signature-coral)' : 'var(--color-ink)'
                      }}
                    >
                      {item.stock.toLocaleString()} {item.unit.split(' ')[0]}
                    </strong>
                    <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                      Tối thiểu: {item.minThreshold}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`farmshift-badge ${item.stock === 0
                          ? 'farmshift-badge-danger'
                          : item.stock <= item.minThreshold
                            ? 'farmshift-badge-warning'
                            : 'farmshift-badge-success'
                        }`}
                    >
                      {item.stock === 0 ? 'Hết hàng' : item.stock <= item.minThreshold ? 'Chạm ngưỡng' : 'Đầy đủ'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="farmshift-btn farmshift-btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 9px' }}
                        onClick={() => setSelectedItemForDetail(item)}
                      >
                        Thẻ kho
                      </button>
                      <button
                        className="farmshift-btn farmshift-btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 9px' }}
                        onClick={() => openAdjustModal(item)}
                      >
                        Cân bằng
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Thêm mới hàng hóa ─────────────────────── */}
      {showAddModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Tạo mới hàng hóa</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateItem}>
              <div className="farmshift-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Tên hàng hóa *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Cám De Heus 501, Vắc-xin..."
                      className="farmshift-form-control"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Mã hàng (tùy chọn)</label>
                    <input
                      type="text"
                      placeholder="Tự động nếu để trống"
                      className="farmshift-form-control"
                      value={newItem.code}
                      onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Nhóm / Danh mục</label>
                    <select
                      className="farmshift-form-control"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    >
                      <option value="Con giống">Con giống</option>
                      <option value="Nguyên liệu sản xuất">Nguyên liệu sản xuất (Cám)</option>
                      <option value="Kho thuốc">Kho thuốc thú y</option>
                      <option value="Kho vaxin">Kho Vắc-xin</option>
                      <option value="Kho hóa chất">Kho Hóa chất sát trùng</option>
                      <option value="Hàng thu hoạch">Hàng thu hoạch (Thịt, trứng)</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Kho lưu trữ</label>
                    <select
                      className="farmshift-form-control"
                      value={newItem.warehouse}
                      onChange={(e) => setNewItem({ ...newItem, warehouse: e.target.value })}
                    >
                      <option value="Kho Cám & Thức ăn">Kho Cám & Thức ăn</option>
                      <option value="Kho Thuốc thú y">Kho Thuốc thú y</option>
                      <option value="Kho Vắc-xin">Kho Vắc-xin</option>
                      <option value="Kho Hóa chất">Kho Hóa chất</option>
                      <option value="Kho Con giống & Thành phẩm">Kho Con giống & Thành phẩm</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Nhãn hiệu / Hãng SX</label>
                    <input
                      type="text"
                      placeholder="Dabaco, CP, Hanvet, FAVET..."
                      className="farmshift-form-control"
                      value={newItem.brand}
                      onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Đơn vị tính / Quy cách</label>
                    <input
                      type="text"
                      placeholder="VD: Bao (25kg), Lọ, Chai, Con, Kg..."
                      className="farmshift-form-control"
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Giá nhập đơn vị (đ)</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="farmshift-form-control"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số lượng ban đầu</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="farmshift-form-control"
                      value={newItem.stock}
                      onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngưỡng tối thiểu</label>
                    <input
                      type="number"
                      className="farmshift-form-control"
                      value={newItem.minThreshold}
                      onChange={(e) => setNewItem({ ...newItem, minThreshold: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Bỏ qua
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Lưu và đóng lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Điều chỉnh tồn kho ────────────────────── */}
      {showAdjustModal && selectedItemForAdjust && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Điều chỉnh số lượng tồn kho</h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleApplyAdjustment}>
              <div className="farmshift-modal-body">
                <div style={{ padding: '12px', backgroundColor: 'var(--color-surface-soft)', borderRadius: 'var(--rounded-md)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)' }}>
                    {selectedItemForAdjust.name} ({selectedItemForAdjust.code})
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '4px' }}>
                    Kho: {selectedItemForAdjust.warehouse} · Tồn sổ sách hiện tại: <strong>{selectedItemForAdjust.stock} {selectedItemForAdjust.unit}</strong>
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Số lượng thực tế sau kiểm kê *</label>
                  <input
                    type="number"
                    required
                    className="farmshift-form-control"
                    value={adjustForm.actualStock}
                    onChange={(e) => setAdjustForm({ ...adjustForm, actualStock: e.target.value })}
                  />
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px' }}>
                    Chênh lệch: {Number(adjustForm.actualStock) - selectedItemForAdjust.stock} {selectedItemForAdjust.unit}
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Lý do điều chỉnh</label>
                  <select
                    className="farmshift-form-control"
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  >
                    <option value="Kiểm kê định kỳ cân đối">Kiểm kê định kỳ cân đối</option>
                    <option value="Hao hụt tự nhiên do bảo quản">Hao hụt tự nhiên do bảo quản</option>
                    <option value="Hư hỏng / Rách vỡ bao bì">Hư hỏng / Rách vỡ bao bì</option>
                    <option value="Bù trừ sai sót nhập liệu">Bù trừ sai sót nhập liệu</option>
                  </select>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Ghi chú chi tiết</label>
                  <textarea
                    rows="2"
                    placeholder="Mô tả biên bản kiểm kê..."
                    className="farmshift-form-control"
                    value={adjustForm.note}
                    onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowAdjustModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Xác nhận cân bằng kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Thẻ kho & Chi tiết hàng hóa (item-detail parity) ─ */}
      {selectedItemForDetail && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '820px' }}>
            <div className="farmshift-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '6px', backgroundColor: 'var(--color-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="farmshift-modal-title" style={{ margin: 0, fontSize: '16px' }}>
                    Thẻ kho: {selectedItemForDetail.name} ({selectedItemForDetail.code})
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '2px' }}>
                    Kho: {selectedItemForDetail.warehouse} · Danh mục: {selectedItemForDetail.category} · Nhãn hiệu: {selectedItemForDetail.brand}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedItemForDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="farmshift-modal-body" style={{ padding: '20px' }}>
              {/* Stat badges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '12px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>TỒN HIỆN TẠI</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-primary)', marginTop: '4px' }}>
                    {selectedItemForDetail.stock.toLocaleString()} {selectedItemForDetail.unit}
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>QUY CÁCH</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
                    {selectedItemForDetail.pack || selectedItemForDetail.unit}
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>GIÁ TRỊ TỒN KHO</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '4px' }}>
                    {((selectedItemForDetail.stock || 0) * (selectedItemForDetail.price || 0)).toLocaleString('vi-VN')} đ
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>TRẠNG THÁI</div>
                  <div style={{ marginTop: '6px' }}>
                    <span className="farmshift-badge farmshift-badge-success">
                      {selectedItemForDetail.stock > selectedItemForDetail.minThreshold ? 'Đầy đủ' : 'Chạm ngưỡng'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stock Movement Timeline */}
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)', margin: '0 0 10px' }}>
                Lịch sử xuất nhập & biến động thẻ kho
              </h4>
              <div className="farmshift-table-container" style={{ border: '1px solid var(--color-hairline)' }}>
                <table className="farmshift-table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Loại chứng từ</th>
                      <th>Mã phiếu</th>
                      <th>Biến động</th>
                      <th>Tồn sau giao dịch</th>
                      <th>Người thực hiện</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { date: '2026-10-21', type: 'Xuất nội bộ sang chuồng', code: 'XK000004', change: -60, post: selectedItemForDetail.stock, person: 'Trần Văn Bình', note: 'Xuất cám cho Chuồng A1 cữ sáng' },
                      { date: '2026-10-20', type: 'Xuất nội bộ sang chuồng', code: 'XK000003', change: -120, post: selectedItemForDetail.stock + 60, person: 'Nguyễn Văn An', note: 'Xuất cám cho Chuồng A2, A3' },
                      { date: '2026-10-18', type: 'Nhập hàng từ NCC', code: 'HDN-1026-01', change: +500, post: selectedItemForDetail.stock + 180, person: 'Nguyễn Hiep', note: 'Nhập lô hàng mới từ NCC An Phú' },
                      { date: '2026-10-01', type: 'Nhập kho đầu kỳ', code: 'DK-0001', change: selectedItemForDetail.stock, post: selectedItemForDetail.stock, person: 'Chủ trại', note: 'Kiểm kê số dư ban đầu' }
                    ].map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.date}</td>
                        <td><strong>{row.type}</strong></td>
                        <td><span style={{ fontFamily: 'monospace' }}>{row.code}</span></td>
                        <td>
                          <strong style={{ color: row.change > 0 ? 'var(--color-success)' : 'var(--color-signature-coral)' }}>
                            {row.change > 0 ? `+${row.change}` : row.change} {selectedItemForDetail.unit.split(' ')[0]}
                          </strong>
                        </td>
                        <td><strong>{row.post.toLocaleString()}</strong></td>
                        <td>{row.person}</td>
                        <td style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="farmshift-modal-footer">
              <button
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => setSelectedItemForDetail(null)}
              >
                Đóng thẻ kho
              </button>
            </div>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
