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

