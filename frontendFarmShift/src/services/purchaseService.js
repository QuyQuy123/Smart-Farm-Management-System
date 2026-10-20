// src/services/purchaseService.js
import { api } from '../utils/api';

/* ── Hóa đơn nhập hàng (Purchase Invoices) ─────────────────────── */
export const listPurchases = async (search = '', paymentStatus = '') => {
  const params = {};
  if (search) params.search = search;
  if (paymentStatus && paymentStatus !== 'ALL') params.paymentStatus = paymentStatus;
  const res = await api.get('/purchases', { params });
  return res.data.data;
};

export const getPurchase = async (id) => {
  const res = await api.get(`/purchases/${id}`);
  return res.data.data;
};

export const createPurchase = async (payload) => {
  const res = await api.post('/purchases', payload);
  return res.data.data;
};

export const importStock = async (id) => {
  const res = await api.post(`/purchases/${id}/import-stock`);
  return res.data.data;
};

export const payPurchase = async (id, payload) => {
  const res = await api.post(`/purchases/${id}/pay`, payload);
  return res.data.data;
};

export const cancelPurchase = async (id) => {
  const res = await api.post(`/purchases/${id}/cancel`);
  return res.data.data;
};

export const ocrPurchase = async (fileOrFormData) => {
  let body = fileOrFormData;
  if (typeof File !== 'undefined' && (fileOrFormData instanceof File || fileOrFormData instanceof Blob)) {
    body = new FormData();
    body.append('file', fileOrFormData, fileOrFormData.name || 'document.png');
  }
  const res = await api.post('/purchases/ocr', body, {
    timeout: 90000, // Cho phép 90s cho xử lý AI Vision đa phương thức (OpenAI gpt-5.6-sol)
    headers: {
      'Content-Type': undefined // Để axios & trình duyệt tự động đính kèm boundary multipart
    }
  });
  return res.data.data;
};

/* ── Thẻ Tags phân loại (Purchase Tags) ────────────────────────── */
export const listPurchaseTags = async () => {
  const res = await api.get('/purchase-tags');
  return res.data.data;
};

export const createPurchaseTag = async (payload) => {
  const res = await api.post('/purchase-tags', payload);
  return res.data.data;
};

export const updatePurchaseTag = async (id, payload) => {
  const res = await api.put(`/purchase-tags/${id}`, payload);
  return res.data.data;
};

export const deletePurchaseTag = async (id) => {
  const res = await api.delete(`/purchase-tags/${id}`);
  return res.data.data;
};

export const updatePurchase = async (id, payload) => (await api.put(`/purchases/${id}`, payload)).data.data;
export const deletePurchase = async id => api.delete(`/purchases/${id}`);
