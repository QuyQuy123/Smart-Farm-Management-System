// src/services/userService.js
import { api } from '../utils/api';

export const getProfile = async () => {
  const response = await api.get('/user/profile');
  return response.data.data; // ApiResponse format: { status, message, data }
};

export const updateProfile = async (profileData) => {
  const response = await api.put('/user/profile', profileData);
  return response.data;
};

export const changePassword = async (passwordData) => {
  const response = await api.put('/user/password', passwordData);
  return response.data;
};
