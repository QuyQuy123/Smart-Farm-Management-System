import { api } from '../utils/api';

export const listProductCategories = async () => (await api.get('/product-categories')).data.data;
export const PRODUCT_CATEGORIES_CHANGED = 'product-categories-changed';
const notifyChange = () => {
  window.dispatchEvent(new Event(PRODUCT_CATEGORIES_CHANGED));
  try { localStorage.setItem(PRODUCT_CATEGORIES_CHANGED, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab updates still work without local storage. */ }
};
export const createProductCategory = async data => {
  const response = await api.post('/product-categories', data);
  notifyChange();
  return response.data.data;
};
export const updateProductCategory = async (id, data) => {
  const response = await api.put(`/product-categories/${id}`, data);
  notifyChange();
  return response.data.data;
};
export const deleteProductCategory = async id => {
  const response = await api.delete(`/product-categories/${id}`);
  notifyChange();
  return response;
};
