import { api } from '../utils/api';

export const listSuppliers = async () => (await api.get('/suppliers')).data.data;
export const createSupplier = async data => (await api.post('/suppliers', data)).data.data;
export const updateSupplier = async (id, data) => (await api.put(`/suppliers/${id}`, data)).data.data;
export const deleteSupplier = async id => api.delete(`/suppliers/${id}`);
