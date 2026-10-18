import { api } from '../utils/api';

export const listBrands = async () => (await api.get('/brands')).data.data;
export const BRANDS_CHANGED = 'brands-changed';
const notifyChange = () => {
  window.dispatchEvent(new Event(BRANDS_CHANGED));
  try { localStorage.setItem(BRANDS_CHANGED, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab updates still work without local storage. */ }
};
export const createBrand = async data => {
  const response = await api.post('/brands', data);
  notifyChange();
  return response.data.data;
};
export const updateBrand = async (id, data) => {
  const response = await api.put(`/brands/${id}`, data);
  notifyChange();
  return response.data.data;
};
export const deleteBrand = async id => {
  const response = await api.delete(`/brands/${id}`);
  notifyChange();
  return response;
};
