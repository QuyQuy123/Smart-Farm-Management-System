// Vietnamese labels for the farm-area / barn codes returned by /api/farm-areas and /api/barns.
export const LIVESTOCK_TYPES = [
  { value: 'AQUACULTURE', label: 'Thủy sản' },
  { value: 'LIVESTOCK', label: 'Gia súc' },
  { value: 'POULTRY', label: 'Gia cầm' },
];

export const BARN_PURPOSES = [
  { value: 'FARMING', label: 'Thả nuôi' },
  { value: 'BIO_TREATMENT', label: 'Xử lý hóa sinh' },
];

export const BARN_STATUSES = [
  { value: 'INACTIVE', label: 'Chưa hoạt động', tone: 'neutral' },
  { value: 'ACTIVE', label: 'Đang hoạt động', tone: 'success' },
  { value: 'CLOSED', label: 'Đã đóng', tone: 'closed' },
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

export const MEALS_PER_DAY = [0, 1, 2, 3, 4, 5, 6];

export const labelOf = (options, value) => options.find(option => option.value === value)?.label || value || '—';

export const apiErrorMessage = error => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';

/** Mirrors the backend barn rules so the owner sees problems before submitting. */
export const validateBarn = form => {
  const errors = {};
  const capacity = Number(form.capacity);
  const current = Number(form.currentQuantity);
  if (!form.areaId) errors.areaId = 'Vui lòng chọn khu nuôi.';
  if (!form.name.trim()) errors.name = 'Vui lòng nhập tên chuồng.';
  if (form.capacity === '' || !Number.isInteger(capacity) || capacity < 1) errors.capacity = 'Sức chứa tối đa phải là số nguyên lớn hơn 0.';
  if (form.currentQuantity === '' || !Number.isInteger(current) || current < 0) errors.currentQuantity = 'Số con hiện có phải là số nguyên không âm.';
  else if (!errors.capacity && current > capacity) errors.currentQuantity = `Số con hiện có vượt quá sức chứa tối đa (${capacity.toLocaleString('vi-VN')}).`;
  else if (current > 0 && form.purpose === 'BIO_TREATMENT') errors.currentQuantity = 'Chuồng xử lý hóa sinh không chứa vật nuôi. Số con hiện có phải bằng 0.';
  else if (current > 0 && form.status !== 'ACTIVE') errors.currentQuantity = 'Chỉ chuồng đang hoạt động mới được có vật nuôi.';
  if (form.targetWeight !== '' && (Number.isNaN(Number(form.targetWeight)) || Number(form.targetWeight) < 0 || Number(form.targetWeight) > 999)) {
    errors.targetWeight = 'Mục tiêu cân nặng từ 0 đến 999 kg.';
  }
  return errors;
};
