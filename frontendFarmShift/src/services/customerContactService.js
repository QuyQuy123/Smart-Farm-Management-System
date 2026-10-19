import { api } from '../utils/api';

export const listCustomerContacts = async (page = 0, q = '') => (await api.get('/customer-contacts', { params: { page, q } })).data.data;
export const createCustomerContact = async data => (await api.post('/customer-contacts', data)).data.data;
export const updateCustomerContact = async (id, data) => (await api.put(`/customer-contacts/${id}`, data)).data.data;
export const deleteCustomerContact = async id => api.delete(`/customer-contacts/${id}`);
