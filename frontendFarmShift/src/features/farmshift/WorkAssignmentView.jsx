import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, Circle, Clock, MapPinned, Pencil, Plus, Trash2, UserCog, Users, Warehouse } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { deleteWorkTask, getWorkBoard, setBarnWorkers, createWorkTask, updateWorkTask } from '../../services/workAssignmentService';
import { FormDialog } from './CycleDialogs';
import { Dialog } from './FarmAreaDialogs';
import { apiErrorMessage, formatAmount, formatDay, todayIso } from './farmAreaOptions';
import styles from './WorkAssignmentView.module.css';

/** Việc chăm sóc hay giao, để chủ trại bấm chọn nhanh khi giao việc. */
const COMMON_TASKS = ['Rửa máng uống', 'Thay / rắc thêm trấu', 'Sát trùng lối đi, hố sát trùng', 'Kiểm tra quạt, đèn sưởi', 'Dọn phân, đảo đệm lót'];
const time = value => (value ? String(value).slice(0, 5) : '');
const initial = name => String(name || '?').trim().charAt(0).toUpperCase();

/** Tình trạng một chuồng trên sơ đồ: chưa có người phụ trách / còn việc giao / đã xong việc giao / chưa giao việc. */
const barnState = barn => {
  if (barn.activeCycleId && barn.workers.length === 0) return 'unassigned';
  if (barn.tasks.length === 0) return 'idle';
  return barn.tasks.every(task => task.done) ? 'done' : 'pending';
};
const STATE_LABELS = { unassigned: 'Chưa có người phụ trách', pending: 'Còn việc giao', done: 'Đã xong việc giao', idle: 'Chưa giao việc' };

/** Gom chuồng theo khu, giữ thứ tự khu như danh sách chuồng. */
const groupAreas = barns => {
  const areas = new Map();
  barns.forEach(barn => {
    if (!areas.has(barn.areaId)) areas.set(barn.areaId, { areaId: barn.areaId, areaName: barn.areaName, barns: [] });
    areas.get(barn.areaId).barns.push(barn);
  });
  return [...areas.values()].map(area => {
    const tasks = area.barns.flatMap(barn => barn.tasks);
    const workers = [...new Map(area.barns.flatMap(barn => barn.workers).map(worker => [worker.id, worker])).values()];
    return { ...area, workers, taskCount: tasks.length, doneCount: tasks.filter(task => task.done).length,
      headcount: area.barns.reduce((sum, barn) => sum + barn.headcount, 0),
      unassigned: area.barns.filter(barn => barnState(barn) === 'unassigned').length };
  });
};

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
 * Tab "Phân công" trong màn Việc hôm nay (chủ trại): công nhân phụ trách từng chuồng và việc giao thêm hằng ngày.
 * Ngày do màn Việc hôm nay chọn. Công nhân chỉ thấy phiếu việc và việc được giao của chuồng mình phụ trách.
 */
export function WorkAssignmentPanel({ date }) {
  const { showToast } = useNotification();
  const today = todayIso();
  const [revision, setRevision] = useState(0);
  const [workerFilter, setWorkerFilter] = useState(null);
  const [areaId, setAreaId] = useState(null);
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
  const ofWorker = barn => !workerFilter || barn.workers.some(worker => worker.id === workerFilter)
    || barn.tasks.some(task => task.assignee.id === workerFilter);
  const areas = board ? groupAreas(board.barns) : [];
  const area = areas.find(item => item.areaId === areaId);
  const barns = !board || !area ? [] : area.barns.filter(ofWorker);
  const shownAreas = areas.filter(item => item.barns.some(ofWorker));
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

  return <>
    {board && <div className={styles.stats}>
      <span><strong>{allTasks.filter(task => task.done).length}/{allTasks.length}</strong> việc giao đã xong · {formatDay(date)}</span>
      {unassigned > 0 && <span className={styles.alert}>{unassigned} chuồng đang nuôi chưa có người phụ trách</span>}
    </div>}

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

          {!area ? <div className={styles.areaMap} aria-label="Sơ đồ khu nuôi">
            {shownAreas.length === 0 ? <p className={styles.state}>Công nhân này chưa phụ trách chuồng nào.</p> : shownAreas.map(item => <button
              key={item.areaId} type="button" className={styles.areaCard} onClick={() => setAreaId(item.areaId)} aria-label={`Mở khu ${item.areaName}`}>
              <span className={styles.areaHead}>
                <span className={styles.areaIcon}><MapPinned size={20} /></span>
                <span className={styles.areaTitle}><strong>{item.areaName}</strong>
                  <small>{item.barns.length} chuồng · {formatAmount(item.headcount)} con đang nuôi</small></span>
                <ChevronRight size={20} className={styles.areaChevron} />
              </span>
              <span className={styles.plan}>{item.barns.map(barn => {
                const status = barnState(barn);
                return <span key={barn.barnId} className={`${styles.tile} ${styles[`tile_${status}`]} ${ofWorker(barn) ? '' : styles.tileDim}`}
                  title={`${barn.barnName}: ${STATE_LABELS[status]}`}>
                  <span className={styles.tileName}>{barn.barnName}</span>
                  <span className={styles.tileFoot}>
                    <span className={styles.tileWorkers}>{barn.workers.length ? barn.workers.map(worker => <i key={worker.id}>{initial(worker.fullName)}</i>) : '—'}</span>
                    {barn.tasks.length > 0 && <span className={styles.tileTasks}>{barn.tasks.filter(task => task.done).length}/{barn.tasks.length}</span>}
                  </span>
                </span>;
              })}</span>
              <span className={styles.areaFoot}>
                <span>{item.workers.length ? item.workers.map(worker => worker.fullName).join(', ') : 'Chưa phân công'}</span>
                <span className={styles.areaStats}>{item.unassigned > 0 && <em>{item.unassigned} chuồng chưa có người</em>}
                  việc giao {item.doneCount}/{item.taskCount}</span>
              </span>
            </button>)}
            <p className={styles.legend}>
              {Object.entries(STATE_LABELS).map(([key, label]) => <span key={key}><i className={styles[`tile_${key}`]} />{label}</span>)}
            </p>
          </div> : <div className={styles.areaView}>
          <div className={styles.areaBar}>
            <button type="button" className={styles.ghost} onClick={() => setAreaId(null)}><ArrowLeft size={16} />Sơ đồ khu</button>
            <h3>{area.areaName}</h3>
            <small>{area.barns.length} chuồng · việc giao {area.doneCount}/{area.taskCount}</small>
          </div>
          <div className={styles.barns}>
            {barns.length === 0 ? <p className={styles.state}>Công nhân này không phụ trách chuồng nào trong khu.</p> : barns.map(barn => <section key={barn.barnId} className={styles.barn}
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
        </div>}

    {modal?.kind === 'workers' && <BarnWorkersDialog barn={modal.barn} workers={board.workers} onClose={() => setModal(null)} onSaved={done} />}
    {modal?.kind === 'form' && <FormDialog key={modal.title} {...modal} onClose={() => setModal(null)} onDone={done} />}
  </>;
}
