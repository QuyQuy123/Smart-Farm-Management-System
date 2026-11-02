import { useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Users } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { getBarnResponsibilities, inheritAreaWorkers, saveAreaWorkerAssignments, setBarnWorkers } from '../../services/workAssignmentService';
import { Dialog } from './FarmAreaDialogs';
import { apiErrorMessage } from './farmAreaOptions';
import styles from './BarnResponsibilities.module.css';

function WorkerNames({ workers }) {
  return <div className={styles.people}>{workers.map(worker => <span key={worker.id} className={styles.person}>
    <span className={styles.avatar} aria-hidden="true">{worker.fullName.trim().split(/\s+/).pop().slice(0, 1)}</span>{worker.fullName}
  </span>)}</div>;
}

function ResponsibilityDialog({ target, workers, onClose, onSaved }) {
  const { area, barn } = target;
  const [inherited, setInherited] = useState(Boolean(barn?.inherited));
  const [chosen, setChosen] = useState(() => new Set((barn || area).workers.map(worker => worker.id)));
  const [applyToAll, setApplyToAll] = useState(() => area.barns.every(item => item.inherited));
  const [barnSelections, setBarnSelections] = useState(() => Object.fromEntries(area.barns.map(item => [item.id, item.workers.map(worker => worker.id)])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Keep formerly assigned accounts visible so they can be removed after deactivation.
  const available = [...workers, ...(barn || area).workers.filter(worker => !workers.some(item => item.id === worker.id))];
  const toggle = id => setChosen(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      if (!barn) await saveAreaWorkerAssignments(area.id, {
        workerIds: [...chosen], applyToAll,
        barns: applyToAll ? [] : area.barns.map(item => ({ barnId: item.id, workerIds: barnSelections[item.id] })),
      });
      else if (inherited) await inheritAreaWorkers(barn.id);
      else await setBarnWorkers(barn.id, [...chosen]);
      onSaved();
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
      setSaving(false);
    }
  };
  return <Dialog title={`Công nhân phụ trách · ${(barn || area).name}`} labelId="responsibility-dialog-title" busy={saving} onClose={onClose} wide={!barn} className={styles.assignmentDialog}>
    <form onSubmit={submit}>
      <div className={styles.dialogBody}>
        <p className={styles.intro}>{barn ? `Thuộc ${area.name}. Chọn kế thừa hoặc phân công riêng cho chuồng này.`
          : 'Chọn công nhân của khu, sau đó áp dụng cho tất cả các chuồng hoặc phân công riêng ngay bên dưới.'}</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {barn && <fieldset className={styles.modes} disabled={saving}>
          <legend>Cách phân công</legend>
          <label><input type="radio" name="assignment-mode" checked={inherited} onChange={() => setInherited(true)} />Kế thừa từ khu nuôi</label>
          <label><input type="radio" name="assignment-mode" checked={!inherited} onChange={() => setInherited(false)} />Phân công riêng cho chuồng</label>
        </fieldset>}
        {barn && inherited ? <div className={styles.inheritance}>
          <p>Danh sách tự cập nhật theo {area.name}.</p>
          {area.workers.length ? <WorkerNames workers={area.workers} /> : <p>Khu nuôi chưa có công nhân phụ trách.</p>}
        </div> : <>
          <p className={styles.count}>Đã chọn {chosen.size} công nhân · Có thể chọn nhiều người</p>
          <ul className={styles.pickList}>{available.map(worker => {
            const active = workers.some(item => item.id === worker.id);
            return <li key={worker.id}><label className={chosen.has(worker.id) ? styles.selected : ''}>
              <input type="checkbox" checked={chosen.has(worker.id)} onChange={() => toggle(worker.id)} disabled={saving || (!active && !chosen.has(worker.id))} />
              <span><strong>{worker.fullName}</strong><small>{worker.email}{!active && ' · Không còn hoạt động, vui lòng bỏ chọn'}</small></span>
            </label></li>;
          })}</ul>
          {!available.length && <p className={styles.empty}>Chưa có tài khoản công nhân đang hoạt động. Thêm tại Tài khoản &amp; Nhân sự.</p>}
          {barn && chosen.size === 0 && <p className={styles.hint}>Lưu danh sách trống sẽ bỏ phân công {barn ? 'riêng của chuồng; chuồng sẽ không có người phụ trách' : 'của khu và các chuồng đang kế thừa'}.</p>}
        </>}
        {!barn && <section className={styles.areaOptions}>
          <label className={styles.switchRow}>
            <span><strong>Áp dụng cho tất cả các chuồng</strong><small>Dùng danh sách công nhân của khu cho toàn bộ {area.barns.length} chuồng.</small></span>
            <span className={styles.switchControl}>
              <span className={applyToAll ? styles.statusOn : styles.statusOff} aria-hidden="true">{applyToAll ? 'Đang bật' : 'Đang tắt'}</span>
              <span className={styles.switchHitArea}>
                <input type="checkbox" role="switch" aria-label="Áp dụng cho tất cả các chuồng" className={styles.switch} checked={applyToAll}
                  onChange={event => setApplyToAll(event.target.checked)} disabled={saving} />
                <span className={styles.switchTrack} aria-hidden="true"><span className={styles.switchThumb} /></span>
              </span>
            </span>
          </label>
          {applyToAll ? <div className={styles.applyPreview}>
            <p>Tất cả các chuồng sẽ kế thừa danh sách trên, thay thế phân công riêng hiện có. Chuồng mới cũng tự kế thừa.</p>
            {chosen.size > 0 && <WorkerNames workers={available.filter(worker => chosen.has(worker.id))} />}
            {chosen.size === 0 && <p>Chưa chọn công nhân. Lưu sẽ bỏ phân công ở tất cả các chuồng trong khu.</p>}
          </div> : <>
            <h3 className={styles.barnSectionTitle}>Phân công riêng từng chuồng</h3>
            <p className={styles.hint}>Chọn nhiều công nhân cho mỗi chuồng. Danh sách công nhân của khu được dùng làm mặc định cho chuồng tạo mới.</p>
            <div className={styles.barnSelections}>{area.barns.map(item => {
              const ids = barnSelections[item.id];
              const options = [...workers, ...item.workers.filter(worker => !workers.some(active => active.id === worker.id))];
              return <fieldset key={item.id} className={styles.barnSelection} disabled={saving}>
                <legend>{item.name}<span>{ids.length} công nhân</span></legend>
                <div className={styles.workerGrid}>{options.map(worker => {
                  const selected = ids.includes(worker.id);
                  const active = workers.some(person => person.id === worker.id);
                  return <label key={worker.id} className={selected ? styles.workerSelected : ''}>
                    <input type="checkbox" checked={selected} disabled={!active && !selected}
                      onChange={() => setBarnSelections(current => ({ ...current,
                        [item.id]: selected ? current[item.id].filter(id => id !== worker.id) : [...current[item.id], worker.id],
                      }))} />
                    <span>{worker.fullName}{!active && <small>Không còn hoạt động, vui lòng bỏ chọn</small>}</span>
                  </label>;
                })}</div>
                {!options.length && <p className={styles.hint}>Chưa có công nhân đang hoạt động.</p>}
                {ids.length === 0 && <p className={styles.hint}>Chuồng chưa có công nhân phụ trách.</p>}
              </fieldset>;
            })}</div>
            {!area.barns.length && <p className={styles.hint}>Khu chưa có chuồng. Chuồng tạo mới sẽ kế thừa công nhân của khu.</p>}
          </>}
        </section>}
      </div>
      <footer className={styles.footer}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={saving} onClick={onClose}>Hủy</button>
        <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={saving} aria-busy={saving}>{saving ? 'Đang lưu...' : 'Lưu phân công'}</button>
      </footer>
    </form>
  </Dialog>;
}

export function BarnResponsibilities({ canEdit }) {
  const { showToast } = useNotification();
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState(null);
  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    getBarnResponsibilities().then(data => { if (!cancelled) setState({ data, error: '', loading: false }); })
      .catch(error => { if (!cancelled) setState({ data: null, error: apiErrorMessage(error), loading: false }); });
    return () => { cancelled = true; };
  }, [canEdit, revision]);
  const refresh = () => { setState(current => ({ ...current, loading: true })); setRevision(current => current + 1); };
  const saved = () => { setTarget(null); showToast('Đã cập nhật công nhân phụ trách.', 'success'); refresh(); };
  if (!canEdit) return <div className="farmshift-card farmshift-card-body">Chỉ chủ trang trại có quyền quản lý phân công khu nuôi và chuồng nuôi.</div>;
  const { data, error, loading } = state;
  const assignment = (area, barn) => {
    const item = barn || area;
    return <div className={styles.assignment}>
      {item.workers.length > 0 && <WorkerNames workers={item.workers} />}
      <button type="button" className={styles.editButton} onClick={() => setTarget({ area, barn })}
        aria-label={`${item.workers.length ? 'Chỉnh sửa công nhân' : 'Thêm công nhân phụ trách'} · ${item.name}`}>
        {item.workers.length ? <><Pencil size={14} />Chỉnh sửa</> : <><Plus size={15} />Thêm công nhân phụ trách</>}
      </button>
    </div>;
  };
  return <section className="farmshift-card">
    <header className={`farmshift-card-header ${styles.header}`}>
      <div><h3 className="farmshift-card-title">Vai trò khu nuôi</h3>
        <p>Phân công cho cả khu nuôi, hoặc thiết lập riêng cho từng chuồng.</p></div>
      <span className={styles.summary}><Users size={16} />{data?.workers?.length || 0} công nhân đang hoạt động</span>
    </header>
    {loading ? <p role="status" className={styles.empty}>Đang tải phân công...</p>
      : error ? <div className={styles.empty}><p role="alert" className={styles.error}>{error}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={refresh}>Thử lại</button></div>
      : !data?.areas?.length ? <p className={styles.empty}>Chưa có khu nuôi. Thêm khu nuôi tại menu Khu nuôi để bắt đầu phân công.</p>
      : <div className="farmshift-table-container" style={{ border: 'none' }}><table className={`farmshift-table ${styles.table}`}>
        <thead><tr><th>Khu nuôi / Chuồng nuôi</th><th>Phạm vi phân công</th><th>Công nhân phụ trách</th></tr></thead>
        {data.areas.map(area => <tbody key={area.id}>
          <tr className={styles.areaRow}><th scope="row"><Building2 size={17} />{area.name}<small>{area.barns.length} chuồng nuôi</small></th>
            <td><span className={styles.scope}>Toàn khu nuôi</span></td><td>{assignment(area)}</td></tr>
          {area.barns.map(barn => <tr key={barn.id}><th scope="row" className={styles.barnName}>{barn.name}</th>
            <td><span className={barn.inherited ? styles.inherited : styles.custom}>{barn.inherited ? 'Kế thừa từ khu' : 'Phân công riêng'}</span></td>
            <td>{assignment(area, barn)}</td></tr>)}
          {!area.barns.length && <tr><td colSpan={3} className={styles.emptyArea}>Chưa có chuồng. Chuồng mới sẽ tự kế thừa công nhân của khu.</td></tr>}
        </tbody>)}
      </table></div>}
    {target && <ResponsibilityDialog target={target} workers={data.workers} onClose={() => setTarget(null)} onSaved={saved} />}
  </section>;
}
