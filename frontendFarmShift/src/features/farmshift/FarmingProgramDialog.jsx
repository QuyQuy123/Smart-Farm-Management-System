import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { createProgram, updateProgram } from '../../services/farmingProgramService';
import { listAllInventoryItems } from '../../services/inventoryItemService';
import { Dialog, FieldError } from './FarmAreaDialogs';
import {
  CARE_PROCEDURE_METHODS, DRINKING_MEDICINE_METHODS, DRINKING_MEDICINE_UNITS,
  MEDICINE_METHODS, MEDICINE_UNITS, STEP_CATEGORIES, VACCINE_METHODS,
  apiErrorMessage, itemFitsStep, itemsForStep, stockKind, uniqueByName, validateProgram,
} from './farmAreaOptions';
import { StockNamePicker } from './StockNamePicker';
import { QuantityInput } from '../../components/QuantityInput/QuantityInput';
import styles from './FarmingPrograms.module.css';

const text = value => (value == null ? '' : String(value));
const toDraftStep = step => ({
  category: step.category,
  name: step.name || '',
  dayFrom: text(step.dayFrom),
  dayTo: text(step.dayTo),
  quantity: text(step.quantity),
  unit: step.category === 'FEED' ? '' : step.unit || '',
  mealsPerDay: text(step.mealsPerDay),
  method: step.method || '',
  tempMin: text(step.tempMin),
  tempMax: text(step.tempMax),
  note: step.note || '',
  inventoryItemId: text(step.inventoryItemId),
});
const emptyStep = (category, dayFrom) => ({
  category,
  name: '',
  dayFrom: text(dayFrom),
  dayTo: text(dayFrom),
  quantity: '',
  unit: category === 'DRINKING_MEDICINE' ? DRINKING_MEDICINE_UNITS[0]
    : category === 'MEDICINE' ? MEDICINE_UNITS[0]
      : category === 'VACCINE' ? 'liều/con' : '',
  mealsPerDay: category === 'FEED' ? '3' : '',
  method: category === 'DRINKING_MEDICINE' ? 'HAND_DRINKER'
    : category === 'VACCINE' ? 'EYE_NOSE'
      : category === 'MEDICINE' ? 'MIX_FEED'
        : category === 'CARE_PROCEDURE' ? 'PROCEDURE' : '',
  tempMin: '',
  tempMax: '',
  note: '',
  inventoryItemId: '',
});
const numberOrNull = value => (value === '' || value == null ? null : Number(value));

const COLUMNS = {
  FEED: [
    ['name', 'Loại cám', 'pick', 'Chọn hoặc gõ loại cám'],
    ['quantity', 'Định mức (g/con/ngày)', 'number', '0.1'],
    ['mealsPerDay', 'Số cữ/ngày', 'number', '1'],
  ],
  DRINKING_MEDICINE: [
    ['name', 'Thuốc uống / men / bổ', 'pick', 'Chọn hoặc gõ thuốc uống'],
    ['method', 'Phương thức cấp', 'select', DRINKING_MEDICINE_METHODS],
    ['quantity', 'Liều lượng', 'number', '0.01'],
    ['unit', 'Đơn vị', 'drinkingUnit', DRINKING_MEDICINE_UNITS],
  ],
  VACCINE: [
    ['name', 'Tên vắc-xin', 'pick', 'Chọn hoặc gõ vắc-xin'],
    ['method', 'Cách dùng', 'select', VACCINE_METHODS],
    ['quantity', 'Liều', 'number', '0.01'],
    ['unit', 'Đơn vị', 'text', 'liều/con'],
  ],
  MEDICINE: [
    ['name', 'Tên thuốc', 'pick', 'Chọn hoặc gõ tên thuốc'],
    ['method', 'Cách dùng', 'select', MEDICINE_METHODS],
    ['quantity', 'Liều lượng', 'number', '0.01'],
    ['unit', 'Đơn vị', 'unit', MEDICINE_UNITS],
  ],
  CARE_PROCEDURE: [
    ['name', 'Tên thủ thuật', 'text', 'Ví dụ: Làm mỏ lần 1'],
    ['method', 'Phương thức', 'select', CARE_PROCEDURE_METHODS],
  ],
};

export function FarmingProgramDialog({ program, onClose, onSaved }) {
  const editing = Boolean(program);
  const [draft, setDraft] = useState(() => ({
    name: program?.name || '',
    breed: program?.breed || '',
    durationDays: text(program?.durationDays ?? ''),
    targetWeightMin: text(program?.targetWeightMin),
    targetWeightMax: text(program?.targetWeightMax),
    description: program?.description || '',
    // WORK & TEMPERATURE cũ không còn hiển thị tab tạo/sửa mới (nhiệt độ theo dõi qua IoT).
    steps: program
      ? program.steps.filter(step => step.category !== 'WORK' && step.category !== 'TEMPERATURE').map(toDraftStep)
      : [emptyStep('FEED', 1)],
  }));
  const [legacyTemperatureSteps, setLegacyTemperatureSteps] = useState(() => (
    program ? program.steps.filter(step => step.category === 'TEMPERATURE').map(toDraftStep) : []
  ));
  const [tab, setTab] = useState('FEED');
  const [errors, setErrors] = useState({ fields: {}, steps: {} });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [items, setItems] = useState([]);
  const [itemsError, setItemsError] = useState('');
  const [itemsLoading, setItemsLoading] = useState(true);

  const feedOptions = useMemo(() => {
    const names = new Map();
    for (const item of items.filter(item => stockKind(item) === 'FEED')) {
      const name = item.name?.normalize('NFC').trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase('vi');
      if (!names.has(key)) names.set(key, { name, items: [] });
      names.get(key).items.push(item);
    }
    return [...names.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    listAllInventoryItems()
      .then(data => { if (!cancelled) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setItemsError('Không tải được danh sách hàng hóa kho. Vui lòng mở lại form để thử lại.'); })
      .finally(() => { if (!cancelled) setItemsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const setField = (key, value) => {
    setDirty(true);
    setDraft(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, fields: { ...current.fields, [key]: undefined } }));
  };
  const setStep = (index, key, value) => {
    setDirty(true);
    setDraft(current => ({ ...current, steps: current.steps.map((step, i) => (i === index ? { ...step, [key]: value } : step)) }));
    setErrors(current => ({ ...current, steps: { ...current.steps, [index]: undefined } }));
  };
  const addStep = () => {
    setDirty(true);
    setDraft(current => {
      const last = current.steps.filter(step => step.category === tab).reduce((max, step) => Math.max(max, Number(step.dayTo) || 0), 0);
      return { ...current, steps: [...current.steps, emptyStep(tab, last + 1)] };
    });
  };
  const removeStep = index => {
    setDirty(true);
    setDraft(current => ({ ...current, steps: current.steps.filter((_, i) => i !== index) }));
    setErrors(current => ({ ...current, steps: {} }));
  };

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    const found = validateProgram(draft);
    const durationNum = Number(draft.durationDays);
    if (!found.fields.durationDays && !found.fields.steps && legacyTemperatureSteps.length > 0) {
      if (legacyTemperatureSteps.some(step => Number(step.dayTo) > durationNum)) {
        found.fields.steps = `Mốc nhiệt độ cũ vượt thời gian nuôi mới (${durationNum} ngày). Hãy tăng thời gian nuôi hoặc bấm "Gỡ mốc nhiệt độ cũ".`;
      } else {
        const sortedTemp = [...legacyTemperatureSteps].sort((a, b) => Number(a.dayFrom) - Number(b.dayFrom));
        const invalidLegacyTemp = sortedTemp.some((step, idx) => {
          const from = Number(step.dayFrom);
          const to = Number(step.dayTo);
          const tMin = Number(step.tempMin);
          const tMax = Number(step.tempMax);
          const badFields = !step.name?.trim()
            || !Number.isInteger(from) || !Number.isInteger(to) || from < 1 || from > to || to > durationNum
            || step.tempMin === '' || step.tempMax === '' || !Number.isFinite(tMin) || !Number.isFinite(tMax)
            || tMin < 10 || tMax > 45 || tMin >= tMax;
          const overlapsPrev = idx > 0 && from <= Number(sortedTemp[idx - 1].dayTo);
          return badFields || overlapsPrev;
        });
        if (invalidLegacyTemp) {
          found.fields.steps = 'Mốc nhiệt độ cũ không còn hợp lệ (ngoài dải 10–45°C hoặc bị chồng ngày). Hãy bấm "Gỡ mốc nhiệt độ cũ" trước khi lưu.';
        }
      }
    }
    setErrors(found);
    const firstBad = Object.keys(found.steps).map(Number).sort((a, b) => a - b)[0];
    if (firstBad !== undefined) setTab(draft.steps[firstBad].category);
    if (Object.keys(found.fields).length || firstBad !== undefined) return;
    setSaving(true);
    setError('');
    const preservedTemperaturePayload = legacyTemperatureSteps.map(step => ({
      category: 'TEMPERATURE',
      name: step.name.trim(),
      dayFrom: Number(step.dayFrom),
      dayTo: Number(step.dayTo),
      quantity: null,
      unit: '',
      mealsPerDay: null,
      method: null,
      tempMin: numberOrNull(step.tempMin),
      tempMax: numberOrNull(step.tempMax),
      note: step.note.trim(),
      inventoryItemId: null,
      feedInputMode: null,
      bagWeightKg: null,
      bagsPer1000Birds: null,
    }));
    const payload = {
      name: draft.name.trim(),
      breed: draft.breed.trim(),
      durationDays: Number(draft.durationDays),
      targetWeightMin: numberOrNull(draft.targetWeightMin),
      targetWeightMax: numberOrNull(draft.targetWeightMax),
      description: draft.description.trim(),
      steps: [
        ...draft.steps.map(step => ({
          category: step.category,
          name: step.name.trim(),
          dayFrom: Number(step.dayFrom),
          dayTo: Number(step.dayTo),
          quantity: numberOrNull(step.quantity),
          unit: step.unit.trim(),
          mealsPerDay: numberOrNull(step.mealsPerDay),
          method: step.method || null,
          tempMin: numberOrNull(step.tempMin),
          tempMax: numberOrNull(step.tempMax),
          note: step.note.trim(),
          inventoryItemId: ['FEED', 'VACCINE', 'MEDICINE', 'DRINKING_MEDICINE'].includes(step.category) && step.inventoryItemId
            ? Number(step.inventoryItemId) : null,
          feedInputMode: step.category === 'FEED' ? 'GRAM_PER_BIRD_DAY' : null,
          bagWeightKg: null,
          bagsPer1000Birds: null,
        })),
        ...preservedTemperaturePayload,
      ],
    };
    try {
      if (editing) await updateProgram(program.id, payload);
      else await createProgram(payload);
      onSaved(editing ? `Đã cập nhật chương trình ${payload.name}.` : `Đã tạo chương trình ${payload.name}.`);
    } catch (requestError) {
      const data = requestError.response?.data?.data;
      if (data && typeof data === 'object' && !Array.isArray(data) && data.name) setErrors({ fields: { name: data.name }, steps: {} });
      else setError(apiErrorMessage(requestError));
      setSaving(false);
    }
  };

  const header = (key, label, input, required, span) => <div className={styles[span]}>
    <label htmlFor={`program-${key}`}>{label} {required && <span className={styles.required}>*</span>}</label>
    {input}
    <FieldError message={errors.fields[key]} />
  </div>;
  const headerInput = (key, props = {}) => {
    const cls = `farmshift-form-control ${errors.fields[key] ? styles.invalid : ''}`;
    if (props.type === 'number') {
      const { type: _type, min: _min, max, step, ...rest } = props;
      return <QuantityInput id={`program-${key}`} inputClassName={cls} allowDecimal={Boolean(step && String(step).includes('.'))} max={max}
        value={draft[key]} onChange={event => setField(key, event.target.value)} disabled={saving} aria-invalid={Boolean(errors.fields[key])} {...rest} />;
    }
    return <input id={`program-${key}`} className={cls}
      value={draft[key]} onChange={event => setField(key, event.target.value)} disabled={saving} aria-invalid={Boolean(errors.fields[key])} {...props} />;
  };

  const rows = draft.steps.map((step, index) => ({ step, index })).filter(row => row.step.category === tab);
  const category = STEP_CATEGORIES.find(item => item.value === tab);

  const cell = (row, [key, label, kind, extra]) => {
    const common = {
      'aria-label': `${label} dòng ${row.index + 1}`,
      value: row.step[key],
      disabled: saving,
      className: 'farmshift-form-control',
      onChange: event => setStep(row.index, key, event.target.value),
    };
    if (kind === 'select') return <select {...common}>{extra.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    if (kind === 'pick' && row.step.category === 'FEED') {
      const known = feedOptions.some(option => option.name === row.step.name);
      return <select aria-label={common['aria-label']} className="farmshift-form-control" value={row.step.name} disabled={saving || itemsLoading}
        aria-invalid={Boolean(errors.steps[row.index])} onChange={event => {
          const option = feedOptions.find(opt => opt.name === event.target.value);
          const candidates = option?.items || [];
          const selected = candidates.find(item => String(item.id) === String(row.step.inventoryItemId))
            || (candidates.length === 1 ? candidates[0] : null);
          setStep(row.index, 'name', option?.name || '');
          setStep(row.index, 'inventoryItemId', selected && itemFitsStep(selected, 'FEED', '') ? String(selected.id) : '');
        }}>
        <option value="">{itemsLoading ? 'Đang tải loại cám...' : 'Chọn loại cám'}</option>
        {!known && row.step.name && <option value={row.step.name}>{row.step.name}</option>}
        {feedOptions.map(option => <option key={option.name} value={option.name}>{option.name}</option>)}
      </select>;
    }
    if (kind === 'pick') {
      return <StockNamePicker label={common['aria-label']} value={row.step.name} itemId={row.step.inventoryItemId} placeholder={extra}
        options={uniqueByName(itemsForStep(items, row.step.category, row.step.unit), row.step.inventoryItemId)} disabled={saving} invalid={Boolean(errors.steps[row.index])}
        onChange={({ name, inventoryItemId }) => {
          setStep(row.index, 'name', name);
          setStep(row.index, 'inventoryItemId', inventoryItemId);
        }} />;
    }
    if (kind === 'unit') return <input {...common} list="program-medicine-units" />;
    if (kind === 'drinkingUnit') return <input {...common} list="program-drinking-units" />;
    if (kind === 'number') {
      const { className, ...rest } = common;
      return <QuantityInput {...rest} inputClassName={className} allowDecimal
        placeholder={key === 'quantity' && row.step.category === 'FEED' ? 'g/con/ngày' : undefined} />;
    }
    return <input {...common} placeholder={extra} maxLength={200} />;
  };

  return <Dialog title={editing ? 'Chỉnh sửa chương trình nuôi' : 'Tạo chương trình nuôi'} labelId="farming-program-title" busy={saving} isDirty={dirty} onClose={onClose} wide className={styles.editor}>
    <form onSubmit={submit} noValidate>
      <div className={styles.editorBody}>
        {error && <p role="alert" className={styles.error}><AlertCircle size={16} />{error}</p>}
        <h3 className={styles.blockTitle}>Thông tin chung</h3>
        <div className={styles.headerGrid}>
          {header('name', 'Tên chương trình', headerInput('name', { maxLength: 150, placeholder: 'Ví dụ: Gà ta 90 ngày', autoFocus: true }), true, 'half')}
          {header('breed', 'Giống gà', headerInput('breed', { maxLength: 100, placeholder: 'Ví dụ: Gà ta' }), true, 'half')}
          {header('durationDays', 'Thời gian nuôi (ngày)', headerInput('durationDays', { type: 'number', min: 1, max: 365, placeholder: 'Ví dụ: 90' }), true, 'third')}
          <div className={styles.twoThirds}>
            <label htmlFor="program-targetWeightMin">Cân xuất chuồng (kg)</label>
            <div className={styles.range}>
              {headerInput('targetWeightMin', { type: 'number', min: 0, step: 0.01, placeholder: 'Từ, ví dụ 1.8' })}
              <span aria-hidden="true">–</span>
              {headerInput('targetWeightMax', { type: 'number', min: 0, step: 0.01, placeholder: 'Đến, ví dụ 2.3', 'aria-label': 'Cân xuất chuồng đến (kg)' })}
            </div>
            <FieldError message={errors.fields.targetWeightMin || errors.fields.targetWeightMax} />
          </div>
          {header('description', 'Mô tả', <textarea id="program-description" className="farmshift-form-control" rows={2} maxLength={1000} value={draft.description}
            onChange={event => setField('description', event.target.value)} disabled={saving} placeholder="Ví dụ: Quy trình 90 ngày, 3 giai đoạn cám & lịch uống thuốc" />, false, 'fullRow')}
        </div>

        <h3 className={styles.blockTitle}>Nội dung theo ngày tuổi</h3>
        <div className={styles.sectionTabs} role="tablist">
          {STEP_CATEGORIES.map(item => {
            const count = draft.steps.filter(step => step.category === item.value).length;
            const hasError = draft.steps.some((step, index) => step.category === item.value && errors.steps[index]);
            return <button key={item.value} type="button" role="tab" aria-selected={tab === item.value}
              className={`${tab === item.value ? styles.sectionActive : ''} ${hasError ? styles.sectionError : ''}`} onClick={() => setTab(item.value)}>
              {item.label} <span>{count}</span>
            </button>;
          })}
        </div>
        <FieldError message={errors.fields.steps} />
        {legacyTemperatureSteps.length > 0 && <div className={styles.legacyTempNotice} role="status">
          <span>
            Chương trình này đang giữ nguyên <strong>{legacyTemperatureSteps.length}</strong> mốc nhiệt độ từ cấu hình cũ khi lưu (nhiệt độ hiện được theo dõi qua cảm biến IoT).
          </span>
          <button
            type="button"
            className="farmshift-btn farmshift-btn-secondary"
            disabled={saving}
            onClick={() => {
              setLegacyTemperatureSteps([]);
              setErrors(current => ({ ...current, fields: { ...current.fields, steps: undefined } }));
            }}
          >
            Gỡ mốc nhiệt độ cũ
          </button>
        </div>}
        {tab === 'FEED' && <p className={styles.itemHint}>Chọn tên cám từ kho và nhập định mức theo g/con/ngày cùng số cữ cho ăn mỗi ngày.</p>}
        {tab === 'DRINKING_MEDICINE' && <p className={styles.itemHint}>Lịch uống thuốc úm, men tiêu hóa, thuốc bổ bằng bình xách tay (gà nhỏ) hoặc hệ thống uống tự động.</p>}
        {['VACCINE', 'MEDICINE'].includes(tab) && <p className={styles.itemHint}>
          Gõ để lọc và chọn {tab === 'VACCINE' ? 'vắc-xin' : 'thuốc'} có trong kho: khi công nhân xác nhận việc,
          hệ thống tự trừ kho và cộng chi phí vào lứa. Tên gõ tay vẫn lưu được nhưng không trừ kho.</p>}
        {tab === 'CARE_PROCEDURE' && <p className={styles.itemHint}>Khai báo thủ thuật chăm sóc định kỳ theo ngày tuổi (ví dụ: Làm mỏ lần 1 ngày 16, Làm mỏ lần 2 ngày 45).</p>}
        {itemsError && <p className={styles.itemHint} role="status">{itemsError}</p>}

        <div className={styles.stepTableWrap}>
          <table className={`${styles.stepTable} ${tab === 'FEED' ? styles.feedTable : ''}`}>
            {tab === 'FEED' && <colgroup>
              <col style={{ width: '9%' }} /><col style={{ width: '9%' }} />
              <col style={{ width: '34%' }} /><col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} /><col style={{ width: '19%' }} /><col style={{ width: '5%' }} />
            </colgroup>}
            <thead><tr><th>Từ ngày</th><th>Đến ngày</th>{COLUMNS[tab].map(column => <th key={column[0]}>{column[1]}</th>)}<th>Ghi chú</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={COLUMNS[tab].length + 4} className={styles.emptyRow}>Chưa có {category.item}. Bấm "Thêm dòng" để thêm.</td></tr>
                : rows.map(row => <Fragment key={row.index}><tr className={errors.steps[row.index] ? styles.rowError : ''}>
                  <td><QuantityInput aria-label={`Từ ngày dòng ${row.index + 1}`} inputClassName="farmshift-form-control" value={row.step.dayFrom}
                    onChange={event => setStep(row.index, 'dayFrom', event.target.value)} disabled={saving} /></td>
                  <td><QuantityInput aria-label={`Đến ngày dòng ${row.index + 1}`} inputClassName="farmshift-form-control" value={row.step.dayTo}
                    onChange={event => setStep(row.index, 'dayTo', event.target.value)} disabled={saving} /></td>
                  {COLUMNS[tab].map(column => <td key={column[0]}>{cell(row, column)}</td>)}
                  <td><input aria-label={`Ghi chú dòng ${row.index + 1}`} className="farmshift-form-control" value={row.step.note} maxLength={1000}
                    onChange={event => setStep(row.index, 'note', event.target.value)} disabled={saving} /></td>
                  <td><button type="button" className={styles.iconButton} aria-label={`Xóa dòng ${row.index + 1}`} onClick={() => removeStep(row.index)} disabled={saving}><Trash2 size={15} /></button></td>
                </tr>
                {errors.steps[row.index] && <tr className={styles.rowMessageRow}><td colSpan={COLUMNS[tab].length + 4} role="alert">{errors.steps[row.index]}</td></tr>}
                </Fragment>)}
            </tbody>
          </table>
          <datalist id="program-medicine-units">{MEDICINE_UNITS.map(unit => <option key={unit} value={unit} />)}</datalist>
          <datalist id="program-drinking-units">{DRINKING_MEDICINE_UNITS.map(unit => <option key={unit} value={unit} />)}</datalist>
        </div>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={addStep} disabled={saving}><Plus size={15} />Thêm dòng</button>
      </div>
      <footer className={styles.footer}>
        <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={onClose} disabled={saving}>Bỏ qua</button>
        <button type="submit" className={`farmshift-btn ${styles.saveButton}`} disabled={saving} aria-busy={saving}>{saving ? 'Đang lưu...' : 'Lưu chương trình'}</button>
      </footer>
    </form>
  </Dialog>;
}
