import { useEffect, useMemo, useState } from 'react';
import { HeartCrack, History, Scale, TrendingDown, TrendingUp, Warehouse } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { getFarmDailyPlan } from '../../services/dailyPlanService';
import { addWeightSample, getCycle, recordLoss } from '../../services/cycleService';
import { apiErrorMessage, formatAmount, formatDay, todayIso } from './farmAreaOptions';
import styles from './BarnJournal.module.css';

/** Nguyên nhân hay gặp, bấm để ghi nhanh vào ghi chú. */
const LOSS_CAUSES = ['Bệnh', 'Đè / ngạt', 'Nóng', 'Cắn mổ', 'Yếu, còi', 'Không rõ'];
const LOSS_TYPES = [{ value: 'DEATH', label: 'Chết' }, { value: 'CULL', label: 'Loại thải' }];
/** Nhắc cân lại khi lần cân gần nhất đã quá số ngày này. */
const WEIGH_EVERY_DAYS = 7;
const DEFAULT_SAMPLE_SIZE = 30;

const num = value => Number(value || 0).toLocaleString('vi-VN');
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
const grams = kg => `${Math.round(Number(kg) * 1000).toLocaleString('vi-VN')} g`;
const positiveNumber = value => {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** Lần cân mẫu, mới nhất trước, kèm mức tăng so với lần cân liền trước. */
const weighings = samples => {
  const sorted = [...(samples || [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return sorted.map((sample, index) => {
    const previous = sorted[index + 1];
    const days = previous ? daysBetween(previous.date, sample.date) : 0;
    const gainKg = previous ? Number(sample.quantity) - Number(previous.quantity) : null;
    return { ...sample, gainKg, dailyGainG: previous && days > 0 ? (gainKg * 1000) / days : null };
  });
};

/** Chuồng đang nuôi (công nhân chỉ thấy chuồng mình phụ trách), gom theo khu. */
function BarnPicker({ barns, selectedId, onSelect, mode }) {
  const areas = useMemo(() => {
    const groups = new Map();
    barns.forEach(barn => {
      if (!groups.has(barn.areaName)) groups.set(barn.areaName, []);
      groups.get(barn.areaName).push(barn);
    });
    return [...groups.entries()];
  }, [barns]);

  return <nav className={styles.picker} aria-label="Chọn chuồng">
    <h3><Warehouse size={18} /> Chọn chuồng</h3>
    {areas.map(([areaName, list]) => <div key={areaName} className={styles.area}>
      <span className={styles.areaName}>{areaName}</span>
      {list.map(barn => <button key={barn.cycleId} type="button" aria-pressed={barn.cycleId === selectedId}
        className={`${styles.barnRow} ${barn.cycleId === selectedId ? styles.barnActive : ''}`} onClick={() => onSelect(barn.cycleId)}>
        <strong>{barn.barnName}</strong>
        <small>{num(barn.headcount)} con{mode === 'weight' && barn.flocks?.[0] ? ` · ${barn.flocks[0].ageDays} ngày tuổi` : ''}</small>
      </button>)}
    </div>)}
  </nav>;
}

/** Số liệu chính của chuồng sau mỗi lần ghi. */
function BarnKpis({ metrics, latest }) {
  return <div className={styles.kpis}>
    <div><span>Số con hiện tại</span><strong>{num(metrics.currentQuantity)}</strong><small>Nhập {num(metrics.totalIn)} con</small></div>
    <div><span>Chết cộng dồn</span><strong>{num(metrics.deaths)}</strong>
      <small>Tỷ lệ hao hụt {metrics.lossRate != null ? `${formatAmount(metrics.lossRate)}%` : '—'}</small></div>
    <div><span>Loại thải</span><strong>{num(metrics.culls)}</strong><small>con</small></div>
    <div><span>Cân nặng TB</span><strong>{metrics.avgWeightKg != null ? `${formatAmount(metrics.avgWeightKg)} kg` : '—'}</strong>
      <small>{latest ? `Cân ngày ${formatDay(latest.date)}` : 'Chưa cân mẫu'}</small></div>
  </div>;
}

function LossForm({ detail, onSaved }) {
  const { showToast } = useNotification();
  const flocks = detail.flocks.filter(flock => flock.status === 'ACTIVE' && flock.quantity > 0);
  const [form, setForm] = useState({ flockId: flocks[0]?.id || '', type: 'DEATH', date: todayIso(), quantity: '', causes: [], note: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const flock = flocks.find(item => item.id === Number(form.flockId));
  const set = (key, value) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); };
  const toggleCause = cause => set('causes', form.causes.includes(cause) ? form.causes.filter(item => item !== cause) : [...form.causes, cause]);

  const submit = async event => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const next = {};
    if (!flock) next.flockId = 'Chọn đàn có con chết / loại thải.';
    if (!form.date) next.date = 'Chọn ngày ghi nhận.';
    else if (form.date > todayIso()) next.date = 'Không ghi trước cho ngày mai.';
    if (!Number.isInteger(quantity) || quantity < 1) next.quantity = 'Nhập số con là số nguyên lớn hơn 0.';
    else if (flock && quantity > flock.quantity) next.quantity = `Đàn chỉ còn ${num(flock.quantity)} con.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    const note = [form.causes.join(', '), form.note.trim()].filter(Boolean).join(' — ');
    setSaving(true);
    try {
      await recordLoss(flock.id, { type: form.type, movementDate: form.date, quantity, note: note || null });
      showToast(`Đã ghi ${num(quantity)} con ${form.type === 'DEATH' ? 'chết' : 'loại thải'} ở ${detail.barn?.name || 'chuồng'}. Đã trừ vào số con của chuồng.`, 'success');
      setForm(current => ({ ...current, quantity: '', causes: [], note: '' }));
      onSaved();
    } catch (error) {
      showToast(apiErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!flocks.length) return <p className={styles.empty}>Chuồng không còn đàn nào đang nuôi.</p>;
  return <form className={styles.form} onSubmit={submit} noValidate>
    <h3><HeartCrack size={18} /> Ghi chết / loại thải</h3>
    <div className={styles.segment} role="radiogroup" aria-label="Loại ghi nhận">
      {LOSS_TYPES.map(type => <button key={type.value} type="button" role="radio" aria-checked={form.type === type.value}
        className={form.type === type.value ? styles.segmentActive : ''} onClick={() => set('type', type.value)}>{type.label}</button>)}
    </div>
    <div className={styles.fields}>
      <label className="farmshift-form-group">
        <span className="farmshift-form-label">Ngày</span>
        <input className="farmshift-form-control" type="date" max={todayIso()} value={form.date} onChange={event => set('date', event.target.value)} />
        {errors.date && <small className={styles.error}>{errors.date}</small>}
      </label>
      {flocks.length > 1 && <label className="farmshift-form-group">
        <span className="farmshift-form-label">Đàn</span>
        <select className="farmshift-select" value={form.flockId} onChange={event => set('flockId', event.target.value)}>
          {flocks.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name} ({num(item.quantity)} con)</option>)}
        </select>
        {errors.flockId && <small className={styles.error}>{errors.flockId}</small>}
      </label>}
      <label className="farmshift-form-group">
        <span className="farmshift-form-label">Số con</span>
        <input className="farmshift-form-control" type="number" min="1" step="1" inputMode="numeric" placeholder="VD: 5"
          value={form.quantity} onChange={event => set('quantity', event.target.value)} />
        {errors.quantity ? <small className={styles.error}>{errors.quantity}</small>
          : flock && <small className={styles.hint}>Đàn {flock.code} còn {num(flock.quantity)} con</small>}
      </label>
    </div>
    <div className={styles.causes}>
      <span className="farmshift-form-label">Nguyên nhân</span>
      <div>{LOSS_CAUSES.map(cause => <button key={cause} type="button" aria-pressed={form.causes.includes(cause)}
        className={form.causes.includes(cause) ? styles.causeActive : ''} onClick={() => toggleCause(cause)}>{cause}</button>)}</div>
    </div>
    <label className="farmshift-form-group">
      <span className="farmshift-form-label">Ghi chú</span>
      <input className="farmshift-form-control" maxLength={500} placeholder="Triệu chứng, vị trí trong chuồng..." value={form.note}
        onChange={event => set('note', event.target.value)} />
    </label>
    <button type="submit" className="farmshift-btn farmshift-btn-primary" disabled={saving}>{saving ? 'Đang ghi...' : 'Ghi và trừ số con'}</button>
  </form>;
}

function WeightForm({ detail, latest, onSaved }) {
  const { showToast } = useNotification();
  const [form, setForm] = useState({ date: todayIso(), sampleSize: String(DEFAULT_SAMPLE_SIZE), mode: 'total', totalKg: '', avgKg: '', note: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key, value) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); };
  const sampleSize = Number(form.sampleSize);
  const avg = form.mode === 'total'
    ? (positiveNumber(form.totalKg) && Number.isInteger(sampleSize) && sampleSize > 0 ? positiveNumber(form.totalKg) / sampleSize : null)
    : positiveNumber(form.avgKg);
  const previous = latest && latest.date <= form.date ? latest : null;
  const gainDays = previous ? daysBetween(previous.date, form.date) : 0;

  const submit = async event => {
    event.preventDefault();
    const next = {};
    if (!form.date) next.date = 'Chọn ngày cân.';
    else if (form.date > todayIso()) next.date = 'Không ghi trước cho ngày mai.';
    if (!Number.isInteger(sampleSize) || sampleSize < 1) next.sampleSize = 'Nhập số con cân là số nguyên lớn hơn 0.';
    if (form.mode === 'total' && !positiveNumber(form.totalKg)) next.totalKg = 'Nhập tổng khối lượng cân được (kg).';
    if (form.mode === 'avg' && !positiveNumber(form.avgKg)) next.avgKg = 'Nhập cân nặng trung bình (kg/con).';
    if (!next.totalKg && !next.avgKg && avg != null && avg > 500) next[form.mode === 'total' ? 'totalKg' : 'avgKg'] = 'Trung bình không quá 500 kg/con.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const avgWeightKg = Math.round(avg * 1000) / 1000;
    setSaving(true);
    try {
      await addWeightSample(detail.cycle.id, { sampleDate: form.date, avgWeightKg, sampleSize, note: form.note.trim() || null });
      showToast(`Đã ghi cân mẫu: trung bình ${formatAmount(avgWeightKg)} kg/con.`, 'success');
      setForm(current => ({ ...current, totalKg: '', avgKg: '', note: '' }));
      onSaved();
    } catch (error) {
      showToast(apiErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  return <form className={styles.form} onSubmit={submit} noValidate>
    <h3><Scale size={18} /> Cân mẫu</h3>
    <p className={styles.tip}>Bắt ngẫu nhiên khoảng {DEFAULT_SAMPLE_SIZE} con ở nhiều góc chuồng, cân cùng giờ, trước bữa ăn sáng. Nên cân mỗi tuần một lần.</p>
    <div className={styles.segment} role="radiogroup" aria-label="Cách nhập">
      <button type="button" role="radio" aria-checked={form.mode === 'total'} className={form.mode === 'total' ? styles.segmentActive : ''}
        onClick={() => set('mode', 'total')}>Nhập tổng số cân</button>
      <button type="button" role="radio" aria-checked={form.mode === 'avg'} className={form.mode === 'avg' ? styles.segmentActive : ''}
        onClick={() => set('mode', 'avg')}>Nhập cân nặng TB</button>
    </div>
    <div className={styles.fields}>
      <label className="farmshift-form-group">
        <span className="farmshift-form-label">Ngày cân</span>
        <input className="farmshift-form-control" type="date" max={todayIso()} value={form.date} onChange={event => set('date', event.target.value)} />
        {errors.date && <small className={styles.error}>{errors.date}</small>}
      </label>
      <label className="farmshift-form-group">
        <span className="farmshift-form-label">Số con cân</span>
        <input className="farmshift-form-control" type="number" min="1" step="1" inputMode="numeric" value={form.sampleSize}
          onChange={event => set('sampleSize', event.target.value)} />
        {errors.sampleSize && <small className={styles.error}>{errors.sampleSize}</small>}
      </label>
      {form.mode === 'total' ? <label className="farmshift-form-group">
        <span className="farmshift-form-label">Tổng khối lượng (kg)</span>
        <input className="farmshift-form-control" type="number" min="0" step="0.01" inputMode="decimal" placeholder="VD: 13,5"
          value={form.totalKg} onChange={event => set('totalKg', event.target.value)} />
        {errors.totalKg && <small className={styles.error}>{errors.totalKg}</small>}
      </label> : <label className="farmshift-form-group">
        <span className="farmshift-form-label">Cân nặng TB (kg/con)</span>
        <input className="farmshift-form-control" type="number" min="0" step="0.001" inputMode="decimal" placeholder="VD: 0,45"
          value={form.avgKg} onChange={event => set('avgKg', event.target.value)} />
        {errors.avgKg && <small className={styles.error}>{errors.avgKg}</small>}
      </label>}
    </div>
    <div className={styles.result} aria-live="polite">
      <span>Trung bình</span>
      <strong>{avg != null ? `${formatAmount(Math.round(avg * 1000) / 1000)} kg/con` : '—'}</strong>
      {avg != null && previous && <small className={avg >= Number(previous.quantity) ? styles.up : styles.down}>
        {avg >= Number(previous.quantity) ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
        {' '}{avg >= Number(previous.quantity) ? '+' : '−'}{grams(Math.abs(avg - Number(previous.quantity)))} so với lần cân {formatDay(previous.date)}
        {gainDays > 0 ? ` (${Math.round(((avg - Number(previous.quantity)) * 1000) / gainDays).toLocaleString('vi-VN')} g/con/ngày)` : ''}
      </small>}
    </div>
    <label className="farmshift-form-group">
      <span className="farmshift-form-label">Ghi chú</span>
      <input className="farmshift-form-control" maxLength={500} placeholder="Độ đồng đều, con còi..." value={form.note}
        onChange={event => set('note', event.target.value)} />
    </label>
    <button type="submit" className="farmshift-btn farmshift-btn-primary" disabled={saving}>{saving ? 'Đang ghi...' : 'Ghi cân mẫu'}</button>
  </form>;
}

function LossHistory({ movements }) {
  const rows = movements.filter(item => item.type === 'DEATH' || item.type === 'CULL')
    .sort((a, b) => b.movementDate.localeCompare(a.movementDate) || b.id - a.id);
  return <section className={styles.history}>
    <h3><History size={18} /> Lịch sử chết / loại thải</h3>
    {rows.length === 0 ? <p className={styles.empty}>Chưa ghi nhận con chết hay loại thải nào.</p>
      : <div className="farmshift-table-container"><table className="farmshift-table">
        <thead><tr><th>Ngày</th><th>Đàn</th><th>Loại</th><th>Số con</th><th>Ghi chú</th><th>Người ghi</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td>{formatDay(row.movementDate)}</td><td>{row.flockCode}</td>
          <td><span className={row.type === 'DEATH' ? styles.death : styles.cull}>{row.type === 'DEATH' ? 'Chết' : 'Loại thải'}</span></td>
          <td><strong>{num(row.quantity)}</strong></td><td>{row.note || '—'}</td><td>{row.createdBy || '—'}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

function WeightHistory({ rows }) {
  return <section className={styles.history}>
    <h3><History size={18} /> Lịch sử cân mẫu</h3>
    {rows.length === 0 ? <p className={styles.empty}>Chưa có lần cân mẫu nào.</p>
      : <div className="farmshift-table-container"><table className="farmshift-table">
        <thead><tr><th>Ngày cân</th><th>Số con cân</th><th>Cân nặng TB</th><th>Tăng so với lần trước</th><th>Tăng / ngày</th><th>Ghi chú</th><th>Người ghi</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td>{formatDay(row.date)}</td><td>{row.sampleSize ? num(row.sampleSize) : '—'}</td>
          <td><strong>{formatAmount(row.quantity)} kg</strong></td>
          <td>{row.gainKg == null ? '—' : `${row.gainKg >= 0 ? '+' : '−'}${grams(Math.abs(row.gainKg))}`}</td>
          <td>{row.dailyGainG == null ? '—' : `${Math.round(row.dailyGainG).toLocaleString('vi-VN')} g`}</td>
          <td>{row.note || '—'}</td><td>{row.createdBy || '—'}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

/**
 * Nhật ký theo chuồng: mode 'loss' ghi chết / loại thải (trừ thẳng vào số con của đàn và chuồng),
 * mode 'weight' ghi cân mẫu (cập nhật cân nặng trung bình của chuồng). Chuồng chọn ở đây dùng chung cho cả hai tab.
 */
export function BarnJournal({ mode, selectedCycleId, onSelect }) {
  const [barns, setBarns] = useState({ loading: true, list: [], error: '' });
  // Số liệu của lứa cycleId; đổi chuồng thì hiện "đang tải" đến khi số liệu chuồng mới về.
  const [detail, setDetail] = useState({ cycleId: null, data: null, error: '' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    getFarmDailyPlan(todayIso())
      .then(list => { if (active) setBarns({ loading: false, list: Array.isArray(list) ? list : [], error: '' }); })
      .catch(error => { if (active) setBarns({ loading: false, list: [], error: apiErrorMessage(error) }); });
    return () => { active = false; };
  }, [revision]);

  const selected = barns.list.find(barn => barn.cycleId === selectedCycleId) || barns.list[0];
  const cycleId = selected?.cycleId;

  useEffect(() => {
    if (!cycleId) return undefined;
    let active = true;
    getCycle(cycleId)
      .then(data => { if (active) setDetail({ cycleId, data, error: '' }); })
      .catch(error => { if (active) setDetail({ cycleId, data: null, error: apiErrorMessage(error) }); });
    return () => { active = false; };
  }, [cycleId, revision]);

  const current = detail.cycleId === cycleId ? detail : { data: null, error: '' };
  const samples = useMemo(() => weighings(current.data?.weightSamples), [current.data]);

  if (barns.loading) return <p className={styles.state} role="status">Đang tải danh sách chuồng...</p>;
  if (barns.error) return <p className={styles.state} role="alert">{barns.error}</p>;
  if (!barns.list.length) return <p className={styles.state}>Chưa có chuồng nào đang nuôi{' '}
    (công nhân chỉ thấy chuồng được chủ trại phân công).</p>;

  const { data } = current;
  const latest = samples[0];
  const overdue = mode === 'weight' && data && (!latest || daysBetween(latest.date, todayIso()) >= WEIGH_EVERY_DAYS);

  return <div className={styles.layout}>
    <BarnPicker barns={barns.list} selectedId={cycleId} onSelect={onSelect} mode={mode} />
    <div className={styles.main}>
      <header className={styles.head}>
        <div>
          <h2>{selected.barnName}</h2>
          <small>{selected.areaName} · Lứa {selected.cycleCode}{selected.flocks?.[0] ? ` · ${selected.flocks[0].ageDays} ngày tuổi` : ''}</small>
        </div>
        {overdue && <span className={styles.alert}>
          {latest ? `Đã ${daysBetween(latest.date, todayIso())} ngày chưa cân` : 'Chưa cân mẫu lần nào'}</span>}
      </header>
      {current.error ? <p className={styles.state} role="alert">{current.error}</p>
        : !data ? <p className={styles.state} role="status">Đang tải số liệu chuồng...</p>
          : <>
            <BarnKpis metrics={data.metrics} latest={latest} />
            {mode === 'loss'
              ? <><LossForm key={cycleId} detail={data} onSaved={() => setRevision(value => value + 1)} /><LossHistory movements={data.movements || []} /></>
              : <><WeightForm key={cycleId} detail={data} latest={latest} onSaved={() => setRevision(value => value + 1)} /><WeightHistory rows={samples} /></>}
          </>}
    </div>
  </div>;
}
