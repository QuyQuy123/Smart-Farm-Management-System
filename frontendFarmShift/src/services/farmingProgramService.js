import { api } from '../utils/api';

const data = async request => (await request).data.data;

export const listPrograms = () => data(api.get('/farming-programs'));
export const getProgram = id => data(api.get(`/farming-programs/${id}`));
export const createProgram = body => data(api.post('/farming-programs', body));
export const updateProgram = (id, body) => data(api.put(`/farming-programs/${id}`, body));
export const deleteProgram = id => data(api.delete(`/farming-programs/${id}`));
