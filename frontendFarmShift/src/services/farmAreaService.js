import { api } from '../utils/api';

export const FARM_AREAS_CHANGED = 'farm-areas-changed';
const notifyChange = () => {
  window.dispatchEvent(new Event(FARM_AREAS_CHANGED));
  try { localStorage.setItem(FARM_AREAS_CHANGED, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab updates still work without local storage. */ }
};
const changed = async request => {
  const response = await request;
  notifyChange();
  return response.data.data;
};

export const listFarmAreas = async () => (await api.get('/farm-areas')).data.data;
export const getFarmArea = async id => (await api.get(`/farm-areas/${id}`)).data.data;
export const createFarmArea = data => changed(api.post('/farm-areas', data));
export const updateFarmArea = (id, data) => changed(api.put(`/farm-areas/${id}`, data));
export const deleteFarmArea = id => changed(api.delete(`/farm-areas/${id}`));

export const listBarns = async areaId => (await api.get('/barns', { params: areaId ? { areaId } : {} })).data.data;
export const createBarn = data => changed(api.post('/barns', data));
export const updateBarn = (id, data) => changed(api.put(`/barns/${id}`, data));
export const deleteBarn = id => changed(api.delete(`/barns/${id}`));
