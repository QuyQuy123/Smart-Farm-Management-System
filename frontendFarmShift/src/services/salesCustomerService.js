import { api } from '../utils/api';

export const listSalesCustomers = async () => (await api.get('/sales/customers')).data.data;
