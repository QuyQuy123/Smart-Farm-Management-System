// d:\Smart-Farm-Management-System\frontendFarmShift\src\utils\api.js
import axios from 'axios';
import { getAuthToken, clearAuthToken } from './authStorage';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401s (e.g. token expired) globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and force re-login if unauthorized
      clearAuthToken();
      // Dispatch event for AuthContext to catch and clear user state
      window.dispatchEvent(new Event('unauthorized'));
    }
    return Promise.reject(error);
  }
);

api.uploadFile = async (file, folder = 'avatars') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const response = await api.post('/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data; // { success: true, data: { url: "..." } }
};
