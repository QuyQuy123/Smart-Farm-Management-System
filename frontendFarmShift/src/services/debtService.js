import { api } from '../utils/api';

export const getDebtSummary = async () => {
  const res = await api.get('/debts/summary');
  return res?.data?.data ?? null;
};

export const getSupplierDebtHistory = async (supplierId) => {
  const res = await api.get(`/debts/suppliers/${supplierId}`);
  return res?.data?.data ?? null;
};

