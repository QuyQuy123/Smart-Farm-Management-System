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

export const PROGRAM_TYPES = [
  { value: 'FEED', label: 'Định mức cám' },
  { value: 'HEALTH', label: 'Phòng & chữa bệnh' },
  { value: 'WORK', label: 'Công việc' },
];

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
