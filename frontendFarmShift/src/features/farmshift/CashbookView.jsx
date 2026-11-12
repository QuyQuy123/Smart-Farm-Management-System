// src/features/farmshift/CashbookView.jsx
// Sổ quỹ & Quản lý Thu Chi chăn nuôi chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, Search, FileSpreadsheet,
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
  createCostAllocation,
  updateCostAllocation,
  deleteCostAllocation,
  createFarmAsset,
  updateFarmAsset,
  deleteFarmAsset,
  createPayroll,
  updatePayroll,
  payPayroll,
  deletePayroll,
  createCashCategory,
  updateCashCategory,
  deleteCashCategory
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
  { id: 3, name: 'Thu khác', type: 'Thu', group: 'Thu nhập khác', note: 'Khoản thu ngoài hoạt động xuất bán' },
  { id: 4, name: 'Tiền thức ăn (Cám)', type: 'Chi', group: 'Chi phí biến đổi', note: 'Thanh toán tiền cám theo lứa' },
  { id: 5, name: 'Tiền con giống', type: 'Chi', group: 'Chi phí biến đổi', note: 'Mua giống gà nhập đàn' },
  { id: 6, name: 'Thuốc thú y & vắc-xin', type: 'Chi', group: 'Chi phí thú y', note: 'Phòng và trị bệnh' },
  { id: 7, name: 'Tiền điện & nước trang trại', type: 'Chi', group: 'Chi phí vận hành', note: 'Hệ thống quạt làm mát' },
  { id: 8, name: 'Tiền lương công nhân', type: 'Chi', group: 'Chi phí nhân công', note: 'Chi lương tháng' },
  { id: 9, name: 'Thanh toán công nợ NCC', type: 'Chi', group: 'Công nợ', note: 'Trả tiền hóa đơn nhập hàng' },
  { id: 10, name: 'Chi phí khác', type: 'Chi', group: 'Chi phí khác', note: 'Chi phí phát sinh khác' },
];

export const CashbookView = () => {
  const location = useLocation();
  const auth = useAuth();
  const notification = useNotification();
  const showToast = notification?.showToast || (() => {});
  const user = auth?.user;
  const canWrite = !user || ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT'].includes(user?.role);

  const VALID_TABS = new Set(['ledger', 'funds', 'costs', 'assets', 'payroll', 'categories']);
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

  // Modal: View voucher detail
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

  // Category Modal
  const [categoryModal, setCategoryModal] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'Chi', costGroup: 'Chi phí vận hành', note: '' });

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

  // ── Categories CRUD ────────────────────────────────────────────────────────────────────

  const openCategoryModal = (mode, cat = null) => {
    if (mode === 'edit' && cat) {
      setCategoryForm({ name: cat.name || '', type: cat.type || 'Chi', costGroup: cat.group || 'Chi phí vận hành', note: cat.note || '' });
      setCategoryModal({ mode: 'edit', item: cat });
    } else {
      setCategoryForm({ name: '', type: 'Chi', costGroup: 'Chi phí vận hành', note: '' });
      setCategoryModal({ mode: 'create', item: null });
    }
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (apiMode) {
      try {
        const payload = {
          name: categoryForm.name.trim(),
          type: categoryForm.type,
          costGroup: categoryForm.costGroup.trim(),
          note: categoryForm.note.trim()
        };
        if (categoryModal.mode === 'edit') {
          await updateCashCategory(categoryModal.item.id, payload);
          showToast('Đã cập nhật loại phiếu thu / chi.', 'success');
        } else {
          await createCashCategory(payload);
          showToast('Đã thêm loại phiếu thu / chi.', 'success');
        }
        setCategoryModal(null);
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể lưu loại phiếu.', 'error');
      }
      return;
    }
    setCategoryModal(null);
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Xóa loại phiếu "${cat.name}"?`)) return;
    if (apiMode) {
      try {
        await deleteCashCategory(cat.id);
        showToast('Đã xóa loại phiếu thu / chi.', 'success');
        reloadSummary();
      } catch (err) {
        showToast(err.response?.data?.message || 'Không thể xóa loại phiếu đang sử dụng.', 'error');
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

  return (
    <FarmShiftLayout
      pageTitle="Sổ quỹ & Nguồn tiền"
      breadcrumbs={[{ label: 'Sổ quỹ' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="farmshift-btn farmshift-btn-excel" onClick={handleExportExcel}>
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
        </div>
      }
    >
      {/* ── Summary Stats ─────────────────────────────────── */}
      <div className={styles.statsGrid}>
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
          <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỒN QUỸ TRANG TRẠI</div>
          <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
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
        <button className={`farmshift-tab-btn ${styles.tabBtnCompact} ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>
          Loại phiếu thu / chi ({txCategories.length})
        </button>
      </div>

      {/* ── Tab 1: Sổ quỹ thu chi ────────────────────────── */}
      {activeTab === 'ledger' && (
        <>
          <div className={styles.advisoryNote} style={{ marginBottom: '12px' }}>
            <strong>Đồng bộ tự động:</strong> Toàn bộ phiếu thu / chi được tự động ghi nhận từ <strong>Quản lý bán hàng</strong>, <strong>Hóa đơn nhập hàng</strong>, <strong>Chi phí lứa</strong> và <strong>Tiền công nhân viên</strong> vào Quỹ trang trại.
          </div>
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
                    <th>Số tiền</th>
                    <th>Người nộp/nhận</th>
                    <th>Quỹ tiền</th>
                    <th>Mô tả</th>
                    <th className={styles.actionsCell}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !filteredTx.length ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>Đang tải dữ liệu sổ quỹ...</td></tr>
                  ) : !filteredTx.length ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>Không có phiếu thu chi nào phù hợp bộ lọc.</td></tr>
                  ) : filteredTx.map(t => (
                    <tr key={t.id}>
                      <td className={styles.codeCell}>{t.code}</td>
                      <td className={styles.dateCell}>{t.date}</td>
                      <td>
                        <span className={`farmshift-badge ${t.type === 'Thu' ? 'farmshift-badge-success' : 'farmshift-badge-danger'}`}>
                          {t.type === 'Thu' ? '↑ Thu' : '↓ Chi'} — {t.category}
                        </span>
                      </td>
                      <td className={styles.amountCell}>
                        <span style={{ color: t.type === 'Thu' ? 'var(--color-success)' : 'var(--color-signature-coral)' }}>
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
                            className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`}
                            title="Xem chi tiết phiếu"
                            aria-label={`Xem phiếu ${t.code}`}
                            onClick={() => setViewTx(t)}
                          >
                            <Eye size={14} />
                          </button>
                          {t.referenceInvoiceCode && (
                            <span
                              className="farmshift-badge farmshift-badge-neutral"
                              title={`Phiếu tự động từ chứng từ ${t.referenceInvoiceCode} — điều chỉnh tại chứng từ gốc`}
                              aria-label={`Phiếu ${t.code} liên kết chứng từ ${t.referenceInvoiceCode}`}
                            >
                              {t.referenceInvoiceCode}
                            </span>
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
                      <strong style={{ fontSize: '15px', color: 'var(--color-primary)' }}>
                        {Number(f.balance || 0).toLocaleString('vi-VN')} đ
                      </strong>
                    </td>
                    <td style={{ color: 'var(--color-muted)' }}>{f.note || '—'}</td>
                    {canWrite && (
                      <td style={{ textAlign: 'center' }}>
                        <div className={styles.actionsGroup}>
                          <button
                            type="button"
                            className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`}
                            title="Sửa nguồn quỹ"
                            aria-label={`Sửa nguồn quỹ ${f.name}`}
                            onClick={() => openEditFundModal(f)}
                          >
                            <Pencil size={14} />
                          </button>
                          {funds.length > 1 && (
                            <button
                              type="button"
                              className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`}
                              style={{ color: 'var(--color-danger)' }}
                              title="Xóa nguồn quỹ"
                              aria-label={`Xóa nguồn quỹ ${f.name}`}
                              onClick={() => handleDeleteFund(f)}
                            >
                              <Trash2 size={14} />
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
          <div className={styles.advisoryNote}>
            <strong>Quy tắc hạch toán:</strong> Gắn khoản chi thực tế với từng chuồng và lứa nuôi để tính giá thành sản xuất trên mỗi kg thành phẩm.
          </div>

          <div className="farmshift-card" style={{ margin: 0 }}>
            <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 className="farmshift-card-title">
                <Calculator size={18} color="var(--color-primary)" />
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
                  {costs.map(c => (
                    <tr key={c.id}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.code || c.id}</span></td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{c.house}</strong></td>
                      <td><span className="farmshift-badge farmshift-badge-neutral">{c.cycle}</span></td>
                      <td>{c.type}</td>
                      <td><strong style={{ color: 'var(--color-signature-coral)' }}>{Number(c.amount || 0).toLocaleString('vi-VN')} đ</strong></td>
                      <td><span style={{ fontFamily: 'monospace' }}>{c.source || '—'}</span></td>
                      <td>{c.date}</td>
                      <td style={{ fontSize: '13.5px', color: 'var(--color-muted)' }}>{c.notes || '—'}</td>
                      {canWrite && (
                        <td style={{ textAlign: 'center' }}>
                          <div className={styles.actionsGroup}>
                            <button type="button" className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`} aria-label={`Sửa phân bổ ${c.code || c.id}`} onClick={() => openCostModal('edit', c)}>
                              <Pencil size={14} />
                            </button>
                            <button type="button" className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`} style={{ color: 'var(--color-danger)' }} aria-label={`Xóa phân bổ ${c.code || c.id}`} onClick={() => handleDeleteCost(c)}>
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
        </div>
      )}

      {/* ── Tab 5: TÀI SẢN & KHẤU HAO ────────────────────── */}
      {activeTab === 'assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.statsGrid}>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG NGUYÊN GIÁ TÀI SẢN</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
                {assets.reduce((s, a) => s + Number(a.cost || 0), 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TRÍCH KHẤU HAO / THÁNG</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-primary)', marginTop: '6px' }}>
                {Math.round(assets.reduce((s, a) => s + Number(a.monthlyDep || 0), 0)).toLocaleString('vi-VN')} đ
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
            <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="farmshift-card-title">
                <Building size={18} color="var(--color-primary)" />
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
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.code || a.id}</span></td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{a.name}</strong></td>
                      <td><strong>{Number(a.cost || 0).toLocaleString('vi-VN')} đ</strong></td>
                      <td>{a.months} tháng</td>
                      <td><strong style={{ color: 'var(--color-primary)' }}>{Math.round(Number(a.monthlyDep || 0)).toLocaleString('vi-VN')} đ</strong></td>
                      <td>{a.house}</td>
                      <td><span className="farmshift-badge farmshift-badge-success">{a.status}</span></td>
                      {canWrite && (
                        <td style={{ textAlign: 'center' }}>
                          <div className={styles.actionsGroup}>
                            <button type="button" className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`} aria-label={`Sửa tài sản ${a.code || a.id}`} onClick={() => openAssetModal('edit', a)}>
                              <Pencil size={14} />
                            </button>
                            <button type="button" className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`} style={{ color: 'var(--color-danger)' }} aria-label={`Xóa tài sản ${a.code || a.id}`} onClick={() => handleDeleteAsset(a)}>
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
        </div>
      )}

      {/* ── Tab 6: TIỀN CÔNG NHÂN VIÊN ───────────────────── */}
      {activeTab === 'payroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.statsGrid}>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>TỔNG TIỀN CÔNG</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-ink)', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + Number(p.total || 0), 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>ĐÃ THANH TOÁN</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-success)', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + Number(p.paid || 0), 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div className="farmshift-card" style={{ margin: 0, padding: '20px' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 500 }}>CÒN PHẢI TRẢ</div>
              <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-signature-coral)', marginTop: '6px' }}>
                {payrolls.reduce((s, p) => s + Number(p.remain || 0), 0).toLocaleString('vi-VN')} đ
              </div>
            </div>
          </div>

          <div className="farmshift-card" style={{ margin: 0 }}>
            <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="farmshift-card-title">
                <Users size={18} color="var(--color-primary)" />
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
                  {payrolls.map(p => (
                    <tr key={p.id}>
                      <td className={styles.codeCell}>{p.code || p.id}</td>
                      <td><strong style={{ color: 'var(--color-ink)' }}>{p.employee}</strong></td>
                      <td>{p.period || '—'}</td>
                      <td><strong>{p.days}</strong> ngày</td>
                      <td>{Number(p.rate || 0).toLocaleString('vi-VN')} đ</td>
                      <td>
                        <span style={{ color: 'var(--color-success)' }}>+{Number(p.bonus || 0).toLocaleString('vi-VN')}</span>
                        {' / '}
                        <span style={{ color: 'var(--color-muted)' }}>-{Number(p.advance || 0).toLocaleString('vi-VN')}</span>
                      </td>
                      <td><strong>{Number(p.total || 0).toLocaleString('vi-VN')} đ</strong></td>
                      <td><strong style={{ color: 'var(--color-success)' }}>{Number(p.paid || 0).toLocaleString('vi-VN')} đ</strong></td>
                      <td>
                        <strong style={{ color: Number(p.remain || 0) > 0 ? 'var(--color-signature-coral)' : 'var(--color-muted)' }}>
                          {Number(p.remain || 0).toLocaleString('vi-VN')} đ
                        </strong>
                      </td>
                      <td>
                        <span className={`farmshift-badge ${Number(p.remain || 0) === 0 ? 'farmshift-badge-success' : 'farmshift-badge-warning'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className={styles.actionsCell}>
                        <div className={styles.actionsGroup}>
                          {Number(p.remain || 0) > 0 && canWrite && (
                            <button
                              type="button"
                              className="farmshift-btn farmshift-btn-primary"
                              style={{ fontSize: '12.5px', padding: '4px 8px' }}
                              aria-label={`Thanh toán lương ${p.code || p.id}`}
                              onClick={() => openPayPayrollModal(p)}
                            >
                              Thanh toán
                            </button>
                          )}
                          {canWrite && (
                            <>
                              <button type="button" className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`} aria-label={`Sửa bảng lương ${p.code || p.id}`} onClick={() => openPayrollModal('edit', p)}>
                                <Pencil size={14} />
                              </button>
                              {Number(p.paid || 0) === 0 && (
                                <button type="button" className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`} style={{ color: 'var(--color-danger)' }} aria-label={`Xóa bảng lương ${p.code || p.id}`} onClick={() => handleDeletePayroll(p)}>
                                  <Trash2 size={14} />
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
          </div>
        </div>
      )}

      {/* ── Tab 7: Loại phiếu thu / chi ──────────────────── */}
      {activeTab === 'categories' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="farmshift-card-title">Danh mục các khoản thu chi chăn nuôi</h3>
            {canWrite && (
              <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={() => openCategoryModal('create')}>
                <Plus size={15} /> Thêm loại phiếu
              </button>
            )}
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên loại giao dịch</th>
                  <th>Phân loại</th>
                  <th>Nhóm chi phí</th>
                  <th>Diễn giải</th>
                  {canWrite && <th style={{ textAlign: 'center' }}>Thao tác</th>}
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
                    <td style={{ color: 'var(--color-muted)' }}>{cat.note || '—'}</td>
                    {canWrite && (
                      <td style={{ textAlign: 'center' }}>
                        <div className={styles.actionsGroup}>
                          <button type="button" className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`} aria-label={`Sửa loại phiếu ${cat.name}`} onClick={() => openCategoryModal('edit', cat)}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" className={`farmshift-btn farmshift-btn-secondary ${styles.iconBtn}`} style={{ color: 'var(--color-danger)' }} aria-label={`Xóa loại phiếu ${cat.name}`} onClick={() => handleDeleteCategory(cat)}>
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
              {viewTx.referenceInvoiceCode && (
                <div><span style={{ color: 'var(--color-muted)' }}>Chứng từ liên kết:</span> <strong>{viewTx.referenceInvoiceCode}</strong> <span style={{ color: 'var(--color-muted)', fontSize: '0.85em' }}>(phiếu tự động — chỉnh sửa tại chứng từ gốc)</span></div>
              )}
              <div><span style={{ color: 'var(--color-muted)' }}>Diễn giải:</span> <strong>{viewTx.note || '—'}</strong></div>
            </div>
            <div className="farmshift-modal-footer">
              <button type="button" className="farmshift-btn farmshift-btn-primary" onClick={() => setViewTx(null)}>Đóng</button>
            </div>
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

      {/* ── Modal: Phân bổ chi phí lứa ───────────────────── */}
      {costModal && (
        <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setCostModal(null); }}>
          <div className="farmshift-modal" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">{costModal.mode === 'edit' ? 'Cập nhật phân bổ chi phí' : 'Thêm phân bổ chi phí lứa'}</h3>
              <button type="button" onClick={() => setCostModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
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
              <button type="button" onClick={() => setAssetModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
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
              <button type="button" onClick={() => setPayrollModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
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
              <button type="button" onClick={() => setPayModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
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
                <button type="submit" className="farmshift-btn farmshift-btn-primary">Xác nhận chi lương</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Thêm / Sửa Loại phiếu thu / chi ───────── */}
      {categoryModal && (
        <div className="farmshift-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setCategoryModal(null); }}>
          <div className="farmshift-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="farmshift-modal-header">
              <h3 className="farmshift-modal-title">{categoryModal.mode === 'edit' ? 'Cập nhật loại phiếu' : 'Thêm loại phiếu thu / chi'}</h3>
              <button type="button" onClick={() => setCategoryModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleSaveCategory}>
              <div className="farmshift-modal-body">
                <div className="farmshift-form-group">
                  <label htmlFor="cat-name" className="farmshift-form-label">Tên loại giao dịch *</label>
                  <input id="cat-name" type="text" required className="farmshift-form-control" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="farmshift-form-group">
                    <label htmlFor="cat-type" className="farmshift-form-label">Phân loại *</label>
                    <select id="cat-type" className="farmshift-form-control" value={categoryForm.type} onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })}>
                      <option value="Thu">Thu</option>
                      <option value="Chi">Chi</option>
                    </select>
                  </div>
                  <div className="farmshift-form-group">
                    <label htmlFor="cat-group" className="farmshift-form-label">Nhóm chi phí *</label>
                    <input id="cat-group" type="text" required className="farmshift-form-control" value={categoryForm.costGroup} onChange={(e) => setCategoryForm({ ...categoryForm, costGroup: e.target.value })} />
                  </div>
                </div>
                <div className="farmshift-form-group">
                  <label htmlFor="cat-note" className="farmshift-form-label">Diễn giải</label>
                  <textarea id="cat-note" rows="2" className="farmshift-form-control" value={categoryForm.note} onChange={(e) => setCategoryForm({ ...categoryForm, note: e.target.value })} />
                </div>
              </div>
              <div className="farmshift-modal-footer">
                <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setCategoryModal(null)}>Hủy</button>
                <button type="submit" className="farmshift-btn farmshift-btn-mint">Lưu loại phiếu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
