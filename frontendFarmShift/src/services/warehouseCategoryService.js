import { api } from '../utils/api';

export const listWarehouseCategories = async () => (await api.get('/warehouse-categories')).data.data;
export const WAREHOUSE_CATEGORIES_CHANGED = 'warehouse-categories-changed';
const notifyChange = () => {
  window.dispatchEvent(new Event(WAREHOUSE_CATEGORIES_CHANGED));
  try { localStorage.setItem(WAREHOUSE_CATEGORIES_CHANGED, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab updates still work without local storage. */ }
};
export const createWarehouseCategory = async data => {
  const response = await api.post('/warehouse-categories', data);
  notifyChange();
  return response.data.data;
};
export const updateWarehouseCategory = async (id, data) => {
  const response = await api.put(`/warehouse-categories/${id}`, data);
  notifyChange();
  return response.data.data;
};
export const deleteWarehouseCategory = async id => {
  const response = await api.delete(`/warehouse-categories/${id}`);
  notifyChange();
  return response;
};
