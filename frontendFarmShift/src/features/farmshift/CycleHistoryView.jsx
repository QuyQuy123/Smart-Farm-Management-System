import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Eye, History, RotateCcw } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { listBarns, listFarmAreas } from '../../services/farmAreaService';
import { listPrograms } from '../../services/farmingProgramService';
import { listClosedCycleHistory } from '../../services/cycleService';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { ResponsiveDataTable } from '../../components/common/ResponsiveDataTable';
import { AreaTabs } from './AreaTabs';
import { apiErrorMessage, formatAmount, formatDay } from './farmAreaOptions';
import { formatBarnOption, sortBarnsForOperation } from '../../utils/selectFormatters';
import { flattenGroupedRows, groupClosedCycles } from '../../utils/cycleHistoryGroups';
import styles from './CycleHistoryView.module.css';

const money = value => (value == null ? '—' : `${Math.round(Number(value)).toLocaleString('vi-VN')}đ`);
const dec = (value, digits = 2) => (value == null ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits }));

const INITIAL_FILTERS = { areaId: '', barnId: '', programId: '', from: '', to: '', search: '' };

/**
 * Tổng hợp lịch sử toàn bộ các lứa nuôi đã kết thúc (CLOSED) trên toàn trại (OPS-03).
 * Tích hợp số đợt bệnh & tiền thuốc từ OPS-02; tự động ẩn mọi cột tài chính khi ROLE_FARM_WORKER.
 */
export function CycleHistoryView() {
  const { user } = useAuth();
  const canFinance = user?.role === 'ROLE_FARM_OWNER' || user?.role === 'ROLE_ACCOUNTANT';

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [revision, setRevision] = useState(0);
  const [viewMode, setViewMode] = useState('grouped');
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [areas, setAreas] = useState([]);
  const [barns, setBarns] = useState([]);
  const [programs, setPrograms] = useState([]);
  const requestKey = `${filters.areaId}|${filters.barnId}|${filters.programId}|${filters.from}|${filters.to}|${filters.search.trim()}|${revision}`;
  const [queryState, setQueryState] = useState({ key: null, rows: [], error: '' });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listFarmAreas().catch(() => []),
      listBarns().catch(() => []),
      listPrograms().catch(() => []),
    ]).then(([a, b, p]) => {
      if (cancelled) return;
      setAreas(Array.isArray(a) ? a : []);
      setBarns(Array.isArray(b) ? b : []);
      setPrograms(Array.isArray(p) ? p : []);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = {};
    if (filters.areaId) params.areaId = filters.areaId;
    if (filters.barnId) params.barnId = filters.barnId;
    if (filters.programId) params.programId = filters.programId;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.search.trim()) params.search = filters.search.trim();

    listClosedCycleHistory(params)
      .then(data => { if (!cancelled) setQueryState({ key: requestKey, rows: Array.isArray(data) ? data : [], error: '' }); })
      .catch(requestError => { if (!cancelled) setQueryState({ key: requestKey, rows: [], error: apiErrorMessage(requestError) }); });
    return () => { cancelled = true; };
  }, [filters, requestKey]);

  const loading = queryState.key !== requestKey;
  const { rows, error } = queryState;

  useRealtimeRefresh(
    ['/cycles', '/cycles/history', '/sales', '/sales-orders', '/diseases', '/barns', '/farm-areas'],
    () => setRevision(value => value + 1),
  );

  const visibleBarns = useMemo(
    () => (filters.areaId ? barns.filter(b => String(b.areaId) === String(filters.areaId)) : barns),
    [barns, filters.areaId],
  );

  const summary = useMemo(() => {
    const totalCycles = rows.length;
    const totalHarvested = rows.reduce((acc, r) => acc + Number(r.harvestedQuantity || 0), 0);
    const totalDiseases = rows.reduce((acc, r) => acc + Number(r.diseaseCount || 0), 0);
    const validFcrs = rows.filter(r => r.fcr != null).map(r => Number(r.fcr));
    const avgFcr = validFcrs.length ? validFcrs.reduce((a, b) => a + b, 0) / validFcrs.length : null;
    const totalDiseaseCost = canFinance ? rows.reduce((acc, r) => acc + Number(r.totalDiseaseMedicineCost || 0), 0) : null;
    const totalProfit = canFinance ? rows.reduce((acc, r) => acc + Number(r.profit || 0), 0) : null;
    return { totalCycles, totalHarvested, totalDiseases, avgFcr, totalDiseaseCost, totalProfit };
  }, [rows, canFinance]);

  const groupedItems = useMemo(() => groupClosedCycles(rows, canFinance), [rows, canFinance]);
  const hasTransferGroups = useMemo(() => groupedItems.some(item => item.isGroupRow), [groupedItems]);
  const tableRows = useMemo(() => (
    viewMode === 'grouped'
      ? flattenGroupedRows(groupedItems, expandedGroups)
      : rows.map(row => ({ ...row, isGroupRow: false, rowKey: String(row.cycleId) }))
  ), [viewMode, groupedItems, expandedGroups, rows]);

  const toggleGroup = key => setExpandedGroups(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const columns = useMemo(() => {
    const base = [
      {
        key: 'cycle',
        label: 'Lứa nuôi',
        primary: true,
        render: (_, row) => {
          if (row.isGroupRow) {
            const isOpen = expandedGroups.has(row.batchGroupKey);
            return <div className={styles.cycleTitle}>
              <div className={styles.groupRowHeader}>
                <button
                  type="button"
                  className={styles.groupRowBtn}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? 'Thu gọn' : 'Mở'} lô tách đàn ${row.barnNames.join(' + ')}`}
                  onClick={() => toggleGroup(row.batchGroupKey)}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <strong>Lô tách đàn ({row.members.length} chuồng)</strong>
                <span className={styles.groupBadge}>Gộp lô</span>
              </div>
              <small>{row.members.map(m => m.cycleCode).join(' + ')}{row.breeds?.length ? ` · ${row.breeds.join(', ')}` : ''}</small>
            </div>;
          }
          return <div className={`${styles.cycleTitle} ${row.isGroupChild ? styles.childIndent : ''}`}>
            <strong>{row.isGroupChild ? `↳ Lứa thứ ${row.cycleNumber}` : `Lứa thứ ${row.cycleNumber}`}</strong>
            <small>{row.cycleCode}{row.breeds?.length ? ` · ${row.breeds.join(', ')}` : ''}</small>
            {row.transferLinks?.length > 0 && <div className={styles.transferBadges}>
              {row.transferLinks.map(link => (
                <span key={`${link.direction}-${link.cycleId}`} className={styles.transferBadge}>
                  {link.direction === 'IN' ? `Tách từ ${link.barnName} (${link.cycleCode})` : `Tách sang ${link.barnName} (${link.cycleCode})`}
                </span>
              ))}
            </div>}
          </div>;
        },
      },
      {
        key: 'location',
        label: 'Khu / Chuồng',
        render: (_, row) => {
          if (row.isGroupRow) {
            return <>
              <strong>{row.barnNames.join(' + ')}</strong>
              <span className={styles.sub}>{row.areaNames.join(', ') || '—'}</span>
            </>;
          }
          return <>
            <strong>{row.barnName}</strong>
            <span className={styles.sub}>{row.areaName || '—'}</span>
          </>;
        },
      },
      {
        key: 'dates',
        label: 'Bắt đầu – Kết thúc',
        render: (_, row) => <>
          <span>{formatDay(row.startDate)} – {formatDay(row.endDate)}</span>
          <span className={styles.sub}>{row.durationDays} ngày nuôi</span>
        </>,
      },
      {
        key: 'birds',
        label: 'Nhập / Xuất / Sống',
        render: (_, row) => <>
          <span>{formatAmount(row.totalIn)} / {formatAmount(row.harvestedQuantity)} con</span>
          <span className={styles.sub}>Tỷ lệ sống: {row.survivalRate != null ? `${dec(row.survivalRate, 2)}%` : '—'}</span>
        </>,
      },
      {
        key: 'fcr',
        label: 'FCR',
        render: (_, row) => <strong>{dec(row.fcr, 2)}</strong>,
      },
      {
        key: 'avgWeight',
        label: 'TL TB xuất (kg)',
        render: (_, row) => <>
          <span>{dec(row.avgHarvestWeightKg, 3)} kg</span>
          <span className={styles.sub}>Sản lượng: {dec(row.harvestedWeightKg, 1)} kg</span>
        </>,
      },
      {
        key: 'disease',
        label: canFinance ? 'Đợt bệnh & Tiền thuốc' : 'Đợt bệnh',
        render: (_, row) => <>
          <span className={row.diseaseCount > 0 ? styles.diseaseBadge : styles.cleanBadge}>
            {row.diseaseCount > 0 ? `${row.diseaseCount} đợt bệnh` : 'Không ghi nhận'}
          </span>
          {canFinance && <span className={styles.sub}>Tiền thuốc: {money(row.totalDiseaseMedicineCost)}</span>}
        </>,
      },
    ];

    if (canFinance) {
      base.push({
        key: 'profit',
        label: 'Lãi / Lỗ thực hiện',
        render: (_, row) => {
          const val = Number(row.profit || 0);
          return <>
            <strong className={val >= 0 ? styles.profitPos : styles.profitNeg}>{money(row.profit)}</strong>
            <span className={styles.sub}>Giá vốn: {row.costPerKg != null ? `${money(row.costPerKg)}/kg` : '—'}</span>
          </>;
        },
      });
    }

    base.push({
      key: 'actions',
      label: 'Chi tiết',
      isAction: true,
      render: (_, row) => {
        if (row.isGroupRow) {
          const isOpen = expandedGroups.has(row.batchGroupKey);
          return <button type="button" className={styles.detailLink} onClick={() => toggleGroup(row.batchGroupKey)}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {isOpen ? 'Thu gọn' : `Xem ${row.members.length} chuồng`}
          </button>;
        }
        return <Link to={`/barns/${row.barnId}?cycle=${row.cycleId}`} className={styles.detailLink}>
          <Eye size={14} />Xem chi tiết
        </Link>;
      },
    });

    return base;
  }, [canFinance, expandedGroups]);

  const setFilter = (key, value) => setFilters(current => {
    if (key === 'areaId') return { ...current, areaId: value, barnId: '' };
    return { ...current, [key]: value };
  });

  const hasFilters = Object.values(filters).some(Boolean);

  const isAccountant = user?.role === 'ROLE_ACCOUNTANT';
  const breadcrumbs = isAccountant
    ? [{ label: 'Bảng tin', path: '/dashboard' }, { label: 'Lịch sử lứa nuôi' }]
    : [{ label: 'Quản lý khu nuôi', path: '/areas' }, { label: 'Lịch sử lứa nuôi' }];

  return <FarmShiftLayout pageTitle="Lịch sử lứa nuôi toàn trại" breadcrumbs={breadcrumbs}>
    {!isAccountant && <AreaTabs areas={areas} active="history" />}

    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h2><History size={20} />Tổng hợp lịch sử lứa nuôi đã kết thúc</h2>
          <p>So sánh hiệu quả kỹ thuật, tỷ lệ sống, FCR, lịch sử đợt bệnh{canFinance ? ' và lãi/lỗ thực hiện' : ''} của tất cả lứa nuôi đã chốt toàn trại.</p>
        </div>
        {hasTransferGroups && (
          <div className={styles.viewToggle} role="group" aria-label="Chế độ xem lịch sử lứa">
            <button
              type="button"
              className={viewMode === 'grouped' ? styles.viewToggleActive : ''}
              onClick={() => setViewMode('grouped')}
            >
              Gộp theo lô tách đàn
            </button>
            <button
              type="button"
              className={viewMode === 'flat' ? styles.viewToggleActive : ''}
              onClick={() => setViewMode('flat')}
            >
              Xem từng chuồng
            </button>
          </div>
        )}
      </header>

      <section className={styles.filterBar} aria-label="Bộ lọc lịch sử lứa nuôi">
        <div className={styles.filterField}>
          <label htmlFor="hist-area">Khu nuôi</label>
          <select id="hist-area" className="farmshift-form-control" value={filters.areaId} onChange={e => setFilter('areaId', e.target.value)}>
            <option value="">Tất cả khu nuôi</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="hist-barn">Chuồng nuôi</label>
          <select id="hist-barn" className="farmshift-form-control" value={filters.barnId} onChange={e => setFilter('barnId', e.target.value)}>
            <option value="">Tất cả chuồng</option>
            {sortBarnsForOperation(visibleBarns).map(b => <option key={b.id} value={b.id}>{formatBarnOption(b)}</option>)}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="hist-program">Chương trình / Giống</label>
          <select id="hist-program" className="farmshift-form-control" value={filters.programId} onChange={e => setFilter('programId', e.target.value)}>
            <option value="">Tất cả chương trình</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.breed})</option>)}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="hist-from">Kết thúc từ ngày</label>
          <input id="hist-from" type="date" className="farmshift-form-control" value={filters.from} onChange={e => setFilter('from', e.target.value)} />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="hist-to">Đến ngày</label>
          <input id="hist-to" type="date" className="farmshift-form-control" value={filters.to} onChange={e => setFilter('to', e.target.value)} />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="hist-search">Tìm kiếm</label>
          <input id="hist-search" className="farmshift-form-control" placeholder="Mã lứa, chuồng, giống..." value={filters.search}
            onChange={e => setFilter('search', e.target.value)} />
        </div>
        {hasFilters && <div className={styles.filterActions}>
          <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setFilters(INITIAL_FILTERS)}>
            <RotateCcw size={14} />Đặt lại
          </button>
        </div>}
      </section>

      <section className={styles.kpis} aria-label="Tổng quan lịch sử lứa">
        <div className={styles.kpi}><span>Tổng lứa đã kết thúc</span><strong>{formatAmount(summary.totalCycles)} lứa</strong></div>
        <div className={styles.kpi}><span>Tổng gà xuất bán</span><strong>{formatAmount(summary.totalHarvested)} con</strong></div>
        <div className={styles.kpi}><span>FCR trung bình</span><strong>{dec(summary.avgFcr, 2)}</strong></div>
        <div className={styles.kpi}><span>Tổng đợt bệnh ghi nhận</span><strong>{formatAmount(summary.totalDiseases)} đợt</strong></div>
        {canFinance && <div className={styles.kpi}><span>Tổng tiền thuốc bệnh án</span><strong>{money(summary.totalDiseaseCost)}</strong></div>}
        {canFinance && <div className={styles.kpi}>
          <span>Tổng lãi / lỗ thực hiện</span>
          <strong className={(summary.totalProfit || 0) >= 0 ? styles.profitPos : styles.profitNeg}>{money(summary.totalProfit)}</strong>
        </div>}
      </section>

      <section className={styles.tableCard}>
        {loading ? <p className={styles.empty} role="status">Đang tải lịch sử lứa nuôi...</p>
          : error ? <p className={styles.error} role="alert">{error}</p>
            : tableRows.length === 0 ? <p className={styles.empty}>Không có lứa nuôi đã kết thúc nào khớp bộ lọc.</p>
              : <ResponsiveDataTable columns={columns} data={tableRows} rowKey="rowKey" />}
      </section>
    </div>
  </FarmShiftLayout>;
}
