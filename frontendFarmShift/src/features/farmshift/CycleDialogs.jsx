import { useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { Dialog, FieldError } from './FarmAreaDialogs';
import { apiErrorMessage } from './farmAreaOptions';
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
