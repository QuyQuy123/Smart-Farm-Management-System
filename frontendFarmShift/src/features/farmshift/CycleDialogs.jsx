import { useEffect, useState } from 'react';
import { AlertCircle, Info, Plus, Trash2 } from 'lucide-react';
import { attachProgram, createProgram, listPrograms } from '../../services/cycleService';
import { Dialog, FieldError } from './FarmAreaDialogs';
import { PROGRAM_TYPES, apiErrorMessage, labelOf } from './farmAreaOptions';
import styles from './AreasView.module.css';

// Validation (400) and duplicate-name (409) responses carry { field: message } in data.
const apiFieldErrors = error => {
  const data = error.response?.data?.data;
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
};

/**
 * Generic form dialog driven by a field list. Each field: { key, label, type: text|number|date|select|textarea,
 * required, options: [{ value, label }], min, max, step, placeholder, hint, full }. validate(values) returns
 * { key: message }; onSubmit(values) performs the request and resolves to the success message.
 */
export function FormDialog({ title, intro, warning, fields, initial, validate, onSubmit, submitLabel = 'Lưu và đóng lại', danger, onClose, onDone }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key, value) => { setValues(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); };

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    const found = {};
    fields.forEach(field => { if (field.required && String(values[field.key] ?? '').trim() === '') found[field.key] = `Vui lòng nhập ${field.label.toLowerCase()}.`; });
    Object.assign(found, validate ? Object.fromEntries(Object.entries(validate(values)).filter(([key, message]) => message && !found[key])) : {});
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setError('');
    try {
      onDone(await onSubmit(values));
    } catch (requestError) {
      const fieldErrors = apiFieldErrors(requestError);
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) setError(apiErrorMessage(requestError));
      setSaving(false);
    }
  };

  const input = field => {
    const id = `cycle-form-${field.key}`;
    const common = {
      id, value: values[field.key] ?? '', disabled: saving || field.disabled, onChange: event => set(field.key, event.target.value),
      className: `farmshift-form-control ${errors[field.key] ? styles.invalid : ''}`,
      'aria-invalid': Boolean(errors[field.key]), 'aria-describedby': errors[field.key] ? `${id}-error` : field.hint ? `${id}-hint` : undefined,
    };
    if (field.type === 'select') return <select {...common}>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    if (field.type === 'textarea') return <textarea {...common} rows={3} maxLength={1000} placeholder={field.placeholder} />;
    return <input {...common} type={field.type || 'text'} min={field.min} max={field.max} step={field.step} placeholder={field.placeholder}
      inputMode={field.type === 'number' ? (field.step && String(field.step).includes('.') ? 'decimal' : 'numeric') : undefined} />;
  };

  return <Dialog title={title} labelId="cycle-form-title" busy={saving} onClose={onClose} wide>
    <form onSubmit={submit} noValidate>
      <div className={styles.modalBody}>
        {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
        {warning && <p className={styles.warning}><AlertCircle size={16} />{warning}</p>}
        {intro && <p className={styles.infoNote}><Info size={16} />{intro}</p>}
        <div className={styles.formGrid}>
          {fields.map(field => <div key={field.key} className={field.full ? styles.fullRow : undefined}>
            <label htmlFor={`cycle-form-${field.key}`}>{field.label} {field.required && <span className={styles.required}>*</span>}</label>
            {input(field)}
            {field.hint && !errors[field.key] && <small id={`cycle-form-${field.key}-hint`} className={styles.fieldHint}>{field.hint}</small>}
            <FieldError id={`cycle-form-${field.key}-error`} message={errors[field.key]} />
          </div>)}
        </div>
      </div>
      <footer className={styles.footer}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>Bỏ qua</button>
        <button type="submit" className={`farmshift-btn ${danger ? styles.deleteButton : 'farmshift-btn-mint'}`} disabled={saving} aria-busy={saving}>
          {saving ? 'Đang lưu...' : submitLabel}
        </button>
      </footer>
    </form>
  </Dialog>;
}

const emptyStep = () => ({ name: '', dayFrom: '', dayTo: '', quantity: '', unit: '' });

/** Chọn chương trình nuôi có sẵn hoặc tạo mới rồi áp dụng cho lứa. */
export function ProgramDialog({ cycleId, attachedIds, onClose, onDone }) {
  const [programs, setPrograms] = useState(null);
  const [mode, setMode] = useState('pick');
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState({ name: '', type: 'HEALTH', description: '', steps: [emptyStep()] });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPrograms().then(list => {
      if (cancelled) return;
      const available = list.filter(program => !attachedIds.includes(program.id));
      setPrograms(available);
      setSelected(available[0] ? String(available[0].id) : '');
      if (!available.length) setMode('create');
    }).catch(requestError => { if (!cancelled) { setPrograms([]); setError(apiErrorMessage(requestError)); } });
    return () => { cancelled = true; };
  }, [attachedIds]);

  const setStep = (index, key, value) => setDraft(current => ({ ...current, steps: current.steps.map((step, i) => i === index ? { ...step, [key]: value } : step) }));
  const chosen = programs?.find(program => String(program.id) === selected);

  const validateDraft = () => {
    const found = {};
    if (!draft.name.trim()) found.name = 'Vui lòng nhập tên chương trình.';
    draft.steps.forEach((step, index) => {
      const from = Number(step.dayFrom); const to = Number(step.dayTo);
      if (!step.name.trim()) found[`step-${index}`] = 'Vui lòng nhập tên nội dung.';
      else if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1 || step.dayFrom === '' || step.dayTo === '') found[`step-${index}`] = 'Ngày tuổi phải là số nguyên từ 1.';
      else if (from > to) found[`step-${index}`] = 'Ngày tuổi bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.';
    });
    return found;
  };

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    setError('');
    let programId = Number(selected);
    if (mode === 'create') {
      const found = validateDraft();
      setErrors(found);
      if (Object.keys(found).length) return;
    } else if (!programId) { setError('Vui lòng chọn chương trình nuôi.'); return; }
    setSaving(true);
    try {
      if (mode === 'create') {
        const created = await createProgram({
          name: draft.name.trim(), type: draft.type, description: draft.description.trim(),
          steps: draft.steps.map(step => ({ name: step.name.trim(), dayFrom: Number(step.dayFrom), dayTo: Number(step.dayTo),
            quantity: step.quantity === '' ? null : Number(step.quantity), unit: step.unit.trim() })),
        });
        programId = created.id;
      }
      await attachProgram(cycleId, programId);
      onDone(`Đã áp dụng chương trình ${mode === 'create' ? draft.name.trim() : chosen?.name} cho lứa nuôi.`);
    } catch (requestError) {
      const fieldErrors = apiFieldErrors(requestError);
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) setError(apiErrorMessage(requestError));
      setSaving(false);
    }
  };

  return <Dialog title="Thêm chương trình nuôi" labelId="program-dialog-title" busy={saving} onClose={onClose} wide>
    <form onSubmit={submit} noValidate>
      <div className={styles.modalBody}>
        {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
        <div className={styles.segmented} role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'pick'} className={mode === 'pick' ? styles.segmentActive : ''}
            onClick={() => setMode('pick')} disabled={!programs?.length}>Chọn chương trình có sẵn</button>
          <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? styles.segmentActive : ''}
            onClick={() => setMode('create')}>Tạo chương trình mới</button>
        </div>
        {programs === null ? <p className={styles.empty} role="status">Đang tải chương trình nuôi...</p> : mode === 'pick' ? <>
          <label htmlFor="program-select">Chương trình nuôi</label>
          <select id="program-select" className="farmshift-form-control" value={selected} onChange={event => setSelected(event.target.value)} disabled={saving}>
            {programs.map(program => <option key={program.id} value={program.id}>{program.name} · {labelOf(PROGRAM_TYPES, program.type)}</option>)}
          </select>
          {chosen && <ul className={styles.stepPreview}>
            {chosen.steps.map(step => <li key={step.id}><strong>{step.name}</strong><span>Ngày tuổi {step.dayFrom}{step.dayTo !== step.dayFrom ? `–${step.dayTo}` : ''}
              {step.quantity != null ? ` · ${Number(step.quantity).toLocaleString('vi-VN')} ${step.unit || ''}` : ''}</span></li>)}
          </ul>}
        </> : <>
          <div className={styles.formGrid}>
            <div>
              <label htmlFor="program-name">Tên chương trình <span className={styles.required}>*</span></label>
              <input id="program-name" className={`farmshift-form-control ${errors.name ? styles.invalid : ''}`} value={draft.name} maxLength={150}
                placeholder="Ví dụ: Lịch vắc-xin gà thịt" onChange={event => { setDraft({ ...draft, name: event.target.value }); setErrors({ ...errors, name: undefined }); }} disabled={saving} />
              <FieldError message={errors.name} />
            </div>
            <div>
              <label htmlFor="program-type">Loại chương trình</label>
              <select id="program-type" className="farmshift-form-control" value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })} disabled={saving}>
                {PROGRAM_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
          <fieldset className={styles.metricGroup}>
            <legend>Nội dung theo ngày tuổi</legend>
            {draft.steps.map((step, index) => <div key={index} className={styles.stepRow}>
              <input aria-label={`Tên nội dung ${index + 1}`} className="farmshift-form-control" placeholder="Ví dụ: Lasota lần 1" value={step.name} onChange={event => setStep(index, 'name', event.target.value)} disabled={saving} />
              <input aria-label={`Từ ngày tuổi ${index + 1}`} className="farmshift-form-control" type="number" min="1" placeholder="Từ" value={step.dayFrom} onChange={event => setStep(index, 'dayFrom', event.target.value)} disabled={saving} />
              <input aria-label={`Đến ngày tuổi ${index + 1}`} className="farmshift-form-control" type="number" min="1" placeholder="Đến" value={step.dayTo} onChange={event => setStep(index, 'dayTo', event.target.value)} disabled={saving} />
              <input aria-label={`Định mức ${index + 1}`} className="farmshift-form-control" type="number" min="0" step="0.01" placeholder="Định mức" value={step.quantity} onChange={event => setStep(index, 'quantity', event.target.value)} disabled={saving} />
              <input aria-label={`Đơn vị ${index + 1}`} className="farmshift-form-control" placeholder="Đơn vị" value={step.unit} maxLength={50} onChange={event => setStep(index, 'unit', event.target.value)} disabled={saving} />
              <button type="button" className={styles.iconButton} aria-label={`Xóa nội dung ${index + 1}`} disabled={saving || draft.steps.length === 1}
                onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })}><Trash2 size={15} /></button>
              <FieldError message={errors[`step-${index}`]} />
            </div>)}
            <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => setDraft({ ...draft, steps: [...draft.steps, emptyStep()] })} disabled={saving}>
              <Plus size={15} />Thêm nội dung
            </button>
          </fieldset>
        </>}
      </div>
      <footer className={styles.footer}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>Bỏ qua</button>
        <button type="submit" className="farmshift-btn farmshift-btn-mint" disabled={saving || programs === null} aria-busy={saving}>{saving ? 'Đang lưu...' : 'Áp dụng cho lứa'}</button>
      </footer>
    </form>
  </Dialog>;
}
