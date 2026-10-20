import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useAuth } from '../../context/AuthContext';
import { getFarmDailyPlan } from '../../services/dailyPlanService';
import { DailyPlanCard } from './DailyPlanCard';
import { useDailyPlanActions } from './useDailyPlanActions';
import { addDaysIso, apiErrorMessage, formatDay, todayIso } from './farmAreaOptions';
import styles from './TodayTasksView.module.css';

/**
 * Việc hôm nay: phiếu việc của mọi chuồng đang nuôi, tính từ chương trình nuôi × số con còn lại.
 * Công nhân chỉ bấm "Xong"; hệ thống tự trừ kho và ghi chi phí. Xem lại / làm bù được các ngày trước.
 */
export const TodayTasksView = () => {
  const { user } = useAuth();
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [hideDone, setHideDone] = useState(false);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: null, plans: [], error: '' });
  const requestKey = `${date}:${revision}`;

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

  return <FarmShiftLayout pageTitle="Việc hôm nay" breadcrumbs={[{ label: 'Việc hôm nay' }]}>
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
        <label className={styles.toggle}><input type="checkbox" checked={hideDone} onChange={event => setHideDone(event.target.checked)} />Ẩn việc đã xong</label>
      </div>
    </div>

    {loading ? <p className={styles.state} role="status">Đang tải phiếu việc...</p>
      : state.error ? <div className={styles.state} role="alert"><p>{state.error}</p>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        : state.plans.length === 0 ? <p className={styles.state}>Không có chuồng nào đang nuôi theo chương trình trong ngày {formatDay(date)}.</p>
          : <div className={styles.list}>
            {state.plans.map(plan => <DailyPlanCard key={plan.cycleId} plan={plan} userEmail={user?.email} role={user?.role}
              busyKey={busyKey} onConfirm={confirm} onUndo={undo} hideDone={hideDone} />)}
          </div>}
  </FarmShiftLayout>;
};
