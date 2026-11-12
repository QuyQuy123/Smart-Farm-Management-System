import { api } from '../utils/api';

export const getCashbookSummary = async (params = {}) => {
  const res = await api.get('/cashbook/summary', { params });
  return res?.data?.data ?? null;
};

export const listCashFunds = async () => {
  const res = await api.get('/cashbook/funds');
  return res?.data?.data ?? [];
};

export const createCashFund = async (payload) => {
  const res = await api.post('/cashbook/funds', payload);
  return res?.data?.data;
};

export const updateCashFund = async (id, payload) => {
  const res = await api.put(`/cashbook/funds/${id}`, payload);
  return res?.data?.data;
};

export const deleteCashFund = async (id) => {
  await api.delete(`/cashbook/funds/${id}`);
};

export const createCashTransaction = async (payload) => {
  const res = await api.post('/cashbook/transactions', payload);
  return res?.data?.data;
};

export const updateCashTransaction = async (id, payload) => {
  const res = await api.put(`/cashbook/transactions/${id}`, payload);
  return res?.data?.data;
};

export const deleteCashTransaction = async (id) => {
  await api.delete(`/cashbook/transactions/${id}`);
};

export const createCashFundTransfer = async (payload) => {
  const res = await api.post('/cashbook/transfers', payload);
  return res?.data?.data;
};

// ── Cycle Cost Allocations ───────────────────────────────────────────────

export const createCostAllocation = async (payload) => {
  const res = await api.post('/cashbook/cost-allocations', payload);
  return res?.data?.data;
};

export const updateCostAllocation = async (id, payload) => {
  const res = await api.put(`/cashbook/cost-allocations/${id}`, payload);
  return res?.data?.data;
};

export const deleteCostAllocation = async (id) => {
  await api.delete(`/cashbook/cost-allocations/${id}`);
};

// ── Fixed Assets & Depreciation ──────────────────────────────────────────

export const createFarmAsset = async (payload) => {
  const res = await api.post('/cashbook/assets', payload);
  return res?.data?.data;
};

export const updateFarmAsset = async (id, payload) => {
  const res = await api.put(`/cashbook/assets/${id}`, payload);
  return res?.data?.data;
};

export const deleteFarmAsset = async (id) => {
  await api.delete(`/cashbook/assets/${id}`);
};

// ── Employee Payroll ─────────────────────────────────────────────────────

export const createPayroll = async (payload) => {
  const res = await api.post('/cashbook/payrolls', payload);
  return res?.data?.data;
};

export const updatePayroll = async (id, payload) => {
  const res = await api.put(`/cashbook/payrolls/${id}`, payload);
  return res?.data?.data;
};

export const payPayroll = async (id, payload) => {
  const res = await api.post(`/cashbook/payrolls/${id}/pay`, payload);
  return res?.data?.data;
};

export const deletePayroll = async (id) => {
  await api.delete(`/cashbook/payrolls/${id}`);
};

// ── Cash Transaction Categories ──────────────────────────────────────────

export const createCashCategory = async (payload) => {
  const res = await api.post('/cashbook/categories', payload);
  return res?.data?.data;
};

export const updateCashCategory = async (id, payload) => {
  const res = await api.put(`/cashbook/categories/${id}`, payload);
  return res?.data?.data;
};

export const deleteCashCategory = async (id) => {
  await api.delete(`/cashbook/categories/${id}`);
};
