// src/features/farmshift/PurchasesView.jsx
// Quản lý Hóa đơn nhập hàng, Nhà cung cấp & Tags chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import {
  FileText, Plus, Search, FileSpreadsheet, Eye, Sparkles,
  Camera, CheckCircle, Clock, DollarSign, Upload, Users, Tag, X, Building
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useNotification } from '../../context/NotificationContext';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';

export const PurchasesView = () => {
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'suppliers' | 'tags'
  const [purchases, setPurchases] = useState(INITIAL_FARMSHIFT_DATA.purchases);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);

  // Suppliers state (from FarmShift-clone/Hóa đơn nhập - Nhà cung cấp.html)
  const [suppliers, setSuppliers] = useState([
    { id: 'sup-1', name: 'Công ty CP Chăn nuôi C.P. Việt Nam', phone: '024 3822 0000', address: 'KCN Biên Hòa II, Đồng Nai', totalPurchased: 180750000, debt: 68250000, note: 'Nhà cung cấp cám Higro độc quyền' },
    { id: 'sup-2', name: 'Tập đoàn Dabaco Việt Nam', phone: '0222 3826 077', address: 'Số 35 Lý Thái Tổ, Bắc Ninh', totalPurchased: 92500000, debt: 0, note: 'Cung cấp con giống gà J-Dabaco, Mía Dabaco' },
    { id: 'sup-3', name: 'Công ty Thuốc Thú y Hanvet', phone: '024 3858 3583', address: 'KCN Đồng Văn, Hà Nam', totalPurchased: 8560000, debt: 0, note: 'Vắc-xin Lasota, Gumboro, kháng sinh' },
    { id: 'sup-4', name: 'Công ty Hóa chất FAVET', phone: '024 3681 1234', address: 'Thường Tín, Hà Nội', totalPurchased: 4500000, debt: 0, note: 'Thuốc sát trùng chuồng trại BKC' },
  ]);

  // Tags state (from FarmShift-clone/Tags.html)
  const [tags, setTags] = useState([
    { id: 'tag-1', name: 'Cám Giai đoạn 1 (Úm)', color: '#019788', usageCount: 6 },
    { id: 'tag-2', name: 'Cám Giai đoạn 2 (Thịt)', color: '#795548', usageCount: 12 },
    { id: 'tag-3', name: 'Vắc-xin phòng định kỳ', color: '#0288d1', usageCount: 8 },
    { id: 'tag-4', name: 'Gà giống đợt tháng 9', color: '#aa2d00', usageCount: 3 },
  ]);

  // New purchase state
  const [newPo, setNewPo] = useState({
    supplier: 'Công ty CP Chăn nuôi C.P. Việt Nam',
    date: new Date().toISOString().split('T')[0],
    note: '',
    paymentStatus: 'Thanh toán hoàn tất',
    items: [
      { name: 'Cám Gà thịt Higro 02', qty: 50, unit: 'Bao (25kg)', price: 335000 }
    ]
  });

  const handleAddItemRow = () => {
    setNewPo({
      ...newPo,
      items: [...newPo.items, { name: '', qty: 10, unit: 'Bao (25kg)', price: 0 }]
    });
  };

  const handleCreatePo = (e) => {
    e.preventDefault();
    const totalAmount = newPo.items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.price)), 0);
    const created = {
      id: `po-${Date.now()}`,
      code: `NH00000${purchases.length}`,
      date: newPo.date,
      supplier: newPo.supplier,
      totalAmount,
      paymentStatus: newPo.paymentStatus,
      stockStatus: 'Đã nhập kho',
      note: newPo.note,
      items: newPo.items.map(it => ({
        ...it,
        amount: Number(it.qty) * Number(it.price)
      }))
    };
    setPurchases([created, ...purchases]);
    setShowAddModal(false);
  };

  const filteredPurchases = purchases.filter(p => {
    const matchSearch = p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (filterPayment === 'ALL') return true;
    return p.paymentStatus.includes(filterPayment);
  });

  return (
    <FarmShiftLayout
      pageTitle="Hóa đơn nhập hàng & Nhà cung cấp"
      breadcrumbs={[{ label: 'Hóa đơn nhập hàng' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="farmshift-btn farmshift-btn-secondary"
            style={{ color: 'var(--color-primary)' }}
            onClick={() => setShowOcrModal(true)}
          >
            <Sparkles size={16} /> AI OCR Bóc tách hóa đơn A4
          </button>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button
            className="farmshift-btn farmshift-btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> Tạo đơn nhập hàng
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
          Hóa đơn nhập hàng ({purchases.length})
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
          onClick={() => setActiveTab('suppliers')}
        >
          Nhà cung cấp ({suppliers.length})
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'tags' ? 'active' : ''}`}
          onClick={() => setActiveTab('tags')}
        >
          Thẻ Tags phân loại ({tags.length})
        </button>
      </div>

      {/* ── Tab 1: Danh sách hóa đơn nhập hàng ──────────── */}
      {activeTab === 'orders' && (
        <>
          <div className="farmshift-toolbar">
            <div className="farmshift-search-box">
              <Search size={16} color="var(--color-muted)" />
              <input
                type="text"
                placeholder="Tìm theo mã hóa đơn (NH000...), Nhà cung cấp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="farmshift-filter-group">
              <select
                className="farmshift-select"
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
              >
                <option value="ALL">Tất cả thanh toán</option>
                <option value="hoàn tất">Đã thanh toán hoàn tất</option>
                <option value="Trả sau">Trả sau / Công nợ</option>
                <option value="thiếu">Thanh toán còn thiếu</option>
              </select>
            </div>
          </div>

          <div className="farmshift-card">
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Ngày nhập</th>
                    <th>Nhà cung cấp</th>
                    <th>Tổng tiền</th>
                    <th>Thanh toán</th>
                    <th>Kho hàng</th>
                    <th>Ghi chú</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map(p => (
                    <tr key={p.id}>
                      <td>
                        <strong style={{ color: 'var(--color-ink)', fontSize: '14px', fontFamily: 'monospace' }}>
                          {p.code}
                        </strong>
                      </td>
                      <td>{p.date}</td>
                      <td><strong>{p.supplier}</strong></td>
                      <td>
                        <strong style={{ fontSize: '14.5px', color: 'var(--color-ink)' }}>
                          {p.totalAmount.toLocaleString('vi-VN')} đ
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`farmshift-badge ${p.paymentStatus.includes('hoàn tất')
                              ? 'farmshift-badge-success'
                              : p.paymentStatus.includes('Trả sau')
                                ? 'farmshift-badge-warning'
                                : 'farmshift-badge-danger'
                            }`}
                        >
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <span className="farmshift-badge farmshift-badge-info">
                          {p.stockStatus}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-muted)', fontSize: '13px', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.note}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="farmshift-btn farmshift-btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                          onClick={() => setSelectedOrder(p)}
                        >
                          <Eye size={13} /> Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab 2: Danh sách Nhà cung cấp ─────────────────── */}
      {activeTab === 'suppliers' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh sách Nhà cung cấp vật tư & con giống</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên nhà cung cấp</th>
                  <th>Số điện thoại</th>
                  <th>Địa chỉ</th>
                  <th>Tổng nhập lũy kế</th>
                  <th>Công nợ hiện tại</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(sup => (
                  <tr key={sup.id}>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{sup.name}</strong></td>
                    <td>{sup.phone}</td>
                    <td>{sup.address}</td>
                    <td><strong>{sup.totalPurchased.toLocaleString('vi-VN')} đ</strong></td>
                    <td>
                      <span className={`farmshift-badge ${sup.debt > 0 ? 'farmshift-badge-warning' : 'farmshift-badge-success'}`}>
                        {sup.debt > 0 ? `Nợ: ${sup.debt.toLocaleString('vi-VN')} đ` : 'Hết nợ'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-muted)' }}>{sup.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Danh sách Thẻ Tags ────────────────────── */}
      {activeTab === 'tags' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Thẻ Tags phân loại hóa đơn chứng từ</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên thẻ Tag</th>
                  <th>Màu sắc nhận diện</th>
                  <th>Số hóa đơn sử dụng</th>
                </tr>
              </thead>
              <tbody>
                {tags.map(t => (
                  <tr key={t.id}>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 12px',
                          borderRadius: 'var(--rounded-pill)',
                          backgroundColor: `${t.color}15`,
                          color: t.color,
                          fontWeight: 500,
                          fontSize: '13px'
                        }}
                      >
                        <Tag size={13} /> {t.name}
                      </span>
                    </td>
                    <td><span style={{ fontFamily: 'monospace' }}>{t.color}</span></td>
                    <td><strong>{t.usageCount}</strong> đơn hàng</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Chi tiết đơn nhập hàng ────────────────── */}
      {selectedOrder && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '700px' }}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">
                Chi tiết hóa đơn {selectedOrder.code}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                ✕
              </button>
            </div>
            <div className="farmshift-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', backgroundColor: 'var(--color-surface-soft)', padding: '14px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Nhà cung cấp:</div>
                  <strong style={{ fontSize: '14px', color: 'var(--color-ink)' }}>{selectedOrder.supplier}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Ngày lập đơn:</div>
                  <strong style={{ fontSize: '14px', color: 'var(--color-ink)' }}>{selectedOrder.date}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Trạng thái thanh toán:</div>
                  <span className="farmshift-badge farmshift-badge-success">{selectedOrder.paymentStatus}</span>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Tổng tiền hóa đơn:</div>
                  <strong style={{ fontSize: '16px', color: 'var(--color-primary)' }}>{selectedOrder.totalAmount.toLocaleString('vi-VN')} đ</strong>
                </div>
              </div>

              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Danh sách mặt hàng:</div>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mặt hàng</th>
                    <th>Số lượng</th>
                    <th>Đơn giá</th>
                    <th style={{ textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td><strong>{it.name}</strong></td>
                      <td>{it.qty} {it.unit}</td>
                      <td>{it.price.toLocaleString('vi-VN')} đ</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{(it.qty * it.price).toLocaleString('vi-VN')} đ</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="farmshift-modal-footer">
              <button
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => setSelectedOrder(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Tạo đơn nhập hàng mới ─────────────────── */}
      {showAddModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '750px' }}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Tạo mới đơn nhập hàng</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePo}>
              <div className="farmshift-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Nhà cung cấp *</label>
                    <select
                      className="farmshift-form-control"
                      value={newPo.supplier}
                      onChange={(e) => setNewPo({ ...newPo, supplier: e.target.value })}
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngày nhập đơn *</label>
                    <input
                      type="date"
                      className="farmshift-form-control"
                      value={newPo.date}
                      onChange={(e) => setNewPo({ ...newPo, date: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ fontSize: '13.5px', fontWeight: 500, marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Chi tiết các mặt hàng nhập:</span>
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={handleAddItemRow}
                  >
                    + Thêm dòng hàng
                  </button>
                </div>

                {newPo.items.map((row, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Tên hàng"
                      className="farmshift-form-control"
                      value={row.name}
                      onChange={(e) => {
                        const updated = [...newPo.items];
                        updated[idx].name = e.target.value;
                        setNewPo({ ...newPo, items: updated });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Số lượng"
                      className="farmshift-form-control"
                      value={row.qty}
                      onChange={(e) => {
                        const updated = [...newPo.items];
                        updated[idx].qty = e.target.value;
                        setNewPo({ ...newPo, items: updated });
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Đơn vị"
                      className="farmshift-form-control"
                      value={row.unit}
                      onChange={(e) => {
                        const updated = [...newPo.items];
                        updated[idx].unit = e.target.value;
                        setNewPo({ ...newPo, items: updated });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Đơn giá"
                      className="farmshift-form-control"
                      value={row.price}
                      onChange={(e) => {
                        const updated = [...newPo.items];
                        updated[idx].price = e.target.value;
                        setNewPo({ ...newPo, items: updated });
                      }}
                    />
                  </div>
                ))}

                <div className="farmshift-form-group" style={{ marginTop: '14px' }}>
                  <label className="farmshift-form-label">Ghi chú đơn nhập</label>
                  <input
                    type="text"
                    placeholder="Nhập cám bổ sung cho lứa tháng 10..."
                    className="farmshift-form-control"
                    value={newPo.note}
                    onChange={(e) => setNewPo({ ...newPo, note: e.target.value })}
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
                  Lưu hóa đơn nhập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: AI OCR Demo ───────────────────────────── */}
      {showOcrModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '650px' }}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                <Sparkles size={18} /> AI OCR Bóc tách phiếu nhập / Hóa đơn A4
              </h3>
              <button
                onClick={() => setShowOcrModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                ✕
              </button>
            </div>
            <div className="farmshift-modal-body">
              <div
                style={{
                  border: '2px dashed var(--color-border-strong)',
                  borderRadius: 'var(--rounded-lg)',
                  padding: '30px',
                  textAlign: 'center',
                  backgroundColor: 'var(--color-surface-soft)',
                  cursor: 'pointer',
                  marginBottom: '16px'
                }}
              >
                <Upload size={36} color="var(--color-primary)" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontWeight: 500, color: 'var(--color-ink)' }}>Kéo thả hoặc bấm để tải ảnh Hóa đơn / Phiếu xuất kho</div>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '4px' }}>Hỗ trợ định dạng JPG, PNG, PDF (khổ A4 hoặc hóa đơn đỏ)</div>
              </div>

              <div style={{ backgroundColor: 'var(--color-surface-soft)', padding: '14px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-hairline)', fontSize: '13px' }}>
                <strong style={{ color: 'var(--color-ink)' }}>Trí tuệ nhân tạo sẽ tự động:</strong>
                <ul style={{ margin: '6px 0 0 18px', padding: 0, color: 'var(--color-body)' }}>
                  <li>Nhận diện tên Nhà cung cấp, ngày lập đơn và số hóa đơn</li>
                  <li>Bóc tách bảng danh sách mặt hàng, số lượng bao/kg và đơn giá</li>
                  <li>Tự động điền dữ liệu vào form tạo đơn nhập và khớp tồn kho</li>
                </ul>
              </div>
            </div>
            <div className="farmshift-modal-footer">
              <button
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => setShowOcrModal(false)}
              >
                Đóng
              </button>
              <button
                className="farmshift-btn farmshift-btn-primary"
                onClick={() => {
                  showToast('MSG30');
                  setShowOcrModal(false);
                  setShowAddModal(true);
                }}
              >
                Thử bóc tách hóa đơn mẫu C.P.
              </button>
            </div>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
