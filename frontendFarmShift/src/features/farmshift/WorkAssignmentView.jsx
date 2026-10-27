import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, Pencil, Plus, Trash2, UserCog, Users, Warehouse } from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { useNotification } from '../../context/NotificationContext';
import { deleteWorkTask, getWorkBoard, setBarnWorkers, createWorkTask, updateWorkTask } from '../../services/workAssignmentService';
import { FormDialog } from './CycleDialogs';
import { Dialog } from './FarmAreaDialogs';
import { addDaysIso, apiErrorMessage, formatAmount, formatDay, todayIso } from './farmAreaOptions';
import styles from './WorkAssignmentView.module.css';

/** Việc chăm sóc hay giao, để chủ trại bấm chọn nhanh khi giao việc. */
const COMMON_TASKS = ['Rửa máng uống', 'Thay / rắc thêm trấu', 'Sát trùng lối đi, hố sát trùng', 'Kiểm tra quạt, đèn sưởi', 'Dọn phân, đảo đệm lót'];
const time = value => (value ? String(value).slice(0, 5) : '');

/** Chọn nhiều công nhân phụ trách một chuồng. */
function BarnWorkersDialog({ barn, workers, onClose, onSaved }) {
  const [chosen, setChosen] = useState(() => new Set(barn.workers.map(worker => worker.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toggle = id => setChosen(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await setBarnWorkers(barn.barnId, [...chosen]);
      onSaved(`Đã cập nhật công nhân phụ trách ${barn.barnName}.`);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
      setSaving(false);
    }
  };
  return <Dialog title={`Phân công chuồng ${barn.barnName}`} labelId="barn-workers-title" busy={saving} onClose={onClose}>
    <div className={styles.dialogBody}>
      <p className={styles.dialogIntro}>Chọn công nhân phụ trách chuồng. Họ sẽ thấy phiếu việc của chuồng này ở mục Việc hôm nay.</p>
      {error && <p role="alert" className={styles.dialogError}>{error}</p>}
      {workers.length === 0 ? <p className={styles.empty}>Chưa có tài khoản công nhân. Thêm ở Tài khoản &amp; Nhân sự.</p>
        : <ul className={styles.pickList}>{workers.map(worker => <li key={worker.id}>
          <label className={chosen.has(worker.id) ? styles.picked : ''}>
            <input type="checkbox" checked={chosen.has(worker.id)} onChange={() => toggle(worker.id)} disabled={saving} />
            <span><strong>{worker.fullName}</strong><small>{worker.email} · đang phụ trách {worker.barnCount} chuồng</small></span>
          </label>
        </li>)}</ul>}
    </div>
    <footer className={styles.dialogFooter}>
      <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>Bỏ qua</button>
      <button type="button" className={`farmshift-btn ${styles.primary}`} onClick={save} disabled={saving} aria-busy={saving}>
        {saving ? 'Đang lưu...' : `Lưu (${chosen.size} người)`}</button>
    </footer>
  </Dialog>;
}

/**
 * Phân công công việc (chủ trại): công nhân phụ trách từng chuồng và việc giao thêm hằng ngày.
 * Công nhân chỉ thấy phiếu việc và việc được giao của chuồng mình phụ trách ở mục Việc hôm nay.
 */
export const WorkAssignmentView = () => {
  const { showToast } = useNotification();
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [revision, setRevision] = useState(0);
  const [workerFilter, setWorkerFilter] = useState(null);
  const [state, setState] = useState({ key: null, board: null, error: '' });
  const [modal, setModal] = useState(null);
  const requestKey = `${date}:${revision}`;

  useEffect(() => {
    let cancelled = false;
    getWorkBoard(date)
      .then(board => { if (!cancelled) setState({ key: requestKey, board, error: '' }); })
      .catch(error => { if (!cancelled) setState({ key: requestKey, board: null, error: apiErrorMessage(error) }); });
    return () => { cancelled = true; };
  }, [date, requestKey]);

  const loading = state.key !== requestKey;
  const board = state.board;
  const done = message => { setModal(null); showToast(message, 'success'); setRevision(value => value + 1); };
  const barns = !board ? [] : board.barns.filter(barn => !workerFilter || barn.workers.some(worker => worker.id === workerFilter)
    || barn.tasks.some(task => task.assignee.id === workerFilter));
  const allTasks = board ? board.barns.flatMap(barn => barn.tasks) : [];
  const unassigned = board ? board.barns.filter(barn => barn.activeCycleId && barn.workers.length === 0).length : 0;

  const openTask = (barn, task) => {
    if (barn.workers.length === 0) {
      showToast(`Chuồng ${barn.barnName} chưa có công nhân phụ trách. Hãy phân công trước khi giao việc.`, 'error');
      return;
    }
    const editing = Boolean(task);
    setModal({
      kind: 'form',
      title: editing ? `Sửa việc · ${barn.barnName}` : `Giao việc · ${barn.barnName}`,
      intro: 'Việc hiện trong phiếu việc của chuồng ở mục Việc hôm nay; công nhân bấm Xong khi làm xong. Đặt "Lặp đến ngày" để giao việc mỗi ngày.',
      initial: editing
        ? { assigneeId: String(task.assignee.id), taskTitle: task.title, dueTime: time(task.dueTime), startDate: task.startDate, endDate: task.endDate === task.startDate ? '' : task.endDate, note: task.note || '' }
        : { assigneeId: String(barn.workers[0].id), taskTitle: '', dueTime: '', startDate: date < today ? today : date, endDate: '', note: '' },
      fields: [
        { key: 'assigneeId', label: 'Công nhân', type: 'select', required: true, options: barn.workers.map(worker => ({ value: String(worker.id), label: worker.fullName })) },
        { key: 'dueTime', label: 'Giờ làm', type: 'time', hint: 'Không bắt buộc.' },
        // Khóa không đặt là 'title' vì FormDialog dùng id cycle-form-title cho tiêu đề hộp thoại.
        { key: 'taskTitle', label: 'Tên công việc', required: true, full: true, placeholder: `Ví dụ: ${COMMON_TASKS.slice(0, 3).join(', ')}` },
        { key: 'startDate', label: 'Ngày làm', type: 'date', required: true, min: editing ? undefined : today },
        { key: 'endDate', label: 'Lặp mỗi ngày đến', type: 'date', min: today, hint: 'Để trống nếu chỉ làm trong ngày.' },
        { key: 'note', label: 'Ghi chú', type: 'textarea', full: true, placeholder: 'Hướng dẫn thêm cho công nhân' },
      ],
      validate: values => ({
        taskTitle: values.taskTitle.trim().length > 200 ? 'Tên công việc không quá 200 ký tự.' : undefined,
        endDate: values.endDate && values.endDate < values.startDate ? 'Ngày lặp đến phải từ ngày làm trở đi.' : undefined,
      }),
      onSubmit: async values => {
        const body = { barnId: barn.barnId, assigneeId: Number(values.assigneeId), title: values.taskTitle.trim(), note: values.note.trim(),
          startDate: values.startDate, endDate: values.endDate || null, dueTime: values.dueTime || null };
        if (editing) await updateWorkTask(task.id, body); else await createWorkTask(body);
        return editing ? `Đã cập nhật việc "${body.title}".` : `Đã giao việc "${body.title}" cho ${barn.workers.find(worker => String(worker.id) === values.assigneeId)?.fullName}.`;
      },
    });
  };
  const removeTask = task => setModal({
    kind: 'form', title: 'Xóa việc được giao', danger: true, submitLabel: 'Xóa việc',
    warning: `Xóa việc "${task.title}" của ${task.assignee.fullName}, kể cả các ngày đã làm xong.`,
    initial: {}, fields: [],
    onSubmit: async () => { await deleteWorkTask(task.id); return `Đã xóa việc "${task.title}".`; },
  });

  return <FarmShiftLayout pageTitle="Phân công công việc" breadcrumbs={[{ label: 'Quản lý khu nuôi', path: '/areas' }]}>
    <div className={styles.toolbar}>
      <div className={styles.dateNav}>
        <button type="button" className={styles.navButton} aria-label="Ngày trước" onClick={() => setDate(addDaysIso(date, -1))}><ChevronLeft size={18} /></button>
        <input type="date" aria-label="Ngày phân công" className="farmshift-form-control" value={date} onChange={event => event.target.value && setDate(event.target.value)} />
        <button type="button" className={styles.navButton} aria-label="Ngày sau" onClick={() => setDate(addDaysIso(date, 1))}><ChevronRight size={18} /></button>
        {date !== today && <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setDate(today)}>Hôm nay</button>}
      </div>
      {board && <div className={styles.stats}>
        <span><strong>{allTasks.filter(task => task.done).length}/{allTasks.length}</strong> việc giao đã xong · {formatDay(date)}</span>
        {unassigned > 0 && <span className={styles.alert}>{unassigned} chuồng đang nuôi chưa có người phụ trách</span>}
      </div>}
    </div>

    {loading ? <p className={styles.state} role="status">Đang tải phân công...</p>
      : state.error ? <div className={styles.state} role="alert"><p>{state.error}</p>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>
        : <div className={styles.layout}>
          <aside className={styles.workers} aria-label="Công nhân">
            <h3><Users size={18} />Công nhân</h3>
            <button type="button" className={`${styles.workerRow} ${!workerFilter ? styles.workerActive : ''}`} onClick={() => setWorkerFilter(null)}>
              <span className={styles.avatar}>∗</span><span><strong>Tất cả chuồng</strong><small>{board.barns.length} chuồng</small></span>
            </button>
            {board.workers.length === 0 && <p className={styles.empty}>Chưa có tài khoản công nhân.</p>}
            {board.workers.map(worker => <button key={worker.id} type="button" aria-pressed={workerFilter === worker.id}
              className={`${styles.workerRow} ${workerFilter === worker.id ? styles.workerActive : ''}`} onClick={() => setWorkerFilter(worker.id)}>
              <span className={styles.avatar}>{worker.fullName.trim().charAt(0).toUpperCase()}</span>
              <span><strong>{worker.fullName}</strong><small>{worker.barnCount} chuồng · việc giao {worker.doneCount}/{worker.taskCount}</small></span>
            </button>)}
          </aside>

          <div className={styles.barns}>
            {barns.length === 0 ? <p className={styles.state}>Công nhân này chưa phụ trách chuồng nào.</p> : barns.map(barn => <section key={barn.barnId} className={styles.barn}
              aria-label={`Phân công ${barn.barnName}`}>
              <header className={styles.barnHead}>
                <span className={styles.barnIcon}><Warehouse size={18} /></span>
                <div className={styles.barnTitle}>
                  <h3>{barn.barnName}</h3>
                  <small>{barn.areaName} · {barn.activeCycleId ? `đang nuôi ${formatAmount(barn.headcount)} con` : 'chưa có lứa nuôi'}</small>
                </div>
                <button type="button" className={styles.ghost} onClick={() => setModal({ kind: 'workers', barn })} aria-label={`Phân công ${barn.barnName}`}>
                  <UserCog size={16} />Phân công</button>
              </header>

              <div className={styles.assignees}>
                <span className={styles.label}>Phụ trách</span>
                {barn.workers.length === 0 ? <span className={styles.none}>Chưa có ai</span>
                  : barn.workers.map(worker => <span key={worker.id} className={styles.chip}>{worker.fullName}</span>)}
              </div>

              <div className={styles.taskHead}>
                <span className={styles.label}>Việc giao ngày {formatDay(date)}</span>
                <button type="button" className={`farmshift-btn ${styles.primary}`} onClick={() => openTask(barn)} aria-label={`Giao việc ${barn.barnName}`}>
                  <Plus size={16} />Giao việc</button>
              </div>
              {barn.tasks.length === 0 ? <p className={styles.noTask}>Chưa giao việc nào cho ngày này.</p>
                : <ul className={styles.tasks}>{barn.tasks.map(task => <li key={task.id} className={task.done ? styles.taskDone : ''}>
                  {task.done ? <CheckCircle2 size={20} className={styles.doneIcon} /> : <Circle size={20} className={styles.todoIcon} />}
                  <div className={styles.taskInfo}>
                    <strong>{task.title}</strong>
                    <small>
                      {task.dueTime && <><Clock size={13} /> {time(task.dueTime)} · </>}{task.assignee.fullName}
                      {task.endDate !== task.startDate && ` · lặp đến ${formatDay(task.endDate)}`}
                      {task.done ? ` · xong lúc ${new Date(task.done.doneAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </small>
                    {task.note && <small className={styles.note}>{task.note}</small>}
                  </div>
                  <div className={styles.taskActions}>
                    <button type="button" className={styles.icon} aria-label={`Sửa việc ${task.title}`} onClick={() => openTask(barn, task)}><Pencil size={15} /></button>
                    <button type="button" className={`${styles.icon} ${styles.danger}`} aria-label={`Xóa việc ${task.title}`} onClick={() => removeTask(task)}><Trash2 size={15} /></button>
                  </div>
                </li>)}</ul>}
            </section>)}
          </div>
        </div>}

    {modal?.kind === 'workers' && <BarnWorkersDialog barn={modal.barn} workers={board.workers} onClose={() => setModal(null)} onSaved={done} />}
    {modal?.kind === 'form' && <FormDialog key={modal.title} {...modal} onClose={() => setModal(null)} onDone={done} />}
  </FarmShiftLayout>;
};
