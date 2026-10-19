import { api } from '../utils/api';

export const listMeasurementUnits = async () => (await api.get('/measurement-units')).data.data;
export const MEASUREMENT_UNITS_CHANGED = 'measurement-units-changed';
const notifyChange = () => {
  window.dispatchEvent(new Event(MEASUREMENT_UNITS_CHANGED));
  try { localStorage.setItem(MEASUREMENT_UNITS_CHANGED, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab updates still work without local storage. */ }
};
export const createMeasurementUnit = async data => {
  const response = await api.post('/measurement-units', data);
  notifyChange();
  return response.data.data;
};
export const updateMeasurementUnit = async (id, data) => {
  const response = await api.put(`/measurement-units/${id}`, data);
  notifyChange();
  return response.data.data;
};
export const deleteMeasurementUnit = async id => {
  const response = await api.delete(`/measurement-units/${id}`);
  notifyChange();
  return response;
};
