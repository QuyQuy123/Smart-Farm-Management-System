import { api } from '../utils/api';
export const listTransferCategories = async () => (await api.get('/transfer-categories')).data.data;
export const createTransferCategory = async data => (await api.post('/transfer-categories', data)).data.data;
export const updateTransferCategory = async (id, data) => (await api.put(`/transfer-categories/${id}`, data)).data.data;
export const deleteTransferCategory = async id => api.delete(`/transfer-categories/${id}`);
export const TRANSFER_TYPES = { IMPORT: 'Nhập kho', EXPORT: 'Xuất kho', TRANSFER: 'Chuyển kho' };
