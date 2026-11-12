// src/features/farmshift/CashbookView.jsx
// Sổ quỹ & Quản lý Thu Chi chăn nuôi chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, Search, FileSpreadsheet, ArrowRightLeft,
  Calculator, Building, Users, Eye, Pencil, Trash2
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA } from '../../data/farmshiftMockData';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getCashbookSummary,
  createCashFund,
  updateCashFund,
  deleteCashFund,
  createCashTransaction,
  updateCashTransaction,
  deleteCashTransaction,
  createCashFundTransfer
} from '../../services/cashbookService';

const DEFAULT_FUNDS = [
  { id: 'f-1', name: 'Tài khoản MB Bank (TK Chính)', accountNo: '0987654321', bank: 'Ngân hàng Quân Đội', fundType: 'BANK', balance: 228920000, note: 'Tài khoản nhận tiền bán sỉ & thanh toán cám', active: true },
  { id: 'f-2', name: 'Tiền mặt tại quỹ trại', accountNo: '—', bank: 'Quỹ thủ quỹ', fundType: 'CASH', balance: 53200000, note: 'Chi trả tiền điện, xăng xe, chi tiêu vặt hàng ngày', active: true },
  { id: 'f-3', name: 'Tài khoản Vietcombank dự phòng', accountNo: '1023456789', bank: 'Vietcombank', fundType: 'BANK', balance: 50000000, note: 'Quỹ dự phòng rủi ro dịch bệnh', active: true },
];

const DEFAULT_TRANSFERS = [
  { id: 'cq-1', code: 'CQ000005', date: '2026-10-01', from: 'Tài khoản MB Bank (TK Chính)', to: 'Tiền mặt tại quỹ trại', amount: 20000000, fee: 0, note: 'Rút tiền mặt chi lương và vật tư tiêu hao', creator: 'Nguyễn Văn Hải' },
  { id: 'cq-2', code: 'CQ000004', date: '2026-09-28', from: 'Tiền mặt tại quỹ trại', to: 'Tài khoản MB Bank (TK Chính)', amount: 150000000, fee: 0, note: 'Nộp tiền mặt bán gà chuồng J1 vào tài khoản', creator: 'Nguyễn Văn Hải' },
];

export const CashbookView = () => {
  const location = useLocation();
  const auth = useAuth();
  const notification = useNotification();
  const showToast = notification?.showToast || (() => {});
  const user = auth?.user;
  const canWrite = !user || ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT'].includes(user?.role);

  const searchParams = new URLSearchParams(location.search);
  const initialTab = location.pathname.includes('/payroll')
    ? 'payroll'
    : location.pathname.includes('/assets')
    ? 'assets'
    : searchParams.get('tab') || 'ledger';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [apiMode, setApiMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  const [transactions, setTransactions] = useState(INITIAL_FARMSHIFT_DATA.cashbook);
  const [funds, setFunds] = useState(DEFAULT_FUNDS);
  const [fundTransfers, setFundTransfers] = useState(DEFAULT_TRANSFERS);
  const [summaryTotals, setSummaryTotals] = useState(null);

  const [filterType, setFilterType] = useState('ALL');
  const [filterFundId, setFilterFundId] = useState('ALL');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Costs allocation state
  const [costs] = useState([
    { id: 'PB0001', house: 'Nhà A1', cycle: 'LUA-2026-MIA01', type: 'Thức ăn chăn nuôi (Cám)', amount: 48500000, source: 'PC000036', date: '2026-10-18', notes: 'Cám Higro 01 úm gà con tuần 1' },
    { id: 'PB0002', house: 'Nhà A2', cycle: 'LUA-2026-MIA01', type: 'Thuốc thú y & Vắc-xin', amount: 8200000, source: 'PC000037', date: '2026-10-19', notes: 'Vắc-xin Newcastle Lasota + Kháng thể' },
    { id: 'PB0003', house: 'Nhà B1', cycle: 'LUA-2026-J02', type: 'Thức ăn chăn nuôi (Cám)', amount: 92400000, source: 'PC000038', date: '2026-10-15', notes: 'Cám Higro 03 giai đoạn vỗ béo' },
    { id: 'PB0004', house: 'Nhà B1', cycle: 'LUA-2026-J02', type: 'Điện năng vận hành', amount: 3600000, source: 'PC000039', date: '2026-10-20', notes: 'Tiền điện quạt hút công nghiệp 1.5kW' },
  ]);

  // Assets & Depreciation state
  const [assets] = useState([
    { id: 'TS0001', name: 'Quạt hút công nghiệp 1.2kW (Hệ 5 quạt)', cost: 35000000, months: 36, monthlyDep: 972222, house: 'Nhà A1, A2, A3', status: 'Đang trích khấu hao' },
    { id: 'TS0002', name: 'Giàn làm mát Cooling Pad tấm tôn inox', cost: 24000000, months: 24, monthlyDep: 1000000, house: 'Khu Mía Thịt', status: 'Đang trích khấu hao' },
    { id: 'TS0003', name: 'Hệ thống đường ống núm uống tự động Lubing', cost: 18000000, months: 36, monthlyDep: 500000, house: 'Nhà B1, B2', status: 'Đang trích khấu hao' },
    { id: 'TS0004', name: 'Máy phát điện dự phòng 15kVA Cummins', cost: 65000000, months: 60, monthlyDep: 1083333, house: 'Toàn trang trại', status: 'Đang trích khấu hao' },
  ]);

  // Payroll state
  const [payrolls, setPayrolls] = useState([
    { id: 'CC0001', employee: 'Nguyễn Văn An', days: 26, rate: 350000, bonus: 1000000, advance: 2000000, total: 10100000, paid: 8100000, remain: 0, status: 'Đã thanh toán' },
    { id: 'CC0002', employee: 'Trần Văn Bình', days: 25, rate: 350000, bonus: 800000, advance: 1500000, total: 9550000, paid: 5000000, remain: 3050000, status: 'Còn nợ lương' },
    { id: 'CC0003', employee: 'Nguyễn Văn Hải', days: 28, rate: 500000, bonus: 2000000, advance: 3000000, total: 16000000, paid: 13000000, remain: 0, status: 'Đã thanh toán' },
    { id: 'CC0004', employee: 'Nguyễn Thị Mai', days: 24, rate: 400000, bonus: 500000, advance: 0, total: 10100000, paid: 10100000, remain: 0, status: 'Đã thanh toán' }
  ]);

  // Transaction categories
  const [txCategories] = useState([
    { id: 1, name: 'Đơn bán gà', type: 'Thu', group: 'Doanh thu chính', note: 'Thu tiền xuất bán gà thịt' },
    { id: 2, name: 'Thu hồi công nợ', type: 'Thu', group: 'Công nợ', note: 'Khách hàng thanh toán nợ cũ' },
    { id: 3, name: 'Tiền thức ăn (Cám)', type: 'Chi', group: 'Chi phí biến đổi', note: 'Thanh toán tiền cám theo lứa' },
    { id: 4, name: 'Tiền con giống', type: 'Chi', group: 'Chi phí biến đổi', note: 'Mua giống gà từ Dabaco' },
    { id: 5, name: 'Thuốc thú y & vắc-xin', type: 'Chi', group: 'Chi phí thú y', note: 'Phòng và trị bệnh' },
    { id: 6, name: 'Tiền điện & nước', type: 'Chi', group: 'Chi phí vận hành', note: 'Hệ thống quạt làm mát' },
    { id: 7, name: 'Tiền lương công nhân', type: 'Chi', group: 'Chi phí nhân công', note: 'Chi lương tháng' },
  ]);

  // Modals: Transaction Create / Edit / View
  const [txModalMode, setTxModalMode] = useState(null); // null | 'create' | 'edit'
  const [editingTxId, setEditingTxId] = useState(null);
  const [modalType, setModalType] = useState('Thu');
  const [txForm, setTxForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Đơn bán gà',
    amount: '',
    contact: 'Khách hàng',
    name: '',
    fundId: 'f-1',
    note: ''
  });
  const [txSaving, setTxSaving] = useState(false);
  const [viewTx, setViewTx] = useState(null);

  // Fund Modal (FIN-07)
  const [fundModal, setFundModal] = useState(null); // null | { mode: 'create' | 'edit', fund }
  const [fundForm, setFundForm] = useState({ name: '', accountNo: '', bank: '', fundType: 'BANK', balance: '0', note: '' });
  const [fundSaving, setFundSaving] = useState(false);

  // Fund Transfer Modal
  const [showFundTransferModal, setShowFundTransferModal] = useState(false);
  const [newTransfer, setNewTransfer] = useState({
    date: new Date().toISOString().split('T')[0],
    fromFundId: 'f-1',
    toFundId: 'f-2',
    amount: '',
    note: ''
  });

  const reloadSummary = useCallback(() => {
    setRevision(r => r + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { type: filterType };
    if (filterFundId !== 'ALL') params.fundId = filterFundId;
    if (filterFrom) params.from = filterFrom;
    if (filterTo) params.to = filterTo;
    if (searchTerm.trim()) params.search = searchTerm.trim();

    getCashbookSummary(params)
      .then(data => {
        if (cancelled) return;
        if (data && typeof data === 'object' && Array.isArray(data.funds) && Array.isArray(data.transactions)) {
          setApiMode(true);
          setFunds(data.funds);
          setTransactions(data.transactions);
          setFundTransfers(Array.isArray(data.transfers) ? data.transfers : []);
          setSummaryTotals({
            totalRevenue: Number(data.totalRevenue || 0),
            totalExpense: Number(data.totalExpense || 0),
            totalFundsBalance: Number(data.totalFundsBalance || 0)
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filterType, filterFundId, filterFrom, filterTo, searchTerm, revision]);

  const totalRevenue = summaryTotals?.totalRevenue ?? transactions.filter(t => t.type === 'Thu').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalExpense = summaryTotals?.totalExpense ?? transactions.filter(t => t.type === 'Chi').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalFundsBalance = summaryTotals?.totalFundsBalance ?? funds.reduce((sum, f) => sum + Number(f.balance || 0), 0);

  const openCreateTxModal = (type) => {
    const defaultFund = funds[0];
    setModalType(type);
    setEditingTxId(null);
    setTxForm({
      date: new Date().toISOString().split('T')[0],
      category: type === 'Thu' ? 'Đơn bán gà' : 'Tiền thức ăn (Cám)',
      amount: '',
      contact: type === 'Thu' ? 'Khách hàng' : 'Nhà cung cấp',
      name: '',
      fundId: defaultFund ? String(defaultFund.id) : '',
      note: ''
    });
    setTxModalMode('create');
  };

  const openEditTxModal = (tx) => {
    const matchedFund = funds.find(f => String(f.id) === String(tx.fundId))
      || funds.find(f => f.name === tx.fund || f.name?.includes(tx.fund))
      || funds[0];
    setModalType(tx.type || 'Thu');
    setEditingTxId(tx.id);
    setTxForm({
      date: tx.date || new Date().toISOString().split('T')[0],
      category: tx.category || (tx.type === 'Thu' ? 'Đơn bán gà' : 'Chi phí khác'),
      amount: String(tx.amount ?? ''),
      contact: tx.contact || 'Khách hàng',
      name: tx.name || '',
      fundId: matchedFund ? String(matchedFund.id) : '',
      note: tx.note || ''
    });
    setTxModalMode('edit');
  };

  const handleSaveTx = async (e) => {
    e.preventDefault();
    if (txSaving) return;
    const amt = Number(txForm.amount) || 0;
    if (amt <= 0) {
      showToast('Số tiền phải lớn hơn 0.', 'warning');
      return;
    }
    const targetFund = funds.find(f => String(f.id) === String(txForm.fundId)) || funds[0];
    if (!targetFund) {
      showToast('Vui lòng chọn nguồn quỹ hợp lệ.', 'warning');
      return;
    }

    if (apiMode) {
      setTxSaving(true);
      try {
        const payload = {
          date: txForm.date,
          type: modalType,
          category: txForm.category,
          amount: amt,
          contact: txForm.contact,
          name: txForm.name.trim(),
          fundId: Number(targetFund.id),
          note: txForm.note.trim()
        };
        if (txModalMode === 'edit' && editingTxId != null) {
          await updateCashTransaction(editingTxId, payload);
          showToast('Đã cập nhật phiếu thu / chi và số dư quỹ.', 'success');
        } else {
          await createCashTransaction(payload);
          showToast('Đã lập phiếu thu / chi thành công.', 'success');
        }
        setTxModalMode(null);
        setEditingTxId(null);
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể lưu phiếu thu / chi.', 'error');
      } finally {
        setTxSaving(false);
      }
      return;
    }

    // Fallback offline mode
    if (txModalMode === 'edit' && editingTxId != null) {
      const oldTx = transactions.find(t => t.id === editingTxId);
      const oldFundName = oldTx?.fund;
      const oldDelta = oldTx ? (oldTx.type === 'Thu' ? Number(oldTx.amount || 0) : -Number(oldTx.amount || 0)) : 0;
      const newDelta = modalType === 'Thu' ? amt : -amt;
      setTransactions(transactions.map(t => t.id === editingTxId ? {
        ...t,
        date: txForm.date,
        type: modalType,
        category: txForm.category,
        amount: amt,
        contact: txForm.contact,
        name: txForm.name.trim(),
        fundId: targetFund.id,
        fund: targetFund.name,
        note: txForm.note.trim()
      } : t));
      setFunds(funds.map(f => {
        let balance = Number(f.balance || 0);
        if (f.name === oldFundName || String(f.id) === String(oldTx?.fundId)) balance -= oldDelta;
        if (String(f.id) === String(targetFund.id)) balance += newDelta;
        return { ...f, balance };
      }));
      showToast('Đã cập nhật phiếu thu / chi.', 'success');
    } else {
      const created = {
        id: `cb-${Date.now()}`,
        code: modalType === 'Thu' ? `PT0000${transactions.length + 22}` : `PC0000${transactions.length + 36}`,
        date: txForm.date,
        type: modalType,
        category: txForm.category,
        amount: amt,
        contact: txForm.contact,
        name: txForm.name.trim(),
        fundId: targetFund.id,
        fund: targetFund.name,
        note: txForm.note.trim(),
        creator: user?.fullName || INITIAL_FARMSHIFT_DATA.farmInfo.owner
      };
      setTransactions([created, ...transactions]);
      setFunds(funds.map(f => String(f.id) === String(targetFund.id)
        ? { ...f, balance: modalType === 'Thu' ? f.balance + amt : f.balance - amt }
        : f
      ));
      showToast('Đã lập phiếu thu / chi thành công.', 'success');
    }
    setTxModalMode(null);
    setEditingTxId(null);
  };

  const handleDeleteTx = async (tx) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phiếu ${tx.code}? Số dư quỹ liên quan sẽ được hoàn tác.`)) return;
    if (apiMode) {
      try {
        await deleteCashTransaction(tx.id);
        showToast('Đã xóa phiếu và hoàn tác số dư quỹ.', 'success');
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể xóa phiếu.', 'error');
      }
      return;
    }
    const delta = tx.type === 'Thu' ? -Number(tx.amount || 0) : Number(tx.amount || 0);
    setTransactions(transactions.filter(t => t.id !== tx.id));
    setFunds(funds.map(f => (f.name === tx.fund || String(f.id) === String(tx.fundId)) ? { ...f, balance: f.balance + delta } : f));
    showToast('Đã xóa phiếu thu / chi.', 'success');
  };

  const openCreateFundModal = () => {
    setFundForm({ name: '', accountNo: '', bank: '', fundType: 'BANK', balance: '0', note: '' });
    setFundModal({ mode: 'create', fund: null });
  };

  const openEditFundModal = (fund) => {
    setFundForm({
      name: fund.name || '',
      accountNo: fund.accountNo || '',
      bank: fund.bank || '',
      fundType: fund.fundType || 'BANK',
      balance: String(fund.balance ?? 0),
      note: fund.note || ''
    });
    setFundModal({ mode: 'edit', fund });
  };

  const handleSaveFund = async (e) => {
    e.preventDefault();
    if (fundSaving || !fundModal) return;
    const balanceVal = Number(fundForm.balance || 0);
    if (balanceVal < 0) {
      showToast('Số dư quỹ không được âm.', 'warning');
      return;
    }

    if (apiMode) {
      setFundSaving(true);
      try {
        const payload = {
          name: fundForm.name.trim(),
          accountNo: fundForm.accountNo.trim() || '—',
          bank: fundForm.bank.trim(),
          fundType: fundForm.fundType,
          balance: balanceVal,
          note: fundForm.note.trim()
        };
        if (fundModal.mode === 'edit') {
          await updateCashFund(fundModal.fund.id, payload);
          showToast('Đã cập nhật nguồn quỹ.', 'success');
        } else {
          await createCashFund(payload);
          showToast('Đã thêm nguồn quỹ mới.', 'success');
        }
        setFundModal(null);
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể lưu nguồn quỹ.', 'error');
      } finally {
        setFundSaving(false);
      }
      return;
    }

    if (fundModal.mode === 'edit') {
      setFunds(funds.map(f => f.id === fundModal.fund.id ? {
        ...f,
        name: fundForm.name.trim(),
        accountNo: fundForm.accountNo.trim() || '—',
        bank: fundForm.bank.trim(),
        fundType: fundForm.fundType,
        balance: balanceVal,
        note: fundForm.note.trim()
      } : f));
      showToast('Đã cập nhật nguồn quỹ.', 'success');
    } else {
      setFunds([...funds, {
        id: `f-${Date.now()}`,
        name: fundForm.name.trim(),
        accountNo: fundForm.accountNo.trim() || '—',
        bank: fundForm.bank.trim(),
        fundType: fundForm.fundType,
        balance: balanceVal,
        note: fundForm.note.trim(),
        active: true
      }]);
      showToast('Đã thêm nguồn quỹ mới.', 'success');
    }
    setFundModal(null);
  };

  const handleDeleteFund = async (fund) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nguồn quỹ "${fund.name}"?`)) return;
    if (apiMode) {
      try {
        await deleteCashFund(fund.id);
        showToast('Đã xóa nguồn quỹ.', 'success');
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể xóa nguồn quỹ đã phát sinh giao dịch.', 'error');
      }
      return;
    }
    setFunds(funds.filter(f => f.id !== fund.id));
    showToast('Đã xóa nguồn quỹ.', 'success');
  };

  const handleCreateFundTransfer = async (e) => {
    e.preventDefault();
    const amt = Number(newTransfer.amount) || 0;
    const fromFund = funds.find(f => String(f.id) === String(newTransfer.fromFundId)) || funds[0];
    const toFund = funds.find(f => String(f.id) === String(newTransfer.toFundId)) || funds[1] || funds[0];
    if (!fromFund || !toFund || String(fromFund.id) === String(toFund.id)) {
      showToast('Quỹ nguồn và quỹ đích phải khác nhau.', 'warning');
      return;
    }
    if (amt <= 0) {
      showToast('Số tiền chuyển phải lớn hơn 0.', 'warning');
      return;
    }

    if (apiMode) {
      try {
        await createCashFundTransfer({
          date: newTransfer.date,
          fromFundId: Number(fromFund.id),
          toFundId: Number(toFund.id),
          amount: amt,
          fee: 0,
          note: newTransfer.note.trim()
        });
        showToast('Đã thực hiện chuyển quỹ nội bộ.', 'success');
        setShowFundTransferModal(false);
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể chuyển quỹ nội bộ.', 'error');
      }
      return;
    }

    const created = {
      id: `cq-${Date.now()}`,
      code: `CQ00000${fundTransfers.length + 6}`,
      date: newTransfer.date,
      fromFundId: fromFund.id,
      from: fromFund.name,
      toFundId: toFund.id,
      to: toFund.name,
      amount: amt,
      fee: 0,
      note: newTransfer.note,
      creator: user?.fullName || INITIAL_FARMSHIFT_DATA.farmInfo.owner
    };
    setFundTransfers([created, ...fundTransfers]);
    setFunds(funds.map(f => {
      if (String(f.id) === String(fromFund.id)) return { ...f, balance: f.balance - amt };
      if (String(f.id) === String(toFund.id)) return { ...f, balance: f.balance + amt };
      return f;
    }));
    showToast('Đã thực hiện chuyển quỹ nội bộ.', 'success');
    setShowFundTransferModal(false);
  };

  const handleExportExcel = () => {
    if (!transactions.length) {
      showToast('Chưa có giao dịch sổ quỹ để xuất.', 'warning');
      return;
    }
    const headers = ['Mã phiếu', 'Ngày', 'Loại', 'Hạng mục', 'Số tiền (VND)', 'Đối tượng', 'Người nộp/nhận', 'Quỹ tiền', 'Ghi chú'];
    const rows = transactions.map(t => [
      t.code, t.date, t.type, `"${t.category}"`, t.amount, `"${t.contact || ''}"`, `"${t.name || ''}"`, `"${t.fund || ''}"`, `"${t.note || ''}"`
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `So_quy_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Xuất báo cáo sổ quỹ thành công.', 'success');
  };

  const filteredTx = apiMode
    ? transactions
    : transactions.filter(t => {
        const q = searchTerm.trim().toLowerCase();
        const matchSearch = !q ||
          t.code?.toLowerCase().includes(q) ||
          t.name?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.note?.toLowerCase().includes(q);
        if (!matchSearch) return false;
        if (filterType !== 'ALL' && t.type !== filterType) return false;
        if (filterFundId !== 'ALL') {
          const matchedFund = funds.find(f => String(f.id) === String(filterFundId));
          if (String(t.fundId || '') !== String(filterFundId) && t.fund !== matchedFund?.name) return false;
        }
        if (filterFrom && t.date < filterFrom) return false;
        if (filterTo && t.date > filterTo) return false;
        return true;
      });

  return (
    <FarmShiftLayout
      pageTitle="Sổ quỹ & Nguồn tiền"
      breadcrumbs={[{ label: 'Sổ quỹ' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="farmshift-btn farmshift-btn-excel" onClick={handleExportExcel}>
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          {canWrite && (
            <>
              <button
                className="farmshift-btn farmshift-btn-secondary"
                onClick={() => {
                  const first = funds[0];
                  const second = funds[1] || funds[0];
                  setNewTransfer({
                    date: new Date().toISOString().split('T')[0],
                    fromFundId: first ? String(first.id) : '',
                    toFundId: second ? String(second.id) : '',
                    amount: '',
                    note: ''
                  });
                  setShowFundTransferModal(true);
                }}
              >
                <ArrowRightLeft size={16} /> Chuyển quỹ nội bộ
              </button>
              <button
                className="farmshift-btn farmshift-btn-secondary"
                style={{ color: 'var(--color-signature-coral)', borderColor: 'var(--color-hairline)' }}
                onClick={() => openCreateTxModal('Chi')}
              >
                <Plus size={16} /> Lập phiếu chi
              </button>
              <button
                className="farmshift-btn farmshift-btn-primary"
                onClick={() => openCreateTxModal('Thu')}
              >
                <Plus size={16} /> Lập phiếu thu
              </button>
            </>
          )}
        </div>
      }
    >
      {/* ── Summary Stats ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
          <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG THU VÀO</div>
          <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-success)', marginTop: '6px' }}>
            +{Number(totalRevenue).toLocaleString('vi-VN')} đ
          </div>
        </div>

        <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
          <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG CHI RA</div>
          <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-signature-coral)', marginTop: '6px' }}>
            -{Number(totalExpense).toLocaleString('vi-VN')} đ
          </div>
        </div>

        <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
          <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG TỒN TẤT CẢ QUỸ</div>
          <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
            {Number(totalFundsBalance).toLocaleString('vi-VN')} đ
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation ──────────────────────────────── */}
      <div className="farmshift-tabs">
        <button className={`farmshift-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')}>
          Sổ quỹ thu chi ({transactions.length})
        </button>
        <button className={`farmshift-tab-btn ${activeTab === 'funds' ? 'active' : ''}`} onClick={() => setActiveTab('funds')}>
          Nguồn quỹ tiền ({funds.length})
        </button>
        <button className={`farmshift-tab-btn ${activeTab === 'transfers' ? 'active' : ''}`} onClick={() => setActiveTab('transfers')}>
          Chuyển quỹ nội bộ ({fundTransfers.length})
        </button>
        <button className={`farmshift-tab-btn ${activeTab === 'costs' ? 'active' : ''}`} onClick={() => setActiveTab('costs')}>
          <Calculator size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Phân bổ chi phí lứa ({costs.length})
        </button>
        <button className={`farmshift-tab-btn ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>
          <Building size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Tài sản & Khấu hao ({assets.length})
        </button>
        <button className={`farmshift-tab-btn ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => setActiveTab('payroll')}>
          <Users size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Tiền công nhân viên ({payrolls.length})
        </button>
        <button className={`farmshift-tab-btn ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>
          Loại phiếu thu / chi ({txCategories.length})
        </button>
      </div>

      {/* ── Tab 1: Sổ quỹ thu chi ────────────────────────── */}
      {activeTab === 'ledger' && (
        <>
          <div className="farmshift-toolbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div className="farmshift-search-box">
              <Search size={16} color="var(--color-muted)" />
              <input
                type="text"
                placeholder="Tìm theo mã phiếu, người nộp/nhận, loại thu chi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="farmshift-filter-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select aria-label="Lọc loại phiếu" className="farmshift-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="ALL">Tất cả thu / chi</option>
                <option value="Thu">Chỉ xem phiếu thu</option>
                <option value="Chi">Chỉ xem phiếu chi</option>
              </select>
              <select aria-label="Lọc theo nguồn quỹ" className="farmshift-select" value={filterFundId} onChange={(e) => setFilterFundId(e.target.value)}>
                <option value="ALL">Tất cả nguồn quỹ</option>
                {funds.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <input aria-label="Từ ngày" type="date" className="farmshift-select" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              <input aria-label="Đến ngày" type="date" className="farmshift-select" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
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
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !filteredTx.length ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>Đang tải dữ liệu sổ quỹ...</td></tr>
                  ) : !filteredTx.length ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>Không có phiếu thu chi nào phù hợp bộ lọc.</td></tr>
                  ) : filteredTx.map(t => (
                    <tr key={t.id}>
                      <td>
                        <strong style={{ color: 'var(--color-ink)', fontFamily: 'monospace', fontSize: '15px' }}>
                          {t.code}
                        </strong>
                      </td>
                      <td>{t.date}</td>
                      <td>
                        <span className={`farmshift-badge ${t.type === 'Thu' ? 'farmshift-badge-success' : 'farmshift-badge-danger'}`}>
                          {t.type === 'Thu' ? '↑ Thu' : '↓ Chi'} — {t.category}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: '14.5px', color: t.type === 'Thu' ? 'var(--color-success)' : 'var(--color-signature-coral)' }}>
                          {t.type === 'Thu' ? '+' : '-'}{Number(t.amount || 0).toLocaleString('vi-VN')} đ
                        </strong>
                      </td>
                      <td>{t.contact}</td>
                      <td><strong>{t.name}</strong></td>
                      <td>
                        <span className="farmshift-badge farmshift-badge-neutral">{t.fund}</span>
                      </td>
                      <td style={{ color: 'var(--color-muted)' }}>{t.creator}</td>
                      <td style={{ color: 'var(--color-muted)', fontSize: '14.5px' }}>{t.note || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="farmshift-btn farmshift-btn-secondary"
                            style={{ padding: '4px 8px' }}
                            title="Xem chi tiết phiếu"
                            aria-label={`Xem phiếu ${t.code}`}
                            onClick={() => setViewTx(t)}
                          >
                            <Eye size={14} />
                          </button>
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                className="farmshift-btn farmshift-btn-secondary"
                                style={{ padding: '4px 8px' }}
                                title="Sửa phiếu"
                                aria-label={`Sửa phiếu ${t.code}`}
                                onClick={() => openEditTxModal(t)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="farmshift-btn farmshift-btn-secondary"
                                style={{ padding: '4px 8px', color: 'var(--color-danger)' }}
                                title="Xóa phiếu"
                                aria-label={`Xóa phiếu ${t.code}`}
                                onClick={() => handleDeleteTx(t)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab 2: Nguồn quỹ tiền (FIN-07) ────────────────── */}
      {activeTab === 'funds' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="farmshift-card-title">Các tài khoản & nguồn quỹ tiền tệ</h3>
            {canWrite && (
              <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={openCreateFundModal}>
                <Plus size={15} /> Thêm nguồn quỹ
              </button>
            )}
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên nguồn quỹ</th>
                  <th>Loại quỹ</th>
                  <th>Số tài khoản</th>
                  <th>Ngân hàng / Đơn vị</th>
                  <th>Số dư khả dụng</th>
                  <th>Ghi chú</th>
                  {canWrite && <th style={{ textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {funds.map(f => (
                  <tr key={f.id}>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{f.name}</strong></td>
                    <td>
                      <span className="farmshift-badge farmshift-badge-neutral">
                        {f.fundType === 'CASH' ? 'Tiền mặt' : 'Ngân hàng'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{f.accountNo || '—'}</td>
                    <td>{f.bank}</td>
                    <td>
                      <strong style={{ fontSize: '15px', color: 'var(--color-primary)' }}>
                        {Number(f.balance || 0).toLocaleString('vi-VN')} đ
                      </strong>
                    </td>
                    <td style={{ color: 'var(--color-muted)' }}>{f.note || '—'}</td>
                    {canWrite && (
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="farmshift-btn farmshift-btn-secondary"
                            style={{ padding: '4px 8px' }}
                            title="Sửa nguồn quỹ"
                            aria-label={`Sửa nguồn quỹ ${f.name}`}
                            onClick={() => openEditFundModal(f)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="farmshift-btn farmshift-btn-secondary"
                            style={{ padding: '4px 8px', color: 'var(--color-danger)' }}
                            title="Xóa nguồn quỹ"
                            aria-label={`Xóa nguồn quỹ ${f.name}`}
                            onClick={() => handleDeleteFund(f)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
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
                    <td><strong>{Number(cq.amount || 0).toLocaleString('vi-VN')} đ</strong></td>
                    <td>{cq.creator}</td>
                    <td style={{ color: 'var(--color-muted)' }}>{cq.note || '—'}</td>
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

      {/* ── TAB: PHÂN BỔ CHI PHÍ LỨA ─────────────────────── */}
      {activeTab === 'costs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            padding: '14px 18px',
            borderRadius: 'var(--rounded-md)',
            backgroundColor: 'var(--color-surface-soft)',
            border: '1px solid var(--color-hairline)',
            fontSize: '15px',
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
                      <td style={{ fontSize: '14.5px', color: 'var(--color-muted)' }}>{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: TÀI SẢN & KHẤU HAO ──────────────────────── */}
      {activeTab === 'assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG NGUYÊN GIÁ TÀI SẢN</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
                {assets.reduce((s, a) => s + a.cost, 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TRÍCH KHẤU HAO / THÁNG</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '6px' }}>
                {Math.round(assets.reduce((s, a) => s + a.monthlyDep, 0)).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>SỐ LƯỢNG TÀI SẢN CỐ ĐỊNH</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
                {assets.length} thiết bị
              </div>
            </div>
          </div>

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

      {/* ── TAB: TIỀN CÔNG NHÂN VIÊN ─────────────────────── */}
      {activeTab === 'payroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG TIỀN CÔNG THÁNG 10/2026</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + p.total, 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>ĐÃ THANH TOÁN</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-success)', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + p.paid, 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>CÒN PHẢI TRẢ</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-signature-coral)', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + p.remain, 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
          </div>

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
                            style={{ fontSize: '13px', padding: '3px 8px' }}
                            onClick={() => {
                              setPayrolls(payrolls.map(row => row.id === p.id ? { ...row, paid: row.total, remain: 0, status: 'Đã thanh toán' } : row));
                            }}
                          >
                            Thanh toán
                          </button>
                        ) : (
                          <span style={{ fontSize: '13.5px', color: 'var(--color-success)' }}>✓ Đã tất toán</span>
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

      {/* ── Modal: Xem chi tiết phiếu thu / chi ────────────── */}
      {viewTx && (
        <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setViewTx(null); }}>
          <div className="farmshift-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Chi tiết phiếu {viewTx.code}</h3>
              <button type="button" onClick={() => setViewTx(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>✕</button>
            </div>
            <div className="farmshift-modal-body" style={{ display: 'grid', gap: '10px', fontSize: '14px' }}>
              <div><span style={{ color: 'var(--color-muted)' }}>Loại phiếu:</span> <strong>{viewTx.type} — {viewTx.category}</strong></div>
              <div><span style={{ color: 'var(--color-muted)' }}>Ngày ghi nhận:</span> <strong>{viewTx.date}</strong></div>
              <div><span style={{ color: 'var(--color-muted)' }}>Số tiền:</span> <strong style={{ color: viewTx.type === 'Thu' ? 'var(--color-success)' : 'var(--color-signature-coral)' }}>{Number(viewTx.amount || 0).toLocaleString('vi-VN')} đ</strong></div>
              <div><span style={{ color: 'var(--color-muted)' }}>Nguồn quỹ:</span> <strong>{viewTx.fund}</strong></div>
              <div><span style={{ color: 'var(--color-muted)' }}>Đối tượng ({viewTx.contact}):</span> <strong>{viewTx.name}</strong></div>
              <div><span style={{ color: 'var(--color-muted)' }}>Người lập:</span> <strong>{viewTx.creator}</strong></div>
              <div><span style={{ color: 'var(--color-muted)' }}>Diễn giải:</span> <strong>{viewTx.note || '—'}</strong></div>
            </div>
            <div className="farmshift-modal-footer">
              {canWrite && (
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => { const t = viewTx; setViewTx(null); openEditTxModal(t); }}>
                  <Pencil size={14} /> Chỉnh sửa
                </button>
              )}
              <button type="button" className="farmshift-btn farmshift-btn-primary" onClick={() => setViewTx(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Lập / Sửa phiếu thu chi (FIN-08) ────────── */}
      {txModalMode && (
        <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !txSaving) setTxModalMode(null); }}>
          <div className="farmshift-modal" onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">
                {txModalMode === 'edit'
                  ? `Cập nhật phiếu ${modalType.toLowerCase()}`
                  : modalType === 'Thu' ? 'Lập phiếu thu tiền' : 'Lập phiếu chi tiền'}
              </h3>
              <button type="button" onClick={() => !txSaving && setTxModalMode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveTx}>
              <div className="farmshift-modal-body">
                {txModalMode === 'edit' && (
                  <div className="farmshift-form-group" style={{ marginBottom: '12px' }}>
                    <label htmlFor="tx-type" className="farmshift-form-label">Phân loại phiếu *</label>
                    <select id="tx-type" className="farmshift-form-control" value={modalType} onChange={(e) => setModalType(e.target.value)}>
                      <option value="Thu">Thu</option>
                      <option value="Chi">Chi</option>
                    </select>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="tx-category" className="farmshift-form-label">Loại thu / chi *</label>
                    <select
                      id="tx-category"
                      className="farmshift-form-control"
                      value={txForm.category}
                      onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
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
                          <option value="Chi trả NCC">Chi trả NCC</option>
                          <option value="Chi phí khác">Chi phí khác</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="tx-date" className="farmshift-form-label">Ngày giao dịch *</label>
                    <input
                      id="tx-date"
                      type="date"
                      required
                      className="farmshift-form-control"
                      value={txForm.date}
                      onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="tx-amount" className="farmshift-form-label">Số tiền (đ) *</label>
                    <input
                      id="tx-amount"
                      type="number"
                      min="1"
                      required
                      placeholder="VD: 5000000"
                      className="farmshift-form-control"
                      value={txForm.amount}
                      onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                    />
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="tx-fund" className="farmshift-form-label">Nguồn quỹ *</label>
                    <select
                      id="tx-fund"
                      className="farmshift-form-control"
                      value={txForm.fundId}
                      onChange={(e) => setTxForm({ ...txForm, fundId: e.target.value })}
                    >
                      {funds.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="tx-contact" className="farmshift-form-label">Đối tượng liên hệ</label>
                    <select
                      id="tx-contact"
                      className="farmshift-form-control"
                      value={txForm.contact}
                      onChange={(e) => setTxForm({ ...txForm, contact: e.target.value })}
                    >
                      <option value="Khách hàng">Khách hàng</option>
                      <option value="Nhà cung cấp">Nhà cung cấp</option>
                      <option value="Nhân sự">Nhân sự</option>
                      <option value="Đối tượng khác">Đối tượng khác</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="tx-name" className="farmshift-form-label">Họ tên người nộp/nhận *</label>
                    <input
                      id="tx-name"
                      type="text"
                      required
                      placeholder="VD: Nguyễn Văn A..."
                      className="farmshift-form-control"
                      value={txForm.name}
                      onChange={(e) => setTxForm({ ...txForm, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="farmshift-form-group">
                  <label htmlFor="tx-note" className="farmshift-form-label">Mô tả / Nội dung chi tiết</label>
                  <textarea
                    id="tx-note"
                    rows="2"
                    placeholder="Mô tả cụ thể lý do thu chi..."
                    className="farmshift-form-control"
                    value={txForm.note}
                    onChange={(e) => setTxForm({ ...txForm, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="farmshift-modal-footer">
                <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={txSaving} onClick={() => setTxModalMode(null)}>
                  Hủy
                </button>
                <button type="submit" className="farmshift-btn farmshift-btn-primary" disabled={txSaving}>
                  {txSaving ? 'Đang lưu...' : txModalMode === 'edit' ? 'Lưu cập nhật' : `Lưu phiếu ${modalType.toLowerCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Thêm / Sửa nguồn quỹ (FIN-07) ───────────── */}
      {fundModal && (
        <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !fundSaving) setFundModal(null); }}>
          <div className="farmshift-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">{fundModal.mode === 'edit' ? 'Cập nhật nguồn quỹ' : 'Thêm nguồn quỹ mới'}</h3>
              <button type="button" onClick={() => !fundSaving && setFundModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>✕</button>
            </div>
            <form onSubmit={handleSaveFund}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label htmlFor="fund-name" className="farmshift-form-label">Tên nguồn quỹ *</label>
                  <input id="fund-name" type="text" required className="farmshift-form-control" placeholder="VD: Tài khoản BIDV Trại Gà" value={fundForm.name} onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="fund-type" className="farmshift-form-label">Loại quỹ</label>
                    <select id="fund-type" className="farmshift-form-control" value={fundForm.fundType} onChange={(e) => setFundForm({ ...fundForm, fundType: e.target.value })}>
                      <option value="BANK">Tài khoản ngân hàng</option>
                      <option value="CASH">Tiền mặt tại quỹ</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="fund-account" className="farmshift-form-label">Số tài khoản</label>
                    <input id="fund-account" type="text" className="farmshift-form-control" placeholder="0123456789 hoặc —" value={fundForm.accountNo} onChange={(e) => setFundForm({ ...fundForm, accountNo: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="fund-bank" className="farmshift-form-label">Ngân hàng / Đơn vị *</label>
                    <input id="fund-bank" type="text" required className="farmshift-form-control" placeholder="BIDV / Quỹ thủ quỹ" value={fundForm.bank} onChange={(e) => setFundForm({ ...fundForm, bank: e.target.value })} />
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="fund-balance" className="farmshift-form-label">Số dư hiện tại (đ) *</label>
                    <input id="fund-balance" type="number" min="0" required className="farmshift-form-control" value={fundForm.balance} onChange={(e) => setFundForm({ ...fundForm, balance: e.target.value })} readOnly={apiMode && fundModal.mode === 'edit'} />
                  </div>
                </div>
                <div className="farmshift-form-group">
                  <label htmlFor="fund-note" className="farmshift-form-label">Ghi chú</label>
                  <textarea id="fund-note" rows="2" className="farmshift-form-control" value={fundForm.note} onChange={(e) => setFundForm({ ...fundForm, note: e.target.value })} />
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={fundSaving} onClick={() => setFundModal(null)}>Hủy</button>
                <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={fundSaving}>
                  {fundSaving ? 'Đang lưu...' : 'Lưu nguồn quỹ'}
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
              <button onClick={() => setShowFundTransferModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>
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
                      value={newTransfer.fromFundId}
                      onChange={(e) => setNewTransfer({ ...newTransfer, fromFundId: e.target.value })}
                    >
                      {funds.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Đến nguồn quỹ *</label>
                    <select
                      className="farmshift-form-control"
                      value={newTransfer.toFundId}
                      onChange={(e) => setNewTransfer({ ...newTransfer, toFundId: e.target.value })}
                    >
                      {funds.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label className="farmshift-form-label">Số tiền chuyển (đ) *</label>
                    <input
                      type="number"
                      min="1"
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
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setShowFundTransferModal(false)}>
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
