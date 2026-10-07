// src/features/farmshift/CashbookView.jsx
// Sổ quỹ & Quản lý Thu Chi chăn nuôi chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import {
  DollarSign, Plus, Search, FileSpreadsheet, ArrowDownRight,
  ArrowUpRight, Wallet, CheckCircle, Calendar, Filter, ArrowRightLeft,
  X, Layers, Building
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';

export const CashbookView = () => {
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'funds' | 'categories' | 'transfers'
  const [transactions, setTransactions] = useState(INITIAL_FARMSHIFT_DATA.cashbook);
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState('Thu');
  const [showFundTransferModal, setShowFundTransferModal] = useState(false);

  // Funds state (from FarmShift-clone/Sổ quỹ/Nguồn quỹ.html)
  const [funds, setFunds] = useState([
    { id: 'f-1', name: 'Tài khoản MB Bank (TK Chính)', accountNo: '0987654321', bank: 'Ngân hàng Quân Đội', balance: 228920000, note: 'Tài khoản nhận tiền bán sỉ & thanh toán cám' },
    { id: 'f-2', name: 'Tiền mặt tại quỹ trại', accountNo: '—', bank: 'Quỹ thủ quỹ', balance: 53200000, note: 'Chi trả tiền điện, xăng xe, chi tiêu vặt hàng ngày' },
    { id: 'f-3', name: 'Tài khoản Vietcombank dự phòng', accountNo: '1023456789', bank: 'Vietcombank', balance: 50000000, note: 'Quỹ dự phòng rủi ro dịch bệnh' },
  ]);

  // Fund Transfers state (from FarmShift-clone/Sổ quỹ/Chuyển quỹ nội bộ.html)
  const [fundTransfers, setFundTransfers] = useState([
    { id: 'cq-1', code: 'CQ000005', date: '2026-10-01', from: 'Tài khoản MB Bank', to: 'Tiền mặt tại quỹ trại', amount: 20000000, fee: 0, note: 'Rút tiền mặt chi lương và vật tư tiêu hao', creator: 'Nguyễn Văn Hải' },
    { id: 'cq-2', code: 'CQ000004', date: '2026-09-28', from: 'Tiền mặt tại quỹ trại', to: 'Tài khoản MB Bank', amount: 150000000, fee: 0, note: 'Nộp tiền mặt bán gà chuồng J1 vào tài khoản', creator: 'Nguyễn Văn Hải' },
  ]);

  // Transaction categories (from FarmShift-clone/Sổ quỹ/Loại phiếu thu.html & Loại phiếu chi.html)
  const [txCategories] = useState([
    { id: 1, name: 'Đơn bán gà', type: 'Thu', group: 'Doanh thu chính', note: 'Thu tiền xuất bán gà thịt' },
    { id: 2, name: 'Thu hồi công nợ', type: 'Thu', group: 'Công nợ', note: 'Khách hàng thanh toán nợ cũ' },
    { id: 3, name: 'Tiền thức ăn (Cám)', type: 'Chi', group: 'Chi phí biến đổi', note: 'Thanh toán tiền cám theo lứa' },
    { id: 4, name: 'Tiền con giống', type: 'Chi', group: 'Chi phí biến đổi', note: 'Mua giống gà từ Dabaco' },
    { id: 5, name: 'Thuốc thú y & vắc-xin', type: 'Chi', group: 'Chi phí thú y', note: 'Phòng và trị bệnh' },
    { id: 6, name: 'Tiền điện & nước', type: 'Chi', group: 'Chi phí vận hành', note: 'Hệ thống quạt làm mát' },
    { id: 7, name: 'Tiền lương công nhân', type: 'Chi', group: 'Chi phí nhân công', note: 'Chi lương tháng' },
  ]);

  // New Transaction Form
  const [newTx, setNewTx] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Đơn bán gà',
    amount: '',
    contact: 'Khách hàng',
    name: '',
    fund: 'Tài khoản MB Bank',
    note: ''
  });

  // New Fund Transfer Form
  const [newTransfer, setNewTransfer] = useState({
    date: new Date().toISOString().split('T')[0],
    from: 'Tài khoản MB Bank',
    to: 'Tiền mặt tại quỹ trại',
    amount: '',
    note: ''
  });

  const totalRevenue = transactions.filter(t => t.type === 'Thu').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'Chi').reduce((sum, t) => sum + t.amount, 0);
  const totalFundsBalance = funds.reduce((sum, f) => sum + f.balance, 0);

  const handleCreateTx = (e) => {
    e.preventDefault();
    const amt = Number(newTx.amount) || 0;
    const created = {
      id: `cb-${Date.now()}`,
      code: modalType === 'Thu' ? `PT0000${transactions.length + 22}` : `PC0000${transactions.length + 36}`,
      date: newTx.date,
      type: modalType,
      category: newTx.category,
      amount: amt,
      contact: newTx.contact,
      name: newTx.name,
      fund: newTx.fund,
      note: newTx.note,
      creator: INITIAL_FARMSHIFT_DATA.farmInfo.owner
    };
    setTransactions([created, ...transactions]);

    // Update fund balance
    setFunds(funds.map(f => {
      if (f.name.includes(newTx.fund)) {
        return {
          ...f,
          balance: modalType === 'Thu' ? f.balance + amt : f.balance - amt
        };
      }
      return f;
    }));

    setShowAddModal(false);
  };

  const handleCreateFundTransfer = (e) => {
    e.preventDefault();
    const amt = Number(newTransfer.amount) || 0;
    const created = {
      id: `cq-${Date.now()}`,
      code: `CQ00000${fundTransfers.length + 6}`,
      date: newTransfer.date,
      from: newTransfer.from,
      to: newTransfer.to,
      amount: amt,
      fee: 0,
      note: newTransfer.note,
      creator: INITIAL_FARMSHIFT_DATA.farmInfo.owner
    };
    setFundTransfers([created, ...fundTransfers]);

    // Update source and destination funds
    setFunds(funds.map(f => {
      if (f.name.includes(newTransfer.from)) return { ...f, balance: f.balance - amt };
      if (f.name.includes(newTransfer.to)) return { ...f, balance: f.balance + amt };
      return f;
    }));

    setShowFundTransferModal(false);
  };

  const filteredTx = transactions.filter(t => {
    const matchSearch = t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (filterType === 'ALL') return true;
    return t.type === filterType;
  });

  return (
    <FarmShiftLayout
      pageTitle="Sổ quỹ & Nguồn tiền"
      breadcrumbs={[{ label: 'Sổ quỹ' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="farmshift-btn farmshift-btn-excel">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button
            className="farmshift-btn farmshift-btn-secondary"
            onClick={() => setShowFundTransferModal(true)}
          >
            <ArrowRightLeft size={16} /> Chuyển quỹ nội bộ
          </button>
          <button
            className="farmshift-btn farmshift-btn-secondary"
            style={{ color: 'var(--color-signature-coral)', borderColor: 'var(--color-hairline)' }}
            onClick={() => { setModalType('Chi'); setNewTx({ ...newTx, category: 'Tiền thức ăn (Cám)' }); setShowAddModal(true); }}
          >
            <Plus size={16} /> Lập phiếu chi
          </button>
          <button
            className="farmshift-btn farmshift-btn-primary"
            onClick={() => { setModalType('Thu'); setNewTx({ ...newTx, category: 'Đơn bán gà' }); setShowAddModal(true); }}
          >
            <Plus size={16} /> Lập phiếu thu
          </button>
        </div>
      }
    >
      {/* ── Summary Stats (DESIGN.md Editorial Cards) ──────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG THU VÀO</div>
          <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-success)', marginTop: '6px' }}>
            +{totalRevenue.toLocaleString('vi-VN')} đ
          </div>
        </div>

        <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG CHI RA</div>
          <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-signature-coral)', marginTop: '6px' }}>
            -{totalExpense.toLocaleString('vi-VN')} đ
          </div>
        </div>

        <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG TỒN TẤT CẢ QUỸ</div>
          <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
            {totalFundsBalance.toLocaleString('vi-VN')} đ
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation ──────────────────────────────── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          Sổ quỹ thu chi ({transactions.length})
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'funds' ? 'active' : ''}`}
          onClick={() => setActiveTab('funds')}
        >
          Nguồn quỹ tiền ({funds.length})
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'transfers' ? 'active' : ''}`}
          onClick={() => setActiveTab('transfers')}
        >
          Chuyển quỹ nội bộ ({fundTransfers.length})
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Loại phiếu thu / chi ({txCategories.length})
        </button>
      </div>

      {/* ── Tab 1: Sổ quỹ thu chi ────────────────────────── */}
      {activeTab === 'ledger' && (
        <>
          <div className="farmshift-toolbar">
            <div className="farmshift-search-box">
              <Search size={16} color="var(--color-muted)" />
              <input
                type="text"
                placeholder="Tìm theo mã phiếu, người nộp/nhận, loại thu chi..."
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
                <option value="ALL">Tất cả thu / chi</option>
                <option value="Thu">Chỉ xem phiếu thu</option>
                <option value="Chi">Chỉ xem phiếu chi</option>
              </select>
            </div>
          </div>

          <div className="farmshift-card">
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Ngày ghi</th>
                    <th>Loại giao dịch</th>
                    <th>Số tiền</th>
                    <th>Đối tượng liên hệ</th>
                    <th>Người nộp/nhận</th>
                    <th>Quỹ tiền</th>
                    <th>Người tạo</th>
                    <th>Mô tả</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map(t => (
                    <tr key={t.id}>
                      <td>
                        <strong style={{ color: 'var(--color-ink)', fontFamily: 'monospace', fontSize: '14px' }}>
                          {t.code}
                        </strong>
                      </td>
                      <td>{t.date}</td>
                      <td>
                        <span
                          className={`farmshift-badge ${t.type === 'Thu' ? 'farmshift-badge-success' : 'farmshift-badge-danger'
                            }`}
                        >
                          {t.type === 'Thu' ? '↑ Thu' : '↓ Chi'} — {t.category}
                        </span>
                      </td>
                      <td>
                        <strong
                          style={{
                            fontSize: '14.5px',
                            color: t.type === 'Thu' ? 'var(--color-success)' : 'var(--color-signature-coral)'
                          }}
                        >
                          {t.type === 'Thu' ? '+' : '-'}{t.amount.toLocaleString('vi-VN')} đ
                        </strong>
                      </td>
                      <td>{t.contact}</td>
                      <td><strong>{t.name}</strong></td>
                      <td>
                        <span className="farmshift-badge farmshift-badge-neutral">{t.fund}</span>
                      </td>
                      <td style={{ color: 'var(--color-muted)' }}>{t.creator}</td>
                      <td style={{ color: 'var(--color-muted)', fontSize: '13px' }}>{t.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab 2: Nguồn quỹ tiền ────────────────────────── */}
      {activeTab === 'funds' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Các tài khoản & nguồn quỹ tiền tệ</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên nguồn quỹ</th>
                  <th>Số tài khoản</th>
                  <th>Ngân hàng / Đơn vị</th>
                  <th>Số dư khả dụng</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {funds.map(f => (
                  <tr key={f.id}>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{f.name}</strong></td>
                    <td style={{ fontFamily: 'monospace' }}>{f.accountNo}</td>
                    <td>{f.bank}</td>
                    <td>
                      <strong style={{ fontSize: '15px', color: 'var(--color-primary)' }}>
                        {f.balance.toLocaleString('vi-VN')} đ
                      </strong>
                    </td>
                    <td style={{ color: 'var(--color-muted)' }}>{f.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Chuyển quỹ nội bộ ─────────────────────── */}
      {activeTab === 'transfers' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Lịch sử điều chuyển tiền giữa các quỹ</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Ngày chuyển</th>
                  <th>Quỹ nguồn (Từ)</th>
                  <th>Quỹ đích (Đến)</th>
                  <th>Số tiền chuyển</th>
                  <th>Người thực hiện</th>
                  <th>Nội dung chuyển</th>
                </tr>
              </thead>
              <tbody>
                {fundTransfers.map(cq => (
                  <tr key={cq.id}>
                    <td><strong style={{ color: 'var(--color-ink)', fontFamily: 'monospace' }}>{cq.code}</strong></td>
                    <td>{cq.date}</td>
                    <td>{cq.from}</td>
                    <td><strong style={{ color: 'var(--fg-teal)' }}>{cq.to}</strong></td>
                    <td><strong>{cq.amount.toLocaleString('vi-VN')} đ</strong></td>
                    <td>{cq.creator}</td>
                    <td style={{ color: 'var(--color-muted)' }}>{cq.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 4: Loại phiếu thu / chi ──────────────────── */}
      {activeTab === 'categories' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh mục các khoản thu chi chăn nuôi</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên loại giao dịch</th>
                  <th>Phân loại</th>
                  <th>Nhóm chi phí</th>
                  <th>Diễn giải</th>
                </tr>
              </thead>
              <tbody>
                {txCategories.map(cat => (
                  <tr key={cat.id}>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{cat.name}</strong></td>
                    <td>
                      <span className={`farmshift-badge ${cat.type === 'Thu' ? 'farmshift-badge-success' : 'farmshift-badge-danger'}`}>
                        {cat.type}
                      </span>
                    </td>
                    <td>{cat.group}</td>
                    <td style={{ color: 'var(--color-muted)' }}>{cat.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Lập phiếu Thu / Chi ───────────────────── */}
      {showAddModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">
                {modalType === 'Thu' ? 'Lập phiếu thu tiền' : 'Lập phiếu chi tiền'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTx}>
              <div className="farmshift-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Loại thu / chi *</label>
                    <select
                      className="farmshift-form-control"
                      value={newTx.category}
                      onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                    >
                      {modalType === 'Thu' ? (
                        <>
                          <option value="Đơn bán gà">Đơn bán gà</option>
                          <option value="Thu hồi công nợ">Thu hồi công nợ</option>
                          <option value="Thu khác">Thu khác</option>
                        </>
                      ) : (
                        <>
                          <option value="Tiền thức ăn (Cám)">Tiền thức ăn (Cám)</option>
                          <option value="Tiền con giống">Tiền con giống</option>
                          <option value="Thuốc thú y & vắc-xin">Thuốc thú y & vắc-xin</option>
                          <option value="Tiền điện & nước">Tiền điện & nước trang trại</option>
                          <option value="Tiền lương công nhân">Tiền lương công nhân</option>
                          <option value="Chi phí khác">Chi phí khác</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngày giao dịch *</label>
                    <input
                      type="date"
                      className="farmshift-form-control"
                      value={newTx.date}
                      onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số tiền (đ) *</label>
                    <input
                      type="number"
                      required
                      placeholder="VD: 5000000"
                      className="farmshift-form-control"
                      value={newTx.amount}
                      onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Nguồn quỹ *</label>
                    <select
                      className="farmshift-form-control"
                      value={newTx.fund}
                      onChange={(e) => setNewTx({ ...newTx, fund: e.target.value })}
                    >
                      <option value="Tài khoản MB Bank">Tài khoản MB Bank</option>
                      <option value="Tiền mặt tại quỹ">Tiền mặt tại quỹ trại</option>
                      <option value="Tài khoản Vietcombank dự phòng">Vietcombank dự phòng</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Đối tượng liên hệ</label>
                    <select
                      className="farmshift-form-control"
                      value={newTx.contact}
                      onChange={(e) => setNewTx({ ...newTx, contact: e.target.value })}
                    >
                      <option value="Khách hàng">Khách hàng</option>
                      <option value="Nhà cung cấp">Nhà cung cấp</option>
                      <option value="Nhân sự">Nhân sự</option>
                      <option value="Đối tượng khác">Đối tượng khác</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Họ tên người nộp/nhận *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Nguyễn Văn A..."
                      className="farmshift-form-control"
                      value={newTx.name}
                      onChange={(e) => setNewTx({ ...newTx, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Mô tả / Nội dung chi tiết</label>
                  <textarea
                    rows="2"
                    placeholder="Mô tả cụ thể lý do thu chi..."
                    className="farmshift-form-control"
                    value={newTx.note}
                    onChange={(e) => setNewTx({ ...newTx, note: e.target.value })}
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
                  Lưu phiếu {modalType.toLowerCase()}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Chuyển quỹ nội bộ ─────────────────────── */}
      {showFundTransferModal && (
        <div className="farmshift-modal-backdrop">
          <div className="farmshift-modal">
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Chuyển tiền giữa các quỹ nội bộ</h3>
              <button
                onClick={() => setShowFundTransferModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateFundTransfer}>
              <div className="farmshift-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Từ nguồn quỹ *</label>
                    <select
                      className="farmshift-form-control"
                      value={newTransfer.from}
                      onChange={(e) => setNewTransfer({ ...newTransfer, from: e.target.value })}
                    >
                      <option value="Tài khoản MB Bank">Tài khoản MB Bank</option>
                      <option value="Tiền mặt tại quỹ trại">Tiền mặt tại quỹ trại</option>
                      <option value="Tài khoản Vietcombank dự phòng">Vietcombank dự phòng</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Đến nguồn quỹ *</label>
                    <select
                      className="farmshift-form-control"
                      value={newTransfer.to}
                      onChange={(e) => setNewTransfer({ ...newTransfer, to: e.target.value })}
                    >
                      <option value="Tiền mặt tại quỹ trại">Tiền mặt tại quỹ trại</option>
                      <option value="Tài khoản MB Bank">Tài khoản MB Bank</option>
                      <option value="Tài khoản Vietcombank dự phòng">Vietcombank dự phòng</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số tiền chuyển (đ) *</label>
                    <input
                      type="number"
                      required
                      placeholder="VD: 10000000"
                      className="farmshift-form-control"
                      value={newTransfer.amount}
                      onChange={(e) => setNewTransfer({ ...newTransfer, amount: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Ngày chuyển</label>
                    <input
                      type="date"
                      className="farmshift-form-control"
                      value={newTransfer.date}
                      onChange={(e) => setNewTransfer({ ...newTransfer, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Lý do điều chuyển</label>
                  <input
                    type="text"
                    placeholder="Rút tiền mua vật tư, nộp tiền mặt vào ngân hàng..."
                    className="farmshift-form-control"
                    value={newTransfer.note}
                    onChange={(e) => setNewTransfer({ ...newTransfer, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => setShowFundTransferModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary">
                  Thực hiện chuyển quỹ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
