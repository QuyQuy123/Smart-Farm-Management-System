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

/** Giờ cữ ăn đầu tiên ("HH:mm"); giờ các cữ sau trên phiếu việc tự chia đều. Chỉ chủ trại. */
export const updateMealSchedule = async firstMealTime => (await api.put('/farm/meal-schedule', { firstMealTime })).data.data;
