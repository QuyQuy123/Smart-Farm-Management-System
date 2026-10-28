import { api } from '../utils/api';

export const listSalesCustomers = async () => (await api.get('/sales/customers')).data.data;

export const listSalesOrders = async () => (await api.get('/sales/orders')).data.data;
export const createSalesOrder = async body => (await api.post('/sales/orders', body)).data.data;

export const getSalesInvoice = async id => (await api.get(`/sales/orders/${encodeURIComponent(id)}/invoice`)).data.data;

export const updateSalesOrder = async (id, body) => (await api.put(`/sales/orders/${encodeURIComponent(id)}`, body)).data.data;
