import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, HeartCrack, History, MapPinned, Scale, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { getFarmDailyPlan } from '../../services/dailyPlanService';
import { addWeightSample, getCycle, recordLoss } from '../../services/cycleService';
import { listBarns } from '../../services/farmAreaService';
import { fileService } from '../../services/fileService';
import { apiErrorMessage, formatAmount, formatDay, todayIso } from './farmAreaOptions';
import styles from './BarnJournal.module.css';

/** Nguyên nhân hay gặp, bấm để ghi nhanh vào ghi chú. */
const LOSS_CAUSES = ['Bệnh', 'Đè / ngạt', 'Nóng', 'Cắn mổ', 'Yếu, còi', 'Không rõ'];
const LOSS_TYPES = [{ value: 'DEATH', label: 'Chết' }, { value: 'CULL', label: 'Loại thải' }];
const MODES = [{ value: 'loss', label: 'Hao hụt (chết / loại thải)', icon: HeartCrack }, { value: 'weight', label: 'Cân mẫu', icon: Scale }];
/** Nhắc cân lại khi lần cân gần nhất đã quá số ngày này. */
const WEIGH_EVERY_DAYS = 7;
const DEFAULT_SAMPLE_SIZE = 30;
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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

/** Gom chuồng theo khu, giữ thứ tự khu như danh sách. */
const groupAreas = barns => {
  const areas = new Map();
  barns.forEach(barn => {
    if (!areas.has(barn.areaName)) areas.set(barn.areaName, []);
    areas.get(barn.areaName).push(barn);
  });
  return [...areas.entries()];
};

/**
 * Chuồng hiện trên sơ đồ. Chủ trại / kế toán thấy mọi chuồng (chuồng trống để mờ);
 * công nhân chỉ thấy chuồng đang nuôi mình được phân công.
 */
const loadBarns = async worker => {
  if (worker) {
    const plans = await getFarmDailyPlan(todayIso());
    return (Array.isArray(plans) ? plans : []).map(plan => ({ barnId: plan.barnId, name: plan.barnName, areaName: plan.areaName,
      cycleId: plan.cycleId, headcount: plan.headcount, ageDays: plan.flocks?.[0]?.ageDays ?? null }));
  }
  const barns = await listBarns();
  return (Array.isArray(barns) ? barns : []).map(barn => ({ barnId: barn.id, name: barn.name, areaName: barn.areaName,
    cycleId: barn.activeCycleId || null, headcount: barn.currentQuantity, ageDays: null }));
};

/** Sơ đồ khu: mỗi khu một khung, bên trong là các ô chuồng. Bấm chuồng đang nuôi để ghi nhật ký. */
function AreaMap({ barns, onOpen }) {
  return <div className={styles.map}>
    {groupAreas(barns).map(([areaName, list]) => <section key={areaName} className={styles.area} aria-label={`Khu ${areaName}`} style={{ flexGrow: list.length }}>
      <span className={styles.areaLabel}>{areaName}<small>· {list.length} chuồng</small></span>
      <div className={styles.tiles}>
        {list.map(barn => {
          const running = Boolean(barn.cycleId);
          return <button key={barn.barnId} type="button" disabled={!running} onClick={() => onOpen(barn.cycleId)}
            className={`${styles.tile} ${running ? '' : styles.tileEmpty}`} aria-label={running ? `Ghi nhật ký ${barn.name}` : `${barn.name}: chuồng trống`}>
            <strong>{barn.name}</strong>
            <span>{running ? `${num(barn.headcount)} con` : 'Chuồng trống'}</span>
            {running && barn.ageDays != null && <small>{barn.ageDays} ngày tuổi</small>}
          </button>;
        })}
      </div>
    </section>)}
  </div>;
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

const readAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

/** Chọn tối đa 3 ảnh (con chết, bệnh tích...) kèm xem trước; ảnh chỉ được tải lên khi bấm ghi. */
function PhotoPicker({ photos, onChange, disabled }) {
  const { showToast } = useNotification();
  const add = async event => {
    const files = [...event.target.files];
    event.target.value = '';
    const images = files.filter(file => file.type.startsWith('image/') && file.size <= MAX_PHOTO_BYTES);
    if (images.length < files.length) showToast('Chỉ nhận ảnh, mỗi ảnh không quá 5MB.', 'error');
    const room = MAX_PHOTOS - photos.length;
    if (images.length > room) showToast(`Đính kèm tối đa ${MAX_PHOTOS} ảnh.`, 'error');
    const picked = images.slice(0, Math.max(room, 0));
    if (picked.length) onChange([...photos, ...await Promise.all(picked.map(async file => ({ file, preview: await readAsDataUrl(file) })))]);
  };
  const remove = index => onChange(photos.filter((_, i) => i !== index));

  return <div className={styles.photos}>
    <span className="farmshift-form-label">Ảnh đính kèm <small>(không bắt buộc, tối đa {MAX_PHOTOS} ảnh)</small></span>
    <div>
      {photos.map((photo, index) => <figure key={`${index}-${photo.file.name}`} className={styles.thumb}>
        <img src={photo.preview} alt={`Ảnh ${index + 1}`} />
        <button type="button" aria-label={`Bỏ ảnh ${index + 1}`} onClick={() => remove(index)} disabled={disabled}><X size={14} /></button>
      </figure>)}
      {photos.length < MAX_PHOTOS && <label className={styles.addPhoto}>
        <Camera size={20} /><span>Thêm ảnh</span>
        <input type="file" accept="image/png,image/jpeg,image/gif" multiple capture="environment" onChange={add} disabled={disabled}
          aria-label="Thêm ảnh đính kèm" />
      </label>}
    </div>
  </div>;
}

function LossForm({ detail, barnName, onSaved }) {
  const { showToast } = useNotification();
  const flocks = detail.flocks.filter(flock => flock.status === 'ACTIVE' && flock.quantity > 0);
  const [form, setForm] = useState({ flockId: flocks[0]?.id || '', type: 'DEATH', date: todayIso(), quantity: '', causes: [], note: '' });
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState('');
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
    try {
      setSaving(photos.length ? 'Đang tải ảnh...' : 'Đang ghi...');
      const photoUrls = [];
      for (const photo of photos) photoUrls.push(await fileService.uploadFile(photo.file, 'losses'));
      setSaving('Đang ghi...');
      await recordLoss(flock.id, { type: form.type, movementDate: form.date, quantity, note: note || null, photoUrls });
      showToast(`Đã ghi ${num(quantity)} con ${form.type === 'DEATH' ? 'chết' : 'loại thải'} ở ${barnName}. Đã trừ vào số con của chuồng.`, 'success');
      setForm(current => ({ ...current, quantity: '', causes: [], note: '' }));
      setPhotos([]);
      onSaved();
    } catch (error) {
      showToast(apiErrorMessage(error), 'error');
    } finally {
      setSaving('');
    }
  };

  if (!flocks.length) return <p className={styles.empty}>Chuồng không còn đàn nào đang nuôi.</p>;
  return <form className={styles.form} onSubmit={submit} noValidate>
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
    <PhotoPicker photos={photos} onChange={setPhotos} disabled={Boolean(saving)} />
    <button type="submit" className="farmshift-btn farmshift-btn-primary" disabled={Boolean(saving)}>{saving || 'Ghi và trừ số con'}</button>
  </form>;
}

/** Cân đại diện một số con, nhập tổng khối lượng; trung bình = tổng ÷ số con cân. */
function WeightForm({ detail, latest, onSaved }) {
  const { showToast } = useNotification();
  const [form, setForm] = useState({ date: todayIso(), sampleSize: String(DEFAULT_SAMPLE_SIZE), totalKg: '', note: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key, value) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); };
  const sampleSize = Number(form.sampleSize);
  const totalKg = positiveNumber(form.totalKg);
  const avg = totalKg && Number.isInteger(sampleSize) && sampleSize > 0 ? Math.round((totalKg / sampleSize) * 1000) / 1000 : null;
  const previous = latest && latest.date <= form.date ? latest : null;
  const gainKg = avg != null && previous ? avg - Number(previous.quantity) : null;
  const gainDays = previous ? daysBetween(previous.date, form.date) : 0;

  const submit = async event => {
    event.preventDefault();
    const next = {};
    if (!form.date) next.date = 'Chọn ngày cân.';
    else if (form.date > todayIso()) next.date = 'Không ghi trước cho ngày mai.';
    if (!Number.isInteger(sampleSize) || sampleSize < 1) next.sampleSize = 'Nhập số con cân là số nguyên lớn hơn 0.';
    if (!totalKg) next.totalKg = 'Nhập tổng khối lượng cân được (kg).';
    else if (avg != null && avg > 500) next.totalKg = 'Trung bình không quá 500 kg/con.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await addWeightSample(detail.cycle.id, { sampleDate: form.date, avgWeightKg: avg, sampleSize, note: form.note.trim() || null });
      showToast(`Đã ghi cân mẫu: trung bình ${formatAmount(avg)} kg/con.`, 'success');
      setForm(current => ({ ...current, totalKg: '', note: '' }));
      onSaved();
    } catch (error) {
      showToast(apiErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  return <form className={styles.form} onSubmit={submit} noValidate>
    <p className={styles.tip}>Bắt ngẫu nhiên khoảng {DEFAULT_SAMPLE_SIZE} con ở nhiều góc chuồng, cân chung rồi nhập tổng khối lượng — hệ thống tự chia
      ra cân nặng trung bình. Nên cân mỗi tuần một lần, cùng giờ, trước bữa ăn sáng.</p>
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
      <label className="farmshift-form-group">
        <span className="farmshift-form-label">Tổng khối lượng (kg)</span>
        <input className="farmshift-form-control" type="number" min="0" step="0.01" inputMode="decimal" placeholder="VD: 13,5"
          value={form.totalKg} onChange={event => set('totalKg', event.target.value)} />
        {errors.totalKg && <small className={styles.error}>{errors.totalKg}</small>}
      </label>
    </div>
    <div className={styles.result} aria-live="polite">
      <span>Cân nặng trung bình</span>
      <strong>{avg != null ? `${formatAmount(avg)} kg/con` : '—'}</strong>
      {gainKg != null && <small className={gainKg >= 0 ? styles.up : styles.down}>
        {gainKg >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
        {' '}{gainKg >= 0 ? '+' : '−'}{grams(Math.abs(gainKg))} so với lần cân {formatDay(previous.date)}
        {gainDays > 0 ? ` (${Math.round((gainKg * 1000) / gainDays).toLocaleString('vi-VN')} g/con/ngày)` : ''}
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
        <thead><tr><th>Ngày</th><th>Đàn</th><th>Loại</th><th>Số con</th><th>Ghi chú</th><th>Ảnh</th><th>Người ghi</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td>{formatDay(row.movementDate)}</td><td>{row.flockCode}</td>
          <td><span className={row.type === 'DEATH' ? styles.death : styles.cull}>{row.type === 'DEATH' ? 'Chết' : 'Loại thải'}</span></td>
          <td><strong>{num(row.quantity)}</strong></td><td>{row.note || '—'}</td>
          <td>{row.photoUrls?.length ? <span className={styles.rowPhotos}>{row.photoUrls.map((url, index) =>
            <a key={url} href={url} target="_blank" rel="noreferrer" title={`Xem ảnh ${index + 1}`}><img src={url} alt={`Ảnh ${index + 1}`} /></a>)}</span> : '—'}</td>
          <td>{row.createdBy || '—'}</td>
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

/** Nhật ký một chuồng: số liệu, ghi hao hụt hoặc cân mẫu, lịch sử. */
function BarnPage({ cycleId, barn, initialMode, canRecord, onBack }) {
  const [mode, setMode] = useState(initialMode === 'weight' ? 'weight' : 'loss');
  const [detail, setDetail] = useState({ cycleId: null, data: null, error: '' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    getCycle(cycleId)
      .then(data => { if (active) setDetail({ cycleId, data, error: '' }); })
      .catch(error => { if (active) setDetail({ cycleId, data: null, error: apiErrorMessage(error) }); });
    return () => { active = false; };
  }, [cycleId, revision]);

  const current = detail.cycleId === cycleId ? detail : { data: null, error: '' };
  const samples = useMemo(() => weighings(current.data?.weightSamples), [current.data]);
  const { data } = current;
  const latest = samples[0];
  const overdue = mode === 'weight' && data && (!latest || daysBetween(latest.date, todayIso()) >= WEIGH_EVERY_DAYS);
  const barnName = data?.barn?.name || barn?.name || 'Chuồng';
  const saved = () => setRevision(value => value + 1);

  return <div className={styles.main}>
    <header className={styles.head}>
      <button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={16} /> Sơ đồ khu</button>
      <div className={styles.title}>
        <h2>{barnName}</h2>
        <small>{data?.barn?.areaName || barn?.areaName}{data ? ` · Lứa ${data.cycle.code}` : ''}
          {data?.metrics?.ageDays != null ? ` · ${data.metrics.ageDays} ngày tuổi` : ''}</small>
      </div>
      {overdue && <span className={styles.alert}>{latest ? `Đã ${daysBetween(latest.date, todayIso())} ngày chưa cân` : 'Chưa cân mẫu lần nào'}</span>}
    </header>
    {current.error ? <p className={styles.state} role="alert">{current.error}</p>
      : !data ? <p className={styles.state} role="status">Đang tải số liệu chuồng...</p>
        : <>
          <BarnKpis metrics={data.metrics} latest={latest} />
          <div className={styles.modes} role="tablist" aria-label="Loại nhật ký">
            {MODES.map(({ value, label, icon: Icon }) => <button key={value} type="button" role="tab" aria-selected={mode === value}
              className={mode === value ? styles.modeActive : ''} onClick={() => setMode(value)}><Icon size={17} /> {label}</button>)}
          </div>
          {mode === 'loss'
            ? <>{canRecord && <LossForm key={cycleId} detail={data} barnName={barnName} onSaved={saved} />}<LossHistory movements={data.movements || []} /></>
            : <>{canRecord && <WeightForm key={cycleId} detail={data} latest={latest} onSaved={saved} />}<WeightHistory rows={samples} /></>}
        </>}
  </div>;
}

/**
 * Ghi nhật ký theo chuồng: mở ra là sơ đồ khu (chủ trại thấy cả trại, công nhân chỉ thấy chuồng được phân công),
 * bấm một chuồng để ghi chết / loại thải (trừ thẳng vào số con) hoặc cân mẫu (cập nhật cân nặng trung bình).
 */
export function BarnJournal({ mode, selectedCycleId, onSelect }) {
  const { user } = useAuth();
  const worker = user?.role === 'ROLE_FARM_WORKER';
  const canRecord = worker || user?.role === 'ROLE_FARM_OWNER';
  const [barns, setBarns] = useState({ loading: true, list: [], error: '' });

  useEffect(() => {
    let active = true;
    loadBarns(worker)
      .then(list => { if (active) setBarns({ loading: false, list, error: '' }); })
      .catch(error => { if (active) setBarns({ loading: false, list: [], error: apiErrorMessage(error) }); });
    return () => { active = false; };
  }, [worker, selectedCycleId]);

  if (selectedCycleId) {
    return <BarnPage key={selectedCycleId} cycleId={selectedCycleId} barn={barns.list.find(barn => barn.cycleId === selectedCycleId)}
      initialMode={mode} canRecord={canRecord} onBack={() => onSelect(null)} />;
  }
  if (barns.loading) return <p className={styles.state} role="status">Đang tải sơ đồ khu...</p>;
  if (barns.error) return <p className={styles.state} role="alert">{barns.error}</p>;
  if (!barns.list.length) {
    return <p className={styles.state}>{worker ? 'Bạn chưa được phân công chuồng nào đang nuôi. Liên hệ chủ trại để được phân công.'
      : 'Chưa có chuồng nào. Tạo khu và chuồng ở mục Khu nuôi.'}</p>;
  }
  const running = barns.list.filter(barn => barn.cycleId);
  return <>
    <p className={styles.intro}><MapPinned size={18} />
      {worker ? `Bạn phụ trách ${running.length} chuồng.` : `${running.length}/${barns.list.length} chuồng đang nuôi.`} Bấm vào chuồng để ghi chết, loại thải hoặc cân mẫu.</p>
    <AreaMap barns={barns.list} onOpen={onSelect} />
  </>;
}
