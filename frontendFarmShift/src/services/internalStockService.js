// src/services/internalStockService.js
import { api } from '../utils/api';

export const INTERNAL_STOCK_TYPES = {
  IMPORT: 'Nhập kho',
  EXPORT: 'Xuất kho',
  TRANSFER: 'Chuyển kho',
};

export const INTERNAL_STOCK_STATUS = {
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

/* ── Danh mục xuất nhập nội bộ ─────────────────────────────────── */

export const listInternalStockCategories = async (type = '') => {
  const params = {};
  if (type) params.type = type;
  const res = await api.get('/internal-stock/categories', { params });
  return res.data.data;
};

export const createInternalStockCategory = async (data) => {
  const res = await api.post('/internal-stock/categories', data);
  return res.data.data;
};

export const updateInternalStockCategory = async (id, data) => {
  const res = await api.put(`/internal-stock/categories/${id}`, data);
  return res.data.data;
};

export const deleteInternalStockCategory = async (id) => {
  const res = await api.delete(`/internal-stock/categories/${id}`);
  return res.data;
};

/* ── Phiếu xuất nhập nội bộ ─────────────────────────────────────── */

export const listInternalStockVouchers = async (params = {}) => {
  const cleanParams = {};
  Object.keys(params).forEach((key) => {
    const val = params[key];
    if (val !== undefined && val !== null && val !== '' && val !== 'ALL') {
      cleanParams[key] = val;
    }
  });
  const res = await api.get('/internal-stock/vouchers', { params: cleanParams });
  return res.data.data;
};

export const getInternalStockVoucher = async (id) => {
  const res = await api.get(`/internal-stock/vouchers/${id}`);
  return res.data.data;
};

export const createInternalStockVoucher = async (data) => {
  const res = await api.post('/internal-stock/vouchers', data);
  return res.data.data;
};

export const cancelInternalStockVoucher = async (id) => {
  const res = await api.post(`/internal-stock/vouchers/${id}/cancel`);
  return res.data.data;
};
