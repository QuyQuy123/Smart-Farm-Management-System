import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, X } from 'lucide-react';
import { createBarn, createFarmArea, deleteBarn, deleteFarmArea, updateBarn, updateFarmArea } from '../../services/farmAreaService';
import { ANIMAL_METRICS, BIRDS_PER_M2, ENVIRONMENT_METRICS, apiErrorMessage, suggestCapacity, validateBarn } from './farmAreaOptions';
import styles from './AreasView.module.css';

// Validation (400) and duplicate-name (409) responses carry { field: message } in data.
const apiFieldErrors = error => {
  const data = error.response?.data?.data;
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
};

export function Dialog({ title, labelId, busy, onClose, wide, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={labelId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className={`${styles.modal} ${wide ? styles.modalWide : ''}`}>
      <header className={styles.modalHeader}>
        <h2 id={labelId}>{title}</h2>
        <button type="button" className={styles.iconButton} onClick={onClose} disabled={busy} aria-label="Đóng"><X size={20} /></button>
      </header>
      {children}
    </section>
  </dialog>;
}

export const FieldError = ({ id, message }) => message ? <p id={id} className={styles.fieldError}>{message}</p> : null;

function MetricPicker({ legend, options, value, onChange, disabled }) {
  const toggle = code => onChange(value.includes(code) ? value.filter(item => item !== code) : [...value, code]);
  return <fieldset className={styles.metricGroup} disabled={disabled}>
    <legend>{legend}</legend>
    <div className={styles.chips}>
      {options.map(option => {
        const selected = value.includes(option.value);
        return <button key={option.value} type="button" className={`${styles.chip} ${selected ? styles.chipSelected : ''}`}
          aria-pressed={selected} onClick={() => toggle(option.value)}>
          {selected && <Check size={13} />}{option.label}
        </button>;
      })}
    </div>
  </fieldset>;
}

export function AreaDialog({ area, onClose, onSaved }) {
  const editing = Boolean(area);
  const [form, setForm] = useState(() => ({
    name: area?.name || '',
    environmentMetrics: area?.environmentMetrics || ['HUMIDITY', 'TEMPERATURE'],
    animalMetrics: area?.animalMetrics || ['WEIGHT', 'LOSS'],
    description: area?.description || '',
  }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key, value) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); };

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    const name = form.name.trim();
    if (!name) { setErrors({ name: 'Vui lòng nhập tên khu nuôi.' }); return; }
    setSaving(true);
    setError('');
    const payload = { ...form, name, description: form.description.trim() };
    try {
      if (editing) await updateFarmArea(area.id, payload);
      else await createFarmArea(payload);
      onSaved(editing ? `Đã cập nhật khu nuôi ${name}.` : `Đã thêm khu nuôi ${name}.`);
    } catch (requestError) {
      const fields = apiFieldErrors(requestError);
      setErrors(fields);
      if (!Object.keys(fields).length) setError(apiErrorMessage(requestError));
      setSaving(false);
    }
  };

  return <Dialog title={editing ? 'Chỉnh sửa khu nuôi' : 'Thêm mới khu nuôi'} labelId="farm-area-dialog-title" busy={saving} onClose={onClose} wide>
    <form onSubmit={submit} noValidate>
      <div className={styles.modalBody}>
        {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
        <label htmlFor="farm-area-name">Tên khu nuôi <span className={styles.required}>*</span></label>
        <input id="farm-area-name" className={`farmshift-form-control ${errors.name ? styles.invalid : ''}`} value={form.name} maxLength={150}
          placeholder="Ví dụ: Khu Mía Thịt" onChange={event => set('name', event.target.value)} disabled={saving}
          aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'farm-area-name-error' : undefined} autoFocus />
        <FieldError id="farm-area-name-error" message={errors.name} />
        <MetricPicker legend="Theo dõi môi trường" options={ENVIRONMENT_METRICS} value={form.environmentMetrics} onChange={value => set('environmentMetrics', value)} disabled={saving} />
        <MetricPicker legend="Theo dõi vật nuôi" options={ANIMAL_METRICS} value={form.animalMetrics} onChange={value => set('animalMetrics', value)} disabled={saving} />
        <label htmlFor="farm-area-description">Ghi chú</label>
        <textarea id="farm-area-description" className="farmshift-form-control" rows={3} maxLength={1000} value={form.description}
          placeholder="Mô tả hạ tầng, diện tích, hệ thống làm mát..." onChange={event => set('description', event.target.value)} disabled={saving} />
        <FieldError message={errors.description} />
      </div>
      <footer className={styles.footer}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>Bỏ qua</button>
        <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={saving} aria-busy={saving}>{saving ? 'Đang lưu...' : 'Lưu và đóng lại'}</button>
      </footer>
    </form>
  </Dialog>;
}

export function BarnDialog({ barn, areas, defaultAreaId, onClose, onSaved }) {
  const editing = Boolean(barn);
  const [form, setForm] = useState(() => ({
    areaId: String(barn?.areaId || defaultAreaId || areas[0]?.id || ''),
    name: barn?.name || '',
    capacity: String(barn?.capacity ?? ''),
    areaM2: barn?.areaM2 == null ? '' : String(barn.areaM2),
    targetWeight: barn?.targetWeight == null ? '' : String(barn.targetWeight),
    description: barn?.description || '',
  }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Capacity follows the area suggestion until the owner types their own number.
  const [capacityAuto, setCapacityAuto] = useState(() => !barn || String(suggestCapacity(barn.areaM2 ?? '')) === String(barn.capacity));
  const set = (key, value) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); };
  const setArea = value => {
    const suggested = suggestCapacity(value);
    setForm(current => ({ ...current, areaM2: value, ...(capacityAuto && suggested ? { capacity: String(suggested) } : {}) }));
    setErrors(current => ({ ...current, areaM2: undefined, capacity: undefined }));
  };
  const setCapacity = value => { setCapacityAuto(false); set('capacity', value); };
  const suggested = suggestCapacity(form.areaM2);
  const density = suggested && Number(form.capacity) > 0 ? Number(form.capacity) / Number(form.areaM2) : null;
  const capacityHint = suggested == null ? `Nhập diện tích để được gợi ý sức chứa theo mức ${BIRDS_PER_M2} con/m².`
    : <>Gợi ý: {Number(form.areaM2).toLocaleString('vi-VN')} m² × {BIRDS_PER_M2} con/m² = <strong>{suggested.toLocaleString('vi-VN')} con</strong>
      {String(suggested) !== form.capacity && <> · <button type="button" className={styles.inlineLink} onClick={() => { setCapacityAuto(true); set('capacity', String(suggested)); }}>Dùng gợi ý</button></>}
      {density > BIRDS_PER_M2 && <span className={styles.densityWarning}> · Mật độ {density.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} con/m² cao hơn mức khuyến nghị.</span>}</>;

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    const found = validateBarn(form, barn);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setError('');
    const payload = {
      areaId: Number(form.areaId), name: form.name.trim(),
      capacity: Number(form.capacity), areaM2: form.areaM2 === '' ? null : Number(form.areaM2),
      targetWeight: form.targetWeight === '' ? null : Number(form.targetWeight), description: form.description.trim(),
    };
    try {
      if (editing) await updateBarn(barn.id, payload);
      else await createBarn(payload);
      onSaved(editing ? `Đã cập nhật chuồng ${payload.name}.` : `Đã thêm chuồng ${payload.name}.`);
    } catch (requestError) {
      const fields = apiFieldErrors(requestError);
      setErrors(fields);
      if (!Object.keys(fields).length) setError(apiErrorMessage(requestError));
      setSaving(false);
    }
  };

  const field = (key, label, input, required, hint) => <div>
    <label htmlFor={`barn-${key}`}>{label} {required && <span className={styles.required}>*</span>}</label>
    {input}
    {hint && !errors[key] && <small id={`barn-${key}-hint`} className={styles.fieldHint}>{hint}</small>}
    <FieldError id={`barn-${key}-error`} message={errors[key]} />
  </div>;
  const inputProps = key => ({
    id: `barn-${key}`, className: `farmshift-form-control ${errors[key] ? styles.invalid : ''}`, value: form[key], disabled: saving,
    onChange: event => set(key, event.target.value), 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `barn-${key}-error` : undefined,
  });

  return <Dialog title={editing ? 'Chỉnh sửa chuồng' : 'Tạo Chuồng'} labelId="barn-dialog-title" busy={saving} onClose={onClose} wide>
    <form onSubmit={submit} noValidate>
      <div className={styles.modalBody}>
        {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
        <div className={styles.formGrid}>
          {field('areaId', 'Khu nuôi', <select {...inputProps('areaId')}>
            {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>, true)}
          {field('name', 'Tên chuồng', <input {...inputProps('name')} maxLength={100} placeholder="Ví dụ: Nhà A1" autoFocus />, true)}
          {field('areaM2', 'Diện tích (m²)', <input {...inputProps('areaM2')} onChange={event => setArea(event.target.value)}
            type="number" min="0" step="0.01" inputMode="decimal" placeholder="Ví dụ: 1000" />)}
          {field('capacity', 'Sức chứa tối đa (con)', <input {...inputProps('capacity')} onChange={event => setCapacity(event.target.value)}
            type="number" min="1" step="1" inputMode="numeric" placeholder="Ví dụ: 8000" />, true, capacityHint)}
          {field('targetWeight', 'Mục tiêu cân nặng xuất chuồng (kg/con)', <input {...inputProps('targetWeight')} type="number" min="0" max="999" step="0.01" inputMode="decimal" placeholder="Ví dụ: 2.3" />)}
        </div>
        <p className={styles.formHint}>{editing
          ? `Đang nuôi ${(barn.currentQuantity || 0).toLocaleString('vi-VN')} con. Số con chỉ thay đổi qua nhập đàn, chuyển đàn, hao hụt và xuất bán.`
          : 'Sức chứa là số con tối đa chuồng được nuôi; mỗi lần nhập đàn sẽ được kiểm tra theo sức chứa này. Chuồng mới ở trạng thái Chưa hoạt động và tự chuyển sang Đang hoạt động khi khai báo lứa nuôi.'}</p>
        <label htmlFor="barn-description">Ghi chú</label>
        <textarea id="barn-description" className="farmshift-form-control" rows={3} maxLength={1000} value={form.description}
          onChange={event => set('description', event.target.value)} disabled={saving} />
        <FieldError message={errors.description} />
      </div>
      <footer className={styles.footer}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>Bỏ qua</button>
        <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={saving} aria-busy={saving}>{saving ? 'Đang lưu...' : 'Lưu và đóng lại'}</button>
      </footer>
    </form>
  </Dialog>;
}

export function DeleteDialog({ kind, item, onClose, onDeleted }) {
  const isArea = kind === 'area';
  // Business rules: an area with barns, or a barn holding animals, cannot be deleted.
  const blocker = isArea
    ? item.barnCount > 0 && `Khu nuôi đang có ${item.barnCount} chuồng. Hãy xóa hoặc chuyển các chuồng sang khu khác trước khi xóa khu nuôi.`
    : item.currentQuantity > 0 && `Chuồng đang nuôi ${item.currentQuantity.toLocaleString('vi-VN')} con. Hãy xuất bán hoặc chuyển hết vật nuôi trước khi xóa chuồng.`;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const label = isArea ? 'khu nuôi' : 'chuồng';

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      if (isArea) await deleteFarmArea(item.id);
      else await deleteBarn(item.id);
      onDeleted(`Đã xóa ${label} ${item.name}.`);
    } catch (requestError) { setError(apiErrorMessage(requestError)); setBusy(false); }
  };

  return <Dialog title={`Xóa ${label}`} labelId="farm-delete-title" busy={busy} onClose={onClose}>
    <div className={styles.modalBody}>
      {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
      {blocker ? <p className={styles.warning}><AlertTriangle size={16} />{blocker}</p>
        : <p>Bạn chắc chắn muốn xóa {label} <strong>{item.name}</strong>? Thao tác này không thể hoàn tác.</p>}
    </div>
    <footer className={styles.footer}>
      <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={busy}>{blocker ? 'Đóng' : 'Hủy bỏ'}</button>
      {!blocker && <button type="button" className={`farmshift-btn ${styles.deleteButton}`} onClick={confirm} disabled={busy} aria-busy={busy}>{busy ? 'Đang xóa...' : `Xóa ${label}`}</button>}
    </footer>
  </Dialog>;
}
