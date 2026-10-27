import { api } from '../utils/api';

const data = async request => (await request).data.data;

/** Màn phân công của chủ trại cho một ngày: công nhân và từng chuồng (người phụ trách, việc được giao). */
export const getWorkBoard = date => data(api.get('/work-assignments', { params: date ? { date } : {} }));
/** Thay toàn bộ công nhân phụ trách chuồng. */
export const setBarnWorkers = (barnId, workerIds) => data(api.put(`/barns/${barnId}/workers`, { workerIds }));
/** body: { barnId, assigneeId, title, note, startDate, endDate?, dueTime? } */
export const createWorkTask = body => data(api.post('/work-tasks', body));
export const updateWorkTask = (id, body) => data(api.put(`/work-tasks/${id}`, body));
export const deleteWorkTask = id => data(api.delete(`/work-tasks/${id}`));
export const checkWorkTask = (id, date, note) => data(api.post(`/work-tasks/${id}/checks`, { date, note }));
export const uncheckWorkTask = (id, date) => data(api.delete(`/work-tasks/${id}/checks`, { params: { date } }));
