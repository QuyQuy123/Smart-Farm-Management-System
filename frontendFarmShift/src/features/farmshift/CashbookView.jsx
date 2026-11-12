// src/features/farmshift/CashbookView.jsx
// Sổ quỹ & Quản lý Thu Chi chăn nuôi chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Search, FileSpreadsheet,
  Calculator, Building, Users, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, Link2, ExternalLink
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
  createCostAllocation,
  updateCostAllocation,
  deleteCostAllocation,
  createFarmAsset,
  updateFarmAsset,
  deleteFarmAsset,
  createPayroll,
  updatePayroll,
  payPayroll,
  deletePayroll
} from '../../services/cashbookService';
import styles from './CashbookView.module.css';

const DEFAULT_FUNDS = [
  { id: 'f-1', name: 'Quỹ trang trại', accountNo: '0987654321', bank: 'MB Bank & Quỹ tiền mặt trại', fundType: 'BANK', balance: 471570000, note: 'Quỹ tập trung toàn trang trại (thu bán gà, góp vốn và chi nhập hàng / lương / vận hành)', active: true },
];

const DEFAULT_COSTS = [
  { id: 'pb-1', code: 'PB0001', house: 'Nhà A1', cycle: 'L000001', type: 'Thức ăn chăn nuôi (Cám)', amount: 51750000, source: 'NH000000', date: '2026-10-02', notes: '150 bao cám Gà úm Higro 01 từ hóa đơn NH000000' },
  { id: 'pb-2', code: 'PB0002', house: 'Nhà A2', cycle: 'L000002', type: 'Thuốc thú y & vắc-xin', amount: 8480000, source: 'PC000003', date: '2026-10-05', notes: 'Vắc-xin Newcastle Lasota & kháng sinh theo hóa đơn NH000002' },
  { id: 'pb-3', code: 'PB0003', house: 'Nhà B1', cycle: 'L000004', type: 'Thức ăn chăn nuôi (Cám)', amount: 60300000, source: 'NH000000', date: '2026-10-15', notes: '180 bao cám Gà thịt Higro 02 từ hóa đơn NH000000' },
  { id: 'pb-4', code: 'PB0004', house: 'Nhà B1', cycle: 'L000004', type: 'Tiền điện & nước trang trại', amount: 8200000, source: 'PC000010', date: '2026-10-02', notes: 'Chi phí điện nước quạt hút làm mát lứa chuồng B1' },
];

const DEFAULT_ASSETS = [
  { id: 'ts-1', code: 'TS0001', name: 'Quạt hút công nghiệp 1.2kW (Hệ 5 quạt)', cost: 35000000, months: 36, monthlyDep: 972222, house: 'Nhà A1, A2, A3', purchaseDate: '2025-01-15', status: 'Đang trích khấu hao', note: '' },
  { id: 'ts-2', code: 'TS0002', name: 'Giàn làm mát Cooling Pad tấm tôn inox', cost: 24000000, months: 24, monthlyDep: 1000000, house: 'Khu Mía Thịt', purchaseDate: '2025-04-01', status: 'Đang trích khấu hao', note: '' },
  { id: 'ts-3', code: 'TS0003', name: 'Hệ thống đường ống núm uống tự động Lubing', cost: 18000000, months: 36, monthlyDep: 500000, house: 'Nhà B1, B2', purchaseDate: '2025-06-10', status: 'Đang trích khấu hao', note: '' },
  { id: 'ts-4', code: 'TS0004', name: 'Máy phát điện dự phòng 15kVA Cummins', cost: 65000000, months: 60, monthlyDep: 1083333, house: 'Toàn trang trại', purchaseDate: '2024-11-01', status: 'Đang trích khấu hao', note: '' },
];

const DEFAULT_PAYROLLS = [
  { id: 'cc-1', code: 'CC0001', employee: 'Nguyễn Văn Ba', period: '2026-09', days: 26, rate: 350000, bonus: 900000, advance: 1000000, total: 10000000, paid: 9000000, remain: 0, status: 'Đã thanh toán', note: 'Chăm sóc Khu Mía Thịt (Nhà A1-A3)' },
  { id: 'cc-2', code: 'CC0002', employee: 'Dương Văn Hùng', period: '2026-09', days: 26, rate: 350000, bonus: 900000, advance: 1000000, total: 10000000, paid: 9000000, remain: 0, status: 'Đã thanh toán', note: 'Chăm sóc Khu J Thịt (Nhà B1-B2)' },
  { id: 'cc-3', code: 'CC0003', employee: 'Nông Thị Hằng', period: '2026-10', days: 26, rate: 350000, bonus: 500000, advance: 1000000, total: 9600000, paid: 0, remain: 8600000, status: 'Còn nợ lương', note: 'Chăm sóc Khu Đông Tảo & kiểm kê kho' },
  { id: 'cc-4', code: 'CC0004', employee: 'Trần Kế Toán', period: '2026-10', days: 26, rate: 450000, bonus: 1000000, advance: 0, total: 12700000, paid: 12700000, remain: 0, status: 'Đã thanh toán', note: 'Kế toán công nợ & thủ quỹ' },
];

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Đơn bán gà', type: 'Thu', group: 'Doanh thu chính', note: 'Thu tiền xuất bán gà thịt' },
  { id: 2, name: 'Thu hồi công nợ', type: 'Thu', group: 'Công nợ', note: 'Khách hàng thanh toán nợ cũ' },
  { id: 11, name: 'Nạp vốn / Góp vốn', type: 'Thu', group: 'Vốn chủ sở hữu', note: 'Bổ sung vốn lưu động, góp vốn vào quỹ trang trại' },
  { id: 3, name: 'Thu khác', type: 'Thu', group: 'Thu nhập khác', note: 'Khoản thu ngoài hoạt động xuất bán' },
  { id: 4, name: 'Tiền thức ăn (Cám)', type: 'Chi', group: 'Chi phí biến đổi', note: 'Thanh toán tiền cám theo lứa' },
  { id: 5, name: 'Tiền con giống', type: 'Chi', group: 'Chi phí biến đổi', note: 'Mua giống gà nhập đàn' },
  { id: 6, name: 'Thuốc thú y & vắc-xin', type: 'Chi', group: 'Chi phí thú y', note: 'Phòng và trị bệnh' },
  { id: 7, name: 'Tiền điện & nước trang trại', type: 'Chi', group: 'Chi phí vận hành', note: 'Hệ thống quạt làm mát' },
  { id: 8, name: 'Tiền lương công nhân', type: 'Chi', group: 'Chi phí nhân công', note: 'Chi lương tháng' },
  { id: 9, name: 'Thanh toán công nợ NCC', type: 'Chi', group: 'Công nợ', note: 'Trả tiền hóa đơn nhập hàng' },
  { id: 12, name: 'Rút vốn', type: 'Chi', group: 'Vốn chủ sở hữu', note: 'Chủ trang trại rút vốn hoặc chia lợi nhuận' },
  { id: 10, name: 'Chi phí khác', type: 'Chi', group: 'Chi phí khác', note: 'Chi phí phát sinh khác' },
];

export const CashbookView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const notification = useNotification();
  const showToast = notification?.showToast || (() => {});
  const user = auth?.user;
  const canWrite = !user || ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT'].includes(user?.role);

  const VALID_TABS = new Set(['ledger', 'funds', 'costs', 'assets', 'payroll']);
  const resolveTabFromLocation = (loc) => {
    if (loc.pathname.includes('/payroll')) return 'payroll';
    if (loc.pathname.includes('/assets')) return 'assets';
    const rawTab = new URLSearchParams(loc.search).get('tab');
    return rawTab && VALID_TABS.has(rawTab) ? rawTab : 'ledger';
  };
  const resolveTypeFromLocation = (loc) => {
    const rawType = new URLSearchParams(loc.search).get('type');
    return rawType === 'Thu' || rawType === 'Chi' ? rawType : 'ALL';
  };

  const [activeTab, setActiveTab] = useState(() => resolveTabFromLocation(location));
  const [apiMode, setApiMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  const [transactions, setTransactions] = useState(INITIAL_FARMSHIFT_DATA.cashbook);
  const [funds, setFunds] = useState(DEFAULT_FUNDS);
  const [costs, setCosts] = useState(DEFAULT_COSTS);
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [payrolls, setPayrolls] = useState(DEFAULT_PAYROLLS);
  const [txCategories, setTxCategories] = useState(DEFAULT_CATEGORIES);
  const [staffOptions, setStaffOptions] = useState([]);
  const [cycleOptions, setCycleOptions] = useState([]);
  const [summaryTotals, setSummaryTotals] = useState(null);

  const [filterType, setFilterType] = useState(() => resolveTypeFromLocation(location));

  useEffect(() => {
    setActiveTab(resolveTabFromLocation(location));
    const urlType = new URLSearchParams(location.search).get('type');
    if (urlType === 'Thu' || urlType === 'Chi') {
      setFilterType(urlType);
    }
  }, [location.pathname, location.search]);
  const [filterFundId, setFilterFundId] = useState('ALL');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(15);
  const [costPage, setCostPage] = useState(1);
  const [costPageSize, setCostPageSize] = useState(15);
  const [payrollPage, setPayrollPage] = useState(1);
  const [payrollPageSize, setPayrollPageSize] = useState(15);

  useEffect(() => {
    setTxPage(1);
  }, [filterType, filterFundId, filterFrom, filterTo, searchTerm]);

  // Modals: Manual Voucher Create / Edit / View
  const [txModalMode, setTxModalMode] = useState(null); // null | 'create' | 'edit'
  const [editingTxId, setEditingTxId] = useState(null);
  const [modalType, setModalType] = useState('Thu');
  const [txForm, setTxForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Nạp vốn / Góp vốn',
    amount: '',
    contact: 'Chủ trang trại',
    name: '',
    fundId: 'f-1',
    note: ''
  });
  const [txSaving, setTxSaving] = useState(false);
  const [viewTx, setViewTx] = useState(null);

  // Fund Modal (FIN-07)
  const [fundModal, setFundModal] = useState(null);
  const [fundForm, setFundForm] = useState({ name: '', accountNo: '', bank: '', fundType: 'BANK', balance: '0', note: '' });
  const [fundSaving, setFundSaving] = useState(false);

  // Cost Allocation Modal
  const [costModal, setCostModal] = useState(null);
  const [costForm, setCostForm] = useState({
    cycleId: '',
    barnName: '',
    cycleCode: '',
    costType: 'Thức ăn chăn nuôi (Cám)',
    amount: '',
    sourceVoucherCode: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  // Fixed Asset Modal
  const [assetModal, setAssetModal] = useState(null);
  const [assetForm, setAssetForm] = useState({
    name: '',
    cost: '',
    depreciationMonths: '36',
    barnLocation: 'Toàn trang trại',
    purchaseDate: new Date().toISOString().split('T')[0],
    status: 'Đang trích khấu hao',
    note: ''
  });

  // Payroll Modals (Create/Edit & Pay Disbursement)
  const [payrollModal, setPayrollModal] = useState(null);
  const [payrollForm, setPayrollForm] = useState({
    accountId: '',
    employeeName: '',
    payPeriod: new Date().toISOString().slice(0, 7),
    workDays: '26',
    dailyRate: '350000',
    bonus: '0',
    advance: '0',
    note: ''
  });
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: '',
    cashFundId: '',
    paymentDate: new Date().toISOString().split('T')[0],
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
          if (Array.isArray(data.costAllocations)) setCosts(data.costAllocations);
          if (Array.isArray(data.assets)) setAssets(data.assets);
          if (Array.isArray(data.payrolls)) setPayrolls(data.payrolls);
          if (Array.isArray(data.categories)) setTxCategories(data.categories);
          if (Array.isArray(data.staffOptions)) setStaffOptions(data.staffOptions);
          if (Array.isArray(data.cycleOptions)) setCycleOptions(data.cycleOptions);
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

  const resolveDefaultTxCategory = (type) => {
    const matchingCats = txCategories.filter(c => c.type === type);
    const preferred = type === 'Thu'
      ? ['Nạp vốn / Góp vốn', 'Thu khác']
      : ['Rút vốn', 'Tiền điện & nước trang trại', 'Chi phí khác'];
    for (const candidate of preferred) {
      if (matchingCats.some(c => c.name === candidate)) return candidate;
    }
    return matchingCats[0]?.name || (type === 'Thu' ? 'Thu khác' : 'Chi phí khác');
  };

  const isCapitalCategory = (categoryName) => (
    categoryName === 'Nạp vốn / Góp vốn' || categoryName === 'Rút vốn'
  );

  const openCreateTxModal = (type) => {
    const defaultFund = funds[0];
    const defaultCategory = resolveDefaultTxCategory(type);
    setModalType(type);
    setEditingTxId(null);
    setTxForm({
      date: new Date().toISOString().split('T')[0],
      category: defaultCategory,
      amount: '',
      contact: isCapitalCategory(defaultCategory) ? 'Chủ trang trại' : 'Đối tượng khác',
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
      category: tx.category || (tx.type === 'Thu' ? 'Thu khác' : 'Chi phí khác'),
      amount: String(tx.amount ?? ''),
      contact: tx.contact || 'Đối tượng khác',
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
    if (!txForm.name.trim()) {
      showToast('Vui lòng nhập người nộp / nhận.', 'warning');
      return;
    }

    // Balance guard on client before submitting
    if (txModalMode === 'create' && modalType === 'Chi' && amt > Number(targetFund.balance || 0)) {
      showToast(`Số dư quỹ (${targetFund.name}) không đủ để thực hiện phiếu chi ${amt.toLocaleString('vi-VN')} đ.`, 'warning');
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
      const nextNum = transactions.filter(t => t.type === modalType).length + 1;
      const created = {
        id: `cb-${Date.now()}`,
        code: `${modalType === 'Thu' ? 'PT' : 'PC'}${String(nextNum).padStart(6, '0')}`,
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

  // ── Cost Allocations CRUD ──────────────────────────────────────────────────────────────

  const openCostModal = (mode, item = null) => {
    if (mode === 'edit' && item) {
      setCostForm({
        cycleId: item.cycleId ? String(item.cycleId) : '',
        barnName: item.house || '',
        cycleCode: item.cycle || '',
        costType: item.type || 'Thức ăn chăn nuôi (Cám)',
        amount: String(item.amount ?? ''),
        sourceVoucherCode: item.source || '',
        date: item.date || new Date().toISOString().split('T')[0],
        note: item.notes || ''
      });
      setCostModal({ mode: 'edit', item });
    } else {
      const firstCycle = cycleOptions[0];
      setCostForm({
        cycleId: firstCycle ? String(firstCycle.id) : '',
        barnName: firstCycle?.barnName || '',
        cycleCode: firstCycle?.code || '',
        costType: 'Thức ăn chăn nuôi (Cám)',
        amount: '',
        sourceVoucherCode: '',
        date: new Date().toISOString().split('T')[0],
        note: ''
      });
      setCostModal({ mode: 'create', item: null });
    }
  };

  const handleSaveCost = async (e) => {
    e.preventDefault();
    const amt = Number(costForm.amount) || 0;
    if (amt <= 0) {
      showToast('Số tiền phân bổ phải lớn hơn 0.', 'warning');
      return;
    }
    const payload = {
      cycleId: costForm.cycleId ? Number(costForm.cycleId) : null,
      barnName: costForm.barnName.trim() || 'Toàn trang trại',
      cycleCode: costForm.cycleCode.trim() || 'CHUNG',
      costType: costForm.costType.trim(),
      amount: amt,
      sourceVoucherCode: costForm.sourceVoucherCode.trim() || '—',
      date: costForm.date,
      note: costForm.note.trim()
    };
    if (apiMode) {
      try {
        if (costModal.mode === 'edit') {
          await updateCostAllocation(costModal.item.id, payload);
          showToast('Đã cập nhật phân bổ chi phí lứa.', 'success');
        } else {
          await createCostAllocation(payload);
          showToast('Đã thêm phân bổ chi phí lứa.', 'success');
        }
        setCostModal(null);
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể lưu phân bổ chi phí.', 'error');
      }
      return;
    }
    setCostModal(null);
  };

  const handleDeleteCost = async (item) => {
    if (!window.confirm(`Xóa khoản phân bổ ${item.code || item.id}?`)) return;
    if (apiMode) {
      try {
        await deleteCostAllocation(item.id);
        showToast('Đã xóa phân bổ chi phí lứa.', 'success');
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể xóa phân bổ chi phí.', 'error');
      }
    }
  };

  // ── Fixed Assets CRUD ──────────────────────────────────────────────────────────────────

  const openAssetModal = (mode, item = null) => {
    if (mode === 'edit' && item) {
      setAssetForm({
        name: item.name || '',
        cost: String(item.cost ?? ''),
        depreciationMonths: String(item.months ?? 36),
        barnLocation: item.house || '',
        purchaseDate: item.purchaseDate || new Date().toISOString().split('T')[0],
        status: item.status || 'Đang trích khấu hao',
        note: item.note || ''
      });
      setAssetModal({ mode: 'edit', item });
    } else {
      setAssetForm({
        name: '',
        cost: '',
        depreciationMonths: '36',
        barnLocation: 'Toàn trang trại',
        purchaseDate: new Date().toISOString().split('T')[0],
        status: 'Đang trích khấu hao',
        note: ''
      });
      setAssetModal({ mode: 'create', item: null });
    }
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    const cost = Number(assetForm.cost) || 0;
    const months = Number(assetForm.depreciationMonths) || 0;
    if (cost <= 0 || months < 1) {
      showToast('Nguyên giá và số tháng khấu hao phải lớn hơn 0.', 'warning');
      return;
    }
    const payload = {
      name: assetForm.name.trim(),
      cost,
      depreciationMonths: months,
      barnLocation: assetForm.barnLocation.trim() || 'Toàn trang trại',
      purchaseDate: assetForm.purchaseDate,
      status: assetForm.status,
      note: assetForm.note.trim()
    };
    if (apiMode) {
      try {
        if (assetModal.mode === 'edit') {
          await updateFarmAsset(assetModal.item.id, payload);
          showToast('Đã cập nhật tài sản cố định.', 'success');
        } else {
          await createFarmAsset(payload);
          showToast('Đã thêm tài sản cố định.', 'success');
        }
        setAssetModal(null);
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể lưu tài sản cố định.', 'error');
      }
      return;
    }
    setAssetModal(null);
  };

  const handleDeleteAsset = async (item) => {
    if (!window.confirm(`Xóa tài sản "${item.name}"?`)) return;
    if (apiMode) {
      try {
        await deleteFarmAsset(item.id);
        showToast('Đã xóa tài sản cố định.', 'success');
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể xóa tài sản.', 'error');
      }
    }
  };

  // ── Payroll CRUD & Fund Payment ────────────────────────────────────────────────────────

  const openPayrollModal = (mode, item = null) => {
    if (mode === 'edit' && item) {
      setPayrollForm({
        accountId: item.accountId ? String(item.accountId) : '',
        employeeName: item.employee || '',
        payPeriod: item.period || new Date().toISOString().slice(0, 7),
        workDays: String(item.days ?? 26),
        dailyRate: String(item.rate ?? 350000),
        bonus: String(item.bonus ?? 0),
        advance: String(item.advance ?? 0),
        note: item.note || ''
      });
      setPayrollModal({ mode: 'edit', item });
    } else {
      setPayrollForm({
        accountId: '',
        employeeName: '',
        payPeriod: new Date().toISOString().slice(0, 7),
        workDays: '26',
        dailyRate: '350000',
        bonus: '0',
        advance: '0',
        note: ''
      });
      setPayrollModal({ mode: 'create', item: null });
    }
  };

  const handleSavePayroll = async (e) => {
    e.preventDefault();
    const payload = {
      accountId: payrollForm.accountId ? Number(payrollForm.accountId) : null,
      employeeName: payrollForm.employeeName.trim(),
      payPeriod: payrollForm.payPeriod,
      workDays: Number(payrollForm.workDays) || 0,
      dailyRate: Number(payrollForm.dailyRate) || 0,
      bonus: Number(payrollForm.bonus) || 0,
      advance: Number(payrollForm.advance) || 0,
      note: payrollForm.note.trim()
    };
    if (!payload.employeeName) {
      showToast('Vui lòng chọn hoặc nhập tên nhân viên.', 'warning');
      return;
    }
    if (apiMode) {
      try {
        if (payrollModal.mode === 'edit') {
          await updatePayroll(payrollModal.item.id, payload);
          showToast('Đã cập nhật bảng lương nhân viên.', 'success');
        } else {
          await createPayroll(payload);
          showToast('Đã tạo bảng chấm công & tiền lương.', 'success');
        }
        setPayrollModal(null);
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể lưu bảng lương.', 'error');
      }
      return;
    }
    setPayrollModal(null);
  };

  const openPayPayrollModal = (p) => {
    const defaultFund = funds.find(f => f.fundType === 'CASH') || funds[0];
    setPayForm({
      amount: String(p.remain ?? 0),
      cashFundId: defaultFund ? String(defaultFund.id) : '',
      paymentDate: new Date().toISOString().split('T')[0],
      note: `Chi trả lương ${p.employee} (${p.code || p.id})`
    });
    setPayModal(p);
  };

  const handleConfirmPayPayroll = async (e) => {
    e.preventDefault();
    if (!payModal) return;
    const amt = Number(payForm.amount) || 0;
    if (amt <= 0) {
      showToast('Số tiền thanh toán phải lớn hơn 0.', 'warning');
      return;
    }
    if (!apiMode) {
      setPayrolls(payrolls.map(row => row.id === payModal.id
        ? { ...row, paid: Number(row.paid || 0) + amt, remain: Math.max(0, Number(row.remain || 0) - amt), status: Number(row.remain || 0) - amt <= 0 ? 'Đã thanh toán' : 'Còn nợ lương' }
        : row));
      setPayModal(null);
      return;
    }
    try {
      await payPayroll(payModal.id, {
        amount: amt,
        cashFundId: Number(payForm.cashFundId),
        paymentDate: payForm.paymentDate,
        note: payForm.note.trim()
      });
      showToast('Đã chi trả lương và lập phiếu chi quỹ tự động.', 'success');
      setPayModal(null);
      reloadSummary();
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể thanh toán lương.', 'error');
    }
  };

  const handleDeletePayroll = async (p) => {
    if (!window.confirm(`Xóa bảng lương ${p.code || p.id} của ${p.employee}?`)) return;
    if (apiMode) {
      try {
        await deletePayroll(p.id);
        showToast('Đã xóa bảng lương nhân viên.', 'success');
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể xóa bảng lương.', 'error');
      }
    }
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

  const paginateList = (items, currentPage, pageSize) => {
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), pages);
    const start = (safePage - 1) * pageSize;
    return {
      rows: items.slice(start, start + pageSize),
      page: safePage,
      pages,
      total: items.length,
      pageSize,
      from: items.length === 0 ? 0 : start + 1,
      to: Math.min(items.length, start + pageSize),
    };
  };

  const renderPager = (paging, onPage, onPageSize, unitLabel, sizeOptions = [15, 30, 50, 100]) => {
    if (paging.total <= 10 && paging.pages <= 1) return null;
    return (
      <div className={styles.pagerBar}>
        <span>
          Hiển thị <strong>{paging.from}–{paging.to}</strong> / <strong>{paging.total}</strong> {unitLabel}
        </span>
        <div className={styles.pagerControls}>
          <label className={styles.pagerSelectLabel}>
            Số dòng:
            <select
              className={styles.pagerSelect}
              aria-label={`Số dòng mỗi trang ${unitLabel}`}
              value={paging.pageSize}
              onChange={(e) => { onPageSize(Number(e.target.value)); onPage(1); }}
            >
              {sizeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            style={{ padding: '5px 10px', fontSize: '13px' }}
            disabled={paging.page <= 1}
            onClick={() => onPage(paging.page - 1)}
            aria-label={`Trang trước ${unitLabel}`}
          >
            <ChevronLeft size={14} /> Trước
          </button>
          <span>Trang <strong>{paging.page}</strong> / {paging.pages}</span>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            style={{ padding: '5px 10px', fontSize: '13px' }}
            disabled={paging.page >= paging.pages}
            onClick={() => onPage(paging.page + 1)}
            aria-label={`Trang sau ${unitLabel}`}
          >
            Sau <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  const txPaging = paginateList(filteredTx, txPage, txPageSize);
  const costPaging = paginateList(costs, costPage, costPageSize);
  const payrollPaging = paginateList(payrolls, payrollPage, payrollPageSize);

  const resolveVoucherOrigin = (tx) => {
    const ref = tx?.referenceInvoiceCode || '';
    if (!ref) {
      let moduleName = 'Quỹ trang trại (lập trực tiếp)';
      if (tx?.category === 'Tiền điện & nước trang trại') {
        moduleName = 'Chi phí vận hành định kỳ';
      } else if (tx?.category === 'Nạp vốn / Góp vốn' || tx?.category === 'Rút vốn') {
        moduleName = 'Vốn chủ sở hữu';
      }
      return {
        moduleName,
        badgeLabel: null,
        route: null,
        tab: null,
        actionLabel: null,
        payrollMatch: null,
      };
    }
    if (ref.startsWith('NHCG')) {
      return {
        moduleName: 'Hóa đơn nhập con giống',
        badgeLabel: 'Nhập giống',
        route: '/purchases',
        tab: null,
        actionLabel: 'Mở hóa đơn nhập',
        payrollMatch: null,
      };
    }
    if (ref.startsWith('NH')) {
      return {
        moduleName: 'Hóa đơn nhập hàng',
        badgeLabel: 'Nhập hàng',
        route: '/purchases',
        tab: null,
        actionLabel: 'Mở hóa đơn nhập',
        payrollMatch: null,
      };
    }
    if (ref.startsWith('BH')) {
      return {
        moduleName: 'Quản lý bán hàng',
        badgeLabel: 'Đơn bán',
        route: '/sales?tab=orders',
        tab: null,
        actionLabel: 'Mở đơn bán hàng',
        payrollMatch: null,
      };
    }
    if (ref.startsWith('CC')) {
      const payrollMatch = payrolls.find(p => p.code === ref) || null;
      return {
        moduleName: 'Bảng lương nhân sự',
        badgeLabel: 'Bảng lương',
        route: null,
        tab: 'payroll',
        actionLabel: 'Xem bảng lương',
        payrollMatch,
      };
    }
    if (ref.startsWith('CE-')) {
      return {
        moduleName: 'Chi phí lứa nuôi',
        badgeLabel: 'Chi phí lứa',
        route: user?.role !== 'ROLE_ACCOUNTANT' ? '/areas' : null,
        tab: null,
        actionLabel: user?.role !== 'ROLE_ACCOUNTANT' ? 'Mở khu nuôi' : null,
        payrollMatch: null,
      };
    }
    return {
      moduleName: 'Chứng từ liên kết',
      badgeLabel: null,
      route: null,
      tab: null,
      actionLabel: null,
      payrollMatch: null,
    };
  };

  const formatViDate = (raw) => {
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || '—';
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  };

  const openVoucherOrigin = (tx) => {
    const origin = resolveVoucherOrigin(tx);
    if (origin.route) {
      setViewTx(null);
      navigate(origin.route);
      return;
    }
    if (origin.tab) {
      setActiveTab(origin.tab);
      setViewTx(null);
    }
  };

  const modalCategories = txCategories.filter(c => c.type === modalType);
  const categoryOptionsForModal = modalCategories.some(c => c.name === txForm.category)
    ? modalCategories
    : (txForm.category ? [{ id: 'custom', name: txForm.category }, ...modalCategories] : modalCategories);
  const txModalFund = funds.find(f => String(f.id) === String(txForm.fundId)) || funds[0];

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
                type="button"
                className="farmshift-btn farmshift-btn-mint"
                onClick={() => openCreateTxModal('Chi')}
              >
                <Plus size={15} /> Lập phiếu chi
              </button>
              <button
                type="button"
                className="farmshift-btn farmshift-btn-mint"
                onClick={() => openCreateTxModal('Thu')}
              >
                <Plus size={15} /> Lập phiếu thu
              </button>
            </>
          )}
        </div>
      }
    >
      {/* ── Summary Stats ─────────────────────────────────── */}
      <div className={styles.statsGrid}>
        <div className="farmshift-card" style={{ margin: 0, padding: '16px 20px' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG THU VÀO</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#58a99a', marginTop: '6px' }}>
            +{Number(totalRevenue).toLocaleString('vi-VN')} đ
          </div>
        </div>

        <div className="farmshift-card" style={{ margin: 0, padding: '16px 20px' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG CHI RA</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#58a99a', marginTop: '6px' }}>
            -{Number(totalExpense).toLocaleString('vi-VN')} đ
          </div>
        </div>

        <div className="farmshift-card" style={{ margin: 0, padding: '16px 20px' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỒN QUỸ TRANG TRẠI</div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#58a99a', marginTop: '6px' }}>
            {Number(totalFundsBalance).toLocaleString('vi-VN')} đ
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation (wrapped cleanly so no tab gets clipped) ── */}
      <div className={`farmshift-tabs ${styles.tabsWrap}`}>
        <button className={`farmshift-tab-btn ${styles.tabBtnCompact} ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')}>
          Sổ quỹ thu chi ({transactions.length})
        </button>
        <button className={`farmshift-tab-btn ${styles.tabBtnCompact} ${activeTab === 'funds' ? 'active' : ''}`} onClick={() => setActiveTab('funds')}>
          Nguồn quỹ tiền ({funds.length})
        </button>
        <button className={`farmshift-tab-btn ${styles.tabBtnCompact} ${activeTab === 'costs' ? 'active' : ''}`} onClick={() => setActiveTab('costs')}>
          <Calculator size={14} />
          Phân bổ chi phí lứa ({costs.length})
        </button>
        <button className={`farmshift-tab-btn ${styles.tabBtnCompact} ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>
          <Building size={14} />
          Tài sản & Khấu hao ({assets.length})
        </button>
        <button className={`farmshift-tab-btn ${styles.tabBtnCompact} ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => setActiveTab('payroll')}>
          <Users size={14} />
          Tiền công nhân viên ({payrolls.length})
        </button>
      </div>

      {/* ── Tab 1: Sổ quỹ thu chi ────────────────────────── */}
      {activeTab === 'ledger' && (
        <>
          <div className={`farmshift-toolbar ${styles.toolbar}`}>
            <div className="farmshift-search-box">
              <Search size={16} color="var(--color-muted)" />
              <input
                type="text"
                placeholder="Tìm theo mã phiếu, người nộp/nhận, loại thu chi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className={`farmshift-filter-group ${styles.filterGroup}`}>
              <select aria-label="Lọc loại phiếu" className="farmshift-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="ALL">Tất cả thu / chi</option>
                <option value="Thu">Chỉ xem phiếu thu</option>
                <option value="Chi">Chỉ xem phiếu chi</option>
              </select>
              {funds.length > 1 && (
                <select aria-label="Lọc theo nguồn quỹ" className="farmshift-select" value={filterFundId} onChange={(e) => setFilterFundId(e.target.value)}>
                  <option value="ALL">Tất cả nguồn quỹ</option>
                  {funds.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
              <input aria-label="Từ ngày" type="date" className="farmshift-select" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              <input aria-label="Đến ngày" type="date" className="farmshift-select" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
          </div>

          <div className="farmshift-card">
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className={`farmshift-table ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Ngày ghi</th>
                    <th>Loại giao dịch</th>
                    <th>Chứng từ gốc</th>
                    <th>Số tiền</th>
                    <th>Người nộp/nhận</th>
                    <th>Quỹ tiền</th>
                    <th>Mô tả</th>
                    <th className={styles.actionsCell}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !filteredTx.length ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>Đang tải dữ liệu sổ quỹ...</td></tr>
                  ) : !filteredTx.length ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>Không có phiếu thu chi nào phù hợp bộ lọc.</td></tr>
                  ) : txPaging.rows.map(t => {
                    const origin = resolveVoucherOrigin(t);
                    const refLabel = t.referenceInvoiceCode ? `Phiếu ${t.code} liên kết chứng từ ${t.referenceInvoiceCode}` : null;
                    const canJump = Boolean(origin.route || origin.tab);
                    return (
                      <tr key={t.id}>
                        <td className={styles.codeCell}>{t.code}</td>
                        <td className={styles.dateCell}>{t.date}</td>
                        <td>
                          <span className={`farmshift-badge ${t.type === 'Thu' ? styles.mintBadge : styles.sageBadge}`}>
                            {t.type === 'Thu' ? '↑ Thu' : '↓ Chi'} — {t.category}
                          </span>
                        </td>
                        <td className={styles.refCell}>
                          {!t.referenceInvoiceCode ? (
                            <span className={styles.manualOriginBadge}>Phiếu tại quỹ</span>
                          ) : canJump ? (
                            <button
                              type="button"
                              className={`farmshift-badge farmshift-badge-neutral ${styles.refBadge} ${styles.refBadgeInteractive}`}
                              title={`${origin.moduleName} (${t.referenceInvoiceCode}) — Bấm để ${origin.actionLabel?.toLowerCase()}`}
                              aria-label={refLabel}
                              onClick={() => openVoucherOrigin(t)}
                            >
                              <Link2 size={12} />
                              {t.referenceInvoiceCode}
                            </button>
                          ) : (
                            <span
                              className={`farmshift-badge farmshift-badge-neutral ${styles.refBadge}`}
                              title={`${origin.moduleName} (${t.referenceInvoiceCode})`}
                              aria-label={refLabel}
                            >
                              <Link2 size={12} />
                              {t.referenceInvoiceCode}
                            </span>
                          )}
                        </td>
                        <td className={styles.amountCell}>
                          <span style={{ color: t.type === 'Thu' ? '#007968' : 'var(--color-ink)' }}>
                            {t.type === 'Thu' ? '+' : '-'}{Number(t.amount || 0).toLocaleString('vi-VN')} đ
                          </span>
                        </td>
                        <td className={styles.personCell}>
                          <strong>{t.name}</strong>
                          <div className={styles.personSub}>{t.contact || 'Đối tượng khác'}</div>
                        </td>
                        <td>
                          <span className="farmshift-badge farmshift-badge-neutral">{t.fund}</span>
                        </td>
                        <td className={styles.noteCell} title={t.note || ''}>
                          {t.note || '—'}
                        </td>
                        <td className={styles.actionsCell}>
                          <div className={styles.actionsGroup}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              title="Xem chi tiết phiếu"
                              aria-label={`Xem phiếu ${t.code}`}
                              onClick={() => setViewTx(t)}
                            >
                              <Eye size={15} />
                            </button>
                            {canWrite && !t.referenceInvoiceCode && (
                              <>
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  title="Sửa phiếu"
                                  aria-label={`Sửa phiếu ${t.code}`}
                                  onClick={() => openEditTxModal(t)}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                  title="Xóa phiếu"
                                  aria-label={`Xóa phiếu ${t.code}`}
                                  onClick={() => handleDeleteTx(t)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {renderPager(txPaging, setTxPage, setTxPageSize, 'phiếu')}
          </div>
        </>
      )}

      {/* ── Tab 2: Nguồn quỹ tiền (FIN-07) ────────────────── */}
      {activeTab === 'funds' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="farmshift-card-title">Quỹ tiền tệ tập trung của trang trại</h3>
            {canWrite && funds.length === 0 && (
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
                        {f.fundType === 'CASH' ? 'Tiền mặt' : 'Quỹ trang trại'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{f.accountNo || '—'}</td>
                    <td>{f.bank}</td>
                    <td>
                      <strong style={{ fontSize: '15px', color: '#007968' }}>
                        {Number(f.balance || 0).toLocaleString('vi-VN')} đ
                      </strong>
                    </td>
                    <td style={{ color: 'var(--color-muted)' }}>{f.note || '—'}</td>
                    {canWrite && (
                      <td style={{ textAlign: 'center' }}>
                        <div className={styles.actionsGroup}>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            title="Sửa nguồn quỹ"
                            aria-label={`Sửa nguồn quỹ ${f.name}`}
                            onClick={() => openEditFundModal(f)}
                          >
                            <Pencil size={15} />
                          </button>
                          {funds.length > 1 && (
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                              title="Xóa nguồn quỹ"
                              aria-label={`Xóa nguồn quỹ ${f.name}`}
                              onClick={() => handleDeleteFund(f)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
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

      {/* ── Tab 4: PHÂN BỔ CHI PHÍ LỨA ───────────────────── */}
      {activeTab === 'costs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="farmshift-card" style={{ margin: 0 }}>
            <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 className="farmshift-card-title">
                <Calculator size={18} color="#008577" />
                Bảng phân bổ chi phí về lứa nuôi
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="farmshift-badge farmshift-badge-neutral">
                  Tổng phân bổ: {costs.reduce((s, c) => s + Number(c.amount || 0), 0).toLocaleString('vi-VN')} đ
                </span>
                {canWrite && (
                  <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => openCostModal('create')}>
                    <Plus size={15} /> Thêm phân bổ chi phí
                  </button>
                )}
              </div>
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
                    {canWrite && <th style={{ textAlign: 'center' }}>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {costPaging.rows.map(c => (
                    <tr key={c.id}>
                      <td className={styles.codeCell}>{c.code || c.id}</td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{c.house}</strong></td>
                      <td><span className="farmshift-badge farmshift-badge-neutral">{c.cycle}</span></td>
                      <td>{c.type}</td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{Number(c.amount || 0).toLocaleString('vi-VN')} đ</strong></td>
                      <td><span style={{ fontFamily: 'monospace' }}>{c.source || '—'}</span></td>
                      <td>{c.date}</td>
                      <td style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>{c.notes || '—'}</td>
                      {canWrite && (
                        <td style={{ textAlign: 'center' }}>
                          <div className={styles.actionsGroup}>
                            <button type="button" className={styles.iconBtn} aria-label={`Sửa phân bổ ${c.code || c.id}`} onClick={() => openCostModal('edit', c)}>
                              <Pencil size={15} />
                            </button>
                            <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} aria-label={`Xóa phân bổ ${c.code || c.id}`} onClick={() => handleDeleteCost(c)}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPager(costPaging, setCostPage, setCostPageSize, 'khoản phân bổ', [10, 15, 30, 50])}
          </div>
        </div>
      )}

      {/* ── Tab 5: TÀI SẢN & KHẤU HAO ────────────────────── */}
      {activeTab === 'assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.statsGrid}>
            <div className="farmshift-card" style={{ margin: 0, padding: '16px 20px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG NGUYÊN GIÁ TÀI SẢN</div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: '#58a99a', marginTop: '6px' }}>
                {assets.reduce((s, a) => s + Number(a.cost || 0), 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '16px 20px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TRÍCH KHẤU HAO / THÁNG</div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: '#58a99a', marginTop: '6px' }}>
                {Math.round(assets.reduce((s, a) => s + Number(a.monthlyDep || 0), 0)).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '16px 20px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>SỐ LƯỢNG TÀI SẢN CỐ ĐỊNH</div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: '#58a99a', marginTop: '6px' }}>
                {assets.length} thiết bị
              </div>
            </div>
          </div>

          <div className="farmshift-card" style={{ margin: 0 }}>
            <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="farmshift-card-title">
                <Building size={18} color="#008577" />
                Danh mục tài sản cố định & bảng trích khấu hao
              </h3>
              {canWrite && (
                <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => openAssetModal('create')}>
                  <Plus size={15} /> Thêm tài sản
                </button>
              )}
            </div>
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className="farmshift-table">
                <thead>
                  <tr>
                    <th>Mã tài sản</th>
                    <th>Tên tài sản</th>
                    <th>Nguyên giá</th>
                    <th>Khấu hao</th>
                    <th>Khấu hao / tháng</th>
                    <th>Phân bổ chuồng</th>
                    <th>Trạng thái</th>
                    {canWrite && <th style={{ textAlign: 'center' }}>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {assets.map(a => (
                    <tr key={a.id}>
                      <td className={styles.codeCell}>{a.code || a.id}</td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{a.name}</strong></td>
                      <td><strong>{Number(a.cost || 0).toLocaleString('vi-VN')} đ</strong></td>
                      <td>{a.months} tháng</td>
                      <td><strong style={{ color: '#008577' }}>{Math.round(Number(a.monthlyDep || 0)).toLocaleString('vi-VN')} đ</strong></td>
                      <td>{a.house}</td>
                      <td><span className={`farmshift-badge ${a.status === 'Đang trích khấu hao' ? styles.mintBadge : styles.sageBadge}`}>{a.status}</span></td>
                      {canWrite && (
                        <td style={{ textAlign: 'center' }}>
                          <div className={styles.actionsGroup}>
                            <button type="button" className={styles.iconBtn} aria-label={`Sửa tài sản ${a.code || a.id}`} onClick={() => openAssetModal('edit', a)}>
                              <Pencil size={15} />
                            </button>
                            <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} aria-label={`Xóa tài sản ${a.code || a.id}`} onClick={() => handleDeleteAsset(a)}>
                              <Trash2 size={15} />
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
        </div>
      )}

      {/* ── Tab 6: TIỀN CÔNG NHÂN VIÊN ───────────────────── */}
      {activeTab === 'payroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.statsGrid}>
            <div className="farmshift-card" style={{ margin: 0, padding: '16px 20px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG TIỀN CÔNG</div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: '#58a99a', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + Number(p.total || 0), 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '16px 20px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>ĐÃ THANH TOÁN</div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: '#58a99a', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + Number(p.paid || 0), 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '16px 20px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', fontWeight: 500 }}>CÒN PHẢI TRẢ</div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: '#58a99a', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + Number(p.remain || 0), 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
          </div>

          <div className="farmshift-card" style={{ margin: 0 }}>
            <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="farmshift-card-title">
                <Users size={18} color="#008577" />
                Bảng chấm công & thanh toán tiền công nhân viên
              </h3>
              {canWrite && (
                <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => openPayrollModal('create')}>
                  <Plus size={15} /> Lập bảng lương
                </button>
              )}
            </div>
            <div className="farmshift-table-container" style={{ border: 'none' }}>
              <table className={`farmshift-table ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Mã bảng công</th>
                    <th>Nhân viên</th>
                    <th>Kỳ</th>
                    <th>Ngày công</th>
                    <th>Đơn giá</th>
                    <th>Phụ cấp / Ứng</th>
                    <th>Tổng lương</th>
                    <th>Đã trả</th>
                    <th>Còn phải trả</th>
                    <th>Trạng thái</th>
                    <th className={styles.actionsCell}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollPaging.rows.map(p => (
                    <tr key={p.id}>
                      <td className={styles.codeCell}>{p.code || p.id}</td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{p.employee}</strong></td>
                      <td>{p.period || '—'}</td>
                      <td><strong>{p.days}</strong> ngày</td>
                      <td>{Number(p.rate || 0).toLocaleString('vi-VN')} đ</td>
                      <td>
                        <span style={{ color: '#007968' }}>+{Number(p.bonus || 0).toLocaleString('vi-VN')}</span>
                        {' / '}
                        <span style={{ color: 'var(--color-muted)' }}>-{Number(p.advance || 0).toLocaleString('vi-VN')}</span>
                      </td>
                      <td><strong>{Number(p.total || 0).toLocaleString('vi-VN')} đ</strong></td>
                      <td><strong style={{ color: '#007968' }}>{Number(p.paid || 0).toLocaleString('vi-VN')} đ</strong></td>
                      <td>
                        <strong style={{ color: Number(p.remain || 0) > 0 ? 'var(--color-ink)' : 'var(--color-muted)' }}>
                          {Number(p.remain || 0).toLocaleString('vi-VN')} đ
                        </strong>
                      </td>
                      <td>
                        <span className={`farmshift-badge ${Number(p.remain || 0) === 0 ? styles.mintBadge : styles.sageBadge}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className={styles.actionsCell}>
                        <div className={styles.actionsGroup}>
                          {Number(p.remain || 0) > 0 && canWrite && (
                            <button
                              type="button"
                              className={`farmshift-btn farmshift-btn-mint ${styles.compactActionBtn}`}
                              aria-label={`Thanh toán lương ${p.code || p.id}`}
                              onClick={() => openPayPayrollModal(p)}
                            >
                              Thanh toán
                            </button>
                          )}
                          {canWrite && (
                            <>
                              <button type="button" className={styles.iconBtn} aria-label={`Sửa bảng lương ${p.code || p.id}`} onClick={() => openPayrollModal('edit', p)}>
                                <Pencil size={15} />
                              </button>
                              {Number(p.paid || 0) === 0 && (
                                <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} aria-label={`Xóa bảng lương ${p.code || p.id}`} onClick={() => handleDeletePayroll(p)}>
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPager(payrollPaging, setPayrollPage, setPayrollPageSize, 'bảng lương', [10, 15, 30, 50])}
          </div>
        </div>
      )}

      {/* ── Modal: Xem chi tiết phiếu thu / chi ────────────── */}
      {viewTx && (() => {
        const isIncome = viewTx.type === 'Thu';
        const viewOrigin = resolveVoucherOrigin(viewTx);
        const viewFund = funds.find(f => String(f.id) === String(viewTx.fundId) || f.name === viewTx.fund);
        const canJumpOrigin = Boolean(viewOrigin.route || viewOrigin.tab);
        const payrollDetail = viewOrigin.payrollMatch;
        return (
          <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setViewTx(null); }}>
            <div className="farmshift-modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
              <div className="farmshift-modal-header" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className={`farmshift-badge ${isIncome ? styles.mintBadge : styles.sageBadge}`}>
                      {isIncome ? '↑ Phiếu thu' : '↓ Phiếu chi'}
                    </span>
                    <h3 className={`farmshift-modal-title ${styles.codeCell}`} style={{ margin: 0 }}>{viewTx.code}</h3>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', marginTop: '4px' }}>
                    Chi tiết hạch toán sổ quỹ · {viewOrigin.moduleName}
                  </div>
                </div>
                <button type="button" className={styles.modalCloseBtn} aria-label="Đóng chi tiết phiếu" onClick={() => setViewTx(null)}>✕</button>
              </div>

              <div className="farmshift-modal-body" style={{ display: 'grid', gap: '14px' }}>
                <div className={`${styles.detailHero} ${isIncome ? styles.detailHeroIncome : styles.detailHeroExpense}`}>
                  <div>
                    <div className={styles.detailHeroLabel}>{viewTx.category}</div>
                    <div
                      className={styles.detailHeroAmount}
                      style={{ color: isIncome ? '#007968' : 'var(--color-ink)' }}
                    >
                      {isIncome ? '+' : '-'}{Number(viewTx.amount || 0).toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={styles.detailItemLabel}>Ngày ghi nhận</div>
                    <div className={styles.detailItemValue} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatViDate(viewTx.date)}
                    </div>
                  </div>
                </div>

                <div className={styles.detailGrid}>
                  <div>
                    <div className={styles.detailItemLabel}>Đối tượng giao dịch</div>
                    <div className={styles.detailItemValue}>{viewTx.name || '—'}</div>
                    <div className={styles.detailSubText}>{viewTx.contact || 'Đối tượng khác'}</div>
                  </div>
                  <div>
                    <div className={styles.detailItemLabel}>Nguồn quỹ</div>
                    <div className={styles.detailItemValue}>{viewTx.fund || 'Quỹ trang trại'}</div>
                    <div className={styles.detailSubText}>
                      {viewFund?.accountNo && viewFund.accountNo !== '—'
                        ? `STK ${viewFund.accountNo}${viewFund.bank ? ` · ${viewFund.bank}` : ''}`
                        : (viewFund?.bank || 'Quỹ tập trung toàn trang trại')}
                    </div>
                  </div>
                  <div>
                    <div className={styles.detailItemLabel}>Người lập / ghi nhận</div>
                    <div className={styles.detailItemValue}>{viewTx.creator || 'Hệ thống'}</div>
                    <div className={styles.detailSubText}>
                      {viewTx.referenceInvoiceCode ? 'Đồng bộ tự động từ chứng từ' : 'Ghi nhận trực tiếp trên sổ quỹ'}
                    </div>
                  </div>
                  <div>
                    <div className={styles.detailItemLabel}>Phân hệ nguồn</div>
                    <div className={styles.detailItemValue}>{viewOrigin.moduleName}</div>
                    <div className={styles.detailSubText}>{isIncome ? 'Ghi tăng tồn quỹ trang trại' : 'Ghi giảm tồn quỹ trang trại'}</div>
                  </div>
                </div>

                {viewTx.referenceInvoiceCode && (
                  <div className={styles.detailSourceBox}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Link2 size={14} color="#165b4c" />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#165b4c' }}>Chứng từ liên kết:</span>
                        <span className={`farmshift-badge farmshift-badge-neutral ${styles.refBadge}`}>
                          {viewTx.referenceInvoiceCode}
                        </span>
                      </div>
                      <div className={styles.detailSubText} style={{ marginTop: '4px' }}>
                        (phiếu tự động — chỉnh sửa tại chứng từ gốc)
                      </div>
                      {payrollDetail && (
                        <div className={styles.detailSubText} style={{ marginTop: '4px', color: '#165b4c' }}>
                          Kỳ công {payrollDetail.period} · Tổng công {Number(payrollDetail.total || 0).toLocaleString('vi-VN')} đ · {payrollDetail.status}
                        </div>
                      )}
                    </div>
                    {canJumpOrigin && (
                      <button
                        type="button"
                        className="farmshift-btn farmshift-btn-secondary"
                        onClick={() => openVoucherOrigin(viewTx)}
                      >
                        <ExternalLink size={14} /> {viewOrigin.actionLabel}
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <div className={styles.detailItemLabel} style={{ marginBottom: '6px' }}>Diễn giải / Nội dung hạch toán</div>
                  <div className={styles.detailNoteBox}>
                    {viewTx.note || 'Không có ghi chú bổ sung.'}
                  </div>
                </div>
              </div>

              <div className="farmshift-modal-footer">
                {canWrite && !viewTx.referenceInvoiceCode && (
                  <button
                    type="button"
                    className="farmshift-btn farmshift-btn-secondary"
                    onClick={() => {
                      const target = viewTx;
                      setViewTx(null);
                      openEditTxModal(target);
                    }}
                  >
                    <Pencil size={14} /> Chỉnh sửa
                  </button>
                )}
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setViewTx(null)}>Đóng</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal: Lập / Sửa phiếu thu chi trực tiếp (FIN-08) ─ */}
      {txModalMode && (() => {
        const isIncomeModal = modalType === 'Thu';
        const enteredAmt = Number(txForm.amount) || 0;
        const currentFundBalance = Number(txModalFund?.balance || 0);
        const editingOldTx = txModalMode === 'edit' ? transactions.find(t => t.id === editingTxId) : null;
        const oldSignedSameFund = editingOldTx && String(editingOldTx.fundId) === String(txModalFund?.id)
          ? (editingOldTx.type === 'Thu' ? Number(editingOldTx.amount || 0) : -Number(editingOldTx.amount || 0))
          : 0;
        const newSigned = isIncomeModal ? enteredAmt : -enteredAmt;
        const projectedBalance = currentFundBalance - oldSignedSameFund + newSigned;
        const orderedCategories = [...categoryOptionsForModal].sort((a, b) => {
          const priority = {
            'Nạp vốn / Góp vốn': 1,
            'Thu khác': 2,
            'Rút vốn': 1,
            'Tiền điện & nước trang trại': 2,
            'Chi phí khác': 3
          };
          return (priority[a.name] || 10) - (priority[b.name] || 10);
        });

        return (
          <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !txSaving) setTxModalMode(null); }}>
            <div className="farmshift-modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
              <div className="farmshift-modal-header" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className={`farmshift-badge ${isIncomeModal ? styles.mintBadge : styles.sageBadge}`}>
                      {isIncomeModal ? '↑ Phiếu thu' : '↓ Phiếu chi'}
                    </span>
                    <h3 className="farmshift-modal-title" style={{ margin: 0 }}>
                      {txModalMode === 'edit'
                        ? `Cập nhật phiếu ${modalType.toLowerCase()}`
                        : isIncomeModal ? 'Lập phiếu thu tiền' : 'Lập phiếu chi tiền'}
                    </h3>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--color-muted)', marginTop: '4px' }}>
                    {txModalFund
                      ? `Hạch toán trực tiếp tại ${txModalFund.name}`
                      : 'Ghi nhận thu / chi trực tiếp vào Quỹ trang trại'}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  aria-label="Đóng biểu mẫu phiếu"
                  onClick={() => !txSaving && setTxModalMode(null)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveTx}>
                <div className={`farmshift-modal-body ${styles.txModalBody}`}>
                  {funds.length <= 1 ? (
                    <div className={`${styles.txFundStrip} ${isIncomeModal ? styles.txFundStripIncome : styles.txFundStripExpense}`}>
                      <div>
                        <div className={styles.txFundName}>{txModalFund?.name || 'Quỹ trang trại'}</div>
                        <div className={styles.txFundBalance}>
                          Tồn hiện tại: <strong>{currentFundBalance.toLocaleString('vi-VN')} đ</strong>
                        </div>
                      </div>
                      <div
                        className={styles.txFundProjected}
                        style={{
                          color: projectedBalance < 0
                            ? 'var(--color-ink)'
                            : '#007968'
                        }}
                      >
                        {enteredAmt > 0
                          ? `Sau phiếu: ${projectedBalance.toLocaleString('vi-VN')} đ`
                          : (isIncomeModal ? '+ Tăng tồn quỹ' : '− Giảm tồn quỹ')}
                      </div>
                    </div>
                  ) : (
                    <div className="farmshift-form-group">
                      <label htmlFor="tx-fund" className="farmshift-form-label">Nguồn quỹ *</label>
                      <select
                        id="tx-fund"
                        className="farmshift-form-control"
                        value={txForm.fundId}
                        onChange={(e) => setTxForm({ ...txForm, fundId: e.target.value })}
                      >
                        {funds.map(f => (
                          <option key={f.id} value={f.id}>{f.name} ({Number(f.balance || 0).toLocaleString('vi-VN')} đ)</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {txModalMode === 'edit' && (
                    <div className="farmshift-form-group">
                      <label htmlFor="tx-type" className="farmshift-form-label">Phân loại phiếu *</label>
                      <select
                        id="tx-type"
                        className="farmshift-form-control"
                        value={modalType}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          setModalType(nextType);
                          setTxForm(prev => ({ ...prev, category: resolveDefaultTxCategory(nextType) }));
                        }}
                      >
                        <option value="Thu">Thu</option>
                        <option value="Chi">Chi</option>
                      </select>
                    </div>
                  )}

                  <div className={styles.txGrid2}>
                    <div className="farmshift-form-group">
                      <label htmlFor="tx-category" className="farmshift-form-label">Loại thu / chi *</label>
                      <select
                        id="tx-category"
                        className="farmshift-form-control"
                        value={txForm.category}
                        onChange={(e) => {
                          const nextCategory = e.target.value;
                          setTxForm(prev => ({
                            ...prev,
                            category: nextCategory,
                            contact: txModalMode === 'create'
                              ? (isCapitalCategory(nextCategory) ? 'Chủ trang trại' : 'Đối tượng khác')
                              : prev.contact
                          }));
                        }}
                      >
                        {orderedCategories.map(cat => (
                          <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
                        ))}
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

                  <div className="farmshift-form-group">
                    <div className={styles.txLabelRow}>
                      <label htmlFor="tx-amount" className="farmshift-form-label">Số tiền (đ) *</label>
                      {enteredAmt > 0 && (
                        <span
                          className={styles.txFormattedAmt}
                          style={{ color: isIncomeModal ? '#007968' : 'var(--color-ink)' }}
                        >
                          {isIncomeModal ? '+' : '−'}{enteredAmt.toLocaleString('vi-VN')} đ
                        </span>
                      )}
                    </div>
                    <input
                      id="tx-amount"
                      type="number"
                      min="1"
                      required
                      placeholder="Nhập số tiền (VD: 50000000)"
                      className={`farmshift-form-control ${styles.txAmountInput}`}
                      value={txForm.amount}
                      onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                    />
                  </div>

                  <div className={styles.txGrid2}>
                    <div className="farmshift-form-group">
                      <label htmlFor="tx-contact" className="farmshift-form-label">Nhóm đối tượng</label>
                      <select
                        id="tx-contact"
                        className="farmshift-form-control"
                        value={txForm.contact}
                        onChange={(e) => setTxForm({ ...txForm, contact: e.target.value })}
                      >
                        <option value="Chủ trang trại">Chủ trang trại</option>
                        <option value="Cổ đông / Đối tác">Cổ đông / Đối tác</option>
                        <option value="Khách hàng">Khách hàng</option>
                        <option value="Nhà cung cấp">Nhà cung cấp</option>
                        <option value="Nhân sự">Nhân sự</option>
                        <option value="Đối tượng khác">Đối tượng khác</option>
                      </select>
                    </div>
                    <div className="farmshift-form-group">
                      <label htmlFor="tx-name" className="farmshift-form-label">Người nộp / nhận *</label>
                      <input
                        id="tx-name"
                        type="text"
                        required
                        placeholder={
                          isCapitalCategory(txForm.category)
                            ? 'VD: Chủ trang trại, Cổ đông góp vốn...'
                            : isIncomeModal
                              ? 'VD: Nguyễn Văn A, Đối tác...'
                              : 'VD: Điện lực Tam Đảo, Đơn vị dịch vụ...'
                        }
                        className="farmshift-form-control"
                        value={txForm.name}
                        onChange={(e) => setTxForm({ ...txForm, name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="farmshift-form-group">
                    <label htmlFor="tx-note" className="farmshift-form-label">Diễn giải / Nội dung hạch toán</label>
                    <textarea
                      id="tx-note"
                      rows="2"
                      placeholder={
                        txForm.category === 'Nạp vốn / Góp vốn'
                          ? 'VD: Nạp bổ sung vốn lưu động nhập giống, cám cho trại...'
                          : txForm.category === 'Rút vốn'
                            ? 'VD: Rút vốn hoặc tạm ứng phân chia lợi nhuận lứa...'
                            : 'Mô tả cụ thể lý do thu / chi...'
                      }
                      className="farmshift-form-control"
                      style={{ minHeight: '72px' }}
                      value={txForm.note}
                      onChange={(e) => setTxForm({ ...txForm, note: e.target.value })}
                    />
                  </div>
                </div>

                <div className="farmshift-modal-footer">
                  <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={txSaving} onClick={() => setTxModalMode(null)}>
                    Hủy
                  </button>
                  <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={txSaving}>
                    {txSaving ? 'Đang lưu...' : txModalMode === 'edit' ? 'Lưu cập nhật' : `Lưu phiếu ${modalType.toLowerCase()}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ── Modal: Thêm / Sửa nguồn quỹ (FIN-07) ───────────── */}
      {fundModal && (
        <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !fundSaving) setFundModal(null); }}>
          <div className="farmshift-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">{fundModal.mode === 'edit' ? 'Cập nhật nguồn quỹ' : 'Thêm nguồn quỹ mới'}</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Đóng nguồn quỹ" onClick={() => !fundSaving && setFundModal(null)}>✕</button>
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

      {/* ── Modal: Phân bổ chi phí lứa ───────────────────── */}
      {costModal && (
        <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setCostModal(null); }}>
          <div className="farmshift-modal" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">{costModal.mode === 'edit' ? 'Cập nhật phân bổ chi phí' : 'Thêm phân bổ chi phí lứa'}</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Đóng phân bổ chi phí" onClick={() => setCostModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveCost}>
              <div className="farmshift-modal-body">
                {cycleOptions.length > 0 && (
                  <div className="farmshift-form-group">
                    <label htmlFor="cost-cycle-select" className="farmshift-form-label">Chọn lứa nuôi (DB)</label>
                    <select
                      id="cost-cycle-select"
                      className="farmshift-form-control"
                      value={costForm.cycleId}
                      onChange={(e) => {
                        const selected = cycleOptions.find(c => String(c.id) === e.target.value);
                        setCostForm({
                          ...costForm,
                          cycleId: e.target.value,
                          barnName: selected ? selected.barnName : costForm.barnName,
                          cycleCode: selected ? selected.code : costForm.cycleCode
                        });
                      }}
                    >
                      <option value="">-- Nhập chuồng / lứa thủ công --</option>
                      {cycleOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.barnName} · {c.code} (Lứa {c.cycleNumber})</option>
                      ))}
                    </select>
                  </div>
                )}
                {!costForm.cycleId && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="farmshift-form-group">
                      <label htmlFor="cost-barn" className="farmshift-form-label">Chuồng nuôi *</label>
                      <input id="cost-barn" type="text" required className="farmshift-form-control" value={costForm.barnName} onChange={(e) => setCostForm({ ...costForm, barnName: e.target.value })} placeholder="VD: Nhà A1" />
                    </div>
                    <div className="farmshift-form-group">
                      <label htmlFor="cost-cycle" className="farmshift-form-label">Mã lứa nuôi *</label>
                      <input id="cost-cycle" type="text" required className="farmshift-form-control" value={costForm.cycleCode} onChange={(e) => setCostForm({ ...costForm, cycleCode: e.target.value })} placeholder="VD: L000001" />
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="cost-type" className="farmshift-form-label">Loại chi phí *</label>
                    <input id="cost-type" type="text" required className="farmshift-form-control" value={costForm.costType} onChange={(e) => setCostForm({ ...costForm, costType: e.target.value })} />
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="cost-amount" className="farmshift-form-label">Số tiền (đ) *</label>
                    <input id="cost-amount" type="number" min="1" required className="farmshift-form-control" value={costForm.amount} onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="cost-source" className="farmshift-form-label">Chứng từ nguồn</label>
                    <input id="cost-source" type="text" className="farmshift-form-control" placeholder="VD: PC000035" value={costForm.sourceVoucherCode} onChange={(e) => setCostForm({ ...costForm, sourceVoucherCode: e.target.value })} />
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="cost-date" className="farmshift-form-label">Ngày ghi nhận *</label>
                    <input id="cost-date" type="date" required className="farmshift-form-control" value={costForm.date} onChange={(e) => setCostForm({ ...costForm, date: e.target.value })} />
                  </div>
                </div>
                <div className="farmshift-form-group">
                  <label htmlFor="cost-note" className="farmshift-form-label">Ghi chú</label>
                  <textarea id="cost-note" rows="2" className="farmshift-form-control" value={costForm.note} onChange={(e) => setCostForm({ ...costForm, note: e.target.value })} />
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setCostModal(null)}>Hủy</button>
                <button type="submit" className="farmshift-btn farmshift-btn-mint">Lưu phân bổ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Tài sản cố định & Khấu hao ────────────── */}
      {assetModal && (
        <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setAssetModal(null); }}>
          <div className="farmshift-modal" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">{assetModal.mode === 'edit' ? 'Cập nhật tài sản cố định' : 'Thêm tài sản cố định'}</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Đóng tài sản cố định" onClick={() => setAssetModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveAsset}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label htmlFor="asset-name" className="farmshift-form-label">Tên tài sản *</label>
                  <input id="asset-name" type="text" required className="farmshift-form-control" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="asset-cost" className="farmshift-form-label">Nguyên giá (đ) *</label>
                    <input id="asset-cost" type="number" min="1" required className="farmshift-form-control" value={assetForm.cost} onChange={(e) => setAssetForm({ ...assetForm, cost: e.target.value })} />
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="asset-months" className="farmshift-form-label">Số tháng khấu hao *</label>
                    <input id="asset-months" type="number" min="1" required className="farmshift-form-control" value={assetForm.depreciationMonths} onChange={(e) => setAssetForm({ ...assetForm, depreciationMonths: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="asset-house" className="farmshift-form-label">Vị trí / Phân bổ chuồng</label>
                    <input id="asset-house" type="text" className="farmshift-form-control" value={assetForm.barnLocation} onChange={(e) => setAssetForm({ ...assetForm, barnLocation: e.target.value })} />
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="asset-status" className="farmshift-form-label">Trạng thái</label>
                    <select id="asset-status" className="farmshift-form-control" value={assetForm.status} onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value })}>
                      <option value="Đang trích khấu hao">Đang trích khấu hao</option>
                      <option value="Đã khấu hao hết">Đã khấu hao hết</option>
                      <option value="Ngưng sử dụng">Ngưng sử dụng</option>
                    </select>
                  </div>
                </div>
                <div className="farmshift-form-group">
                  <label htmlFor="asset-note" className="farmshift-form-label">Ghi chú</label>
                  <textarea id="asset-note" rows="2" className="farmshift-form-control" value={assetForm.note} onChange={(e) => setAssetForm({ ...assetForm, note: e.target.value })} />
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setAssetModal(null)}>Hủy</button>
                <button type="submit" className="farmshift-btn farmshift-btn-mint">Lưu tài sản</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Lập / Sửa Bảng lương ──────────────────── */}
      {payrollModal && (
        <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setPayrollModal(null); }}>
          <div className="farmshift-modal" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">{payrollModal.mode === 'edit' ? 'Cập nhật bảng lương' : 'Lập bảng chấm công & tiền lương'}</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Đóng bảng lương" onClick={() => setPayrollModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSavePayroll}>
              <div className="farmshift-modal-body">
                {staffOptions.length > 0 && (
                  <div className="farmshift-form-group">
                    <label htmlFor="payroll-staff" className="farmshift-form-label">Chọn nhân sự (từ tài khoản)</label>
                    <select
                      id="payroll-staff"
                      className="farmshift-form-control"
                      value={payrollForm.accountId}
                      onChange={(e) => {
                        const acc = staffOptions.find(s => String(s.id) === e.target.value);
                        setPayrollForm({ ...payrollForm, accountId: e.target.value, employeeName: acc ? acc.fullName : payrollForm.employeeName });
                      }}
                    >
                      <option value="">-- Nhập tên thủ công --</option>
                      {staffOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.fullName}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="payroll-name" className="farmshift-form-label">Tên nhân viên *</label>
                    <input id="payroll-name" type="text" required className="farmshift-form-control" value={payrollForm.employeeName} onChange={(e) => setPayrollForm({ ...payrollForm, employeeName: e.target.value })} />
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="payroll-period" className="farmshift-form-label">Kỳ lương *</label>
                    <input id="payroll-period" type="month" required className="farmshift-form-control" value={payrollForm.payPeriod} onChange={(e) => setPayrollForm({ ...payrollForm, payPeriod: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="payroll-days" className="farmshift-form-label">Ngày công *</label>
                    <input id="payroll-days" type="number" min="0" required className="farmshift-form-control" value={payrollForm.workDays} onChange={(e) => setPayrollForm({ ...payrollForm, workDays: e.target.value })} />
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="payroll-rate" className="farmshift-form-label">Đơn giá / ngày (đ) *</label>
                    <input id="payroll-rate" type="number" min="0" required className="farmshift-form-control" value={payrollForm.dailyRate} onChange={(e) => setPayrollForm({ ...payrollForm, dailyRate: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="payroll-bonus" className="farmshift-form-label">Phụ cấp / Thưởng (đ)</label>
                    <input id="payroll-bonus" type="number" min="0" className="farmshift-form-control" value={payrollForm.bonus} onChange={(e) => setPayrollForm({ ...payrollForm, bonus: e.target.value })} />
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="payroll-advance" className="farmshift-form-label">Đã tạm ứng (đ)</label>
                    <input id="payroll-advance" type="number" min="0" className="farmshift-form-control" value={payrollForm.advance} onChange={(e) => setPayrollForm({ ...payrollForm, advance: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setPayrollModal(null)}>Hủy</button>
                <button type="submit" className="farmshift-btn farmshift-btn-mint">Lưu bảng lương</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Chi trả lương liên kết Quỹ ────────────── */}
      {payModal && (
        <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setPayModal(null); }}>
          <div className="farmshift-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">Chi trả lương · {payModal.employee}</h3>
              <button type="button" className={styles.modalCloseBtn} aria-label="Đóng chi trả lương" onClick={() => setPayModal(null)}>✕</button>
            </div>
            <form onSubmit={handleConfirmPayPayroll}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label htmlFor="pay-amount" className="farmshift-form-label">Số tiền thanh toán (đ) *</label>
                  <input id="pay-amount" type="number" min="1" max={payModal.remain} required className="farmshift-form-control" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="pay-fund" className="farmshift-form-label">Chi từ nguồn quỹ *</label>
                    {funds.length <= 1 ? (
                      <div className="farmshift-form-control" style={{ background: 'var(--color-surface-soft)', display: 'flex', alignItems: 'center' }}>
                        {funds[0] ? `${funds[0].name} (${Number(funds[0].balance || 0).toLocaleString('vi-VN')} đ)` : 'Quỹ trang trại'}
                      </div>
                    ) : (
                      <select id="pay-fund" className="farmshift-form-control" value={payForm.cashFundId} onChange={(e) => setPayForm({ ...payForm, cashFundId: e.target.value })}>
                        {funds.map(f => (
                          <option key={f.id} value={f.id}>{f.name} ({Number(f.balance || 0).toLocaleString('vi-VN')} đ)</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="pay-date" className="farmshift-form-label">Ngày chi *</label>
                    <input id="pay-date" type="date" required className="farmshift-form-control" value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} />
                  </div>
                </div>
                <div className="farmshift-form-group">
                  <label htmlFor="pay-note" className="farmshift-form-label">Diễn giải phiếu chi</label>
                  <input id="pay-note" type="text" className="farmshift-form-control" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setPayModal(null)}>Hủy</button>
                <button type="submit" className="farmshift-btn farmshift-btn-mint">Xác nhận chi lương</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
