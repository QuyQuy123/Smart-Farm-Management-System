// src/features/farmshift/TransfersView.jsx
// Xuất nhập nội bộ & Luân chuyển kho chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import {
  ArrowLeftRight, Plus, Search, FileSpreadsheet, CheckCircle,
  Package, Warehouse, RefreshCw, X, Trash2, FileText, ExternalLink
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';

export const TransfersView = () => {
  const [activeTab, setActiveTab] = useState('slips'); // 'slips' | 'categories'

  // Slips List (Xuất nhập nội bộ.html)
  const [slips, setSlips] = useState([
    {
      id: 'tf-1',
      code: 'EC000000',
      itemCount: 2,
      totalQty: 10,
      category: 'Sử dụng nội bộ',
      type: 'Xuất kho',
      from: 'Kho Thuốc thú y',
      to: 'Khu J Thịt - Nhà B1',
      status: 'Hoàn thành',
      date: '06/10/2026',
      note: 'Xuất 10 gói Paracetamol C cho chuồng J1'
    },
    {
      id: 'tf-2',
      code: 'CK000005',
      itemCount: 1,
      totalQty: 40,
      category: 'Chuyển kho nội bộ',
      type: 'Chuyển kho',
      from: 'Kho Cám & Thức ăn',
      to: 'Kho đệm Nhà A (Khu Mía Thịt)',
      status: 'Hoàn thành',
      date: '04/10/2026',
      note: 'Chuyển 40 bao cám Higro 02 sang kho đệm'
    },
    {
      id: 'tf-3',
      code: 'IC000001',
      itemCount: 5,
      totalQty: 250,
      category: 'Cân bằng kho nhập',
      type: 'Nhập kho',
      from: 'Kiểm kê kho định kỳ',
      to: 'Kho Cám & Thức ăn',
      status: 'Hoàn thành',
      date: '06/10/2026',
      note: 'Nhập kho để cân bằng số lượng tồn kho thực tế'
    },
    {
      id: 'tf-4',
      code: 'EC000001',
      itemCount: 1,
      totalQty: 2,
      category: 'Xuất hủy',
      type: 'Xuất kho',
      from: 'Kho Vắc-xin',
      to: 'Hủy bỏ',
      status: 'Hoàn thành',
      date: '28/09/2026',
      note: 'Hủy 2 lọ vắc-xin bảo quản quá hạn'
    }
  ]);

  // Categories List (Danh mục phiếu.html)
  const [categories, setCategories] = useState([
    { code: 'IC000001', type: 'Nhập kho', name: 'Cân bằng kho nhập', desc: 'Nhập kho để cân bằng số lượng tồn thực tế.', slipCount: 1, date: '06/10/2026' },
    { code: 'EC000000', type: 'Xuất kho', name: 'Sử dụng nội bộ', desc: 'Xuất kho phục vụ cho ăn, thuốc điều trị tại các chuồng.', slipCount: 12, date: '01/10/2026' },
    { code: 'CK000001', type: 'Chuyển kho', name: 'Chuyển kho nội bộ', desc: 'Điều chuyển vật tư, cám giữa các kho phụ và kho đệm.', slipCount: 5, date: '01/10/2026' },
    { code: 'EC000002', type: 'Xuất kho', name: 'Xuất hủy', desc: 'Xuất bỏ hàng hỏng, vắc-xin quá hạn, cám mốc.', slipCount: 2, date: '25/09/2026' },
    { code: 'IC000002', type: 'Nhập kho', name: 'Nhập đầu kỳ', desc: 'Ghi nhận số lượng tồn kho ban đầu khi mở trại.', slipCount: 1, date: '01/09/2026' },
  ]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Modals
  const [showCreateSlipModal, setShowCreateSlipModal] = useState(false);
  const [showCreateCatModal, setShowCreateCatModal] = useState(false);
  const [selectedSlipDetail, setSelectedSlipDetail] = useState(null);

  // New Slip Form State
  const [newSlip, setNewSlip] = useState({
    type: 'Xuất kho',
    category: 'Sử dụng nội bộ',
    from: 'Kho Cám & Thức ăn',
    to: 'Khu Mía Thịt - Nhà A1',
    date: new Date().toLocaleDateString('vi-VN'),
    note: '',
    items: [
      { name: 'Cám Higro 01', qty: 10, unit: 'Bao (25kg)', price: 360000 }
    ]
  });

  // New Category State
  const [newCat, setNewCat] = useState({
    type: 'Xuất kho',
    name: '',
    desc: ''
  });

  const handleAddItemRow = () => {
    setNewSlip({
      ...newSlip,
      items: [
        ...newSlip.items,
        { name: 'Paracetamol C', qty: 5, unit: 'Gói (1kg)', price: 110000 }
      ]
    });
  };

  const handleRemoveItemRow = (index) => {
    setNewSlip({
      ...newSlip,
      items: newSlip.items.filter((_, i) => i !== index)
    });
  };

  const handleCreateSlip = (e) => {
    e.preventDefault();
    const prefix = newSlip.type === 'Nhập kho' ? 'IC' : newSlip.type === 'Chuyển kho' ? 'CK' : 'EC';
    const totalQty = newSlip.items.reduce((acc, it) => acc + Number(it.qty || 0), 0);
    const created = {
      id: `tf-${Date.now()}`,
      code: `${prefix}00000${slips.length + 1}`,
      itemCount: newSlip.items.length,
      totalQty,
      category: newSlip.category,
      type: newSlip.type,
      from: newSlip.from,
      to: newSlip.to,
      status: 'Hoàn thành',
      date: newSlip.date,
      note: newSlip.note || 'Phiếu lập tự động'
    };
    setSlips([created, ...slips]);
    setShowCreateSlipModal(false);
  };

  const handleCreateCategory = (e) => {
    e.preventDefault();
    if (!newCat.name) return;
    const prefix = newCat.type === 'Nhập kho' ? 'IC' : newCat.type === 'Chuyển kho' ? 'CK' : 'EC';
    const created = {
      code: `${prefix}00000${categories.length + 1}`,
      type: newCat.type,
      name: newCat.name,
      desc: newCat.desc,
      slipCount: 0,
      date: new Date().toLocaleDateString('vi-VN')
    };
    setCategories([...categories, created]);
    setShowCreateCatModal(false);
    setNewCat({ type: 'Xuất kho', name: '', desc: '' });
  };

  const filteredSlips = slips.filter(s => {
    const matchSearch = s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.to.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (filterType !== 'ALL' && s.type !== filterType) return false;
    if (filterCategory !== 'ALL' && s.category !== filterCategory) return false;
    return true;
  });

  return (
    <FarmShiftLayout
      pageTitle="Xuất nhập nội bộ"
      breadcrumbs={[{ label: 'Xuất nhập nội bộ' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          {activeTab === 'slips' ? (
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowCreateSlipModal(true)}
            >
              <Plus size={16} /> Tạo phiếu
            </button>
          ) : (
            <button
              className="farmshift-btn farmshift-btn-primary"
              onClick={() => setShowCreateCatModal(true)}
            >
              <Plus size={16} /> Thêm danh mục
            </button>
          )}
        </div>
      }
    >
      {/* ── Tabs Navigation: Phiếu xuất nhập vs Danh mục phiếu ── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'slips' ? 'active' : ''}`}
          onClick={() => setActiveTab('slips')}
        >
          <ArrowLeftRight size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Phiếu xuất nhập nội bộ
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          <FileText size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Danh mục phiếu
        </button>
      </div>

      {/* ── TAB 1: Phiếu xuất nhập nội bộ (Xuất nhập nội bộ.html) ── */}
      {activeTab === 'slips' && (
        <div>
          <div className="farmshift-toolbar">
            <div className="farmshift-search-box">
              <Search size={16} color="var(--color-muted)" />
              <input
                type="text"
                placeholder="Tìm theo mã phiếu, lý do, kho nguồn, kho đích..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="farmshift-filter-group">
              <select
                className="farmshift-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="ALL">Tất cả loại phiếu</option>
                <option value="Xuất kho">Xuất kho</option>
                <option value="Chuyển kho">Chuyển kho</option>
                <option value="Nhập kho">Nhập kho</option>
              </select>

              <select
                className="farmshift-select"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="ALL">Tất cả danh mục</option>
                <option value="Sử dụng nội bộ">Sử dụng nội bộ</option>
                <option value="Chuyển kho nội bộ">Chuyển kho nội bộ</option>
                <option value="Cân bằng kho nhập">Cân bằng kho nhập</option>
                <option value="Xuất hủy">Xuất hủy</option>
              </select>
            </div>
          </div>

          <div className="farmshift-card">
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã Phiếu</th>
                    <th>Số mã hàng</th>
                    <th>Số lượng</th>
                    <th>Danh mục</th>
                    <th>Loại phiếu</th>
                    <th>Kho xuất / Nguồn</th>
                    <th>Kho nhận / Đích</th>
                    <th>Ngày chứng từ</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'right' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSlips.map(s => (
                    <tr key={s.id}>
                      <td>
                        <strong
                          style={{ fontFamily: 'monospace', color: 'var(--color-link)', cursor: 'pointer' }}
                          onClick={() => setSelectedSlipDetail(s)}
                        >
                          {s.code}
                        </strong>
                      </td>
                      <td>{s.itemCount} mã</td>
                      <td>
                        <strong style={{ color: 'var(--color-ink)' }}>{s.totalQty}</strong> đơn vị
                      </td>
                      <td><strong>{s.category}</strong></td>
                      <td>
                        <span className="farmshift-badge farmshift-badge-neutral">{s.type}</span>
                      </td>
                      <td>{s.from}</td>
                      <td>{s.to}</td>
                      <td>{s.date}</td>
                      <td>
                        <span className="farmshift-badge farmshift-badge-success">{s.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="farmshift-btn farmshift-btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                          onClick={() => setSelectedSlipDetail(s)}
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Danh mục phiếu (Danh mục phiếu.html) ─────── */}
      {activeTab === 'categories' && (
        <div className="farmshift-card">
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Mã danh mục</th>
                  <th>Loại phiếu</th>
                  <th>Tên danh mục</th>
                  <th>Mô tả quy cách</th>
                  <th>Số phiếu</th>
                  <th>Ngày tạo</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.code}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--color-muted)' }}>
                        {cat.code}
                      </span>
                    </td>
                    <td>
                      <span className="farmshift-badge farmshift-badge-neutral">{cat.type}</span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--color-ink)' }}>{cat.name}</strong>
                    </td>
                    <td style={{ color: 'var(--color-muted)', fontSize: '13px' }}>{cat.desc}</td>
                    <td>
                      <span className="farmshift-badge farmshift-badge-neutral">{cat.slipCount} phiếu</span>
                    </td>
                    <td>{cat.date}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="farmshift-btn farmshift-btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => alert(`Chỉnh sửa danh mục ${cat.name}`)}
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Tạo phiếu xuất nhập nội bộ (Tạo phiếu xuất nhập nội bộ.html) ── */}
      {showCreateSlipModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '780px' }}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Tạo phiếu xuất nhập nội bộ</h3>
              <button
                onClick={() => setShowCreateSlipModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSlip}>
              <div className="farmshift-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Loại phiếu *</label>
                    <select
                      className="farmshift-form-control"
                      value={newSlip.type}
                      onChange={(e) => setNewSlip({ ...newSlip, type: e.target.value })}
                    >
                      <option value="Xuất kho">Xuất kho sử dụng</option>
                      <option value="Chuyển kho">Chuyển kho nội bộ</option>
                      <option value="Nhập kho">Nhập cân bằng kho</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Danh mục lý do *</label>
                    <select
                      className="farmshift-form-control"
                      value={newSlip.category}
                      onChange={(e) => setNewSlip({ ...newSlip, category: e.target.value })}
                    >
                      {categories.map(c => (
                        <option key={c.code} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngày chứng từ</label>
                    <input
                      type="text"
                      className="farmshift-form-control"
                      value={newSlip.date}
                      onChange={(e) => setNewSlip({ ...newSlip, date: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Kho xuất / Nguồn đi *</label>
                    <input
                      type="text"
                      className="farmshift-form-control"
                      value={newSlip.from}
                      onChange={(e) => setNewSlip({ ...newSlip, from: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Kho nhận / Chuồng đến *</label>
                    <input
                      type="text"
                      className="farmshift-form-control"
                      value={newSlip.to}
                      onChange={(e) => setNewSlip({ ...newSlip, to: e.target.value })}
                    />
                  </div>
                </div>

                {/* Line items table */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--color-ink)' }}>Danh sách hàng hóa trong phiếu</strong>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="farmshift-btn farmshift-btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => alert('Đã sẵn sàng tải file Excel mẫu để nhập hàng loạt!')}
                      >
                        Nhập từ Excel
                      </button>
                      <button
                        type="button"
                        className="farmshift-btn farmshift-btn-primary"
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={handleAddItemRow}
                      >
                        <Plus size={13} /> Thêm dòng
                      </button>
                    </div>
                  </div>

                  <table className="farmshift-table" style={{ border: '1px solid var(--color-hairline)' }}>
                    <thead>
                      <tr>
                        <th>Tên hàng hoá</th>
                        <th style={{ width: '100px' }}>Số lượng</th>
                        <th style={{ width: '110px' }}>Đơn vị</th>
                        <th style={{ width: '130px' }}>Đơn giá (đ)</th>
                        <th style={{ width: '140px' }}>Thành tiền</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newSlip.items.map((it, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              type="text"
                              className="farmshift-form-control"
                              style={{ height: '34px', padding: '4px 8px' }}
                              value={it.name}
                              onChange={(e) => {
                                const copy = [...newSlip.items];
                                copy[idx].name = e.target.value;
                                setNewSlip({ ...newSlip, items: copy });
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="farmshift-form-control"
                              style={{ height: '34px', padding: '4px 8px' }}
                              value={it.qty}
                              onChange={(e) => {
                                const copy = [...newSlip.items];
                                copy[idx].qty = Number(e.target.value);
                                setNewSlip({ ...newSlip, items: copy });
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="farmshift-form-control"
                              style={{ height: '34px', padding: '4px 8px' }}
                              value={it.unit}
                              onChange={(e) => {
                                const copy = [...newSlip.items];
                                copy[idx].unit = e.target.value;
                                setNewSlip({ ...newSlip, items: copy });
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="farmshift-form-control"
                              style={{ height: '34px', padding: '4px 8px' }}
                              value={it.price}
                              onChange={(e) => {
                                const copy = [...newSlip.items];
                                copy[idx].price = Number(e.target.value);
                                setNewSlip({ ...newSlip, items: copy });
                              }}
                            />
                          </td>
                          <td>
                            <strong style={{ fontSize: '13px' }}>
                              {((it.qty || 0) * (it.price || 0)).toLocaleString('vi-VN')} đ
                            </strong>
                          </td>
                          <td>
                            {newSlip.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-signature-coral)' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Mô tả / Ghi chú</label>
                  <textarea
                    rows="2"
                    placeholder="Diễn giải nguyên nhân xuất kho hoặc mục đích điều chuyển..."
                    className="farmshift-form-control"
                    value={newSlip.note}
                    onChange={(e) => setNewSlip({ ...newSlip, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowCreateSlipModal(false)}
                >
                  Bỏ qua
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Lưu phiếu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Thêm mới danh mục phiếu ─────────────────── */}
      {showCreateCatModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Thêm mới danh mục phiếu</h3>
              <button
                onClick={() => setShowCreateCatModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Loại phiếu áp dụng *</label>
                  <select
                    className="farmshift-form-control"
                    value={newCat.type}
                    onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}
                  >
                    <option value="Xuất kho">Xuất kho</option>
                    <option value="Chuyển kho">Chuyển kho</option>
                    <option value="Nhập kho">Nhập kho</option>
                  </select>
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Tên danh mục *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Cân bằng kho nhập, Sử dụng thử nghiệm..."
                    className="farmshift-form-control"
                    value={newCat.name}
                    onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  />
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Mô tả mục đích</label>
                  <textarea
                    rows="2"
                    placeholder="Diễn giải mục đích áp dụng..."
                    className="farmshift-form-control"
                    value={newCat.desc}
                    onChange={(e) => setNewCat({ ...newCat, desc: e.target.value })}
                  />
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowCreateCatModal(false)}
                >
                  Bỏ qua
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Lưu danh mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Chi tiết phiếu xuất nhập nội bộ ────────── */}
      {selectedSlipDetail && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal" style={{ maxWidth: '650px' }}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">
                Chi tiết phiếu: {selectedSlipDetail.code}
              </h3>
              <button
                onClick={() => setSelectedSlipDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="farmshift-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', backgroundColor: 'var(--color-surface-soft)', padding: '14px', borderRadius: 'var(--rounded-md)' }}>
                <div>• Loại phiếu: <strong>{selectedSlipDetail.type}</strong></div>
                <div>• Danh mục: <strong>{selectedSlipDetail.category}</strong></div>
                <div>• Kho nguồn: <strong>{selectedSlipDetail.from}</strong></div>
                <div>• Kho đích: <strong>{selectedSlipDetail.to}</strong></div>
                <div>• Ngày tạo: <strong>{selectedSlipDetail.date}</strong></div>
                <div>• Trạng thái: <span className="farmshift-badge farmshift-badge-success">{selectedSlipDetail.status}</span></div>
              </div>
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--color-ink)' }}>Ghi chú điều chuyển:</strong>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--color-body)' }}>
                  {selectedSlipDetail.note}
                </p>
              </div>
            </div>
            <div className="farmshift-modal-footer">
              <button
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => setSelectedSlipDetail(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
