import { api } from '../utils/api';

export const getWarehouseResponsibilities = async () => (await api.get('/warehouse-responsibilities')).data.data;
export const setWarehouseWorkers = async (warehouseId, workerIds) =>
  (await api.put(`/warehouse-categories/${warehouseId}/workers`, { workerIds })).data.data;
