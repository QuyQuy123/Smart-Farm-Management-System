// Vietnamese labels for the farm-area / barn codes returned by /api/farm-areas and /api/barns.
/** Mật độ nuôi gà thịt khuyến nghị, dùng để gợi ý sức chứa từ diện tích chuồng. */
export const BIRDS_PER_M2 = 8;
export const suggestCapacity = areaM2 => {
  const area = Number(areaM2);
  return areaM2 !== '' && area > 0 ? Math.floor(area * BIRDS_PER_M2) : null;
};

export const BARN_STATUSES = [
  { value: 'INACTIVE', label: 'Chưa hoạt động', tone: 'neutral' },
  { value: 'ACTIVE', label: 'Đang hoạt động', tone: 'success' },
];

export const ENVIRONMENT_METRICS = [
  { value: 'HUMIDITY', label: 'Độ ẩm' },
  { value: 'TEMPERATURE', label: 'Nhiệt độ' },
];

export const ANIMAL_METRICS = [
  { value: 'WEIGHT', label: 'Cân nặng' },
  { value: 'LOSS', label: 'Hao hụt (con)' },
  { value: 'MANURE', label: 'Tình trạng phân' },
  { value: 'ANIMAL_PHOTO', label: 'Ảnh vật nuôi' },
  { value: 'DEAD_PHOTO', label: 'Ảnh chết loại' },
  { value: 'NOTE', label: 'Ghi chú' },
];

export const labelOf = (options, value) => options.find(option => option.value === value)?.label || value || '—';

export const apiErrorMessage = error => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';

/**
 * Mirrors the backend barn rules so the owner sees problems before submitting. Animals only enter through
 * flock imports, so the form checks capacity against the barn's current stock and its running cycle.
 */
export const validateBarn = (form, barn) => {
  const errors = {};
  const capacity = Number(form.capacity);
  const stock = barn?.currentQuantity || 0;
  if (!form.areaId) errors.areaId = 'Vui lòng chọn khu nuôi.';
  if (!form.name.trim()) errors.name = 'Vui lòng nhập tên chuồng.';
  if (form.capacity === '' || !Number.isInteger(capacity) || capacity < 1) errors.capacity = 'Sức chứa tối đa phải là số nguyên lớn hơn 0.';
  else if (capacity < stock) errors.capacity = `Sức chứa tối đa nhỏ hơn số con đang nuôi (${stock.toLocaleString('vi-VN')}).`;
  if (form.areaM2 !== '' && (Number.isNaN(Number(form.areaM2)) || Number(form.areaM2) <= 0)) errors.areaM2 = 'Diện tích phải lớn hơn 0.';
  if (form.targetWeight !== '' && (Number.isNaN(Number(form.targetWeight)) || Number(form.targetWeight) < 0 || Number(form.targetWeight) > 999)) {
    errors.targetWeight = 'Mục tiêu cân nặng từ 0 đến 999 kg.';
  }
  if (barn?.activeCycleId) {
    if (String(form.areaId) !== String(barn.areaId)) errors.areaId = 'Chuồng đang có lứa nuôi nên không thể chuyển sang khu khác.';
  }
  return errors;
};

// ---------------------------------------------------------------- farming cycles

/** Purchased flocks of one cycle must arrive within this many days of the first (matches the backend). */
export const MAX_IMPORT_SPREAD_DAYS = 3;

export const FLOCK_GENDERS = [
  { value: 'MALE', label: 'Trống' },
  { value: 'FEMALE', label: 'Mái' },
  { value: 'MIXED', label: 'Xô (trống mái lẫn)' },
];

export const MOVEMENT_TYPES = [
  { value: 'IMPORT', label: 'Nhập đàn' },
  { value: 'TRANSFER_IN', label: 'Chuyển đến' },
  { value: 'TRANSFER_OUT', label: 'Chuyển đi' },
  { value: 'DEATH', label: 'Hao hụt (chết)' },
  { value: 'CULL', label: 'Loại thải' },
  { value: 'HARVEST', label: 'Xuất bán' },
];

export const EXPENSE_CATEGORIES = [
  { value: 'ELECTRICITY', label: 'Tiền điện' },
  { value: 'WATER', label: 'Tiền nước' },
  { value: 'LABOR', label: 'Công nhân' },
  { value: 'MEDICINE', label: 'Thuốc & vắc-xin' },
  { value: 'OTHER', label: 'Chi phí khác' },
];

// ---------------------------------------------------------------- farming programs (by breed)

export const STEP_CATEGORIES = [
  { value: 'FEED', label: 'Cám định mức', item: 'mức cám' },
  { value: 'VACCINE', label: 'Lịch vắc-xin', item: 'mũi vắc-xin' },
  { value: 'MEDICINE', label: 'Thuốc trộn', item: 'đợt thuốc' },
  { value: 'TEMPERATURE', label: 'Nhiệt độ', item: 'mức nhiệt' },
];

export const VACCINE_METHODS = [
  { value: 'EYE_NOSE', label: 'Nhỏ mắt, mũi' },
  { value: 'MOUTH', label: 'Nhỏ miệng' },
  { value: 'DRINKING_WATER', label: 'Pha nước uống' },
  { value: 'INJECTION', label: 'Tiêm' },
  { value: 'WING_WEB', label: 'Chủng màng cánh' },
];

export const MEDICINE_METHODS = [
  { value: 'MIX_FEED', label: 'Trộn cám' },
  { value: 'MIX_WATER', label: 'Pha nước uống' },
];

export const METHODS = [...VACCINE_METHODS, ...MEDICINE_METHODS];

export const MEDICINE_UNITS = ['g/kg cám', 'ml/lít nước', 'g/lít nước', 'ml/kg cám'];

/** Quy cách đơn vị tồn kho (Bao 25kg = 25 kg, Lọ 1000 liều = 1000 liều) để quy đổi định mức chương trình sang tồn kho. */
export const USAGE_UNITS = [
  { value: 'KG', label: 'kg' },
  { value: 'G', label: 'g' },
  { value: 'L', label: 'lít' },
  { value: 'ML', label: 'ml' },
  { value: 'DOSE', label: 'liều' },
];

export const formatAmount = value => (value == null || value === '' ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 3 }));

export const contentText = (quantity, unit) => (quantity == null || !unit ? '' : `${formatAmount(quantity)} ${labelOf(USAGE_UNITS, unit)}`);

const DIMENSIONS = { KG: 'MASS', G: 'MASS', L: 'VOLUME', ML: 'VOLUME', DOSE: 'DOSE' };

/** Loại đại lượng của định mức: cám theo khối lượng, thuốc / vắc-xin theo tử số đơn vị liều (g/..., ml/..., liều/...). */
export const doseDimension = (category, unit) => {
  if (category === 'FEED') return 'MASS';
  const head = String(unit || '').split('/')[0].trim().toLowerCase();
  if (['kg', 'g', 'gam', 'gram'].includes(head)) return 'MASS';
  if (['l', 'lít', 'lit', 'ml'].includes(head)) return 'VOLUME';
  if (['liều', 'lieu', 'giọt', 'giot', 'dose'].includes(head)) return 'DOSE';
  return null;
};

const lowerVi = value => String(value || '').toLocaleLowerCase('vi');

/** Phân loại hàng hóa kho: cám (thức ăn), vắc-xin hoặc thuốc, theo tên, loại hàng và kho chứa. */
export const stockKind = item => {
  const name = lowerVi(item.name);
  if (/vắc|vac-?xin|vaccin/.test(name)) return 'VACCINE';
  const text = `${name} ${lowerVi(item.productType)} ${lowerVi(item.warehouseName)}`;
  if (/thức ăn|cám|ngô|bắp/.test(text)) return 'FEED';
  if (/thuốc|thú y|vitamin|kháng sinh|men|điện giải/.test(text)) return 'MEDICINE';
  return null;
};

/** Hàng hóa gợi ý cho một dòng chương trình: đúng nhóm (cám / vắc-xin / thuốc) và quy đổi được đơn vị. */
export const itemsForStep = (items, category, unit) => items.filter(item => stockKind(item) === category && itemFitsStep(item, category, unit));

/** Hàng hóa dùng được cho một nội dung khi có quy cách và cùng loại đại lượng với định mức. */
export const itemFitsStep = (item, category, unit) => {
  if (!item?.unitContentUnit) return false;
  const dimension = doseDimension(category, unit);
  return dimension === null || DIMENSIONS[item.unitContentUnit] === dimension;
};

const isWhole = value => value !== '' && value != null && Number.isInteger(Number(value));
const positive = value => value !== '' && value != null && Number(value) > 0;

/**
 * Mirrors the backend program rules. Returns { fields: { key: message }, steps: { index: message } }.
 * Steps are { category, name, dayFrom, dayTo, quantity, unit, mealsPerDay, method, tempMin, tempMax, note } with string inputs.
 */
export const validateProgram = draft => {
  const fields = {};
  const steps = {};
  const duration = Number(draft.durationDays);
  if (!draft.name.trim()) fields.name = 'Vui lòng nhập tên chương trình.';
  if (!draft.breed.trim()) fields.breed = 'Vui lòng nhập giống gà.';
  if (!isWhole(draft.durationDays) || duration < 1 || duration > 365) fields.durationDays = 'Thời gian nuôi từ 1 đến 365 ngày.';
  ['targetWeightMin', 'targetWeightMax'].forEach(key => {
    if (draft[key] !== '' && !(Number(draft[key]) > 0 && Number(draft[key]) <= 20)) fields[key] = 'Cân nặng từ 0,01 đến 20 kg.';
  });
  if (!fields.targetWeightMin && !fields.targetWeightMax && draft.targetWeightMin !== '' && draft.targetWeightMax !== ''
    && Number(draft.targetWeightMin) > Number(draft.targetWeightMax)) fields.targetWeightMax = 'Cân nặng tối đa phải lớn hơn hoặc bằng tối thiểu.';

  draft.steps.forEach((step, index) => {
    const from = Number(step.dayFrom);
    const to = Number(step.dayTo);
    let message;
    if (!step.name.trim()) message = 'Vui lòng nhập tên nội dung.';
    else if (!isWhole(step.dayFrom) || !isWhole(step.dayTo) || from < 1 || to < 1) message = 'Ngày tuổi phải là số nguyên từ 1.';
    else if (from > to) message = 'Ngày tuổi bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.';
    else if (!fields.durationDays && to > duration) message = `Ngày tuổi ${to} vượt thời gian nuôi ${duration} ngày.`;
    else if (step.category === 'FEED' && (!positive(step.quantity) || !isWhole(step.mealsPerDay) || Number(step.mealsPerDay) < 1 || Number(step.mealsPerDay) > 8)) {
      message = 'Cần định mức (g/con/ngày) lớn hơn 0 và số cữ ăn từ 1 đến 8.';
    } else if (step.category === 'VACCINE' && !VACCINE_METHODS.some(item => item.value === step.method)) message = 'Chọn cách dùng vắc-xin.';
    else if (step.category === 'MEDICINE' && !MEDICINE_METHODS.some(item => item.value === step.method)) message = 'Chọn cách dùng thuốc (trộn cám hoặc pha nước).';
    else if (step.category === 'MEDICINE' && (!positive(step.quantity) || !step.unit.trim())) message = 'Cần liều lượng và đơn vị (ví dụ 2 g/kg cám).';
    else if (step.category === 'TEMPERATURE' && !(step.tempMin !== '' && step.tempMax !== '' && Number(step.tempMin) < Number(step.tempMax))) {
      message = 'Nhiệt độ thấp nhất phải nhỏ hơn nhiệt độ cao nhất.';
    }
    if (message) steps[index] = message;
  });

  if (!draft.steps.some(step => step.category === 'FEED')) fields.steps = 'Chương trình nuôi cần có định mức cám.';
  // One feed ration and one temperature band per day of age.
  ['FEED', 'TEMPERATURE'].forEach(category => {
    const rows = draft.steps.map((step, index) => ({ ...step, index })).filter(step => step.category === category && !steps[step.index])
      .sort((a, b) => Number(a.dayFrom) - Number(b.dayFrom));
    for (let i = 1; i < rows.length; i += 1) {
      if (Number(rows[i].dayFrom) <= Number(rows[i - 1].dayTo)) {
        steps[rows[i].index] = `Bị chồng ngày với dòng ngày ${rows[i - 1].dayFrom}–${rows[i - 1].dayTo}. Mỗi ngày tuổi chỉ có một mức.`;
      }
    }
  });
  return { fields, steps };
};

/** Short human description of one program step, e.g. "85 g/con/ngày · 3 cữ" or "Nhỏ mắt, mũi · 1 liều/con". */
export const describeStep = step => {
  const number = value => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
  switch (step.category) {
    case 'FEED': return `${number(step.quantity)} g/con/ngày · ${step.mealsPerDay} cữ/ngày`;
    case 'VACCINE': return [METHODS.find(item => item.value === step.method)?.label, step.quantity != null ? `${number(step.quantity)} ${step.unit || ''}`.trim() : null].filter(Boolean).join(' · ');
    case 'MEDICINE': return `${METHODS.find(item => item.value === step.method)?.label || ''} · ${number(step.quantity)} ${step.unit || ''}`.trim();
    case 'TEMPERATURE': return `${number(step.tempMin)} – ${number(step.tempMax)} °C`;
    default: return '';
  }
};

export const STEP_STATES = {
  DONE: { label: 'Đã qua', tone: 'neutral' },
  IN_PROGRESS: { label: 'Đang áp dụng', tone: 'success' },
  UPCOMING: { label: 'Sắp tới', tone: 'info' },
};

export const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const addDaysIso = (iso, days) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const formatDay = iso => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';
