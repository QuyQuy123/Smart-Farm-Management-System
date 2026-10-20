import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, ChevronRight as Open, ListChecks, Warehouse } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { getFarmDailyPlan } from '../../services/dailyPlanService';
import { DailyPlanCard } from './DailyPlanCard';
import { useDailyPlanActions } from './useDailyPlanActions';
import { addDaysIso, apiErrorMessage, formatAmount, formatDay, todayIso } from './farmAreaOptions';
import styles from './TodayTasksView.module.css';

const ageText = plan => {
  const ages = [...new Set(plan.flocks.map(flock => flock.ageDays))].sort((a, b) => a - b);
  return ages.length ? `ngày tuổi ${ages.length > 1 ? `${ages[0]}–${ages[ages.length - 1]}` : ages[0]}` : '';
};

/**
 * Việc hôm nay: trước hết là danh sách chuồng đang nuôi với tiến độ trong ngày; bấm vào chuồng để mở phiếu việc của chuồng đó
 * (định mức chương trình nuôi × số con còn lại). Công nhân chỉ bấm "Xong"; hệ thống tự trừ kho và ghi chi phí.
 * Chuồng đang mở nằm trên URL (?cycle=) để quay lại / chia sẻ được.
 */
export const TodayTasksView = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [hideDone, setHideDone] = useState(false);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: null, plans: [], error: '' });
  const requestKey = `${date}:${revision}`;
  const openCycle = searchParams.get('cycle');

  useEffect(() => {
    let cancelled = false;
    getFarmDailyPlan(date)
      .then(plans => { if (!cancelled) setState({ key: requestKey, plans: Array.isArray(plans) ? plans : [], error: '' }); })
      .catch(error => { if (!cancelled) setState({ key: requestKey, plans: [], error: apiErrorMessage(error) }); });
    return () => { cancelled = true; };
  }, [date, requestKey]);

  const { busyKey, confirm, undo } = useDailyPlanActions(updated =>
    setState(current => ({ ...current, plans: current.plans.map(plan => (plan.cycleId === updated.cycleId ? updated : plan)) })));
  const loading = state.key !== requestKey;
  const tasks = state.plans.reduce((sum, plan) => sum + plan.tasks.length, 0);
  const done = state.plans.reduce((sum, plan) => sum + plan.doneCount, 0);
  const opened = state.plans.find(plan => String(plan.cycleId) === openCycle);
  const open = cycleId => {
    setSearchParams(cycleId ? { cycle: String(cycleId) } : {});
    if (typeof window.scrollTo === 'function' && !navigator.userAgent.includes('jsdom')) window.scrollTo({ top: 0 });
  };

  return <FarmShiftLayout pageTitle="Việc hôm nay" breadcrumbTitle={opened ? opened.barnName : 'Việc hôm nay'}
    breadcrumbs={[{ label: 'Quản lý khu nuôi', path: '/areas' }, ...(opened ? [{ label: 'Việc hôm nay', path: '/today-tasks' }] : [])]}>
    <div className={styles.toolbar}>
      <div className={styles.dateNav}>
        <button type="button" className={styles.navButton} aria-label="Ngày trước" onClick={() => setDate(addDaysIso(date, -1))}><ChevronLeft size={18} /></button>
        <input type="date" aria-label="Ngày làm việc" className="farmshift-form-control" value={date} max={today}
          onChange={event => event.target.value && event.target.value <= today && setDate(event.target.value)} />
        <button type="button" className={styles.navButton} aria-label="Ngày sau" disabled={date >= today} onClick={() => setDate(addDaysIso(date, 1))}><ChevronRight size={18} /></button>
        {date !== today && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setDate(today)}>Hôm nay</button>}
      </div>
      <div className={styles.summary}>
        <ListChecks size={18} />
        <span><strong>{done}/{tasks}</strong> việc đã xong · {state.plans.length} chuồng · {formatDay(date)}</span>
        {opened && <label className={styles.toggle}><input type="checkbox" checked={hideDone} onChange={event => setHideDone(event.target.checked)} />Ẩn việc đã xong</label>}
      </div>
    </div>

    {loading ? <p className={styles.state} role="status">Đang tải phiếu việc...</p>
      : state.error ? <div className={styles.state} role="alert"><p>{state.error}</p>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        : opened ? <div className={styles.detail}>
          <button type="button" className={styles.back} onClick={() => open(null)}><ArrowLeft size={16} />Tất cả chuồng</button>
          <DailyPlanCard plan={opened} userEmail={user?.email} role={user?.role} busyKey={busyKey} onConfirm={confirm} onUndo={undo} hideDone={hideDone} />
        </div>
          : state.plans.length === 0 ? <p className={styles.state}>Không có chuồng nào đang nuôi theo chương trình trong ngày {formatDay(date)}.</p>
            : <div className={styles.grid}>
              {state.plans.map(plan => {
                const total = plan.tasks.length;
                const percent = total ? Math.round((plan.doneCount / total) * 100) : 0;
                const left = total - plan.doneCount;
                return <button key={plan.cycleId} type="button" className={`${styles.barn} ${total && left === 0 ? styles.barnDone : ''}`}
                  onClick={() => open(plan.cycleId)} aria-label={`Mở việc chuồng ${plan.barnName}`}>
                  <span className={styles.barnHead}>
                    <span className={styles.barnIcon}><Warehouse size={18} /></span>
                    <span className={styles.barnName}><strong>{plan.barnName}</strong><small>{plan.areaName}</small></span>
                    <Open size={18} className={styles.chevron} />
                  </span>
                  <span className={styles.barnMeta}>{formatAmount(plan.headcount)} con · {ageText(plan)}{plan.flocks.length > 1 ? ` · ${plan.flocks.length} đàn` : ''}</span>
                  <span className={styles.barnProgress}>
                    <strong>{plan.doneCount}/{total}</strong> việc
                    <span className={styles.barnStatus}>{total === 0 ? 'Không có việc' : left === 0 ? 'Đã xong' : `Còn ${left} việc`}</span>
                  </span>
                  <span className={styles.bar}><i style={{ width: `${percent}%` }} /></span>
                  {plan.warnings.length > 0 && <span className={styles.barnWarn}><AlertTriangle size={14} />{plan.warnings.length} cảnh báo</span>}
                </button>;
              })}
            </div>}
  </FarmShiftLayout>;
};
