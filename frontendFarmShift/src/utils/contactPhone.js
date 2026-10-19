export const validateContactPhone = value => {
  if (!value) return 'Vui lòng nhập số điện thoại.';
  if (!/^[0-9]+$/.test(value)) return 'Số điện thoại chỉ được chứa chữ số.';
  const landline = value.startsWith('024') || value.startsWith('028');
  if (value.length !== (landline ? 11 : 10)) {
    return landline ? 'Số điện thoại đầu 024 hoặc 028 phải có đúng 11 số.' : 'Số điện thoại phải có đúng 10 số.';
  }
  return '';
};
