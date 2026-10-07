// src/services/userService.js
// User profile & settings API service connected to Spring Boot backend
import { api } from '../utils/api';

export const getProfile = async () => {
  const response = await api.get('/user/profile');
  return response.data?.data || response.data;
};

export const updateProfile = async (profileData) => {
  const response = await api.put('/user/profile', profileData);
  return response.data?.data || response.data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const response = await api.put('/user/password', { currentPassword, newPassword });
  return response.data;
};

export const getAllUsers = async () => {
  const response = await api.get('/user/all');
  return response.data?.data || response.data;
};

