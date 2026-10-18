export const sortWarehouseCategories = categories => {
  const timestamp = value => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };
  return [...categories].sort((left, right) =>
    timestamp(left.createdAt) - timestamp(right.createdAt) || Number(left.id) - Number(right.id));
};
