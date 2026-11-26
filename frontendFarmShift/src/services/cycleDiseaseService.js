import { api } from '../utils/api';

const data = async request => (await request).data.data;

export const listCycleDiseases = cycleId => data(api.get(`/cycles/${cycleId}/diseases`));
export const listDiseaseMedicineSources = cycleId => data(api.get(`/cycles/${cycleId}/diseases/medicine-sources`));
export const createCycleDisease = (cycleId, body) => data(api.post(`/cycles/${cycleId}/diseases`, body));
export const updateCycleDisease = (cycleId, diseaseId, body) => data(api.put(`/cycles/${cycleId}/diseases/${diseaseId}`, body));
export const deleteCycleDisease = (cycleId, diseaseId) => data(api.delete(`/cycles/${cycleId}/diseases/${diseaseId}`));
export const addDiseaseTreatment = (cycleId, diseaseId, body) => data(api.post(`/cycles/${cycleId}/diseases/${diseaseId}/treatments`, body));
export const updateDiseaseTreatmentCost = (cycleId, diseaseId, treatmentId, body) => data(api.put(`/cycles/${cycleId}/diseases/${diseaseId}/treatments/${treatmentId}/cost`, body));
export const deleteDiseaseTreatment = (cycleId, diseaseId, treatmentId) => data(api.delete(`/cycles/${cycleId}/diseases/${diseaseId}/treatments/${treatmentId}`));
