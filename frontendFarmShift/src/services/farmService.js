import { api } from '../utils/api';

export const getFarm = async () => {
  const response = await api.get('/farm');
  return response.data?.data ?? null;
};

export const updateFarm = async (farm) => {
  const { name, owner, phone, scale, address, type } = farm;
  const response = await api.put('/farm', { name, owner, phone, scale, address, type });
  return response.data.data;
};
