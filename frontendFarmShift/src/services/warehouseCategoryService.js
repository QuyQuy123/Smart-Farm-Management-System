import { api } from '../utils/api';

export const listWarehouseCategories = async () => (await api.get('/warehouse-categories')).data.data;
export const createWarehouseCategory = async data => (await api.post('/warehouse-categories', data)).data.data;
export const updateWarehouseCategory = async (id, data) => (await api.put(`/warehouse-categories/${id}`, data)).data.data;
export const deleteWarehouseCategory = async id => api.delete(`/warehouse-categories/${id}`);
