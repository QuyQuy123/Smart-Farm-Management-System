import { api } from '../utils/api';
import { FARM_AREAS_CHANGED } from './farmAreaService';

// Stock changes move barn counts, so the area pages and sidebar refresh too.
const notifyChange = () => {
  window.dispatchEvent(new Event(FARM_AREAS_CHANGED));
  try { localStorage.setItem(FARM_AREAS_CHANGED, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab updates still work without local storage. */ }
};
const data = async request => (await request).data.data;
const changed = async request => {
  const result = await data(request);
  notifyChange();
  return result;
};

export const getBarn = id => data(api.get(`/barns/${id}`));
export const listCycles = barnId => data(api.get(`/barns/${barnId}/cycles`));
export const startCycle = (barnId, body) => changed(api.post(`/barns/${barnId}/cycles`, body));
export const getCycle = id => data(api.get(`/cycles/${id}`));
export const closeCycle = (id, body) => changed(api.post(`/cycles/${id}/close`, body));

export const importFlock = (cycleId, body) => changed(api.post(`/cycles/${cycleId}/flocks`, body));
export const transferFlock = (flockId, body) => changed(api.post(`/flocks/${flockId}/transfer`, body));
export const assignFlockProgram = (flockId, programId) => changed(api.put(`/flocks/${flockId}/program`, { programId }));
export const assignCycleProgram = (cycleId, programId) => changed(api.put(`/cycles/${cycleId}/program`, { programId }));
export const recordLoss = (flockId, body) => changed(api.post(`/flocks/${flockId}/losses`, body));
export const recordHarvest = (flockId, body) => changed(api.post(`/flocks/${flockId}/harvests`, body));

export const addFeedRecord = (cycleId, body) => data(api.post(`/cycles/${cycleId}/feed-records`, body));
export const deleteFeedRecord = (cycleId, id) => data(api.delete(`/cycles/${cycleId}/feed-records/${id}`));
export const addWeightSample = (cycleId, body) => data(api.post(`/cycles/${cycleId}/weight-samples`, body));
export const deleteWeightSample = (cycleId, id) => data(api.delete(`/cycles/${cycleId}/weight-samples/${id}`));
export const addExpense = (cycleId, body) => data(api.post(`/cycles/${cycleId}/expenses`, body));
export const deleteExpense = (cycleId, id) => data(api.delete(`/cycles/${cycleId}/expenses/${id}`));

