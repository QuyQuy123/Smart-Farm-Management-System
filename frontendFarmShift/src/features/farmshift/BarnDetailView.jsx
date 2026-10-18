import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, CalendarDays, CheckCircle2, ClipboardList, Coins, Flag, Gauge, HeartCrack, Layers, Pencil, PlusCircle,
  Scale, ShoppingCart, Skull, Sprout, Trash2, Users, Warehouse, Wheat,
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { listBarns, listFarmAreas } from '../../services/farmAreaService';
import {
  addExpense, addFeedRecord, addWeightSample, closeCycle, deleteExpense, deleteFeedRecord, deleteWeightSample, detachProgram,
  getBarn, getCycle, importFlock, listCycles, recordHarvest, recordLoss, startCycle, transferFlock,
} from '../../services/cycleService';
import { BarnDialog } from './FarmAreaDialogs';
import { FormDialog, ProgramDialog } from './CycleDialogs';
import {
  EXPENSE_CATEGORIES, FLOCK_GENDERS, MAX_IMPORT_SPREAD_DAYS, MOVEMENT_TYPES, PROGRAM_TYPES, STEP_STATES,
  addDaysIso, apiErrorMessage, formatDay, labelOf, todayIso,
} from './farmAreaOptions';
import styles from './BarnDetailView.module.css';

const num = (value, digits = 0) => value == null ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits });
const money = value => value == null ? '—' : `${Number(value).toLocaleString('vi-VN')}đ`;
const isInt = value => value !== '' && Number.isInteger(Number(value));

const COST_COLORS = { chick: '#f59e0b', feed: '#06b6d4', ELECTRICITY: '#8b5cf6', WATER: '#3b82f6', LABOR: '#a8a29e', MEDICINE: '#ef4444', OTHER: '#ec4899' };

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

export const BarnDetailView = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const role = user?.role;
  const isOwner = role === 'ROLE_FARM_OWNER';
  const canDaily = isOwner || role === 'ROLE_FARM_WORKER';
  const canFinance = isOwner || role === 'ROLE_ACCOUNTANT';
  const requestedCycle = searchParams.get('cycle');

  const [revision, setRevision] = useState(0);
  const requestKey = `${id}|${requestedCycle || ''}|${revision}`;
  const [state, setState] = useState({ key: null });
  const [modal, setModal] = useState(null);
  const [flockTab, setFlockTab] = useState('ACTIVE');
  const [journalTab, setJournalTab] = useState('FEED');
  const [expenseTab, setExpenseTab] = useState('ELECTRICITY');
  const [financeTab, setFinanceTab] = useState('CHART');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [barn, cycles, barns, areas] = await Promise.all([getBarn(id), listCycles(id), listBarns(), listFarmAreas()]);
        const cycleId = requestedCycle || barn.activeCycleId;
        const detail = cycleId ? await getCycle(cycleId) : null;
        if (!cancelled) setState({ key: requestKey, barn, cycles, barns, areas, detail, error: '' });
      } catch (requestError) {
        if (!cancelled) setState({ key: requestKey, error: requestError.response?.status === 404 ? 'Không tìm thấy chuồng hoặc lứa nuôi.' : apiErrorMessage(requestError) });
      }
    })();
    return () => { cancelled = true; };
  }, [id, requestedCycle, requestKey]);

  const loading = state.key !== requestKey;
  const { barn, cycles = [], barns = [], areas = [], detail, error } = state;
  const cycle = detail?.cycle;
  const metrics = detail?.metrics;
  const active = cycle?.status === 'ACTIVE';
  const today = todayIso();
  const done = message => { setModal(null); showToast(message, 'success'); setRevision(value => value + 1); };
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

  const openCloseCycle = () => setModal({
    title: `Kết thúc lứa nuôi thứ ${cycle.cycleNumber}`, submitLabel: 'Xác nhận kết thúc', danger: true,
    intro: 'Chi phí, doanh thu và nhật ký được lưu trong lịch sử lứa. Sau khi kết thúc, lứa chỉ xem được, không ghi thêm dữ liệu.',
    initial: { endDate: today, note: '' },
    fields: [
      { key: 'endDate', label: 'Ngày kết thúc', type: 'date', required: true, max: today },
      { key: 'note', label: 'Ghi chú', type: 'textarea', full: true },
    ],
    validate: values => ({ endDate: dateRule(values.endDate, 'Ngày kết thúc') }),
    onSubmit: async values => { await closeCycle(cycle.id, values); return `Đã kết thúc lứa nuôi thứ ${cycle.cycleNumber}.`; },
  });

  const room = barn ? barn.capacity - barn.currentQuantity : 0;
  const openImport = () => {
    const first = metrics.firstImportDate;
    const windowEnd = first ? addDaysIso(first, MAX_IMPORT_SPREAD_DAYS) : null;
    setModal({
      title: 'Nhập đàn vào lứa',
      intro: `${first ? `Đàn đầu tiên nhập ngày ${formatDay(first)}: các đàn tiếp theo phải nhập trong khoảng ${formatDay([addDaysIso(first, -MAX_IMPORT_SPREAD_DAYS), cycle.startDate].sort()[1])} – ${formatDay(windowEnd < today ? windowEnd : today)}. `
        : `Các đàn của lứa phải nhập cách nhau không quá ${MAX_IMPORT_SPREAD_DAYS} ngày. `}Chuồng còn chỗ cho ${num(room)} con (sức chứa ${num(barn.capacity)}).`,
      initial: { name: '', gender: 'MALE', importDate: windowEnd && windowEnd < today ? windowEnd : today, ageAtImport: '1', quantity: '', avgWeight: '0.04', unitPrice: '', sourceNote: '', note: '' },
      fields: [
        { key: 'name', label: 'Tên đàn', required: true, placeholder: 'Ví dụ: MÍA-DABACO TRỐNG' },
        { key: 'gender', label: 'Giới tính', type: 'select', required: true, options: FLOCK_GENDERS },
        { key: 'importDate', label: 'Ngày nhập', type: 'date', required: true, max: today },
        { key: 'ageAtImport', label: 'Ngày tuổi lúc nhập', type: 'number', required: true, min: 1, step: 1 },
        { key: 'quantity', label: 'Số lượng nhập (con)', type: 'number', required: true, min: 1, step: 1 },
        { key: 'avgWeight', label: 'Trọng lượng TB (kg/con)', type: 'number', required: true, min: 0, step: 0.001 },
        { key: 'unitPrice', label: 'Giá con giống (đ/con)', type: 'number', required: true, min: 0, step: 1 },
        { key: 'sourceNote', label: 'Nguồn nhập', placeholder: 'Ví dụ: Dabaco' },
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
        await importFlock(cycle.id, { ...values, name: values.name.trim(), ageAtImport: Number(values.ageAtImport), quantity: Number(values.quantity),
          avgWeight: Number(values.avgWeight), unitPrice: Number(values.unitPrice), sourceNote: values.sourceNote.trim(), note: values.note.trim() });
        return `Đã nhập đàn ${values.name.trim()} (${num(values.quantity)} con).`;
      },
    });
  };

  const openTransfer = flock => {
    const targets = barns.filter(item => item.activeCycleId && item.id !== barn.id);
    setModal({
      title: `Tách / chuyển đàn ${flock.code}`,
      intro: `Đàn ${flock.name} đang tồn ${num(flock.quantity)} con. Giá vốn con giống chuyển theo tỷ lệ số con; tổng số con toàn trại giữ nguyên.`,
      warning: targets.length ? null : 'Chưa có chuồng nào khác đang có lứa nuôi. Hãy khai báo lứa cho chuồng đích trước.',
      initial: { targetBarnId: targets[0] ? String(targets[0].id) : '', quantity: '', transferDate: today, name: flock.name, avgWeight: '', note: '' },
      fields: [
        { key: 'targetBarnId', label: 'Chuồng đích đang có lứa', type: 'select', required: true,
          options: targets.length ? targets.map(item => ({ value: String(item.id), label: `${item.name} (${item.areaName}) · còn ${num(item.capacity - item.currentQuantity)} chỗ` }))
            : [{ value: '', label: 'Không có chuồng phù hợp' }] },
        { key: 'quantity', label: 'Số con chuyển', type: 'number', required: true, min: 1, max: flock.quantity, step: 1 },
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
        else if (target && Number(values.quantity) > target.capacity - target.currentQuantity) found.quantity = `${target.name} chỉ còn ${num(target.capacity - target.currentQuantity)} chỗ.`;
        if (values.avgWeight !== '' && !(Number(values.avgWeight) > 0)) found.avgWeight = 'Trọng lượng trung bình phải lớn hơn 0.';
        return found;
      },
      onSubmit: async values => {
        await transferFlock(flock.id, { targetBarnId: Number(values.targetBarnId), quantity: Number(values.quantity), transferDate: values.transferDate,
          name: values.name.trim(), avgWeight: values.avgWeight === '' ? null : Number(values.avgWeight), note: values.note.trim() });
        return `Đã chuyển ${num(values.quantity)} con từ đàn ${flock.code}.`;
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

  const openFeed = () => setModal({
    title: 'Ghi nhật ký cám',
    initial: { recordDate: today, feedName: '', quantityKg: '', unitPrice: '', note: '' },
    fields: [
      { key: 'recordDate', label: 'Ngày cho ăn', type: 'date', required: true, max: today },
      { key: 'feedName', label: 'Tên cám', required: true, placeholder: 'Ví dụ: Higro 02' },
      { key: 'quantityKg', label: 'Lượng cám (kg)', type: 'number', required: true, min: 0, step: 0.01 },
      { key: 'unitPrice', label: 'Đơn giá cám (đ/kg)', type: 'number', required: true, min: 0, step: 1 },
      { key: 'note', label: 'Ghi chú', type: 'textarea', full: true },
    ],
    validate: values => ({ recordDate: dateRule(values.recordDate, 'Ngày cho ăn'), quantityKg: values.quantityKg !== '' && !(Number(values.quantityKg) > 0) ? 'Lượng cám phải lớn hơn 0.' : undefined }),
    onSubmit: async values => {
      await addFeedRecord(cycle.id, { ...values, feedName: values.feedName.trim(), quantityKg: Number(values.quantityKg), unitPrice: Number(values.unitPrice), note: values.note.trim() });
      return 'Đã ghi nhật ký cám.';
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
    validate: values => ({ expenseDate: dateRule(values.expenseDate, 'Ngày chi'), amount: values.amount !== '' && !(Number(values.amount) > 0) ? 'Số tiền phải lớn hơn 0.' : undefined }),
    onSubmit: async values => { await addExpense(cycle.id, { ...values, amount: Number(values.amount), note: values.note.trim() }); return 'Đã ghi khoản chi.'; },
  });

  const openDelete = (label, action) => setModal({
    title: 'Xóa bản ghi', submitLabel: 'Xóa', danger: true, intro: `Bạn chắc chắn muốn xóa ${label}? Thao tác này không thể hoàn tác.`,
    initial: {}, fields: [], onSubmit: async () => { await action(); return `Đã xóa ${label}.`; },
  });

  const removeProgram = program => setModal({
    title: 'Bỏ chương trình nuôi', submitLabel: 'Bỏ khỏi lứa', danger: true,
    intro: `Bỏ chương trình ${program.name} khỏi lứa nuôi này? Chương trình mẫu vẫn được giữ lại.`, initial: {}, fields: [],
    onSubmit: async () => { await detachProgram(cycle.id, program.id); return `Đã bỏ chương trình ${program.name}.`; },
  });

  // ---------------------------------------------------------------- render helpers

  const header = barn && <div className={styles.titleBar}>
    <div><Link to={`/areas/${barn.areaId}`}>{barn.areaName}</Link> / <span>{barn.name}</span></div>
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

  const history = <Card title="Lịch sử lứa nuôi" icon={Layers}>
    {cycles.length === 0 ? <Empty>Chuồng chưa có lứa nuôi nào.</Empty> :
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Lứa</th><th>Bắt đầu</th><th>Kết thúc</th><th>Số nhập</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>{cycles.map(item => <tr key={item.id} className={cycle?.id === item.id ? styles.selectedRow : ''}>
          <td>Lứa thứ {item.cycleNumber}</td><td>{formatDay(item.startDate)}</td><td>{formatDay(item.endDate)}</td><td>{num(item.totalIn)} con</td>
          <td><span className={`${styles.badge} ${item.status === 'ACTIVE' ? styles.badge_success : styles.badge_neutral}`}>{item.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã kết thúc'}</span></td>
          <td>{cycle?.id !== item.id && <button type="button" className={styles.linkButton} onClick={() => setSearchParams(item.status === 'ACTIVE' ? {} : { cycle: String(item.id) })}>Xem</button>}</td>
        </tr>)}</tbody>
      </table></div>}
  </Card>;

  const renderNoCycle = () => {
    return <div className={styles.columns}>
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
    </div>;
  };

  const kpis = metrics && [
    { icon: CalendarDays, label: 'Ngày nuôi', value: num(metrics.dayOfCycle), hint: metrics.ageDays != null ? `Ngày tuổi ${num(metrics.ageDays)}` : null },
    { icon: Users, label: 'Tổng đàn', value: `${num(metrics.currentQuantity)} con`, hint: `Nhập ${num(metrics.totalIn)} con` },
    { icon: Scale, label: 'Cân nặng TB', value: metrics.avgWeightKg != null ? `${num(metrics.avgWeightKg, 3)} kg` : '—',
      hint: barn.targetWeight != null ? `Mục tiêu ${num(barn.targetWeight, 2)} kg` : null },
    { icon: Gauge, label: 'Mật độ', value: metrics.densityPerM2 != null ? `${num(metrics.densityPerM2, 1)} con/m²` : '—', hint: barn.areaM2 ? null : 'Chưa khai báo diện tích' },
    { icon: Wheat, label: 'Hệ số FCR', value: metrics.fcr != null ? num(metrics.fcr, 2) : '—', hint: `Cám ${num(metrics.feedKg, 1)} kg` },
    ...(canFinance && detail.finance ? [{ icon: Coins, label: 'Chi phí', value: detail.finance.costPerKg != null ? `${num(detail.finance.costPerKg)}đ/kg` : '—',
      hint: detail.finance.costPerHead != null ? `${num(detail.finance.costPerHead)}đ/con` : null }] : []),
    { icon: ShoppingCart, label: 'Sản lượng ước tính', value: `${num(metrics.biomassKg, 1)} kg`, hint: `Tăng trọng ${num(metrics.weightGainKg, 1)} kg` },
    { icon: Skull, label: 'SL hao hụt', value: num(metrics.deaths), hint: metrics.lossRate != null ? `${num(metrics.lossRate, 2)}%` : null },
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
    const attachedIds = detail.programs.map(program => program.id);

    return <div className={styles.columns}>
      <div className={styles.left}>
        <Card title="Thông tin lứa nuôi" icon={Flag}>
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
        {barnInfo}
        {isOwner && active && <Card title="Kết thúc" icon={Flag}>
          <p className={styles.closeText}>Ấn kết thúc khi lứa nuôi đã hoàn thành để có được thống kê hoạt động và bắt đầu một lứa nuôi mới.
            {metrics.currentQuantity > 0 && <strong> Còn {num(metrics.currentQuantity)} con trong chuồng: hãy xuất bán, chuyển đàn hoặc ghi hao hụt hết trước khi kết thúc.</strong>}</p>
          <button type="button" className={styles.closeButton} onClick={openCloseCycle} disabled={metrics.currentQuantity > 0}>Kết thúc lứa nuôi</button>
        </Card>}
      </div>

      <div className={styles.right}>
        <Card title="Chỉ số kỹ thuật" icon={Gauge}>
          <div className={styles.kpis}>{kpis.map(({ icon: Icon, label, value, hint }) => <div key={label} className={styles.kpi}>
            <Icon size={20} /><div><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>
          </div>)}</div>
        </Card>

        <Card title={`Danh sách đàn (${detail.flocks.length})`} icon={Users}
          actions={isOwner && active && <button type="button" className="farmshift-btn farmshift-btn-mint" onClick={openImport}><PlusCircle size={15} />Nhập đàn</button>}>
          <Tabs value={flockTab} onChange={setFlockTab} tabs={[
            { value: 'ACTIVE', label: `Đang nuôi (${detail.flocks.filter(flock => flock.status === 'ACTIVE').length})` },
            { value: 'ARCHIVED', label: `Lưu trữ (${detail.flocks.filter(flock => flock.status === 'ARCHIVED').length})` },
          ]} />
          {flocks.length === 0 ? <Empty>{flockTab === 'ACTIVE' ? (active ? 'Lứa chưa có đàn. Bấm "Nhập đàn" để nhập con giống.' : 'Không còn đàn đang nuôi.') : 'Chưa có đàn lưu trữ.'}</Empty> :
            <div className={styles.tableWrap}><table className={styles.table}>
              <thead><tr><th>Mã đàn</th><th>T/Tuổi</th><th>N/Tuổi</th><th>Tên</th><th colSpan={2}>Số lượng nhập</th><th>Giới tính</th><th>Tồn</th><th>Nguồn nhập</th><th>Ngày nhập</th><th /></tr></thead>
              <tbody>{flocks.map(flock => <tr key={flock.id}>
                <td>{flock.code}</td><td>{flock.currentAgeWeeks}</td><td>{flock.currentAgeDays}</td><td className={styles.upper}>{flock.name}</td>
                <td>{num(flock.importQuantity)} con</td><td>{num(flock.importWeightKg, 1)} kg</td><td>{labelOf(FLOCK_GENDERS, flock.gender).split(' ')[0]}</td>
                <td><strong>{num(flock.quantity)} con</strong></td><td>{flock.sourceNote}</td><td>{formatDay(flock.importDate)}</td>
                <td className={styles.rowActions}>{active && flock.status === 'ACTIVE' && <>
                  {isOwner && <button type="button" className={styles.iconButton} title="Tách / chuyển đàn" aria-label={`Chuyển đàn ${flock.code}`} onClick={() => openTransfer(flock)}><ArrowLeftRight size={15} /></button>}
                  {canDaily && <button type="button" className={styles.iconButton} title="Ghi hao hụt / loại thải" aria-label={`Ghi hao hụt ${flock.code}`} onClick={() => openLoss(flock)}><Skull size={15} /></button>}
                  {canFinance && <button type="button" className={styles.iconButton} title="Xuất bán" aria-label={`Xuất bán ${flock.code}`} onClick={() => openHarvest(flock)}><ShoppingCart size={15} /></button>}
                </>}</td>
              </tr>)}</tbody>
            </table></div>}
        </Card>

        <Card title="Chương trình nuôi" icon={ClipboardList}
          actions={isOwner && active && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setModal({ type: 'program', attachedIds })}><PlusCircle size={15} />Chọn thêm</button>}>
          {detail.programs.length === 0 ? <Empty>Chưa có chương trình nuôi được chọn.</Empty> : detail.programs.map(program => <div key={program.id} className={styles.program}>
            <div className={styles.programHead}>
              <strong>{program.name}</strong><span className={`${styles.badge} ${styles.badge_warning}`}>{labelOf(PROGRAM_TYPES, program.type)}</span>
              {isOwner && active && <button type="button" className={styles.iconButton} aria-label={`Bỏ chương trình ${program.name}`} onClick={() => removeProgram(program)}><Trash2 size={14} /></button>}
            </div>
            <ul className={styles.steps}>{program.steps.map(step => {
              const stepState = STEP_STATES[step.state] || STEP_STATES.UPCOMING;
              return <li key={step.id} className={step.state === 'IN_PROGRESS' ? styles.stepNow : ''}>
                <span>Ngày {step.dayFrom}{step.dayTo !== step.dayFrom ? `–${step.dayTo}` : ''}</span>
                <strong>{step.name}</strong>
                <small>{step.quantity != null ? `${num(step.quantity, 2)} ${step.unit || ''}` : ''}</small>
                <span className={`${styles.badge} ${styles[`badge_${stepState.tone}`]}`}>{stepState.label}</span>
              </li>;
            })}</ul>
          </div>)}
        </Card>

        <Card title="Nhật ký" icon={ClipboardList} actions={active && canDaily && <>
          {journalTab === 'FEED' && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={openFeed}><PlusCircle size={15} />Ghi cám</button>}
          {journalTab === 'WEIGHT' && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={openWeight}><PlusCircle size={15} />Ghi cân mẫu</button>}
        </>}>
          <Tabs value={journalTab} onChange={setJournalTab} tabs={[{ value: 'FEED', label: 'Cám' }, { value: 'WEIGHT', label: 'Thông số vật nuôi' }, { value: 'LOSS', label: 'Hao hụt & chuyển đàn' }]} />
          {journalTab === 'FEED' && (detail.feedRecords.length === 0 ? <Empty>Chưa có dữ liệu</Empty> : <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>Ngày</th><th>Tên cám</th><th>Lượng (kg)</th>{canFinance && <th>Thành tiền</th>}<th>Người ghi</th><th /></tr></thead>
            <tbody>{detail.feedRecords.map(item => <tr key={item.id}><td>{formatDay(item.date)}</td><td>{item.label}</td><td>{num(item.quantity, 2)}</td>
              {canFinance && <td>{money(item.amount)}</td>}<td>{item.createdBy || '—'}</td>
              <td>{isOwner && active && <button type="button" className={styles.iconButton} aria-label={`Xóa nhật ký cám ${formatDay(item.date)}`} onClick={() => openDelete('nhật ký cám', () => deleteFeedRecord(cycle.id, item.id))}><Trash2 size={14} /></button>}</td></tr>)}</tbody>
          </table></div>)}
          {journalTab === 'WEIGHT' && (detail.weightSamples.length === 0 ? <Empty>Chưa có dữ liệu</Empty> : <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>Ngày cân</th><th>Trọng lượng TB (kg/con)</th><th>Số con cân</th><th>Ghi chú</th><th /></tr></thead>
            <tbody>{detail.weightSamples.map(item => <tr key={item.id}><td>{formatDay(item.date)}</td><td>{num(item.quantity, 3)}</td><td>{num(item.sampleSize)}</td><td>{item.note || '—'}</td>
              <td>{isOwner && active && <button type="button" className={styles.iconButton} aria-label={`Xóa lần cân ${formatDay(item.date)}`} onClick={() => openDelete('lần cân mẫu', () => deleteWeightSample(cycle.id, item.id))}><Trash2 size={14} /></button>}</td></tr>)}</tbody>
          </table></div>)}
          {journalTab === 'LOSS' && (losses.length === 0 ? <Empty>Chưa có dữ liệu</Empty> : <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>Ngày</th><th>Đàn</th><th>Loại</th><th>Số con</th><th>Khối lượng (kg)</th><th>Ghi chú</th></tr></thead>
            <tbody>{losses.map(item => <tr key={item.id}><td>{formatDay(item.movementDate)}</td><td>{item.flockCode}</td><td>{labelOf(MOVEMENT_TYPES, item.type)}
              {item.relatedFlockCode ? ` (${item.type === 'TRANSFER_OUT' ? 'sang' : 'từ'} ${item.relatedFlockCode})` : ''}</td><td>{num(item.quantity)}</td><td>{num(item.weightKg, 2)}</td><td>{item.note || '—'}</td></tr>)}</tbody>
          </table></div>)}
        </Card>

        {canFinance && finance && <Card title="Khoản chi bổ sung" icon={Coins}
          actions={active && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={openExpense}><PlusCircle size={15} />Thêm khoản chi</button>}>
          <Tabs value={expenseTab} onChange={setExpenseTab} tabs={EXPENSE_CATEGORIES} />
          <p className={styles.summaryLine}>Tổng tiền: <strong>{money(finance.expenses[expenseTab])}</strong></p>
          {expenses.length === 0 ? <Empty>Chưa có dữ liệu</Empty> : <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>Ngày</th><th>Số tiền</th><th>Ghi chú</th><th>Người ghi</th><th /></tr></thead>
            <tbody>{expenses.map(item => <tr key={item.id}><td>{formatDay(item.date)}</td><td>{money(item.amount)}</td><td>{item.note || '—'}</td><td>{item.createdBy || '—'}</td>
              <td>{active && <button type="button" className={styles.iconButton} aria-label={`Xóa khoản chi ${formatDay(item.date)}`} onClick={() => openDelete('khoản chi', () => deleteExpense(cycle.id, item.id))}><Trash2 size={14} /></button>}</td></tr>)}</tbody>
          </table></div>}
        </Card>}

        {canFinance && finance && <Card title="Doanh thu" icon={ShoppingCart}>
          <p className={styles.summaryLine}>Số lượng: <strong>{num(metrics.harvestedQuantity)} con</strong> · Sản lượng: <strong>{num(metrics.harvestedWeightKg, 1)} kg</strong>
            · Loại thải: <strong>{num(metrics.culls)} con</strong> · Tiền bán: <strong>{money(finance.revenue)}</strong></p>
          {harvests.length === 0 ? <Empty>Chưa có dữ liệu</Empty> : <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>Ngày</th><th>Đàn</th><th>Số con</th><th>Khối lượng (kg)</th><th>Đơn giá (đ/kg)</th><th>Thành tiền</th><th>Ghi chú</th></tr></thead>
            <tbody>{harvests.map(item => <tr key={item.id}><td>{formatDay(item.movementDate)}</td><td>{item.flockCode}</td><td>{num(item.quantity)}</td><td>{num(item.weightKg, 2)}</td>
              <td>{num(item.unitPrice)}</td><td>{money(item.amount)}</td><td>{item.note || '—'}</td></tr>)}</tbody>
          </table></div>}
        </Card>}

        {history}
      </div>
    </div>;
  };

  return <FarmShiftLayout pageTitle={barn ? barn.name : 'Chi tiết chuồng'} showShortcuts
    breadcrumbs={[{ label: 'Quản lý khu nuôi', path: '/areas' }, ...(barn ? [{ label: barn.areaName, path: `/areas/${barn.areaId}` }] : [])]}>
    {loading ? <p className={styles.loading} role="status">Đang tải chi tiết chuồng...</p>
      : error ? <div role="alert" className={`${styles.card} ${styles.emptyCycle}`}><p>{error}</p>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => navigate('/barns')}>Về danh sách chuồng</button></div>
        : <>{header}{detail ? renderCycle() : renderNoCycle()}</>}
    {modal?.type === 'barn' && <BarnDialog barn={barn} areas={areas} onClose={() => setModal(null)} onSaved={done} />}
    {modal?.type === 'program' && <ProgramDialog cycleId={cycle.id} attachedIds={modal.attachedIds} onClose={() => setModal(null)} onDone={done} />}
    {modal && !modal.type && <FormDialog key={modal.title} {...modal} onClose={() => setModal(null)} onDone={done} />}
  </FarmShiftLayout>;
};
