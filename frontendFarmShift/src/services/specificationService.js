import { api } from '../utils/api';

export const listSpecifications = async () => (await api.get('/specifications')).data.data;
export const SPECIFICATIONS_CHANGED = 'specifications-changed';
const notifyChange = () => {
  window.dispatchEvent(new Event(SPECIFICATIONS_CHANGED));
  try { localStorage.setItem(SPECIFICATIONS_CHANGED, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab updates still work without local storage. */ }
};
export const createSpecification = async data => {
  const response = await api.post('/specifications', data);
  notifyChange();
  return response.data.data;
};
export const updateSpecification = async (id, data) => {
  const response = await api.put(`/specifications/${id}`, data);
  notifyChange();
  return response.data.data;
};
export const deleteSpecification = async id => {
  const response = await api.delete(`/specifications/${id}`);
  notifyChange();
  return response;
};
