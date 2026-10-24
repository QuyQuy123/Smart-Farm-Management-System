import { useState } from 'react';
import { AlertTriangle, Check, RotateCcw, SlidersHorizontal, Syringe, Thermometer, Utensils, Pill, ClipboardCheck } from 'lucide-react';
import { METHODS, formatAmount, labelOf, todayIso } from './farmAreaOptions';
import styles from './DailyPlanCard.module.css';

const SECTIONS = [
  { category: 'FEED', label: 'Cho ăn', icon: Utensils },
  { category: 'VACCINE', label: 'Vắc-xin', icon: Syringe },
  { category: 'MEDICINE', label: 'Thuốc', icon: Pill },
  { category: 'TEMPERATURE', label: 'Nhiệt độ', icon: Thermometer },
  { category: 'WORK', label: 'Công việc', icon: ClipboardCheck },
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
export function DailyPlanCard({ plan, userEmail, role, busyKey, onConfirm, onUndo, showHeader = true, hideDone = false }) {
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const isOwner = role === 'ROLE_FARM_OWNER';
  const canAct = isOwner || role === 'ROLE_FARM_WORKER';
  const total = plan.tasks.length;
  const progress = total ? Math.round((plan.doneCount / total) * 100) : 0;
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

  return <section className={styles.card} aria-label={`Phiếu việc ${plan.barnName}`}>
    {showHeader && <header className={styles.header}>
      <div>
        <h3>{plan.barnName} <span>· {plan.areaName}</span></h3>
        <p>{formatAmount(plan.headcount)} con · ngày tuổi {ages.length > 1 ? `${ages[0]}–${ages[ages.length - 1]}` : ages[0] ?? '—'}
          {plan.flocks.length > 1 && ` · ${plan.flocks.length} đàn`}</p>
      </div>
      <div className={styles.progress} aria-label={`Đã xong ${plan.doneCount}/${total} việc`}>
        <strong>{plan.doneCount}/{total}</strong><span>việc</span>
        <div className={styles.bar}><i style={{ width: `${progress}%` }} /></div>
        {plan.doneCost != null && <small>Chi phí đã ghi: {money(plan.doneCost)}</small>}
      </div>
    </header>}

    {plan.warnings.length > 0 && <ul className={styles.warnings}>
      {plan.warnings.map(warning => <li key={warning}><AlertTriangle size={14} />{warning}</li>)}
    </ul>}

    {total === 0 ? <p className={styles.empty}>Không có việc theo chương trình nuôi cho ngày này.</p> : SECTIONS.map(section => {
      const tasks = plan.tasks.filter(task => task.category === section.category && !(hideDone && task.done));
      if (!tasks.length) return null;
      const Icon = section.icon;
      return <div key={section.category} className={styles.section}>
        <h4><Icon size={15} />{section.label}</h4>
        <ul>
          {tasks.map(task => {
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
                <small>
                  {[task.method && labelOf(METHODS, task.method), task.doseText, task.note].filter(Boolean).join(' · ')}
                  {task.shares.length > 1 && task.plannedQuantity != null && <> · {task.shares.map(share => `${share.flockCode}: ${formatAmount(share.plannedQuantity)} ${task.unit}`).join(', ')}</>}
                </small>
                {task.stockEnough === false && !done && <small className={styles.short}>Kho không đủ: còn {formatAmount(task.stockOnHand)} {task.stockUnit}</small>}
                {done && <small className={styles.doneLine}>
                  <Check size={13} />Xong lúc {time(done.doneAt)} · {done.doneBy}
                  {done.actualQuantity != null && (done.deviated || task.plannedQuantity == null || Number(done.actualQuantity) !== Number(task.plannedQuantity))
                    && ` · thực tế ${amountText(done.actualQuantity, task.unit, done.stockQuantity, task.stockUnit)}`}
                  {done.cost != null && Number(done.cost) > 0 && ` · ${money(done.cost)}`}
                  {done.note && ` · ${done.note}`}
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
          })}
        </ul>
      </div>;
    })}
  </section>;
}
