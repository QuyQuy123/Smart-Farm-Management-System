import { api } from '../utils/api';

const data = async request => (await request).data.data;

export const listPrograms = () => data(api.get('/farming-programs'));
export const getProgram = id => data(api.get(`/farming-programs/${id}`));
export const createProgram = body => data(api.post('/farming-programs', body));
export const updateProgram = (id, body) => data(api.put(`/farming-programs/${id}`, body));
export const deleteProgram = id => data(api.delete(`/farming-programs/${id}`));

export const downloadProgramExcelTemplate = async () => {
  const response = await api.get('/farming-programs/excel-template', { responseType: 'blob' });
  return response.data;
};

export const exportProgramExcel = async id => {
  const response = await api.get(`/farming-programs/${id}/export-excel`, { responseType: 'blob' });
  return response.data;
};

export const importProgramExcel = async (file, mode = 'preview') => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/farming-programs/import-excel?mode=${encodeURIComponent(mode)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
};
