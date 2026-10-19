import { api } from '../utils/api';

export const listInventoryItems = async warehouseId => (await api.get('/inventory-items', { params: { warehouseId } })).data.data;
export const createInventoryItem = async data => (await api.post('/inventory-items', data)).data.data;
export const updateInventoryItem = async (id, data) => (await api.put(`/inventory-items/${id}`, data)).data.data;
export const deleteInventoryItem = async id => api.delete(`/inventory-items/${id}`);
