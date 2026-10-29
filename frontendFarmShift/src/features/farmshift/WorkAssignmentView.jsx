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
/** Tên gọi (chữ cuối của họ tên) cho gọn trên ô chuồng: "Nông Thị Hằng" → "Hằng". */
const givenName = name => String(name || '').trim().split(/\s+/).pop();

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
    return { ...area, taskCount: tasks.length, doneCount: tasks.filter(task => task.done).length,
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
  // Sơ đồ khu → bấm khu mở cả khu, bấm ô chuồng mở riêng chuồng đó.
  const [focus, setFocus] = useState({ areaId: null, barnId: null });
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
  const area = areas.find(item => item.areaId === focus.areaId);
  const focusBarn = area?.barns.find(barn => barn.barnId === focus.barnId);
  const barns = !area ? [] : focusBarn ? [focusBarn] : area.barns.filter(ofWorker);
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
          {/* Lọc theo công nhân: một dải chọn giống thanh Việc hôm nay / Phân công, mỗi người một dòng gọn. */}
          <div className={styles.workerBar}>
            <span className={styles.workerLabel}><Users size={16} />Lọc theo công nhân</span>
            <div className={styles.workers} role="group" aria-label="Công nhân">
              <button type="button" aria-pressed={!workerFilter} className={`${styles.workerRow} ${!workerFilter ? styles.workerActive : ''}`}
                onClick={() => setWorkerFilter(null)} title={`${board.barns.length} chuồng`}>
                <strong>Tất cả</strong><small>{board.barns.length} chuồng</small>
              </button>
              {board.workers.map(worker => <button key={worker.id} type="button" aria-pressed={workerFilter === worker.id}
                className={`${styles.workerRow} ${workerFilter === worker.id ? styles.workerActive : ''}`} onClick={() => setWorkerFilter(worker.id)}
                title={`${worker.fullName}: ${worker.barnCount} chuồng · việc giao ${worker.doneCount}/${worker.taskCount}`}>
                <span className={styles.avatar}>{worker.fullName.trim().charAt(0).toUpperCase()}</span>
                <strong>{worker.fullName}</strong><small>{worker.barnCount} chuồng</small>
                {worker.taskCount > 0 && <em className={styles.workerTasks}>{worker.doneCount}/{worker.taskCount}</em>}
              </button>)}
            </div>
            {board.workers.length === 0 && <p className={styles.empty}>Chưa có tài khoản công nhân.</p>}
          </div>

          {!area ? <div className={styles.areaMap} aria-label="Sơ đồ khu nuôi">
            {shownAreas.length === 0 ? <p className={styles.state}>Công nhân này chưa phụ trách chuồng nào.</p> : shownAreas.map(item => <section
              key={item.areaId} className={styles.areaCard} aria-label={`Khu ${item.areaName}`}>
              <button type="button" className={styles.areaHead} onClick={() => setFocus({ areaId: item.areaId, barnId: null })} aria-label={`Mở khu ${item.areaName}`}>
                <span className={styles.areaIcon}><MapPinned size={20} /></span>
                <span className={styles.areaTitle}><strong>{item.areaName}</strong>
                  <small>{item.barns.length} chuồng · {formatAmount(item.headcount)} con đang nuôi</small></span>
                <ChevronRight size={20} className={styles.areaChevron} />
              </button>
              <div className={styles.plan}>{item.barns.map(barn => {
                const status = barnState(barn);
                const names = barn.workers.map(worker => worker.fullName).join(', ');
                return <button key={barn.barnId} type="button" className={`${styles.tile} ${styles[`tile_${status}`]} ${ofWorker(barn) ? '' : styles.tileDim}`}
                  onClick={() => setFocus({ areaId: item.areaId, barnId: barn.barnId })} aria-label={`Mở chuồng ${barn.barnName}`}
                  title={`${barn.barnName}: ${STATE_LABELS[status]}${names ? ` · ${names}` : ''}`}>
                  <span className={styles.tileName}>{barn.barnName}</span>
                  <span className={styles.tileWorkers}>{barn.workers.length ? barn.workers.map(worker => givenName(worker.fullName)).join(', ') : 'Chưa có người'}</span>
                  <span className={styles.tileFoot}>
                    <span className={styles.tileCount}>{barn.workers.length > 0 && `${barn.workers.length} người`}</span>
                    {barn.tasks.length > 0 && <span className={styles.tileTasks}>{barn.tasks.filter(task => task.done).length}/{barn.tasks.length}</span>}
                  </span>
                </button>;
              })}</div>
              <div className={styles.areaFoot}>
                <span>{item.unassigned > 0 && <em>{item.unassigned} chuồng chưa có người phụ trách</em>}</span>
                <span className={styles.areaStats}>việc giao {item.doneCount}/{item.taskCount}</span>
              </div>
            </section>)}
            <p className={styles.legend}>
              {Object.entries(STATE_LABELS).map(([key, label]) => <span key={key}><i className={styles[`tile_${key}`]} />{label}</span>)}
            </p>
          </div> : <div className={styles.areaView}>
          <div className={styles.areaBar}>
            <button type="button" className={styles.ghost} onClick={() => setFocus({ areaId: null, barnId: null })}><ArrowLeft size={16} />Sơ đồ khu</button>
            <h3>{area.areaName}{focusBarn && ` › ${focusBarn.barnName}`}</h3>
            <small>{area.barns.length} chuồng · việc giao {area.doneCount}/{area.taskCount}</small>
          </div>
          {/* Chuyển nhanh giữa các chuồng trong khu, hoặc xem cả khu. */}
          <div className={styles.barnSwitch} role="tablist" aria-label={`Chuồng trong ${area.areaName}`}>
            <button type="button" role="tab" aria-selected={!focusBarn} className={!focusBarn ? styles.switchActive : ''}
              onClick={() => setFocus({ areaId: area.areaId, barnId: null })}>Cả khu ({area.barns.length})</button>
            {area.barns.map(barn => {
              const status = barnState(barn);
              return <button key={barn.barnId} type="button" role="tab" aria-selected={focusBarn?.barnId === barn.barnId}
                className={focusBarn?.barnId === barn.barnId ? styles.switchActive : ''} title={STATE_LABELS[status]}
                onClick={() => setFocus({ areaId: area.areaId, barnId: barn.barnId })}>
                <i className={styles[`tile_${status}`]} />{barn.barnName}
                {barn.tasks.length > 0 && <small>{barn.tasks.filter(task => task.done).length}/{barn.tasks.length}</small>}
              </button>;
            })}
          </div>
          <div className={`${styles.barns} ${focusBarn ? styles.barnsSingle : ''}`}>
            {barns.length === 0 ? <p className={styles.state}>Công nhân này không phụ trách chuồng nào trong khu.</p> : barns.map(barn => <section key={barn.barnId} className={`${styles.barn} ${focusBarn ? styles.book : ''}`}
              aria-label={`Phân công ${barn.barnName}`}>
              {/* Một chuồng đang mở: vẽ như cuốn sổ mở đôi, trang trái là chuồng và người phụ trách, trang phải là việc giao trong ngày. */}
              <div className={`${styles.page} ${styles.pageLeft}`}>
              <span className={styles.bookKicker}>Sổ giao việc</span>
              <header className={styles.barnHead}>
                <span className={styles.barnIcon}><Warehouse size={18} /></span>
                <div className={styles.barnTitle}>
                  <h3>{barn.barnName}</h3>
                  <small>{barn.areaName} · {barn.activeCycleId ? `đang nuôi ${formatAmount(barn.headcount)} con` : 'chưa có lứa nuôi'}</small>
                </div>
              </header>

              {/* Nút Phân công đứng cạnh danh sách người phụ trách, là thứ nó thay đổi. */}
              <div className={styles.assignees}>
                <div className={styles.assigneeHead}>
                  <span className={styles.label}>Phụ trách</span>
                  <button type="button" className={styles.ghost} onClick={() => setModal({ kind: 'workers', barn })} aria-label={`Phân công ${barn.barnName}`}>
                    <UserCog size={16} />Phân công</button>
                </div>
                <div className={styles.assigneeList}>
                  {barn.workers.length === 0 ? <span className={styles.none}>Chưa có ai</span>
                    : barn.workers.map(worker => <span key={worker.id} className={styles.chip}>{worker.fullName}</span>)}
                </div>
              </div>
              <p className={styles.bookStat}>
                <strong>{barn.tasks.filter(task => task.done).length}/{barn.tasks.length}</strong> việc đã xong
                <span>Ngày {formatDay(date)}</span>
              </p>
              </div>
              <div className={`${styles.page} ${styles.pageRight}`}>

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
              </div>
            </section>)}
          </div>
          </div>}
        </div>}

    {modal?.kind === 'workers' && <BarnWorkersDialog barn={modal.barn} workers={board.workers} onClose={() => setModal(null)} onSaved={done} />}
    {modal?.kind === 'form' && <FormDialog key={modal.title} {...modal} onClose={() => setModal(null)} onDone={done} />}
  </>;
}
