import { useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { Dialog, FieldError } from './FarmAreaDialogs';
import { apiErrorMessage } from './farmAreaOptions';
import { CurrencyInput } from '../../components/CurrencyInput/CurrencyInput';
import { QuantityInput } from '../../components/QuantityInput/QuantityInput';
import styles from './AreasView.module.css';

// Validation (400) and duplicate-name (409) responses carry { field: message } in data.
const apiFieldErrors = error => {
  const data = error.response?.data?.data;
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
};

/**
 * Generic form dialog driven by a field list. Each field: { key, label, type: text|number|date|select|textarea,
 * required, options: [{ value, label }], min, max, step, placeholder, hint, full, render, visible }. render(props, setValue)
 * draws a custom control (props carry id, value, className and aria attributes); visible(values) hides a field (and skips
 * its required check) when it returns false. validate(values) returns { key: message }; onSubmit(values) performs the
 * request and resolves to the success message.
 */
export function FormDialog({ title, intro, warning, fields: allFields, initial, validate, preview, onSubmit, submitLabel = 'Lưu và đóng lại', danger, onClose, onDone }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Ô chọn có danh sách phụ thuộc giá trị khác (options là hàm): lựa chọn cũ không còn hợp lệ thì chuyển sang dòng đầu.
  const optionsOf = (field, current) => (typeof field.options === 'function' ? field.options(current) : field.options);
  const reconcile = next => {
    allFields.filter(field => typeof field.options === 'function').forEach(field => {
      const options = optionsOf(field, next);
      if (!options.some(option => option.value === next[field.key])) next[field.key] = options[0]?.value ?? '';
    });
    return next;
  };
  const set = (key, value) => {
    const next = reconcile({ ...values, [key]: value });
    setValues(next);
    const liveErrors = validate ? validate(next) : null;
    setErrors(current => {
      const updated = { ...current };
      updated[key] = liveErrors && String(value ?? '').trim() !== '' ? (liveErrors[key] || undefined) : undefined;
      Object.keys(current).forEach(existingKey => {
        if (existingKey !== key && current[existingKey]) {
          updated[existingKey] = liveErrors?.[existingKey] || undefined;
        }
      });
      if (key === 'importDate' && liveErrors && String(next.ageAtImport ?? '').trim() !== '') {
        updated.ageAtImport = liveErrors.ageAtImport || undefined;
      }
      return updated;
    });
  };
  const fields = allFields.filter(field => !field.visible || field.visible(values));

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
    if (field.render) return field.render(common, value => set(field.key, value));
    if (field.type === 'select') return <select {...common}>{optionsOf(field, values).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    if (field.type === 'textarea') return <textarea {...common} rows={3} maxLength={1000} placeholder={field.placeholder} />;
    if (field.type === 'currency' || field.key === 'unitPrice' || field.key === 'amount' || field.key === 'price') {
      const { className, ...rest } = common;
      return <CurrencyInput {...rest} inputClassName={className} suffix={field.suffix ?? 'đ'} showWords={field.showWords !== false} placeholder={field.placeholder} />;
    }
    if (field.type === 'number') {
      const { className, ...rest } = common;
      const allowDecimal = Boolean(field.step && String(field.step).includes('.'));
      return (
        <QuantityInput
          {...rest}
          inputClassName={className}
          allowDecimal={allowDecimal}
          suffix={field.suffix || ''}
          max={field.max}
          showMaxButton={Boolean(field.showMaxButton)}
          suppressMaxError={Boolean(validate)}
          placeholder={field.placeholder}
        />
      );
    }
    return <input {...common} type={field.type || 'text'} min={field.min} max={field.max} step={field.step} placeholder={field.placeholder} />;
  };

  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return <Dialog title={title} labelId="cycle-form-title" busy={saving} isDirty={isDirty} onClose={onClose} wide>
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
        {preview?.(values)}
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
