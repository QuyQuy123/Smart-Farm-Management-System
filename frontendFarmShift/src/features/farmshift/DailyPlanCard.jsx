import { useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, Clock, RotateCcw, SlidersHorizontal, Syringe, Thermometer, Utensils, Pill } from 'lucide-react';
import { METHODS, formatAmount, labelOf, todayIso } from './farmAreaOptions';
import styles from './DailyPlanCard.module.css';

const SECTIONS = [
  { category: 'FEED', label: 'Cho ăn', icon: Utensils },
  { category: 'VACCINE', label: 'Vắc-xin', icon: Syringe },
  { category: 'MEDICINE', label: 'Thuốc', icon: Pill },
  { category: 'TEMPERATURE', label: 'Nhiệt độ', icon: Thermometer },
];
const MEASURED = ['FEED', 'VACCINE', 'MEDICINE'];
const money = value => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const time = value => (value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');

const title = task => (task.category === 'FEED' && task.meal ? `Cữ ${task.meal}${task.mealsPerDay ? `/${task.mealsPerDay}` : ''} · ${task.name}` : task.name);

/** "50 kg = 2 Bao 25kg" — lượng cả chuồng kèm số đơn vị kho cần lấy. */
const amountText = (quantity, unit, stock, stockUnit) => {
  if (quantity == null) return null;
  const main = `${formatAmount(quantity)} ${unit || ''}`.trim();
  return stock != null && stockUnit ? `${main} = ${formatAmount(stock)} ${stockUnit}` : main;
};

/**
 * Phiếu việc một ngày của một chuồng. Công nhân bấm "Xong" khi làm đúng kế hoạch, "Khác kế hoạch" khi lượng thực tế khác
 * (bắt buộc ghi lý do nếu lệch nhiều). onConfirm / onUndo trả về thông báo lỗi (chuỗi) hoặc null khi thành công.
 */
export function DailyPlanCard({ plan, userEmail, role, busyKey, onConfirm, onUndo, onConfirmAssigned, onUndoAssigned, showHeader = true, hideDone = false, compact = false }) {
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const isOwner = role === 'ROLE_FARM_OWNER';
  const canAct = isOwner || role === 'ROLE_FARM_WORKER';
  const assigned = plan.assignedTasks || [];
  const total = plan.tasks.length + assigned.length;
  const doneTotal = plan.doneCount + assigned.filter(task => task.done).length;
  const progress = total ? Math.round((doneTotal / total) * 100) : 0;
  const ages = [...new Set(plan.flocks.map(flock => flock.ageDays))].sort((a, b) => a - b);

  const run = async (task, action) => {
    setErrors(current => ({ ...current, [task.key]: undefined }));
    const message = await action();
    if (message) setErrors(current => ({ ...current, [task.key]: message }));
    else if (editing?.key === task.key) setEditing(null);
  };
  const quickDone = task => run(task, () => onConfirm(plan, task, {}));
  const saveDifferent = task => run(task, () => onConfirm(plan, task, {
    actualQuantity: MEASURED.includes(task.category) && editing.quantity !== '' ? Number(editing.quantity) : undefined,
    note: editing.note.trim() || undefined,
  }));
  const undo = task => run(task, () => onUndo(plan, task));
  const canUndo = done => isOwner || (role === 'ROLE_FARM_WORKER' && done.doneBy === userEmail && plan.date === todayIso());
  // Việc được giao dùng khóa riêng ("A<id>") để báo lỗi / trạng thái đang lưu không lẫn với việc theo chương trình.
  const assignedKey = task => `A${task.id}`;
  const runAssigned = async (task, action) => {
    setErrors(current => ({ ...current, [assignedKey(task)]: undefined }));
    const message = await action();
    if (message) setErrors(current => ({ ...current, [assignedKey(task)]: message }));
  };

  // Lịch trong ngày: cữ ăn và việc giao có giờ xếp theo giờ; vắc-xin, thuốc, nhiệt độ và việc không hẹn giờ để ở "Trong ngày".
  const visible = task => !(hideDone && task.done);
  const slots = new Map();
  const slotAt = at => {
    if (!slots.has(at)) slots.set(at, { feed: [], assigned: [], meals: [] });
    return slots.get(at);
  };
  plan.tasks.filter(task => task.category === 'FEED' && task.time && visible(task)).forEach(task => {
    const slot = slotAt(task.time);
    slot.feed.push(task);
    if (task.meal && !slot.meals.includes(task.meal)) slot.meals.push(task.meal);
  });
  assigned.filter(task => task.dueTime && visible(task)).forEach(task => slotAt(String(task.dueTime).slice(0, 5)).assigned.push(task));
  const timeline = [...slots.entries()].sort(([a], [b]) => a.localeCompare(b));
  const allDay = SECTIONS.map(section => ({ ...section,
    tasks: plan.tasks.filter(task => task.category === section.category && !(task.category === 'FEED' && task.time) && visible(task)) }))
    .filter(section => section.tasks.length);
  const allDayAssigned = assigned.filter(task => !task.dueTime && visible(task));

  const renderTask = task => {
    const done = task.done;
    const busy = busyKey === `${plan.cycleId}:${task.key}`;
    const isEditing = editing?.key === task.key;
    const planned = amountText(task.plannedQuantity, task.unit, task.plannedStock, task.stockUnit);
    return <li key={task.key} className={`${styles.task} ${done ? styles.done : ''} ${done?.deviated ? styles.deviated : ''}`}>
      <div className={styles.info}>
        <strong>{title(task)}</strong>
        <span className={styles.amount}>
          {task.category === 'TEMPERATURE' ? `Giữ ${formatAmount(task.tempMin)} – ${formatAmount(task.tempMax)} °C` : planned || (MEASURED.includes(task.category) ? 'Chưa tính được lượng' : '')}
        </span>
        {/* Bản gọn (trang chuồng) ẩn liều lượng và phần chia theo đàn; xem đủ ở trang Việc hôm nay. */}
        {!compact && <small>
          {[task.method && labelOf(METHODS, task.method), task.doseText, task.note].filter(Boolean).join(' · ')}
          {task.shares.length > 1 && task.plannedQuantity != null && <> · {task.shares.map(share => `${share.flockCode}: ${formatAmount(share.plannedQuantity)} ${task.unit}`).join(', ')}</>}
        </small>}
        {task.stockEnough === false && !done && <small className={styles.short}>Kho không đủ: còn {formatAmount(task.stockOnHand)} {task.stockUnit}</small>}
        {done && <small className={styles.doneLine}>
          <Check size={13} />Xong lúc {time(done.doneAt)}{!compact && <>
          {` · ${done.doneBy}`}
          {done.actualQuantity != null && (done.deviated || task.plannedQuantity == null || Number(done.actualQuantity) !== Number(task.plannedQuantity))
            && ` · thực tế ${amountText(done.actualQuantity, task.unit, done.stockQuantity, task.stockUnit)}`}
          {done.cost != null && Number(done.cost) > 0 && ` · ${money(done.cost)}`}
          {done.note && ` · ${done.note}`}</>}
        </small>}
        {errors[task.key] && <small role="alert" className={styles.error}>{errors[task.key]}</small>}
        {isEditing && <div className={styles.editor}>
          {MEASURED.includes(task.category) && <label>Lượng thực tế ({task.unit || 'đơn vị'})
            <input type="number" min="0" step="0.001" inputMode="decimal" className="farmshift-form-control" value={editing.quantity}
              onChange={event => setEditing({ ...editing, quantity: event.target.value })} autoFocus /></label>}
          <label>Lý do / ghi chú
            <input className="farmshift-form-control" value={editing.note} maxLength={1000} placeholder="Ví dụ: gà bỏ ăn do nóng"
              onChange={event => setEditing({ ...editing, note: event.target.value })} /></label>
          <div className={styles.editorActions}>
            <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Hủy</button>
            <button type="button" className={`farmshift-btn ${styles.doneButton}`} onClick={() => saveDifferent(task)} disabled={busy}>Lưu</button>
          </div>
        </div>}
      </div>
      {canAct && <div className={styles.actions}>
        {done ? canUndo(done) && <button type="button" className={styles.undoButton} onClick={() => undo(task)} disabled={busy}
          aria-label={`Hoàn tác ${title(task)}`}><RotateCcw size={14} />Hoàn tác</button>
          : !isEditing && <>
            <button type="button" className={`farmshift-btn ${styles.doneButton}`} onClick={() => quickDone(task)} disabled={busy}
              aria-label={`Xong ${title(task)}`}><Check size={15} />{busy ? 'Đang lưu...' : 'Xong'}</button>
            <button type="button" className={styles.otherButton} disabled={busy} aria-label={`Khác kế hoạch ${title(task)}`}
              onClick={() => setEditing({ key: task.key, quantity: task.plannedQuantity == null ? '' : String(task.plannedQuantity), note: '' })}>
              <SlidersHorizontal size={13} />Khác kế hoạch</button>
          </>}
      </div>}
    </li>;
  };

  const renderAssigned = (task, tagged = false) => {
    const busy = busyKey === `${plan.cycleId}:${assignedKey(task)}`;
    const mine = isOwner || task.assignee.email === userEmail;
    // Chuồng chỉ có một người phụ trách và việc giao đúng người đó thì "Giao cho …" lặp lại phần Phụ trách ở đầu thẻ.
    const soleWorker = plan.workers?.length === 1 && plan.workers[0].id === task.assignee.id;
    const showTime = task.dueTime && !compact;
    return <li key={task.id} className={`${styles.task} ${task.done ? styles.done : ''}`}>
      <div className={styles.info}>
        <strong>{task.title}{tagged && <span className={styles.tag}>Việc được giao</span>}</strong>
        {(showTime || !soleWorker) && <small className={styles.assignedMeta}>
          {showTime && <><Clock size={13} />{String(task.dueTime).slice(0, 5)}{!soleWorker && ' · '}</>}{!soleWorker && `Giao cho ${task.assignee.fullName}`}
        </small>}
        {task.note && !compact && <small>{task.note}</small>}
        {task.done && <small className={styles.doneLine}><Check size={13} />Xong lúc {time(task.done.doneAt)}
          {!compact && ` · ${task.done.doneBy}`}{!compact && task.done.note && ` · ${task.done.note}`}</small>}
        {errors[assignedKey(task)] && <small role="alert" className={styles.error}>{errors[assignedKey(task)]}</small>}
      </div>
      {canAct && mine && onConfirmAssigned && <div className={styles.actions}>
        {task.done ? canUndo(task.done) && <button type="button" className={styles.undoButton} disabled={busy}
          onClick={() => runAssigned(task, () => onUndoAssigned(plan, task))} aria-label={`Hoàn tác ${task.title}`}><RotateCcw size={14} />Hoàn tác</button>
          : <button type="button" className={`farmshift-btn ${styles.doneButton}`} disabled={busy} aria-label={`Xong ${task.title}`}
            onClick={() => runAssigned(task, () => onConfirmAssigned(plan, task))}><Check size={15} />{busy ? 'Đang lưu...' : 'Xong'}</button>}
      </div>}
    </li>;
  };

  return <section className={`${styles.card} ${compact ? styles.compact : ''}`} aria-label={`Phiếu việc ${plan.barnName}`}>
    {showHeader && <header className={styles.header}>
      <div>
        <h3>{plan.barnName} <span>· {plan.areaName}</span></h3>
        <p>{formatAmount(plan.headcount)} con · ngày tuổi {ages.length > 1 ? `${ages[0]}–${ages[ages.length - 1]}` : ages[0] ?? '—'}
          {plan.flocks.length > 1 && ` · ${plan.flocks.length} đàn`}</p>
        {plan.workers && <p className={styles.workers}>Phụ trách: {plan.workers.length ? plan.workers.map(worker => worker.fullName).join(', ') : 'chưa phân công'}</p>}
      </div>
      <div className={styles.progress} aria-label={`Đã xong ${doneTotal}/${total} việc`}>
        <strong>{doneTotal}/{total}</strong><span>việc</span>
        <div className={styles.bar}><i style={{ width: `${progress}%` }} /></div>
        {plan.doneCost != null && <small>Chi phí đã ghi: {money(plan.doneCost)}</small>}
      </div>
    </header>}

    {plan.warnings.length > 0 && <ul className={styles.warnings}>
      {plan.warnings.map(warning => <li key={warning}><AlertTriangle size={14} />{warning}</li>)}
    </ul>}

    {plan.tasks.length === 0 && assigned.length === 0 ? <p className={styles.empty}>Không có việc cho ngày này.</p>
      : <div className={styles.schedule} aria-label="Lịch việc trong ngày">
        {(allDay.length > 0 || allDayAssigned.length > 0) && <div className={styles.slot}>
          <div className={`${styles.slotTime} ${styles.slotAllDay}`}><strong>Trong ngày</strong><small>không hẹn giờ</small></div>
          <div className={styles.slotTasks}>
            {allDay.map(section => {
              const Icon = section.icon;
              return <div key={section.category} className={styles.section}>
                <h4><Icon size={15} />{section.label}</h4>
                <ul>{section.tasks.map(renderTask)}</ul>
              </div>;
            })}
            {allDayAssigned.length > 0 && <div className={styles.section}>
              <h4><ClipboardCheck size={15} />Việc được giao</h4>
              <ul>{allDayAssigned.map(task => renderAssigned(task))}</ul>
            </div>}
          </div>
        </div>}
        {timeline.map(([at, slot]) => <div key={at} className={styles.slot}>
          <div className={styles.slotTime}><strong>{at}</strong>{slot.meals.length > 0 && <small><Utensils size={13} />Cữ {slot.meals.join(', ')}</small>}</div>
          <ul className={styles.slotTasks}>
            {slot.feed.map(renderTask)}
            {slot.assigned.map(task => renderAssigned(task, true))}
          </ul>
        </div>)}
      </div>}
  </section>;
}
