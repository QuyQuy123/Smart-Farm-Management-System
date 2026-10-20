import { api } from '../utils/api';

const data = async request => (await request).data.data;

/** Phiếu việc của mọi chuồng đang nuôi trong một ngày (mặc định hôm nay). */
export const getFarmDailyPlan = date => data(api.get('/daily-plan', { params: date ? { date } : {} }));
/** Phiếu việc của một lứa (chuồng) trong một ngày. */
export const getBarnDailyPlan = (cycleId, date) => data(api.get(`/cycles/${cycleId}/daily-plan`, { params: date ? { date } : {} }));
/** body: { date, taskKey, actualQuantity?, note? } — trả về phiếu việc mới của chuồng. */
export const confirmDailyTask = (cycleId, body) => data(api.post(`/cycles/${cycleId}/daily-plan/tasks`, body));
export const undoDailyTask = (cycleId, date, taskKey) => data(api.delete(`/cycles/${cycleId}/daily-plan/tasks`, { params: { date, taskKey } }));
