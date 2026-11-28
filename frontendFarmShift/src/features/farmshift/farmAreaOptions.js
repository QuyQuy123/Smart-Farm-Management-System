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
  { value: 'MEDICINE', label: 'Thuốc & vắc-xin' },
  { value: 'OTHER', label: 'Chi phí khác' },
];

// ---------------------------------------------------------------- farming programs (by breed)

export const STEP_CATEGORIES = [
  { value: 'FEED', label: 'Cám định mức', item: 'mức cám' },
  { value: 'DRINKING_MEDICINE', label: 'Lịch uống thuốc', item: 'đợt uống thuốc' },
  { value: 'VACCINE', label: 'Lịch vắc-xin', item: 'mũi vắc-xin' },
  { value: 'MEDICINE', label: 'Thuốc trộn', item: 'đợt thuốc trộn' },
  { value: 'CARE_PROCEDURE', label: 'Thủ thuật chăm sóc', item: 'thủ thuật' },
];

export const stepCategoryLabel = category => {
  const found = STEP_CATEGORIES.find(item => item.value === category);
  if (found) return found.label;
  if (category === 'TEMPERATURE') return 'Nhiệt độ';
  if (category === 'WORK') return 'Công việc';
  return category || '—';
};

export const FEED_INPUT_MODES = [
  { value: 'GRAM_PER_BIRD_DAY', label: 'g/con/ngày' },
  { value: 'BAGS_PER_1000_BIRDS', label: 'bao/1.000 con' },
];

export const DEFAULT_BAG_WEIGHT_KG = 25;
export const MAX_STEP_QUANTITY = 99999999999.999;
export const MAX_BAG_WEIGHT_KG = 9999999.999;

/** Quy đổi định mức cám từ bao/1.000 con/giai đoạn sang g/con/ngày (làm tròn 3 chữ số thập phân). */
export const bagsToGramPerBirdDay = (bagsPer1000Birds, bagWeightKg, dayFrom, dayTo) => {
  const bags = Number(bagsPer1000Birds);
  const weight = Number(bagWeightKg || DEFAULT_BAG_WEIGHT_KG);
  const from = Number(dayFrom);
  const to = Number(dayTo);
  if (!(bags > 0) || !(weight > 0) || !Number.isInteger(from) || !Number.isInteger(to) || to < from) return null;
  const days = to - from + 1;
  return Math.round(((bags * weight) / days) * 1000) / 1000;
};

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

export const DRINKING_MEDICINE_METHODS = [
  { value: 'HAND_DRINKER', label: 'Bình xách tay' },
  { value: 'AUTO_DRINKER', label: 'Hệ thống uống tự động' },
  { value: 'MIX_WATER', label: 'Pha nước uống' },
];

export const CARE_PROCEDURE_METHODS = [
  { value: 'PROCEDURE', label: 'Thủ thuật thực hiện' },
];

export const METHODS = [...VACCINE_METHODS, ...MEDICINE_METHODS, ...DRINKING_MEDICINE_METHODS, ...CARE_PROCEDURE_METHODS];

export const MEDICINE_UNITS = ['g/kg cám', 'ml/lít nước', 'g/lít nước', 'ml/kg cám'];
export const DRINKING_MEDICINE_UNITS = ['gói/1000 con', 'g/lít nước', 'ml/lít nước', 'g/con/ngày', 'ml/con/ngày'];

/** Quy cách đơn vị tồn kho (Bao 25kg = 25 kg, Lọ 1000 liều = 1000 liều) để quy đổi định mức chương trình sang tồn kho. */
export const USAGE_UNITS = [
  { value: 'KG', label: 'kg' },
  { value: 'G', label: 'g' },
  { value: 'L', label: 'lít' },
  { value: 'ML', label: 'ml' },
  { value: 'DOSE', label: 'liều' },
  { value: 'PACK', label: 'gói' },
];

export const formatAmount = value => (value == null || value === '' ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 3 }));

export const contentText = (quantity, unit) => (quantity == null || !unit ? '' : `${formatAmount(quantity)} ${labelOf(USAGE_UNITS, unit)}`);

const DIMENSIONS = { KG: 'MASS', G: 'MASS', L: 'VOLUME', ML: 'VOLUME', DOSE: 'DOSE', PACK: 'PACK' };

/** Loại đại lượng của định mức: cám theo khối lượng, thuốc / vắc-xin theo tử số đơn vị liều (g/..., ml/..., liều/..., gói/...). */
export const doseDimension = (category, unit) => {
  if (category === 'FEED') return 'MASS';
  const head = String(unit || '').split('/')[0].trim().toLowerCase();
  if (['kg', 'g', 'gam', 'gram'].includes(head)) return 'MASS';
  if (['l', 'lít', 'lit', 'ml'].includes(head)) return 'VOLUME';
  if (['liều', 'lieu', 'giọt', 'giot', 'dose'].includes(head)) return 'DOSE';
  if (['gói', 'goi', 'pack'].includes(head)) return 'PACK';
  return null;
};

const lowerVi = value => String(value || '').toLocaleLowerCase('vi');

/** Phân loại hàng hóa kho: cám (thức ăn), vắc-xin hoặc thuốc, theo tên, loại hàng và kho chứa. */
export const stockKind = item => {
  const name = lowerVi(item.name);
  if (/vắc|vac-?xin|vaccin/.test(name)) return 'VACCINE';
  const text = `${name} ${lowerVi(item.productType)} ${lowerVi(item.warehouseName)}`;
  if (/thức ăn|cám|ngô|bắp/.test(text)) return 'FEED';
  if (/thuốc|thú y|vitamin|kháng sinh|men|điện giải|sâm/.test(text)) return 'MEDICINE';
  return null;
};

/** Hàng hóa gợi ý cho một dòng chương trình: đúng nhóm (cám / vắc-xin / thuốc / thuốc uống) và quy đổi được đơn vị. */
export const itemsForStep = (items, category, unit) => {
  const targetKind = category === 'DRINKING_MEDICINE' ? 'MEDICINE' : category;
  return items.filter(item => stockKind(item) === targetKind && itemFitsStep(item, category, unit));
};

/**
 * Một dòng cho mỗi tên hàng dù hàng có ở nhiều kho: chương trình nuôi chỉ chọn tên, kho nào trừ do phân công kho quyết định.
 * Giữ dòng đang được gắn (preferredId) để ô chọn vẫn nhận ra lựa chọn cũ.
 */
export const uniqueByName = (items, preferredId) => {
  const byName = new Map();
  for (const item of items) {
    const name = String(item.name || '').normalize('NFC').trim().toLocaleLowerCase('vi');
    if (!name) continue;
    if (!byName.has(name) || String(item.id) === String(preferredId)) byName.set(name, item);
  }
  return [...byName.values()];
};

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
  const nameTrimmed = draft.name.trim();
  const breedTrimmed = draft.breed.trim();
  const descTrimmed = (draft.description || '').trim();
  if (!nameTrimmed) fields.name = 'Vui lòng nhập tên chương trình.';
  else if (nameTrimmed.length > 150) fields.name = 'Tên chương trình không quá 150 ký tự.';
  if (!breedTrimmed) fields.breed = 'Vui lòng nhập giống gà.';
  else if (breedTrimmed.length > 100) fields.breed = 'Tên giống không quá 100 ký tự.';
  if (descTrimmed.length > 1000) fields.description = 'Mô tả không quá 1000 ký tự.';
  if (!isWhole(draft.durationDays) || duration < 1 || duration > 365) fields.durationDays = 'Thời gian nuôi từ 1 đến 365 ngày.';
  ['targetWeightMin', 'targetWeightMax'].forEach(key => {
    const val = Number(draft[key]);
    if (draft[key] !== '' && !(Number.isFinite(val) && val >= 0.01 && val <= 20)) fields[key] = 'Cân nặng từ 0,01 đến 20 kg.';
  });
  if (!fields.targetWeightMin && !fields.targetWeightMax && draft.targetWeightMin !== '' && draft.targetWeightMax !== ''
    && Number(draft.targetWeightMin) > Number(draft.targetWeightMax)) fields.targetWeightMax = 'Cân nặng tối đa phải lớn hơn hoặc bằng tối thiểu.';

  draft.steps.forEach((step, index) => {
    const from = Number(step.dayFrom);
    const to = Number(step.dayTo);
    const stepNameTrimmed = step.name.trim();
    const stepUnitTrimmed = (step.unit || '').trim();
    const stepNoteTrimmed = (step.note || '').trim();
    let message;
    if (!stepNameTrimmed) message = step.category === 'FEED' ? 'Vui lòng chọn loại cám.' : 'Vui lòng nhập tên nội dung.';
    else if (stepNameTrimmed.length > 200) message = 'Tên nội dung không quá 200 ký tự.';
    else if (stepNoteTrimmed.length > 1000) message = 'Ghi chú không quá 1000 ký tự.';
    else if (!isWhole(step.dayFrom) || !isWhole(step.dayTo) || from < 1 || to < 1 || from > 365 || to > 365) message = 'Ngày tuổi phải là số nguyên từ 1 đến 365.';
    else if (from > to) message = 'Ngày tuổi bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.';
    else if (!fields.durationDays && to > duration) message = `Ngày tuổi ${to} vượt thời gian nuôi ${duration} ngày.`;
    else if (stepUnitTrimmed.length > 50) message = 'Đơn vị không quá 50 ký tự.';
    else if (step.category === 'FEED') {
      if (!isWhole(step.mealsPerDay) || Number(step.mealsPerDay) < 1 || Number(step.mealsPerDay) > 8) {
        message = 'Cần định mức (g/con/ngày) lớn hơn 0 và số cữ ăn từ 1 đến 8.';
      } else if (!positive(step.quantity)) {
        message = 'Cần định mức (g/con/ngày) lớn hơn 0 và số cữ ăn từ 1 đến 8.';
      } else if (Number(step.quantity) > MAX_STEP_QUANTITY) {
        message = 'Định mức vượt giới hạn tối đa cho phép.';
      }
    } else if (step.category === 'VACCINE') {
      if (!VACCINE_METHODS.some(item => item.value === step.method)) message = 'Chọn cách dùng vắc-xin.';
      else if (step.inventoryItemId && !positive(step.quantity)) message = 'Cần nhập liều lượng lớn hơn 0 để tính số lọ vắc-xin.';
      else if (step.quantity !== '' && step.quantity != null) {
        const qty = Number(step.quantity);
        if (!Number.isFinite(qty) || qty <= 0) message = 'Liều lượng phải lớn hơn 0.';
        else if (qty > MAX_STEP_QUANTITY) message = 'Liều lượng vượt giới hạn tối đa cho phép.';
      }
    } else if (step.category === 'MEDICINE' && !MEDICINE_METHODS.some(item => item.value === step.method)) message = 'Chọn cách dùng thuốc (trộn cám hoặc pha nước).';
    else if (step.category === 'MEDICINE' && (!positive(step.quantity) || !stepUnitTrimmed)) message = 'Cần liều lượng và đơn vị (ví dụ 2 g/kg cám).';
    else if (step.category === 'MEDICINE' && Number(step.quantity) > MAX_STEP_QUANTITY) message = 'Liều lượng vượt giới hạn tối đa cho phép.';
    else if (step.category === 'DRINKING_MEDICINE' && !DRINKING_MEDICINE_METHODS.some(item => item.value === step.method)) message = 'Chọn phương thức uống thuốc (bình xách tay hoặc hệ thống uống tự động).';
    else if (step.category === 'DRINKING_MEDICINE' && (!positive(step.quantity) || !stepUnitTrimmed)) message = 'Cần liều lượng và đơn vị (ví dụ 0,5 gói/1000 con, 1 g/lít nước).';
    else if (step.category === 'DRINKING_MEDICINE' && Number(step.quantity) > MAX_STEP_QUANTITY) message = 'Liều lượng vượt giới hạn tối đa cho phép.';
    else if (step.category === 'CARE_PROCEDURE') {
      if (step.method && !CARE_PROCEDURE_METHODS.some(item => item.value === step.method)) message = 'Phương thức thủ thuật chăm sóc không hợp lệ.';
      else if (step.quantity !== '' && step.quantity != null) {
        const qty = Number(step.quantity);
        if (!Number.isFinite(qty) || qty < 0) message = 'Định mức không được âm.';
        else if (qty > MAX_STEP_QUANTITY) message = 'Liều lượng vượt giới hạn tối đa cho phép.';
      }
    } else if (step.category === 'TEMPERATURE' && !(step.tempMin !== '' && step.tempMax !== ''
      && Number(step.tempMin) >= 10 && Number(step.tempMax) <= 45 && Number(step.tempMin) < Number(step.tempMax))) {
      message = 'Nhiệt độ phải từ 10 đến 45°C và thấp nhất phải nhỏ hơn cao nhất.';
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
    case 'FEED':
      return `${number(step.quantity)} g/con/ngày · ${step.mealsPerDay} cữ/ngày`;
    case 'VACCINE': return [METHODS.find(item => item.value === step.method)?.label, step.quantity != null ? `${number(step.quantity)} ${step.unit || ''}`.trim() : null].filter(Boolean).join(' · ');
    case 'MEDICINE':
    case 'DRINKING_MEDICINE': return `${METHODS.find(item => item.value === step.method)?.label || ''} · ${number(step.quantity)} ${step.unit || ''}`.trim();
    case 'CARE_PROCEDURE': return METHODS.find(item => item.value === step.method)?.label || 'Thủ thuật thực hiện';
    case 'TEMPERATURE': return `${number(step.tempMin)} – ${number(step.tempMax)} °C`;
    default: return '';
  }
};

export const STEP_STATES = {
  DONE: { label: 'Đã qua', tone: 'neutral' },
  IN_PROGRESS: { label: 'Đang áp dụng', tone: 'success' },
  UPCOMING: { label: 'Sắp tới', tone: 'info' },
};

export const VN_TIME_ZONE = 'Asia/Bangkok';

export const todayIso = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
};

export const addDaysIso = (iso, days) => {
  const [year, month, day] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

export const formatDay = iso => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';

// ---------------------------------------------------------------- kho theo khu (mỗi khu một kho cám, một kho thuốc)

export const WAREHOUSE_KINDS = [{ value: 'FEED', label: 'Kho cám' }, { value: 'MEDICINE', label: 'Kho thuốc' }];
export const kindLabel = kind => WAREHOUSE_KINDS.find(item => item.value === kind)?.label || 'Khác';

/** Các khu có kho, theo thứ tự tên; kho không thuộc khu nào gom vào "Không thuộc khu". */
export const warehouseAreas = warehouses => [...new Map(warehouses.map(warehouse =>
  [warehouse.areaId ?? 'none', warehouse.areaName || 'Không thuộc khu'])).entries()]
  .sort((a, b) => a[1].localeCompare(b[1], 'vi'));

/** Lọc kho theo khu ('' là tất cả) và loại kho ('' là tất cả). */
export const filterWarehouses = (warehouses, { area, kind }) => warehouses.filter(warehouse =>
  (!area || String(warehouse.areaId ?? 'none') === area) && (!kind || warehouse.kind === kind));

// ---------------------------------------------------------------- việc hằng ngày mặc định theo chuồng

export const CUSTOM_ROUTINE_PREFIX = 'CUSTOM:';
export const MAX_CUSTOM_ROUTINE_LENGTH = 50;

export const ROUTINE_TASK_PRESETS = [
  { code: 'CHANGE_LITTER', title: 'Thay trấu' },
  { code: 'CLEAN_FEEDERS', title: 'Vệ sinh máng' },
  { code: 'WASH_BARN', title: 'Xịt rửa chuồng' },
  { code: 'FEED_AND_WATER', title: 'Cho ăn & uống' },
  { code: 'LOG_MORTALITY', title: 'Ghi chép hao hụt' },
  { code: 'GIVE_SUPPLEMENTS', title: 'Cho uống thuốc bổ' },
  { code: 'CHECK_TEMPERATURE', title: 'Kiểm tra nhiệt độ' },
  { code: 'COLLECT_MORTALITY', title: 'Thu gom xác chết' },
  { code: 'CHECK_EXHAUST_FANS', title: 'Kiểm tra quạt hút' },
  { code: 'DISINFECT_WALKWAY', title: 'Sát trùng lối đi' },
  { code: 'SAMPLE_WEIGHING', title: 'Cân mẫu gà' },
  { code: 'CHECK_BROODER', title: 'Kiểm tra quầy úm' },
];

export const DEFAULT_ROUTINE_CODES = ['CHANGE_LITTER', 'CLEAN_FEEDERS', 'WASH_BARN'];

const ROUTINE_PRESET_TITLES = new Map(ROUTINE_TASK_PRESETS.map(p => [p.code, p.title]));

export const isCustomRoutineCode = code => typeof code === 'string' && code.startsWith(CUSTOM_ROUTINE_PREFIX);

export const routineTaskTitle = code => {
  if (!code) return '';
  if (ROUTINE_PRESET_TITLES.has(code)) return ROUTINE_PRESET_TITLES.get(code);
  if (isCustomRoutineCode(code)) return code.slice(CUSTOM_ROUTINE_PREFIX.length).trim();
  return String(code);
};
