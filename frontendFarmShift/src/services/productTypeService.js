import { api } from '../utils/api';

export const listProductTypes = async () => (await api.get('/product-types')).data.data;
export const PRODUCT_TYPES_CHANGED = 'product-types-changed';
const notifyChange = () => {
  window.dispatchEvent(new Event(PRODUCT_TYPES_CHANGED));
  try { localStorage.setItem(PRODUCT_TYPES_CHANGED, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab updates still work without local storage. */ }
};
export const createProductType = async data => {
  const response = await api.post('/product-types', data);
  notifyChange();
  return response.data.data;
};
export const updateProductType = async (id, data) => {
  const response = await api.put(`/product-types/${id}`, data);
  notifyChange();
  return response.data.data;
};
export const deleteProductType = async id => {
  const response = await api.delete(`/product-types/${id}`);
  notifyChange();
  return response;
};
