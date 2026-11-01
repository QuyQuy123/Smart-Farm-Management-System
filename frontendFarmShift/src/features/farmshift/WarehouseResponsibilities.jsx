import { useEffect, useState } from 'react';
import { Pencil, Plus, Users, Warehouse } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { getWarehouseResponsibilities, setWarehouseWorkers } from '../../services/warehouseResponsibilityService';
import { Dialog } from './FarmAreaDialogs';
import { apiErrorMessage } from './farmAreaOptions';
import styles from './BarnResponsibilities.module.css';

function WarehouseWorkersDialog({ warehouse, workers, onClose, onSaved }) {
  const [chosen, setChosen] = useState(() => new Set(warehouse.workers.map(worker => worker.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const available = [...workers, ...warehouse.workers.filter(worker => !workers.some(item => item.id === worker.id))];
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
      const saved = await setWarehouseWorkers(warehouse.id, [...chosen]);
      onSaved(warehouse.id, saved);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
      setSaving(false);
    }
  };
  return <Dialog title={`Công nhân phụ trách · ${warehouse.name}`} labelId="warehouse-workers-title" busy={saving} onClose={onClose} className={styles.assignmentDialog}>
    <form onSubmit={submit}>
      <div className={styles.dialogBody}>
        <p className={styles.intro}>Chọn công nhân phụ trách kho này. Một kho có thể có nhiều công nhân; một công nhân có thể phụ trách nhiều kho.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <p className={styles.count}>Đã chọn {chosen.size} công nhân · Có thể chọn nhiều người</p>
        <ul className={styles.pickList}>{available.map(worker => {
          const active = workers.some(item => item.id === worker.id);
          return <li key={worker.id}><label className={chosen.has(worker.id) ? styles.selected : ''}>
            <input type="checkbox" checked={chosen.has(worker.id)} onChange={() => toggle(worker.id)} disabled={saving || (!active && !chosen.has(worker.id))} />
            <span><strong>{worker.fullName}</strong><small>{worker.email}{!active && ' · Không còn hoạt động, vui lòng bỏ chọn'}</small></span>
          </label></li>;
        })}</ul>
        {!available.length && <p className={styles.empty}>Chưa có tài khoản công nhân đang hoạt động. Thêm tại Tài khoản &amp; Nhân sự.</p>}
        {!chosen.size && <p className={styles.hint}>Lưu danh sách trống sẽ bỏ toàn bộ công nhân phụ trách kho này.</p>}
      </div>
      <footer className={styles.footer}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={saving} onClick={onClose}>Hủy</button>
        <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={saving} aria-busy={saving}>{saving ? 'Đang lưu...' : 'Lưu phân công'}</button>
      </footer>
    </form>
  </Dialog>;
}

export function WarehouseResponsibilities({ canEdit }) {
  const { showToast } = useNotification();
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState(null);
  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    getWarehouseResponsibilities().then(data => { if (!cancelled) setState({ data, error: '', loading: false }); })
      .catch(error => { if (!cancelled) setState({ data: null, error: apiErrorMessage(error), loading: false }); });
    return () => { cancelled = true; };
  }, [canEdit, revision]);
  const retry = () => { setState(current => ({ ...current, loading: true })); setRevision(current => current + 1); };
  const saved = (id, workers) => {
    setState(current => ({ ...current, data: { ...current.data,
      warehouses: current.data.warehouses.map(warehouse => warehouse.id === id ? { ...warehouse, workers } : warehouse),
    } }));
    setTarget(null);
    showToast('Đã cập nhật công nhân phụ trách kho.', 'success');
  };
  if (!canEdit) return <div className="farmshift-card farmshift-card-body">Chỉ chủ trang trại có quyền quản lý phân công kho.</div>;
  const { data, error, loading } = state;
  return <section className="farmshift-card">
    <header className={`farmshift-card-header ${styles.header}`}>
      <div><h3 className="farmshift-card-title">Phân công công nhân phụ trách kho</h3><p>Chọn công nhân phụ trách cho từng kho hàng của trang trại.</p></div>
      <span className={styles.summary}><Users size={16} />{data?.workers?.length || 0} công nhân đang hoạt động</span>
    </header>
    {loading ? <p role="status" className={styles.empty}>Đang tải danh sách kho...</p>
      : error ? <div className={styles.empty}><p role="alert" className={styles.error}>{error}</p><button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={retry}>Thử lại</button></div>
      : !data?.warehouses?.length ? <p className={styles.empty}>Chưa có kho hàng. Thêm kho tại Thiết lập danh mục trước khi phân công.</p>
      : <div className="farmshift-table-container" style={{ border: 'none' }}><table className="farmshift-table">
        <thead><tr><th>Tên kho hàng</th><th>Công nhân phụ trách</th></tr></thead>
        <tbody>{data.warehouses.map(warehouse => <tr key={warehouse.id}>
          <th scope="row"><span className={styles.summary}><Warehouse size={17} />{warehouse.name}</span></th>
          <td><div className={styles.assignment}>
            <div className={styles.people}>{warehouse.workers.map(worker => <span key={worker.id} className={styles.person}>
              <span className={styles.avatar} aria-hidden="true">{worker.fullName.trim().split(/\s+/).pop().slice(0, 1)}</span>{worker.fullName}
            </span>)}</div>
            <button type="button" className={styles.editButton} onClick={() => setTarget(warehouse)}
              aria-label={`${warehouse.workers.length ? 'Chỉnh sửa công nhân' : 'Thêm công nhân phụ trách'} · ${warehouse.name}`}>
              {warehouse.workers.length ? <><Pencil size={14} />Chỉnh sửa</> : <><Plus size={15} />Thêm công nhân phụ trách</>}
            </button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    {target && <WarehouseWorkersDialog warehouse={target} workers={data.workers} onClose={() => setTarget(null)} onSaved={saved} />}
  </section>;
}
