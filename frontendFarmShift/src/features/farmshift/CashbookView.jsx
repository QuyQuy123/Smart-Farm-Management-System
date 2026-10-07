// src/features/farmshift/CashbookView.jsx
// Sổ quỹ & Quản lý Thu Chi chăn nuôi chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DollarSign, Plus, Search, FileSpreadsheet, ArrowDownRight,
  ArrowUpRight, Wallet, CheckCircle, Calendar, Filter, ArrowRightLeft,
  X, Layers, Building, Calculator, Users, Clock, Briefcase, CheckCircle2
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';

export const CashbookView = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = location.pathname.includes('/payroll')
    ? 'payroll'
    : location.pathname.includes('/assets')
    ? 'assets'
    : searchParams.get('tab') || 'ledger';

  const [activeTab, setActiveTab] = useState(initialTab); // 'ledger' | 'funds' | 'categories' | 'transfers' | 'costs' | 'assets' | 'payroll'
  const [transactions, setTransactions] = useState(INITIAL_FARMSHIFT_DATA.cashbook);
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Costs allocation state (costs parity)
  const [costs, setCosts] = useState([
    { id: 'PB0001', house: 'Nhà A1', cycle: 'LUA-2026-MIA01', type: 'Thức ăn chăn nuôi (Cám)', amount: 48500000, source: 'PC000036', date: '2026-10-18', notes: 'Cám Higro 01 úm gà con tuần 1' },
    { id: 'PB0002', house: 'Nhà A2', cycle: 'LUA-2026-MIA01', type: 'Thuốc thú y & Vắc-xin', amount: 8200000, source: 'PC000037', date: '2026-10-19', notes: 'Vắc-xin Newcastle Lasota + Kháng thể' },
    { id: 'PB0003', house: 'Nhà B1', cycle: 'LUA-2026-J02', type: 'Thức ăn chăn nuôi (Cám)', amount: 92400000, source: 'PC000038', date: '2026-10-15', notes: 'Cám Higro 03 giai đoạn vỗ béo' },
    { id: 'PB0004', house: 'Nhà B1', cycle: 'LUA-2026-J02', type: 'Điện năng vận hành', amount: 3600000, source: 'PC000039', date: '2026-10-20', notes: 'Tiền điện quạt hút công nghiệp 1.5kW' },
  ]);

  // Assets & Depreciation state (assets parity)
  const [assets, setAssets] = useState([
    { id: 'TS0001', name: 'Quạt hút công nghiệp 1.2kW (Hệ 5 quạt)', cost: 35000000, months: 36, monthlyDep: 972222, house: 'Nhà A1, A2, A3', status: 'Đang trích khấu hao' },
    { id: 'TS0002', name: 'Giàn làm mát Cooling Pad tấm tôn inox', cost: 24000000, months: 24, monthlyDep: 1000000, house: 'Khu Mía Thịt', status: 'Đang trích khấu hao' },
    { id: 'TS0003', name: 'Hệ thống đường ống núm uống tự động Lubing', cost: 18000000, months: 36, monthlyDep: 500000, house: 'Nhà B1, B2', status: 'Đang trích khấu hao' },
    { id: 'TS0004', name: 'Máy phát điện dự phòng 15kVA Cummins', cost: 65000000, months: 60, monthlyDep: 1083333, house: 'Toàn trang trại', status: 'Đang trích khấu hao' },
  ]);

  // Payroll state (payroll parity)
  const [payrolls, setPayrolls] = useState([
    { id: 'CC0001', employee: 'Nguyễn Văn An', days: 26, rate: 350000, bonus: 1000000, advance: 2000000, total: 10100000, paid: 8100000, remain: 0, status: 'Đã thanh toán' },
    { id: 'CC0002', employee: 'Trần Văn Bình', days: 25, rate: 350000, bonus: 800000, advance: 1500000, total: 9550000, paid: 5000000, remain: 3050000, status: 'Còn nợ lương' },
    { id: 'CC0003', employee: 'Nguyễn Văn Hải', days: 28, rate: 500000, bonus: 2000000, advance: 3000000, total: 16000000, paid: 13000000, remain: 0, status: 'Đã thanh toán' },
    { id: 'CC0004', employee: 'Nguyễn Thị Mai', days: 24, rate: 400000, bonus: 500000, advance: 0, total: 10100000, paid: 10100000, remain: 0, status: 'Đã thanh toán' }
  ]);

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
          className={`farmshift-tab-btn ${activeTab === 'costs' ? 'active' : ''}`}
          onClick={() => setActiveTab('costs')}
        >
          <Calculator size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Phân bổ chi phí lứa ({costs.length})
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
          onClick={() => setActiveTab('assets')}
        >
          <Building size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Tài sản & Khấu hao ({assets.length})
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'payroll' ? 'active' : ''}`}
          onClick={() => setActiveTab('payroll')}
        >
          <Users size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Tiền công nhân viên ({payrolls.length})
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

      {/* ── TAB: PHÂN BỔ CHI PHÍ LỨA (costs parity) ──────── */}
      {activeTab === 'costs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            padding: '14px 18px',
            borderRadius: 'var(--rounded-md)',
            backgroundColor: 'var(--color-surface-soft)',
            border: '1px solid var(--color-hairline)',
            fontSize: '13.5px',
            color: 'var(--color-body)'
          }}>
            💡 <strong>Quy tắc hạch toán:</strong> Gắn khoản chi thực tế với từng chuồng và lứa nuôi. Giúp trang trại tính toán chính xác giá thành sản xuất trên mỗi kg thành phẩm khi xuất bán.
          </div>

          <div className="farmshift-card" style={{ margin: 0 }}>
            <div className="farmshift-card-header">
              <h3 className="farmshift-card-title">
                <Calculator size={18} color="var(--color-primary)" />
                Bảng phân bổ chi phí về lứa nuôi
              </h3>
              <span className="farmshift-badge farmshift-badge-neutral">
                Tổng phân bổ: {costs.reduce((s, c) => s + c.amount, 0).toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã phân bổ</th>
                    <th>Chuồng nuôi</th>
                    <th>Lứa nuôi</th>
                    <th>Loại chi phí</th>
                    <th>Số tiền (đ)</th>
                    <th>Chứng từ nguồn</th>
                    <th>Ngày ghi nhận</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map(c => (
                    <tr key={c.id}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.id}</span></td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{c.house}</strong></td>
                      <td><span className="farmshift-badge farmshift-badge-neutral">{c.cycle}</span></td>
                      <td>{c.type}</td>
                      <td><strong style={{ color: 'var(--color-signature-coral)' }}>{c.amount.toLocaleString('vi-VN')} đ</strong></td>
                      <td><span style={{ fontFamily: 'monospace' }}>{c.source}</span></td>
                      <td>{c.date}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-muted)' }}>{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: TÀI SẢN & KHẤU HAO (assets parity) ───────── */}
      {activeTab === 'assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Asset Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG NGUYÊN GIÁ TÀI SẢN</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
                {assets.reduce((s, a) => s + a.cost, 0).toLocaleString('vi-VN')} đ
              </div>
            </div>

            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>TRÍCH KHẤU HAO / THÁNG</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '6px' }}>
                {Math.round(assets.reduce((s, a) => s + a.monthlyDep, 0)).toLocaleString('vi-VN')} đ
              </div>
            </div>

            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>SỐ LƯỢNG TÀI SẢN CỐ ĐỊNH</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
                {assets.length} thiết bị
              </div>
            </div>
          </div>

          {/* Assets Table */}
          <div className="farmshift-card" style={{ margin: 0 }}>
            <div className="farmshift-card-header">
              <h3 className="farmshift-card-title">
                <Building size={18} color="var(--color-primary)" />
                Danh mục tài sản cố định & bảng trích khấu hao
              </h3>
            </div>
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã tài sản</th>
                    <th>Tên tài sản</th>
                    <th>Nguyên giá</th>
                    <th>Thời gian khấu hao</th>
                    <th>Khấu hao / tháng</th>
                    <th>Phân bổ chuồng</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(a => (
                    <tr key={a.id}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.id}</span></td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{a.name}</strong></td>
                      <td><strong>{a.cost.toLocaleString('vi-VN')} đ</strong></td>
                      <td>{a.months} tháng</td>
                      <td><strong style={{ color: 'var(--color-primary)' }}>{Math.round(a.monthlyDep).toLocaleString('vi-VN')} đ</strong></td>
                      <td>{a.house}</td>
                      <td><span className="farmshift-badge farmshift-badge-success">{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: TIỀN CÔNG NHÂN VIÊN (payroll parity) ─────── */}
      {activeTab === 'payroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Payroll Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG TIỀN CÔNG THÁNG 10/2026</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + p.total, 0).toLocaleString('vi-VN')} đ
              </div>
            </div>

            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>ĐÃ THANH TOÁN</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-success)', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + p.paid, 0).toLocaleString('vi-VN')} đ
              </div>
            </div>

            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)', fontWeight: 500 }}>CÒN PHẢI TRẢ</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-signature-coral)', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + p.remain, 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
          </div>

          {/* Payroll Table */}
          <div className="farmshift-card" style={{ margin: 0 }}>
            <div className="farmshift-card-header">
              <h3 className="farmshift-card-title">
                <Users size={18} color="var(--color-primary)" />
                Bảng chấm công & thanh toán tiền công nhân viên · Tháng 10/2026
              </h3>
            </div>
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã bảng công</th>
                    <th>Nhân viên</th>
                    <th>Ngày công</th>
                    <th>Đơn giá / ngày</th>
                    <th>Phụ cấp</th>
                    <th>Ứng trước</th>
                    <th>Tổng tiền công</th>
                    <th>Đã thanh toán</th>
                    <th>Còn phải trả</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map(p => (
                    <tr key={p.id}>
                      <td><span style={{ fontFamily: 'monospace' }}>{p.id}</span></td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{p.employee}</strong></td>
                      <td><strong>{p.days}</strong> ngày</td>
                      <td>{p.rate.toLocaleString('vi-VN')} đ</td>
                      <td>{p.bonus.toLocaleString('vi-VN')} đ</td>
                      <td><span style={{ color: 'var(--color-muted)' }}>{p.advance.toLocaleString('vi-VN')} đ</span></td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{p.total.toLocaleString('vi-VN')} đ</strong></td>
                      <td><strong style={{ color: 'var(--color-success)' }}>{p.paid.toLocaleString('vi-VN')} đ</strong></td>
                      <td>
                        <strong style={{ color: p.remain > 0 ? 'var(--color-signature-coral)' : 'var(--color-muted)' }}>
                          {p.remain.toLocaleString('vi-VN')} đ
                        </strong>
                      </td>
                      <td>
                        <span className={`farmshift-badge ${p.remain === 0 ? 'farmshift-badge-success' : 'farmshift-badge-warning'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {p.remain > 0 ? (
                          <button
                            className="farmshift-btn farmshift-btn-primary"
                            style={{ fontSize: '11.5px', padding: '3px 8px' }}
                            onClick={() => {
                              setPayrolls(payrolls.map(row => row.id === p.id ? { ...row, paid: row.total, remain: 0, status: 'Đã thanh toán' } : row));
                            }}
                          >
                            Thanh toán
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-success)' }}>✓ Đã tất toán</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
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
