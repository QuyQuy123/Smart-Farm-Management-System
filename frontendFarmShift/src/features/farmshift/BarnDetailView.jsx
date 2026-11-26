import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, CalendarDays, Eye, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, Coins, Flag, Gauge, HeartCrack, Layers, Pencil, PlusCircle,
  Scale, Search, ShoppingCart, Skull, Sprout, Stethoscope, Trash2, Users, Warehouse, Wheat, X,
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listBarns, listFarmAreas } from '../../services/farmAreaService';
import {
  addExpense, addWeightSample, deleteExpense, deleteFeedRecord, deleteWeightSample,
  assignCycleProgram, assignFlockProgram, getBarn, getCycle, importFlock, listCycles, recordHarvest, recordLoss, startCycle, transferFlock,
} from '../../services/cycleService';
import { CloseCycleDialog } from './CloseCycleDialog';
import { BarnDialog } from './FarmAreaDialogs';
import { listPrograms } from '../../services/farmingProgramService';
import { FormDialog } from './CycleDialogs';
import { SupplierPicker } from './SupplierPicker';
import { FlockDetailDialog } from './FlockDetailDialog';
import { MovementDetailDialog } from './MovementDetailDialog';
import { AreaTabs } from './AreaTabs';
import { DailyPlanCard } from './DailyPlanCard';
import { DiseaseLogPanel } from './DiseaseLogPanel';
import { useDailyPlanActions } from './useDailyPlanActions';
import { getBarnDailyPlan } from '../../services/dailyPlanService';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { useViewport } from '../../hooks/useViewport';
import {
  EXPENSE_CATEGORIES, FLOCK_GENDERS, MAX_IMPORT_SPREAD_DAYS, MOVEMENT_TYPES, STEP_STATES, describeStep, stepCategoryLabel,
  addDaysIso, apiErrorMessage, formatDay, labelOf, todayIso,
} from './farmAreaOptions';
import styles from './BarnDetailView.module.css';

const num = (value, digits = 0) => value == null ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits });
const money = value => value == null ? '—' : `${Math.round(Number(value)).toLocaleString('vi-VN')}đ`;
const isInt = value => value !== '' && Number.isInteger(Number(value));
const IMPORT_PAYMENT_OPTIONS = [{ value: 'Trả sau', label: 'Trả sau (ghi công nợ)' }, { value: 'Thanh toán hoàn tất', label: 'Đã trả đủ tiền' }];

const COST_COLORS = { chick: '#f59e0b', feed: '#06b6d4', MEDICINE: '#ef4444', OTHER: '#ec4899' };

function Donut({ parts }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <svg viewBox="0 0 160 160" className={styles.donut} role="img" aria-label="Biểu đồ phân bổ chi phí">
    <circle cx="80" cy="80" r={radius} fill="none" stroke="#edf1f0" strokeWidth="28" />
    {total > 0 && parts.filter(part => part.value > 0).map(part => {
      const length = (part.value / total) * circumference;
      const circle = <circle key={part.key} cx="80" cy="80" r={radius} fill="none" stroke={part.color} strokeWidth="28"
        strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)" />;
      offset += length;
      return circle;
    })}
  </svg>;
}

function Card({ title, icon: Icon, actions, children, className = '' }) {
  return <section className={`${styles.card} ${className}`}>
    <header className={styles.cardHeader}><h3>{Icon && <Icon size={17} />}{title}</h3>{actions && <div className={styles.cardActions}>{actions}</div>}</header>
    {children}
  </section>;
}

function Tabs({ tabs, value, onChange }) {
  return <div className={styles.tabs} role="tablist">
    {tabs.map(tab => <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value}
      className={value === tab.value ? styles.tabActive : ''} onClick={() => onChange(tab.value)}>{tab.label}</button>)}
  </div>;
}

const Empty = ({ children }) => <p className={styles.empty}>{children}</p>;

const PAGE_SIZES = [10, 25, 50];

function buildPageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = [1];
  if (page > 3) pages.push('…-left');
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) {
    pages.push(p);
  }
  if (page < totalPages - 2) pages.push('…-right');
  pages.push(totalPages);
  return pages;
}

function TablePager({ total, page, pageSize, onPageChange, onPageSizeChange, label = 'Phân trang' }) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);
  const pageList = buildPageList(safePage, totalPages);

  return (
    <div className={styles.pager}>
      <span className={styles.pagerInfo}>
        Hiển thị {num(start)}–{num(end)} / {num(total)} bản ghi
      </span>
      <div className={styles.pagerControls}>
        <label className={styles.pagerSizeLabel}>
          <select
            aria-label="Số dòng mỗi trang"
            className={styles.pagerSelect}
            value={pageSize}
            onChange={event => {
              onPageSizeChange(Number(event.target.value));
              onPageChange(1);
            }}
          >
            {PAGE_SIZES.map(size => <option key={size} value={size}>{size} dòng</option>)}
          </select>
        </label>
        {totalPages > 1 && (
          <nav className={styles.pagerNav} aria-label={label}>
            <button
              type="button"
              className={styles.pageBtn}
              aria-label="Trang trước"
              disabled={safePage <= 1}
              onClick={() => onPageChange(safePage - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            {pageList.map(item => (typeof item === 'string'
              ? <span key={item} className={styles.pageEllipsis}>…</span>
              : <button
                  key={item}
                  type="button"
                  className={`${styles.pageBtn} ${item === safePage ? styles.pageActive : ''}`}
                  aria-current={item === safePage ? 'page' : undefined}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </button>
            ))}
            <button
              type="button"
              className={styles.pageBtn}
              aria-label="Trang sau"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange(safePage + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

const paginateRows = (rows, page, pageSize) => {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * pageSize;
  return { safePage, items: rows.slice(offset, offset + pageSize) };
};

export const BarnDetailView = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const { isMobile } = useViewport();
  const role = user?.role;
  const isOwner = role === 'ROLE_FARM_OWNER';
  const isAccountant = role === 'ROLE_ACCOUNTANT';
  const canDaily = isOwner || role === 'ROLE_FARM_WORKER';
  const canFinance = isOwner || isAccountant;
  const requestedCycle = searchParams.get('cycle');

  const [revision, setRevision] = useState(0);
  const requestKey = `${id}|${requestedCycle || ''}|${revision}`;
  const [state, setState] = useState({ key: null });
  const [modal, setModal] = useState(null);
  const [flockTab, setFlockTab] = useState('ACTIVE');
  const [leftInfoTab, setLeftInfoTab] = useState('CYCLE');
  const [detailTab, setDetailTab] = useState('JOURNAL');
  const [journalTab, setJournalTab] = useState('FEED');
  const [journalSearch, setJournalSearch] = useState('');
  const [journalPage, setJournalPage] = useState(1);
  const [journalPageSize, setJournalPageSize] = useState(10);
  const [expenseTab, setExpenseTab] = useState('MEDICINE');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(10);
  const [revenuePage, setRevenuePage] = useState(1);
  const [revenuePageSize, setRevenuePageSize] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [financeTab, setFinanceTab] = useState('CHART');
  const [showMoreKpis, setShowMoreKpis] = useState(false);
  const [showAllProgramSteps, setShowAllProgramSteps] = useState(false);
  const [diseaseSummary, setDiseaseSummary] = useState(null);

  useEffect(() => {
    const handleAiAction = (event) => {
      const action = event.detail;
      if (!action) return;
      if (action.executed || action.uiCommand === 'REFRESH_DATA') {
        setRevision(r => r + 1);
        if (action.actionSummary) {
          showToast(`Đã đồng bộ AI: ${action.actionSummary.title || ''} • ${action.actionSummary.detail || ''}`, 'success');
        }
      }
    };
    window.addEventListener('farmshift:ai-action', handleAiAction);
    return () => window.removeEventListener('farmshift:ai-action', handleAiAction);
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [barn, cycles, barns, areas, programs] = await Promise.all([getBarn(id), listCycles(id), listBarns(), listFarmAreas(), listPrograms()]);
        const cycleId = requestedCycle || barn.activeCycleId;
        const detail = cycleId ? await getCycle(cycleId) : null;
        // Phiếu việc hôm nay chỉ có với lứa đang nuôi; lỗi tải phiếu việc không làm hỏng cả trang.
        const dayPlan = detail?.cycle.status === 'ACTIVE' ? await getBarnDailyPlan(detail.cycle.id).catch(() => null) : null;
        if (!cancelled) setState({ key: requestKey, barn, cycles, barns, areas, programs: Array.isArray(programs) ? programs : [], detail, dayPlan, error: '' });
      } catch (requestError) {
        if (!cancelled) setState({ key: requestKey, error: requestError.response?.status === 404 ? 'Không tìm thấy chuồng hoặc lứa nuôi.' : apiErrorMessage(requestError) });
      }
    })();
    return () => { cancelled = true; };
  }, [id, requestedCycle, requestKey]);

  useRealtimeRefresh(
    ['/barns', '/cycles', '/flocks', '/daily-plan', '/daily-plans', '/journal', '/today-tasks', '/farm-areas', '/areas', '/farming-programs', '/sales', '/sales-orders'],
    () => setRevision(value => value + 1)
  );

  const loading = state.key === null || !state.key.startsWith(`${id}|${requestedCycle || ''}|`);
  const { barn, cycles = [], barns = [], areas = [], programs = [], detail, dayPlan, error } = state;
  const cycle = detail?.cycle;
  const metrics = detail?.metrics;
  const active = cycle?.status === 'ACTIVE';
  const today = todayIso();
  const done = message => { setModal(null); showToast(message, 'success'); setRevision(value => value + 1); };
  // Xác nhận việc làm đổi nhật ký cám, chi phí và tồn kho: cập nhật phiếu việc ngay rồi tải lại chi tiết lứa (không hiện màn tải).
  const dailyActions = useDailyPlanActions(updated => {
    setState(current => ({ ...current, dayPlan: updated }));
    getCycle(updated.cycleId).then(fresh => setState(current => (current.detail?.cycle.id === fresh.cycle.id ? { ...current, detail: fresh } : current)))
      .catch(() => {});
  });
  const sameArea = useMemo(() => barns.filter(item => barn && item.areaId === barn.areaId), [barns, barn]);

  const dateRule = (value, label, from = cycle?.startDate) => {
    if (!value) return undefined;
    if (value < from) return `${label} không được trước ${formatDay(from)}.`;
    if (value > today) return `${label} không được sau hôm nay.`;
    return undefined;
  };

  // ---------------------------------------------------------------- dialog configs

  const openStartCycle = () => setModal({
    title: 'Khai báo lứa nuôi',
    intro: 'Sau khi khai báo lứa, dùng "Nhập đàn" để nhập con giống vào chuồng. Các đàn của một lứa phải nhập cách nhau không quá 3 ngày.',
    initial: { startDate: today, hatchDate: '', note: '' },
    fields: [
      { key: 'startDate', label: 'Ngày bắt đầu', type: 'date', required: true, max: today },
      { key: 'hatchDate', label: 'Ngày nở (ngày tuổi 1)', type: 'date', max: today, hint: 'Để trống nếu tính ngày tuổi theo đàn nhập.' },
      { key: 'note', label: 'Ghi chú', type: 'textarea', full: true },
    ],
    validate: values => ({
      startDate: values.startDate > today ? 'Ngày bắt đầu không được sau hôm nay.' : undefined,
      hatchDate: values.hatchDate && values.hatchDate > values.startDate ? 'Ngày nở không được sau ngày bắt đầu lứa.' : undefined,
    }),
    onSubmit: async values => {
      const created = await startCycle(barn.id, { startDate: values.startDate, hatchDate: values.hatchDate || null, note: values.note.trim() });
      setSearchParams({});
      return `Đã khai báo lứa nuôi thứ ${created.cycleNumber} cho ${barn.name}.`;
    },
  });

  const openCloseCycle = () => setModal({ type: 'close' });

  const room = barn ? barn.capacity - barn.currentQuantity : 0;
  const openImport = () => {
    const first = metrics.firstImportDate;
    const windowEnd = first ? addDaysIso(first, MAX_IMPORT_SPREAD_DAYS) : null;
    setModal({
      title: 'Nhập đàn vào lứa',
      intro: `${first ? `Đàn đầu tiên nhập ngày ${formatDay(first)}: các đàn tiếp theo phải nhập trong khoảng ${formatDay([addDaysIso(first, -MAX_IMPORT_SPREAD_DAYS), cycle.startDate].sort()[1])} – ${formatDay(windowEnd < today ? windowEnd : today)}. `
        : `Các đàn của lứa phải nhập cách nhau không quá ${MAX_IMPORT_SPREAD_DAYS} ngày. `}Chuồng còn chỗ cho ${num(room)} con (sức chứa ${num(barn.capacity)}).`,
      warning: programs.length ? null : 'Chưa có chương trình nuôi. Vào Thiết lập chăn nuôi → Chương trình nuôi để tạo chương trình cho giống gà trước khi nhập đàn.',
      initial: { programId: programs[0] ? String(programs[0].id) : '', name: '', gender: 'MALE', importDate: windowEnd && windowEnd < today ? windowEnd : today, ageAtImport: '1', quantity: '', avgWeight: '0.04', unitPrice: '', supplierId: '', paymentStatus: 'Trả sau', note: '' },
      fields: [
        { key: 'programId', label: 'Chương trình nuôi (giống)', type: 'select', required: true, full: true,
          hint: 'Cám định mức, lịch vắc-xin, thuốc và nhiệt độ của đàn sẽ theo chương trình này.',
          options: programs.length ? programs.map(program => ({ value: String(program.id), label: `${program.name} · ${program.breed} · ${program.durationDays} ngày` }))
            : [{ value: '', label: 'Chưa có chương trình nuôi' }] },
        { key: 'name', label: 'Tên đàn', required: true, placeholder: 'Ví dụ: MÍA-DABACO TRỐNG' },
        { key: 'gender', label: 'Giới tính', type: 'select', required: true, options: FLOCK_GENDERS },
        { key: 'importDate', label: 'Ngày nhập', type: 'date', required: true, max: today },
        { key: 'ageAtImport', label: 'Ngày tuổi lúc nhập', type: 'number', required: true, min: 1, step: 1 },
        { key: 'quantity', label: 'Số lượng nhập (con)', type: 'number', required: true, min: 1, step: 1 },
        { key: 'avgWeight', label: 'Trọng lượng TB (kg/con)', type: 'number', required: true, min: 0, step: 0.001 },
        { key: 'supplierId', label: 'Nhà cung cấp con giống', required: true, full: true,
          hint: 'Lưu xong, hệ thống tự tạo hóa đơn nhập hàng (số con × giá con giống) cho nhà cung cấp này ở mục Nhập hàng, liên kết với đàn và lứa.',
          render: (props, setValue) => <SupplierPicker props={props} onPick={setValue} canCreate={isOwner} /> },
        { key: 'unitPrice', label: 'Giá con giống (đ/con)', type: 'number', required: true, min: 0, step: 1 },
        { key: 'paymentStatus', label: 'Thanh toán', type: 'select', required: true, options: IMPORT_PAYMENT_OPTIONS },
        { key: 'note', label: 'Ghi chú', type: 'textarea', full: true },
      ],
      validate: values => {
        const found = { importDate: dateRule(values.importDate, 'Ngày nhập') };
        if (!found.importDate && first) {
          const earliest = values.importDate < first ? values.importDate : first;
          const latest = values.importDate > first ? values.importDate : first;
          if (addDaysIso(earliest, MAX_IMPORT_SPREAD_DAYS) < latest) {
            found.importDate = `Đàn nhập sau không được cách đàn đầu tiên (${formatDay(first)}) quá ${MAX_IMPORT_SPREAD_DAYS} ngày. Hãy khai báo lứa mới.`;
          }
        }
        if (!isInt(values.quantity) || Number(values.quantity) < 1) found.quantity = 'Số lượng nhập phải là số nguyên lớn hơn 0.';
        else if (Number(values.quantity) > room) found.quantity = `Chuồng chỉ còn chỗ cho ${num(room)} con.`;
        if (!isInt(values.ageAtImport) || Number(values.ageAtImport) < 1) found.ageAtImport = 'Ngày tuổi phải là số nguyên từ 1.';
        if (!(Number(values.avgWeight) > 0)) found.avgWeight = 'Trọng lượng trung bình phải lớn hơn 0.';
        if (values.unitPrice !== '' && Number(values.unitPrice) < 0) found.unitPrice = 'Giá con giống không được âm.';
        return found;
      },
      onSubmit: async values => {
        const created = await importFlock(cycle.id, { ...values, programId: Number(values.programId), name: values.name.trim(), ageAtImport: Number(values.ageAtImport),
          quantity: Number(values.quantity), avgWeight: Number(values.avgWeight), unitPrice: Number(values.unitPrice), supplierId: Number(values.supplierId), note: values.note.trim() });
        return `Đã nhập đàn ${values.name.trim()} (${num(values.quantity)} con)${created?.purchaseInvoiceCode ? ` và tạo hóa đơn nhập hàng ${created.purchaseInvoiceCode}` : ''}.`;
      },
    });
  };

  const openTransfer = flock => {
    // Chuồng đích là chuồng trống, chưa có lứa (hệ thống tự mở lứa mới từ ngày chuyển); chuồng cùng khu xếp trước.
    const roomOf = item => item.capacity - item.currentQuantity;
    const targets = barns.filter(item => item.id !== barn.id && !item.activeCycleId && item.currentQuantity === 0 && item.capacity > 0)
      .sort((a, b) => Number(b.areaName === barn.areaName) - Number(a.areaName === barn.areaName));
    const half = Math.floor(flock.quantity / 2);
    const density = (item, quantity) => (Number(item.areaM2) > 0 ? ` · ${num(quantity / Number(item.areaM2), 1)} con/m²` : '');
    const side = (label, item, quantity) => <div className={quantity > item.capacity ? styles.transferOver : undefined}>
      <span>{label}</span>
      <strong>{item.name}</strong>
      <small>{num(quantity)} / {num(item.capacity)} con{density(item, quantity)}</small>
    </div>;
    setModal({
      title: `Tách / chuyển đàn ${flock.code}`,
      intro: `Đàn ${flock.name} đang tồn ${num(flock.quantity)} con. Số con chuyển đi vẫn là đàn đó, chỉ đổi chuồng: giữ tuổi và cân nặng; cám đã ăn, giá vốn và các khoản chi chia theo số con.`,
      warning: targets.length ? null : 'Chưa có chuồng trống để tách đàn. Hãy tạo chuồng mới ở mục Khu nuôi hoặc kết thúc lứa của một chuồng.',
      initial: { targetBarnId: targets[0] ? String(targets[0].id) : '', quantity: '', transferDate: today, name: flock.name, avgWeight: '', note: '' },
      fields: [
        // Chỉ hiện chuồng khả thi: nhập số con chuyển thì bỏ các chuồng không đủ sức chứa.
        { key: 'targetBarnId', label: 'Chuồng trống nhận đàn', type: 'select', required: true, full: true,
          options: values => {
            const moving = Number(values.quantity);
            const counted = isInt(values.quantity) && moving > 0;
            const feasible = counted ? targets.filter(item => roomOf(item) >= moving) : targets;
            if (feasible.length) return feasible.map(item => ({ value: String(item.id), label: `${item.name} (${item.areaName}) · chứa được ${num(roomOf(item))} con` }));
            return [{ value: '', label: counted && targets.length ? `Không có chuồng trống đủ chỗ cho ${num(moving)} con` : 'Không có chuồng trống' }];
          } },
        { key: 'quantity', label: 'Số con chuyển', required: true,
          render: (common, setQuantity) => <div className={styles.quantityRow}>
            <input {...common} type="number" min={1} max={flock.quantity} step={1} inputMode="numeric" />
            {half > 0 && <button type="button" className={styles.halfButton} disabled={common.disabled} onClick={() => setQuantity(String(half))}>Chia đôi</button>}
          </div> },
        { key: 'transferDate', label: 'Ngày chuyển', type: 'date', required: true, max: today },
        { key: 'name', label: 'Tên đàn mới' },
        { key: 'avgWeight', label: 'Trọng lượng TB (kg/con)', type: 'number', min: 0, step: 0.001, hint: 'Để trống để lấy lần cân gần nhất.' },
        { key: 'note', label: 'Ghi chú', type: 'textarea', full: true },
      ],
      validate: values => {
        const target = targets.find(item => String(item.id) === values.targetBarnId);
        const found = { transferDate: dateRule(values.transferDate, 'Ngày chuyển', flock.importDate > cycle.startDate ? flock.importDate : cycle.startDate) };
        if (!isInt(values.quantity) || Number(values.quantity) < 1) found.quantity = 'Số con chuyển phải là số nguyên lớn hơn 0.';
        else if (Number(values.quantity) > flock.quantity) found.quantity = `Đàn chỉ còn ${num(flock.quantity)} con.`;
        else if (target && Number(values.quantity) > roomOf(target)) found.quantity = `${target.name} chỉ còn ${num(roomOf(target))} chỗ.`;
        if (values.avgWeight !== '' && !(Number(values.avgWeight) > 0)) found.avgWeight = 'Trọng lượng trung bình phải lớn hơn 0.';
        return found;
      },
      preview: values => {
        const target = targets.find(item => String(item.id) === values.targetBarnId);
        const moving = Number(values.quantity);
        if (!target || !Number.isInteger(moving) || moving < 1 || moving > flock.quantity) return null;
        return <div className={styles.transferPreview} aria-label="Xem trước sau khi chuyển">
          <div className={styles.transferSides}>
            {side('Chuồng hiện tại còn', barn, barn.currentQuantity - moving)}
            {side('Chuồng mới sẽ có', target, target.currentQuantity + moving)}
          </div>
          <small>Đàn tách giữ nguyên {flock.currentAgeDays} ngày tuổi, chương trình nuôi, cân nặng và FCR; cám đã ăn và chi phí chia theo số con.
            {' '}Hệ thống tự mở lứa mới cho chuồng này từ ngày chuyển.</small>
        </div>;
      },
      onSubmit: async values => {
        const target = targets.find(item => String(item.id) === values.targetBarnId);
        await transferFlock(flock.id, { targetBarnId: Number(values.targetBarnId), quantity: Number(values.quantity), transferDate: values.transferDate,
          name: values.name.trim(), avgWeight: values.avgWeight === '' ? null : Number(values.avgWeight), note: values.note.trim() });
        return `Đã chuyển ${num(values.quantity)} con từ đàn ${flock.code} sang ${target.name}. Đã mở lứa mới, nhớ phân công công nhân và kho cho chuồng này.`;
      },
    });
  };

  /**
   * Gắn / đổi chương trình nuôi cho tất cả đàn đang nuôi (mặc định) hoặc từng đàn.
   * Lịch tính theo ngày tuổi hiện tại nên chương trình phải dài hơn tuổi đàn.
   */
  const openAssignProgram = () => {
    const flocks = detail.flocks.filter(flock => flock.status === 'ACTIVE');
    const shared = flocks.every(flock => flock.programId === flocks[0]?.programId) ? flocks[0]?.programId : null;
    const flockLabel = flock => `${flock.code} · ${flock.name} · ${flock.currentAgeDays} ngày tuổi · ${flock.programName || 'chưa có chương trình'}`;
    setModal({
      title: 'Gắn chương trình nuôi cho đàn',
      intro: 'Lịch cám, vắc-xin, thuốc và nhiệt độ của đàn sẽ chạy theo chương trình, tính từ ngày tuổi hiện tại của đàn.',
      warning: programs.length ? null : 'Chưa có chương trình nuôi. Vào Thiết lập chăn nuôi → Chương trình nuôi để tạo trước.',
      initial: { flockId: 'ALL', programId: shared ? String(shared) : programs[0] ? String(programs[0].id) : '' },
      fields: [
        { key: 'flockId', label: 'Đàn đang nuôi', type: 'select', required: true, full: true,
          options: [{ value: 'ALL', label: `Tất cả đàn đang nuôi (${flocks.length} đàn)` },
            ...flocks.map(flock => ({ value: String(flock.id), label: flockLabel(flock) }))] },
        { key: 'programId', label: 'Chương trình nuôi (giống)', type: 'select', required: true, full: true,
          options: programs.length ? programs.map(program => ({ value: String(program.id), label: `${program.name} · ${program.breed} · ${program.durationDays} ngày` }))
            : [{ value: '', label: 'Chưa có chương trình nuôi' }] },
      ],
      validate: values => {
        const chosen = values.flockId === 'ALL' ? flocks : flocks.filter(item => String(item.id) === values.flockId);
        const oldest = chosen.reduce((max, item) => (!max || item.currentAgeDays > max.currentAgeDays ? item : max), null);
        const program = programs.find(item => String(item.id) === values.programId);
        return {
          flockId: chosen.length ? undefined : 'Vui lòng chọn đàn.',
          programId: !program ? 'Vui lòng chọn chương trình nuôi.'
            : oldest && oldest.currentAgeDays > program.durationDays
              ? `Đàn ${oldest.code} đã ${oldest.currentAgeDays} ngày tuổi, vượt thời gian nuôi ${program.durationDays} ngày của chương trình.` : undefined,
        };
      },
      onSubmit: async values => {
        const name = programs.find(item => String(item.id) === values.programId)?.name;
        if (values.flockId === 'ALL') {
          await assignCycleProgram(cycle.id, Number(values.programId));
          return `Đã gắn chương trình ${name} cho ${flocks.length} đàn đang nuôi.`;
        }
        await assignFlockProgram(Number(values.flockId), Number(values.programId));
        return `Đã gắn chương trình ${name} cho đàn.`;
      },
    });
  };

  const openLoss = flock => setModal({
    title: `Ghi hao hụt / loại thải · ${flock.code}`,
    initial: { type: 'DEATH', movementDate: today, quantity: '', weightKg: '', note: '' },
    fields: [
      { key: 'type', label: 'Loại ghi nhận', type: 'select', required: true, options: MOVEMENT_TYPES.filter(item => item.value === 'DEATH' || item.value === 'CULL') },
      { key: 'movementDate', label: 'Ngày ghi nhận', type: 'date', required: true, max: today },
      { key: 'quantity', label: 'Số con', type: 'number', required: true, min: 1, max: flock.quantity, step: 1 },
      { key: 'weightKg', label: 'Tổng khối lượng (kg)', type: 'number', min: 0, step: 0.01 },
      { key: 'note', label: 'Nguyên nhân / ghi chú', type: 'textarea', full: true },
    ],
    validate: values => ({
      movementDate: dateRule(values.movementDate, 'Ngày ghi nhận', flock.importDate),
      quantity: !isInt(values.quantity) || Number(values.quantity) < 1 ? 'Số con phải là số nguyên lớn hơn 0.'
        : Number(values.quantity) > flock.quantity ? `Đàn chỉ còn ${num(flock.quantity)} con.` : undefined,
    }),
    onSubmit: async values => {
      await recordLoss(flock.id, { ...values, quantity: Number(values.quantity), weightKg: values.weightKg === '' ? null : Number(values.weightKg), note: values.note.trim() });
      return `Đã ghi ${labelOf(MOVEMENT_TYPES, values.type).toLowerCase()} ${num(values.quantity)} con.`;
    },
  });

  const openHarvest = flock => setModal({
    title: `Xuất bán · ${flock.code}`,
    initial: { movementDate: today, quantity: '', weightKg: '', unitPrice: '', note: '' },
    fields: [
      { key: 'movementDate', label: 'Ngày xuất bán', type: 'date', required: true, max: today },
      { key: 'quantity', label: 'Số con xuất bán', type: 'number', required: true, min: 1, max: flock.quantity, step: 1 },
      { key: 'weightKg', label: 'Tổng khối lượng (kg)', type: 'number', required: true, min: 0, step: 0.01 },
      { key: 'unitPrice', label: 'Đơn giá bán (đ/kg)', type: 'number', required: true, min: 0, step: 1 },
      { key: 'note', label: 'Khách hàng / ghi chú', type: 'textarea', full: true },
    ],
    validate: values => ({
      movementDate: dateRule(values.movementDate, 'Ngày xuất bán', flock.importDate),
      quantity: !isInt(values.quantity) || Number(values.quantity) < 1 ? 'Số con phải là số nguyên lớn hơn 0.'
        : Number(values.quantity) > flock.quantity ? `Đàn chỉ còn ${num(flock.quantity)} con.` : undefined,
      weightKg: values.weightKg !== '' && !(Number(values.weightKg) > 0) ? 'Tổng khối lượng phải lớn hơn 0.' : undefined,
    }),
    onSubmit: async values => {
      await recordHarvest(flock.id, { ...values, quantity: Number(values.quantity), weightKg: Number(values.weightKg), unitPrice: Number(values.unitPrice), note: values.note.trim() });
      return `Đã ghi xuất bán ${num(values.quantity)} con.`;
    },
  });

  const openWeight = () => setModal({
    title: 'Ghi thông số vật nuôi (cân mẫu)',
    initial: { sampleDate: today, avgWeightKg: '', sampleSize: '', note: '' },
    fields: [
      { key: 'sampleDate', label: 'Ngày cân', type: 'date', required: true, max: today },
      { key: 'avgWeightKg', label: 'Trọng lượng TB (kg/con)', type: 'number', required: true, min: 0, step: 0.001 },
      { key: 'sampleSize', label: 'Số con cân mẫu', type: 'number', min: 1, step: 1 },
      { key: 'note', label: 'Ghi chú', type: 'textarea', full: true },
    ],
    validate: values => ({
      sampleDate: dateRule(values.sampleDate, 'Ngày cân'),
      avgWeightKg: values.avgWeightKg !== '' && !(Number(values.avgWeightKg) > 0) ? 'Trọng lượng trung bình phải lớn hơn 0.' : undefined,
      sampleSize: values.sampleSize !== '' && (!isInt(values.sampleSize) || Number(values.sampleSize) < 1) ? 'Số con cân mẫu phải là số nguyên lớn hơn 0.' : undefined,
    }),
    onSubmit: async values => {
      await addWeightSample(cycle.id, { ...values, avgWeightKg: Number(values.avgWeightKg), sampleSize: values.sampleSize === '' ? null : Number(values.sampleSize), note: values.note.trim() });
      return 'Đã ghi thông số vật nuôi.';
    },
  });

  const openExpense = () => setModal({
    title: 'Ghi khoản chi bổ sung',
    initial: { expenseDate: today, category: expenseTab, amount: '', note: '' },
    fields: [
      { key: 'category', label: 'Khoản chi', type: 'select', required: true, options: EXPENSE_CATEGORIES },
      { key: 'expenseDate', label: 'Ngày chi', type: 'date', required: true, max: today },
      { key: 'amount', label: 'Số tiền (đ)', type: 'number', required: true, min: 1, step: 1 },
      { key: 'note', label: 'Ghi chú', type: 'textarea', full: true },
    ],
    validate: values => ({
      expenseDate: dateRule(values.expenseDate, 'Ngày chi'),
      amount: values.amount !== '' && !(Number(values.amount) > 0)
        ? 'Số tiền phải lớn hơn 0.'
        : values.amount !== '' && Number(values.amount) > 99999999999999
          ? 'Số tiền vượt giới hạn cho phép.'
          : undefined,
    }),
    onSubmit: async values => { await addExpense(cycle.id, { ...values, amount: Number(values.amount), note: values.note.trim() }); return 'Đã ghi khoản chi.'; },
  });

  const openDelete = (label, action) => setModal({
    title: 'Xóa bản ghi', submitLabel: 'Xóa', danger: true, intro: `Bạn chắc chắn muốn xóa ${label}? Thao tác này không thể hoàn tác.`,
    initial: {}, fields: [], onSubmit: async () => { await action(); return `Đã xóa ${label}.`; },
  });

  // ---------------------------------------------------------------- render helpers

  const header = barn && <div className={styles.titleBar}>
    <div>{canDaily ? <Link to={`/areas/${barn.areaId}`}>{barn.areaName}</Link> : <span>{barn.areaName}</span>} / <span>{barn.name}</span></div>
    <select aria-label="Chuyển sang chuồng khác" value={barn.id} onChange={event => navigate(`/barns/${event.target.value}`)}>
      {sameArea.map(item => <option key={item.id} value={item.id}>-- {item.name}</option>)}
    </select>
  </div>;

  const barnInfo = barn && <Card title="Thông tin chuồng" icon={Warehouse}
    actions={isOwner && <button type="button" className={styles.iconButton} aria-label="Sửa thông tin chuồng" onClick={() => setModal({ type: 'barn' })}><Pencil size={15} /></button>}>
    <dl className={styles.facts}>
      <dt>Khu vực</dt><dd>{barn.areaName}</dd>
      <dt>Tên chuồng</dt><dd>{barn.name}</dd>
      <dt>Loại hình sản xuất</dt><dd>Gà thịt</dd>
      <dt>Diện tích (m²)</dt><dd>{num(barn.areaM2, 2)}</dd>
      <dt>Sức chứa tối đa</dt><dd>{num(barn.capacity)} con</dd>
      <dt>Đang nuôi</dt><dd>{num(barn.currentQuantity)} con</dd>
      <dt>Mô tả</dt><dd>{barn.description || '—'}</dd>
    </dl>
  </Card>;

  const renderHistoryContent = () => {
    if (cycles.length === 0) return <Empty>Chuồng chưa có lứa nuôi nào.</Empty>;
    const pagedHistory = paginateRows(cycles, historyPage, historyPageSize);
    return <>
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Lứa</th><th>Bắt đầu</th><th>Kết thúc</th><th>Số nhập</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>{pagedHistory.items.map(item => <tr key={item.id} className={cycle?.id === item.id ? styles.selectedRow : ''}>
          <td>Lứa thứ {item.cycleNumber}</td><td>{formatDay(item.startDate)}</td><td>{formatDay(item.endDate)}</td><td>{num(item.totalIn)} con</td>
          <td><span className={`${styles.badge} ${item.status === 'ACTIVE' ? styles.badge_success : styles.badge_neutral}`}>{item.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã kết thúc'}</span></td>
          <td>{cycle?.id !== item.id && <button type="button" className={styles.linkButton} onClick={() => setSearchParams(item.status === 'ACTIVE' ? {} : { cycle: String(item.id) })}>Xem</button>}</td>
        </tr>)}</tbody>
      </table></div>
      <TablePager
        total={cycles.length}
        page={pagedHistory.safePage}
        pageSize={historyPageSize}
        onPageChange={setHistoryPage}
        onPageSizeChange={setHistoryPageSize}
        label="Phân trang lịch sử lứa nuôi"
      />
    </>;
  };

  const history = <Card title="Lịch sử lứa nuôi" icon={Layers}>
    {renderHistoryContent()}
  </Card>;

  const renderNoCycle = () => (
    <div className={styles.columns}>
      <div className={styles.left}>{barnInfo}</div>
      <div className={styles.right}>
        <section className={`${styles.card} ${styles.emptyCycle}`}>
          <Sprout size={34} />
          <h3>Chuồng chưa có lứa nuôi</h3>
          <p>Khai báo lứa nuôi để nhập đàn, ghi nhật ký và theo dõi chỉ số kỹ thuật. Chuồng sẽ tự chuyển sang Đang hoạt động.</p>
          {isOwner && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={openStartCycle}><PlusCircle size={16} />Khai báo lứa nuôi</button>}
        </section>
        {history}
      </div>
    </div>
  );

  // Chỉ số chính luôn hiện; các chỉ số phụ nằm sau nút "Xem thêm chỉ số" cho gọn.
  // Mục tiêu cân nặng lấy từ chương trình nuôi của lứa (không đặt theo chuồng).
  const targetProgram = (detail?.programs || []).find(program => program.targetWeightMax != null || program.targetWeightMin != null);
  const targetKg = targetProgram ? Number(targetProgram.targetWeightMax ?? targetProgram.targetWeightMin) : null;
  const targetText = targetProgram && [targetProgram.targetWeightMin, targetProgram.targetWeightMax]
    .filter(value => value != null).map(value => num(value, 2)).join('–');
  const weightProgress = metrics && metrics.avgWeightKg != null && targetKg
    ? Math.min(100, Math.round((Number(metrics.avgWeightKg) / targetKg) * 100)) : null;
  const mainKpis = metrics && [
    { icon: CalendarDays, label: 'Ngày tuổi', value: metrics.ageDays != null ? num(metrics.ageDays) : '—', unit: 'ngày',
      hint: `Ngày nuôi thứ ${num(metrics.dayOfCycle)}` },
    { icon: Users, label: 'Đang nuôi', value: num(metrics.currentQuantity), unit: 'con',
      hint: `Hao hụt ${num(metrics.deaths)} con${metrics.lossRate != null ? ` (${num(metrics.lossRate, 2)}%)` : ''}` },
    { icon: Scale, label: 'Cân nặng TB', value: metrics.avgWeightKg != null ? num(metrics.avgWeightKg, 3) : '—', unit: 'kg',
      hint: targetText ? `Mục tiêu ${targetText} kg` : 'Chương trình nuôi chưa đặt mục tiêu', progress: weightProgress },
    { icon: Wheat, label: 'Hệ số FCR', value: metrics.fcr != null ? num(metrics.fcr, 2) : '—', unit: '',
      hint: `Đã ăn ${num(metrics.feedKg, 1)} kg cám` },
  ];
  const kpis = metrics && [
    { icon: Users, label: 'Tổng nhập', value: `${num(metrics.totalIn)} con`, hint: null },
    { icon: Gauge, label: 'Mật độ', value: metrics.densityPerM2 != null ? `${num(metrics.densityPerM2, 1)} con/m²` : '—', hint: barn.areaM2 ? null : 'Chưa khai báo diện tích' },
    ...(canFinance && detail.finance ? [{ icon: Coins, label: 'Chi phí', value: detail.finance.costPerKg != null ? `${num(detail.finance.costPerKg)}đ/kg` : '—',
      hint: detail.finance.costPerHead != null ? `${num(detail.finance.costPerHead)}đ/con` : null }] : []),
    { icon: ShoppingCart, label: 'Sản lượng ước tính', value: `${num(metrics.biomassKg, 1)} kg`, hint: `Tăng trọng ${num(metrics.weightGainKg, 1)} kg` },
    { icon: HeartCrack, label: 'SL loại thải', value: num(metrics.culls), hint: metrics.cullRate != null ? `${num(metrics.cullRate, 2)}%` : null },
    { icon: CheckCircle2, label: 'SL thu hoạch', value: num(metrics.harvestedQuantity), hint: `${num(metrics.harvestedWeightKg, 1)} kg` },
  ];

  const renderCycle = () => {
    const flocks = detail.flocks.filter(flock => flock.status === flockTab);
    const finance = detail.finance;
    const costParts = finance ? [
      { key: 'chick', label: 'Con giống', value: Number(finance.chickCost), color: COST_COLORS.chick },
      { key: 'feed', label: 'Cám', value: Number(finance.feedCost), color: COST_COLORS.feed },
      ...EXPENSE_CATEGORIES.map(item => ({ key: item.value, label: item.label, value: Number(finance.expenses[item.value] || 0), color: COST_COLORS[item.value] })),
    ] : [];
    const losses = detail.movements.filter(item => item.type === 'DEATH' || item.type === 'CULL' || item.type === 'TRANSFER_OUT' || item.type === 'TRANSFER_IN');
    const harvests = detail.movements.filter(item => item.type === 'HARVEST');
    const expenses = (detail.expenses || []).filter(item => item.category === expenseTab);

    const effectiveDetailTab = !canFinance && (detailTab === 'EXPENSE' || detailTab === 'REVENUE') ? 'JOURNAL' : detailTab;
    const currentDiseaseSummary = diseaseSummary && diseaseSummary.cycleId === cycle.id ? diseaseSummary : null;
    const journalTotalCount = detail.feedRecords.length + detail.weightSamples.length + losses.length;
    const expenseTotalCount = (detail.expenses || []).length;

    const journalNeedle = journalSearch.trim().toLowerCase();
    const matchesText = (...parts) => !journalNeedle || parts.some(part => part != null && String(part).toLowerCase().includes(journalNeedle));
    const filteredFeeds = detail.feedRecords.filter(item => matchesText(formatDay(item.date), item.label, item.createdBy));
    const filteredWeights = detail.weightSamples.filter(item => matchesText(formatDay(item.date), item.note, item.createdBy));
    const filteredLosses = losses.filter(item => matchesText(formatDay(item.movementDate), item.flockCode, labelOf(MOVEMENT_TYPES, item.type), item.relatedFlockCode, item.note));
    const activeJournalRows = journalTab === 'FEED' ? filteredFeeds : journalTab === 'WEIGHT' ? filteredWeights : filteredLosses;
    const pagedJournal = paginateRows(activeJournalRows, journalPage, journalPageSize);
    const feedTotalKg = detail.feedRecords.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const feedTotalAmount = detail.feedRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const expenseNeedle = expenseSearch.trim().toLowerCase();
    const filteredExpenses = expenses.filter(item => !expenseNeedle
      || [formatDay(item.date), item.note, item.createdBy].some(part => part != null && String(part).toLowerCase().includes(expenseNeedle)));
    const pagedExpenses = paginateRows(filteredExpenses, expensePage, expensePageSize);
    const pagedHarvests = paginateRows(harvests, revenuePage, revenuePageSize);

    const activeFlockForQuickLoss = detail.flocks.find(flock => flock.status === 'ACTIVE' && flock.quantity > 0);
    const sectionTabs = [
      { value: 'JOURNAL', label: 'Nhật ký', icon: ClipboardList, count: journalTotalCount },
      { value: 'DISEASE', label: 'Sổ bệnh án', icon: Stethoscope, count: currentDiseaseSummary?.count ?? null, alertDot: (currentDiseaseSummary?.activeCount ?? 0) > 0 },
      ...(canFinance && finance ? [
        { value: 'EXPENSE', label: 'Khoản chi bổ sung', icon: Coins, count: expenseTotalCount },
        { value: 'REVENUE', label: 'Doanh thu', icon: ShoppingCart, count: harvests.length },
      ] : []),
      { value: 'HISTORY', label: 'Lịch sử lứa nuôi', icon: Layers, count: cycles.length },
    ];

    return <>
      {isMobile && active && canDaily && (
        <div className={styles.mobileQuickBar} data-testid="barn-mobile-quick-actions" aria-label="Thao tác nhanh chuồng nuôi">
          <Link
            to={barn?.activeCycleId ? `/today-tasks?cycle=${encodeURIComponent(barn.activeCycleId)}` : '/today-tasks'}
            className={styles.quickActionBtn}
          >
            <CalendarDays size={16} />
            <span>Ghi cám</span>
          </Link>
          {activeFlockForQuickLoss && (
            <button
              type="button"
              className={styles.quickActionBtn}
              onClick={() => openLoss(activeFlockForQuickLoss)}
            >
              <Skull size={16} />
              <span>Hao hụt</span>
            </button>
          )}
          <button
            type="button"
            className={styles.quickActionBtn}
            onClick={openWeight}
          >
            <Gauge size={16} />
            <span>Cân mẫu</span>
          </button>
        </div>
      )}
      <div className={styles.columns}>
      <div className={styles.left}>
        <Card
          title={leftInfoTab === 'CYCLE' ? 'Thông tin lứa nuôi' : 'Thông tin chuồng'}
          icon={leftInfoTab === 'CYCLE' ? Flag : Warehouse}
          actions={isOwner && <button type="button" className={styles.iconButton} aria-label="Sửa thông tin chuồng" onClick={() => setModal({ type: 'barn' })}><Pencil size={15} /></button>}
        >
          <Tabs value={leftInfoTab} onChange={setLeftInfoTab} tabs={[{ value: 'CYCLE', label: 'Lứa nuôi' }, { value: 'BARN', label: 'Chuồng' }]} />
          {leftInfoTab === 'CYCLE' ? (
            <div className={styles.cycleInfo}>
              <span className={styles.dot} />
              <div>
                <strong>Lứa nuôi thứ {cycle.cycleNumber}, từ {formatDay(cycle.startDate)}{cycle.endDate ? ` đến ${formatDay(cycle.endDate)}` : ''}</strong>
                <p>Trạng thái: <span className={`${styles.badge} ${active ? styles.badge_success : styles.badge_neutral}`}>{active ? 'Đang hoạt động' : 'Đã kết thúc'}</span></p>
                {cycle.hatchDate && <p>Ngày nở: {formatDay(cycle.hatchDate)}</p>}
                {cycle.note && <p className={styles.muted}>{cycle.note}</p>}
                {!active && barn.activeCycleId && <button type="button" className={styles.linkButton} onClick={() => setSearchParams({})}>← Về lứa đang nuôi</button>}
              </div>
            </div>
          ) : (
            <dl className={styles.facts}>
              <dt>Khu vực</dt><dd>{barn.areaName}</dd>
              <dt>Tên chuồng</dt><dd>{barn.name}</dd>
              <dt>Loại hình sản xuất</dt><dd>Gà thịt</dd>
              <dt>Diện tích (m²)</dt><dd>{num(barn.areaM2, 2)}</dd>
              <dt>Sức chứa tối đa</dt><dd>{num(barn.capacity)} con</dd>
              <dt>Đang nuôi</dt><dd>{num(barn.currentQuantity)} con</dd>
              <dt>Mô tả</dt><dd>{barn.description || '—'}</dd>
            </dl>
          )}
        </Card>
        {canFinance && finance && <section className={styles.card}>
          <Tabs value={financeTab} onChange={setFinanceTab} tabs={[{ value: 'CHART', label: 'Hạch toán' }, { value: 'TABLE', label: 'Chi phí nuôi' }]} />
          {financeTab === 'CHART' ? <div className={styles.financeBody}>
            <p className={styles.chartTitle}>Biểu đồ phân bổ chi phí</p>
            <Donut parts={costParts} />
            <ul className={styles.legend}>{costParts.map(part => <li key={part.key}><span style={{ background: part.color }} />{part.label}</li>)}</ul>
            <div className={styles.pnl}>
              <div><span>Doanh thu</span><strong className={styles.positive}>{money(finance.revenue)}</strong></div>
              <div><span>Chi phí</span><strong className={styles.negative}>{money(finance.totalCost)}</strong></div>
              <div><span>Lợi nhuận</span><strong className={Number(finance.profit) >= 0 ? styles.positive : styles.info}>{money(finance.profit)}</strong></div>
            </div>
          </div> : <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>Khoản chi</th><th>Số tiền</th><th>Tỷ lệ</th></tr></thead>
            <tbody>{costParts.map(part => <tr key={part.key}><td><span className={styles.swatch} style={{ background: part.color }} />{part.label}</td><td>{money(part.value)}</td>
              <td>{Number(finance.totalCost) > 0 ? `${num((part.value / Number(finance.totalCost)) * 100, 1)}%` : '—'}</td></tr>)}
              <tr className={styles.totalRow}><td>Tổng chi phí</td><td>{money(finance.totalCost)}</td><td>100%</td></tr></tbody>
          </table></div>}
        </section>}
        {isOwner && active && <Card title="Kết thúc" icon={Flag}>
          <p className={styles.closeText}>Ấn kết thúc khi lứa nuôi đã hoàn thành để có được thống kê hoạt động và bắt đầu một lứa nuôi mới.
            {metrics.currentQuantity > 0 && <strong> Còn {num(metrics.currentQuantity)} con trong chuồng: hãy xuất bán, chuyển đàn hoặc ghi hao hụt hết trước khi kết thúc.</strong>}</p>
          <button type="button" className={styles.closeButton} onClick={openCloseCycle} disabled={metrics.currentQuantity > 0}>Kết thúc lứa nuôi</button>
        </Card>}
      </div>

      <div className={styles.right}>
        <Card title="Chỉ số kỹ thuật" icon={Gauge}
          actions={<button type="button" className={styles.moreButton} aria-expanded={showMoreKpis} onClick={() => setShowMoreKpis(value => !value)}>
            {showMoreKpis ? <>Thu gọn <ChevronUp size={16} /></> : <>Xem thêm chỉ số <ChevronDown size={16} /></>}</button>}>
          <div className={styles.mainKpis}>{mainKpis.map(({ icon: Icon, label, value, unit, hint, progress }) => <div key={label} className={styles.mainKpi}>
            <span className={styles.mainKpiIcon}><Icon size={20} /></span>
            <span className={styles.mainKpiLabel}>{label}</span>
            <strong>{value}{unit && value !== '—' && <small> {unit}</small>}</strong>
            {progress != null && <span className={styles.mainKpiBar} aria-label={`Đạt ${progress}% mục tiêu`}><i style={{ width: `${progress}%` }} /></span>}
            <span className={styles.mainKpiHint}>{hint}</span>
          </div>)}</div>
          {showMoreKpis && <div className={styles.kpis}>{kpis.map(({ icon: Icon, label, value, hint }) => <div key={label} className={styles.kpi}>
            <Icon size={18} /><div><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>
          </div>)}</div>}
        </Card>

        <Card title={`Danh sách đàn (${detail.flocks.length})`} icon={Users}
          actions={isOwner && active && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={openImport}><PlusCircle size={15} />Nhập đàn</button>}>
          <Tabs value={flockTab} onChange={setFlockTab} tabs={[
            { value: 'ACTIVE', label: `Đang nuôi (${detail.flocks.filter(flock => flock.status === 'ACTIVE').length})` },
            { value: 'ARCHIVED', label: `Lưu trữ (${detail.flocks.filter(flock => flock.status === 'ARCHIVED').length})` },
          ]} />
          {flocks.length === 0 ? <Empty>{flockTab === 'ACTIVE' ? (active ? 'Lứa chưa có đàn. Bấm "Nhập đàn" để nhập con giống.' : 'Không còn đàn đang nuôi.') : 'Chưa có đàn lưu trữ.'}</Empty> :
            <div className={styles.tableWrap}><table className={styles.table}>
              {/* Chỉ hiện thông tin cần xem hằng ngày; số lượng nhập, nguồn nhập, giá, hóa đơn... xem ở nút Chi tiết. */}
              <thead><tr><th>Đàn</th><th>Ngày tuổi</th><th>Tồn</th><th /></tr></thead>
              <tbody>{flocks.map(flock => <tr key={flock.id}>
                <td className={styles.upper}>{flock.name}<small className={styles.programTag}>{[flock.code, labelOf(FLOCK_GENDERS, flock.gender).split(' ')[0], flock.programName].filter(Boolean).join(' · ')}</small></td>
                <td>{flock.currentAgeDays}</td>
                <td><strong>{num(flock.quantity)} con</strong></td>
                <td className={styles.rowActions}>
                  <button type="button" className={styles.iconButton} title="Xem chi tiết đàn" aria-label={`Chi tiết đàn ${flock.code}`}
                    onClick={() => setModal({ type: 'flock', flock })}><Eye size={15} /></button>
                  {active && flock.status === 'ACTIVE' && <>
                  {isOwner && <button type="button" className={styles.iconButton} title="Tách / chuyển đàn" aria-label={`Chuyển đàn ${flock.code}`} onClick={() => openTransfer(flock)}><ArrowLeftRight size={15} /></button>}
                  {canDaily && <button type="button" className={styles.iconButton} title="Ghi hao hụt / loại thải" aria-label={`Ghi hao hụt ${flock.code}`} onClick={() => openLoss(flock)}><Skull size={15} /></button>}
                  {canFinance && <button type="button" className={styles.iconButton} title="Xuất bán" aria-label={`Xuất bán ${flock.code}`} onClick={() => openHarvest(flock)}><ShoppingCart size={15} /></button>}
                </>}</td>
              </tr>)}</tbody>
            </table></div>}
        </Card>

        {active && <Card title={`Việc hôm nay · ${formatDay(today)}`} icon={CalendarDays}
          actions={canDaily && <Link to="/today-tasks" className={styles.linkButton}>Mở tất cả chuồng</Link>}>
          {!dayPlan ? <Empty>Không tải được phiếu việc hôm nay.</Empty>
            : (dayPlan.flocks.length === 0 && !(dayPlan.routineTasks?.length > 0) && !(dayPlan.assignedTasks?.length > 0))
              ? <Empty>Chưa có đàn đang nuôi trong chuồng.</Empty>
              : <div className={styles.dayPlan}><DailyPlanCard compact plan={dayPlan} userEmail={user?.email} role={role} busyKey={dailyActions.busyKey}
                onConfirm={dailyActions.confirm} onUndo={dailyActions.undo}
                onConfirmAssigned={dailyActions.confirmAssigned} onUndoAssigned={dailyActions.undoAssigned}
                onToggleRoutine={dailyActions.toggleRoutine} /></div>}
        </Card>}

        <Card title="Chương trình nuôi" icon={ClipboardList}
          actions={isOwner && active && detail.flocks.some(flock => flock.status === 'ACTIVE')
            && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={openAssignProgram}><PlusCircle size={15} />Gắn chương trình</button>}>
          {detail.programs.length === 0 ? <Empty>Các đàn của lứa chưa gắn chương trình nuôi.</Empty> : detail.programs.map(program => {
            const pendingSteps = program.steps.filter(step => step.state !== 'DONE');
            const visibleSteps = showAllProgramSteps ? pendingSteps : pendingSteps.slice(0, 5);
            const doneCount = program.steps.length - pendingSteps.length;
            return <div key={program.id} className={styles.program}>
              <div className={styles.programHead}>
                <strong>{program.name}</strong><span className={`${styles.badge} ${styles.badge_warning}`}>{program.breed}</span>
                <span className={styles.muted}>Ngày tuổi {program.currentDay}/{program.durationDays}</span>
              </div>
              <ul className={styles.steps}>{visibleSteps.map(step => {
                const stepState = STEP_STATES[step.state] || STEP_STATES.UPCOMING;
                return <li key={step.id} className={step.state === 'IN_PROGRESS' ? styles.stepNow : ''}>
                  <span>Ngày {step.dayFrom}{step.dayTo !== step.dayFrom ? `–${step.dayTo}` : ''}</span>
                  <strong>{stepCategoryLabel(step.category)}: {step.name}</strong>
                  <small>{describeStep(step)}</small>
                  <span className={`${styles.badge} ${styles[`badge_${stepState.tone}`]}`}>{stepState.label}</span>
                </li>;
              })}</ul>
              {(doneCount > 0 || pendingSteps.length > 5) && <div className={styles.programFooter}>
                {doneCount > 0 && <p className={styles.planEmpty}>
                  Đã qua {doneCount} nội dung. Xem đầy đủ tại Thiết lập chăn nuôi → Chương trình nuôi.</p>}
                {pendingSteps.length > 5 && <button type="button" className={styles.linkButton} onClick={() => setShowAllProgramSteps(v => !v)}>
                  {showAllProgramSteps ? 'Thu gọn bước' : `Xem thêm ${pendingSteps.length - 5} bước`}
                </button>}
              </div>}
            </div>;
          })}
        </Card>
      </div>
    </div>

    <section className={`${styles.card} ${styles.detailSection}`} aria-label="Chi tiết vận hành lứa nuôi">
      <div className={styles.sectionTabBar}>
        <div className={styles.sectionTabs} role="tablist" aria-label="Mục chi tiết lứa nuôi">
          {sectionTabs.map(({ value, label, icon: Icon, count, alertDot }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={effectiveDetailTab === value}
              className={`${styles.sectionTab} ${effectiveDetailTab === value ? styles.sectionTabActive : ''}`}
              onClick={() => setDetailTab(value)}
            >
              <Icon size={16} />
              <span>{label}</span>
              {alertDot && <span className={styles.activeDiseaseDot} title="Có đợt bệnh đang điều trị" />}
              {count != null && <span className={styles.tabCount}>{count}</span>}
            </button>
          ))}
        </div>
        <div className={styles.sectionAction}>
          {effectiveDetailTab === 'JOURNAL' && active && canDaily && journalTab === 'WEIGHT' && (
            <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={openWeight}>
              <PlusCircle size={15} />Ghi cân mẫu
            </button>
          )}
          {effectiveDetailTab === 'EXPENSE' && active && canFinance && (
            <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={openExpense}>
              <PlusCircle size={15} />Thêm khoản chi
            </button>
          )}
        </div>
      </div>

      {effectiveDetailTab === 'JOURNAL' && (
        <div>
          <div className={styles.subToolbar}>
            <Tabs
              value={journalTab}
              onChange={tab => { setJournalTab(tab); setJournalPage(1); }}
              tabs={[
                { value: 'FEED', label: 'Cám' },
                { value: 'WEIGHT', label: 'Thông số vật nuôi' },
                { value: 'LOSS', label: 'Hao hụt & chuyển đàn' },
              ]}
            />
            <div className={styles.searchBox}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                aria-label="Tìm kiếm trong nhật ký"
                placeholder="Tìm ngày, tên cám, ghi chú..."
                value={journalSearch}
                onChange={event => { setJournalSearch(event.target.value); setJournalPage(1); }}
              />
              {journalSearch && (
                <button type="button" className={styles.searchClear} aria-label="Xóa tìm kiếm nhật ký"
                  onClick={() => { setJournalSearch(''); setJournalPage(1); }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {journalTab === 'FEED' && active && detail.openedFeeds?.length > 0 && (
            <div className={styles.openedFeedBanner} data-testid="barn-opened-feeds">
              <strong>Cám đang mở bao còn lại tại chuồng:</strong>
              <ul className={styles.openedFeedList}>
                {detail.openedFeeds.map(feed => (
                  <li key={feed.productId || feed.id}>
                    <span>{feed.feedName}: <strong>{num(feed.remainingKg, 3)} kg</strong></span>
                    {canFinance && feed.remainingValue != null && <span>({money(feed.remainingValue)})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {journalTab === 'FEED' && detail.feedRecords.length > 0 && (
            <p className={styles.summaryLine}>
              Tổng lượng: <strong>{num(feedTotalKg, 1)} kg</strong>
              {canFinance && <> · Tổng tiền cám: <strong>{money(feedTotalAmount)}</strong></>}
            </p>
          )}

          {journalTab === 'FEED' && (detail.feedRecords.length === 0
            ? <Empty>Chưa có dữ liệu. Cám được ghi khi bấm Xong cữ ăn ở Việc hôm nay.</Empty>
            : filteredFeeds.length === 0
              ? <Empty>Không tìm thấy nhật ký cám phù hợp.</Empty>
              : <>
                <div className={styles.tableWrap}><table className={styles.table}>
                  <thead><tr><th>Ngày</th><th>Tên cám</th><th>Lượng (kg)</th>{canFinance && <th>Thành tiền</th>}<th>Người ghi</th><th /></tr></thead>
                  <tbody>{pagedJournal.items.map(item => <tr key={item.id}><td>{formatDay(item.date)}</td><td>{item.label}</td><td>{num(item.quantity, 2)}</td>
                    {canFinance && <td>{money(item.amount)}</td>}<td>{item.createdBy || '—'}</td>
                    <td>{isOwner && active && <button type="button" className={styles.iconButton} aria-label={`Xóa nhật ký cám ${formatDay(item.date)}`} onClick={() => openDelete('nhật ký cám', () => deleteFeedRecord(cycle.id, item.id))}><Trash2 size={14} /></button>}</td></tr>)}</tbody>
                </table></div>
                <TablePager total={filteredFeeds.length} page={pagedJournal.safePage} pageSize={journalPageSize}
                  onPageChange={setJournalPage} onPageSizeChange={setJournalPageSize} label="Phân trang nhật ký cám" />
              </>)}

          {journalTab === 'WEIGHT' && (detail.weightSamples.length === 0
            ? <Empty>Chưa có dữ liệu</Empty>
            : filteredWeights.length === 0
              ? <Empty>Không tìm thấy lần cân mẫu phù hợp.</Empty>
              : <>
                <div className={styles.tableWrap}><table className={styles.table}>
                  <thead><tr><th>Ngày cân</th><th>Trọng lượng TB (kg/con)</th><th>Số con cân</th><th>Ghi chú</th><th /></tr></thead>
                  <tbody>{pagedJournal.items.map(item => <tr key={item.id}><td>{formatDay(item.date)}</td><td>{num(item.quantity, 3)}</td><td>{num(item.sampleSize)}</td><td>{item.note || '—'}</td>
                    <td>{isOwner && active && <button type="button" className={styles.iconButton} aria-label={`Xóa lần cân ${formatDay(item.date)}`} onClick={() => openDelete('lần cân mẫu', () => deleteWeightSample(cycle.id, item.id))}><Trash2 size={14} /></button>}</td></tr>)}</tbody>
                </table></div>
                <TablePager total={filteredWeights.length} page={pagedJournal.safePage} pageSize={journalPageSize}
                  onPageChange={setJournalPage} onPageSizeChange={setJournalPageSize} label="Phân trang cân mẫu" />
              </>)}

          {journalTab === 'LOSS' && (losses.length === 0
            ? <Empty>Chưa có dữ liệu</Empty>
            : filteredLosses.length === 0
              ? <Empty>Không tìm thấy bản ghi hao hụt hoặc chuyển đàn phù hợp.</Empty>
              : <>
                <div className={styles.tableWrap}><table className={styles.table}>
                  <thead><tr><th>Ngày</th><th>Đàn</th><th>Loại</th><th>Số con</th><th>Khối lượng (kg)</th><th>Ghi chú</th><th aria-label="Chi tiết" /></tr></thead>
                  <tbody>{pagedJournal.items.map(item => <tr key={item.id}><td>{formatDay(item.movementDate)}</td><td>{item.flockCode}</td><td>{labelOf(MOVEMENT_TYPES, item.type)}
                    {item.relatedFlockCode ? ` (${item.type === 'TRANSFER_OUT' ? 'sang' : 'từ'} ${item.relatedFlockCode})` : ''}</td><td>{num(item.quantity)}</td><td>{num(item.weightKg, 2)}</td><td>{item.note || '—'}</td>
                    <td className={styles.rowActions}><button type="button" className={styles.iconButton} title="Xem chi tiết, ảnh đính kèm"
                      aria-label={`Chi tiết ${labelOf(MOVEMENT_TYPES, item.type).toLowerCase()} ngày ${formatDay(item.movementDate)} đàn ${item.flockCode}`}
                      onClick={() => setModal({ type: 'movement', movement: item })}><Eye size={15} />
                      {item.photoUrls?.length ? <span className={styles.photoCount}>{item.photoUrls.length}</span> : null}</button></td></tr>)}</tbody>
                </table></div>
                <TablePager total={filteredLosses.length} page={pagedJournal.safePage} pageSize={journalPageSize}
                  onPageChange={setJournalPage} onPageSizeChange={setJournalPageSize} label="Phân trang hao hụt" />
              </>)}
        </div>
      )}

      {effectiveDetailTab === 'DISEASE' && (
        <DiseaseLogPanel
          embedded
          cycle={cycle}
          flocks={detail.flocks}
          canDaily={canDaily}
          canFinance={canFinance}
          isOwner={isOwner}
          userEmail={user?.email}
          refreshKey={revision}
          onChanged={() => setRevision(value => value + 1)}
          onSummaryChange={info => setDiseaseSummary({ cycleId: cycle.id, ...info })}
          showToast={showToast}
        />
      )}

      {effectiveDetailTab === 'EXPENSE' && canFinance && finance && (
        <div>
          <div className={styles.subToolbar}>
            <Tabs
              value={expenseTab}
              onChange={tab => { setExpenseTab(tab); setExpensePage(1); }}
              tabs={EXPENSE_CATEGORIES}
            />
            <div className={styles.searchBox}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                aria-label="Tìm kiếm khoản chi"
                placeholder="Tìm ngày, ghi chú, người ghi..."
                value={expenseSearch}
                onChange={event => { setExpenseSearch(event.target.value); setExpensePage(1); }}
              />
              {expenseSearch && (
                <button type="button" className={styles.searchClear} aria-label="Xóa tìm kiếm khoản chi"
                  onClick={() => { setExpenseSearch(''); setExpensePage(1); }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <p className={styles.summaryLine}>Tổng tiền: <strong>{money(finance.expenses[expenseTab])}</strong></p>
          {expenses.length === 0
            ? <Empty>Chưa có dữ liệu</Empty>
            : filteredExpenses.length === 0
              ? <Empty>Không tìm thấy khoản chi phù hợp.</Empty>
              : <>
                <div className={styles.tableWrap}><table className={styles.table}>
                  <thead><tr><th>Ngày</th><th>Số tiền</th><th>Ghi chú</th><th>Người ghi</th><th /></tr></thead>
                  <tbody>{pagedExpenses.items.map(item => <tr key={item.id}><td>{formatDay(item.date)}</td><td>{money(item.amount)}</td><td>{item.note || '—'}</td><td>{item.createdBy || '—'}</td>
                    <td>{active && <button type="button" className={styles.iconButton} aria-label={`Xóa khoản chi ${formatDay(item.date)}`} onClick={() => openDelete('khoản chi', () => deleteExpense(cycle.id, item.id))}><Trash2 size={14} /></button>}</td></tr>)}</tbody>
                </table></div>
                <TablePager total={filteredExpenses.length} page={pagedExpenses.safePage} pageSize={expensePageSize}
                  onPageChange={setExpensePage} onPageSizeChange={setExpensePageSize} label="Phân trang khoản chi" />
              </>}
        </div>
      )}

      {effectiveDetailTab === 'REVENUE' && canFinance && finance && (
        <div>
          <p className={styles.summaryLine}>Số lượng: <strong>{num(metrics.harvestedQuantity)} con</strong> · Sản lượng: <strong>{num(metrics.harvestedWeightKg, 1)} kg</strong>
            · Loại thải: <strong>{num(metrics.culls)} con</strong> · Tiền bán: <strong>{money(finance.revenue)}</strong></p>
          {harvests.length === 0 ? <Empty>Chưa có dữ liệu</Empty> : <>
            <div className={styles.tableWrap}><table className={styles.table}>
              <thead><tr><th>Ngày</th><th>Đàn</th><th>Số con</th><th>Khối lượng (kg)</th><th>Đơn giá (đ/kg)</th><th>Thành tiền</th><th>Ghi chú</th></tr></thead>
              <tbody>{pagedHarvests.items.map(item => <tr key={item.id}><td>{formatDay(item.movementDate)}</td><td>{item.flockCode}</td><td>{num(item.quantity)}</td><td>{num(item.weightKg, 2)}</td>
                <td>{num(item.unitPrice)}</td><td>{money(item.amount)}</td><td>{item.note || '—'}</td></tr>)}</tbody>
            </table></div>
            <TablePager total={harvests.length} page={pagedHarvests.safePage} pageSize={revenuePageSize}
              onPageChange={setRevenuePage} onPageSizeChange={setRevenuePageSize} label="Phân trang doanh thu" />
          </>}
        </div>
      )}

      {effectiveDetailTab === 'HISTORY' && (
        <div>
          {renderHistoryContent()}
        </div>
      )}
    </section>
    </>;
  };

  const breadcrumbs = isAccountant
    ? [{ label: 'Bảng tin', path: '/dashboard' }, { label: 'Lịch sử lứa nuôi', path: '/cycles/history' }, ...(barn ? [{ label: barn.areaName }] : [])]
    : [{ label: 'Quản lý khu nuôi', path: '/areas' }, ...(barn ? [{ label: barn.areaName, path: `/areas/${barn.areaId}` }] : [])];

  return <FarmShiftLayout pageTitle={barn ? barn.name : 'Chi tiết chuồng'} showShortcuts={!isAccountant} environmentHref={`/iot?barn=${encodeURIComponent(id)}`}
    feedHref={barn?.activeCycleId ? `/today-tasks?cycle=${encodeURIComponent(barn.activeCycleId)}` : undefined}
    weightHref={cycle ? `/journal?tab=weight&cycle=${encodeURIComponent(cycle.id)}` : undefined}
    lossHref={cycle ? `/journal?tab=loss&cycle=${encodeURIComponent(cycle.id)}` : undefined}
    breadcrumbs={breadcrumbs}>
    {loading ? <p className={styles.loading} role="status">Đang tải chi tiết chuồng...</p>
      : error ? <div role="alert" className={`${styles.card} ${styles.emptyCycle}`}><p>{error}</p>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => navigate(isAccountant ? '/cycles/history' : '/barns')}>
          {isAccountant ? 'Về lịch sử lứa nuôi' : 'Về danh sách chuồng'}
        </button></div>
        : <>{!isAccountant && <AreaTabs areas={areas} active={barn.areaId} />}{header}{detail ? renderCycle() : renderNoCycle()}</>}
    {modal?.type === 'flock' && <FlockDetailDialog flock={modal.flock} canFinance={canFinance} onClose={() => setModal(null)} />}
    {modal?.type === 'movement' && <MovementDetailDialog movement={modal.movement} onClose={() => setModal(null)} />}
    {modal?.type === 'barn' && <BarnDialog barn={barn} areas={areas} onClose={() => setModal(null)} onSaved={done} />}
    {modal?.type === 'close' && <CloseCycleDialog barn={barn} cycle={cycle} onClose={() => setModal(null)} onDone={done} />}
    {modal && !modal.type && <FormDialog key={modal.title} {...modal} onClose={() => setModal(null)} onDone={done} />}
  </FarmShiftLayout>;
};
