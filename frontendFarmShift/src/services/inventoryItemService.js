import { api } from '../utils/api';

export const listInventoryItems = async (warehouseId, includeReceipts = false) => (await api.get('/inventory-items', { params: { warehouseId, ...(includeReceipts ? { includeReceipts: true } : {}) } })).data.data;
/** Mọi hàng hóa của mọi kho, kèm quy cách đơn vị (dùng khi gắn hàng hóa vào chương trình nuôi). */
export const listAllInventoryItems = async () => (await api.get('/inventory-items')).data.data;
export const createInventoryItem = async data => (await api.post('/inventory-items', data)).data.data;
export const updateInventoryItem = async (id, data) => (await api.put(`/inventory-items/${id}`, data)).data.data;
export const deleteInventoryItem = async id => api.delete(`/inventory-items/${id}`);
