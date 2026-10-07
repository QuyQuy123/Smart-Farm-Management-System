// src/services/fileService.js
// Cloudflare R2 / S3 file upload service connected to Spring Boot backend
import { api } from '../utils/api';

export const fileService = {
  uploadFile: async (file, folder = 'avatars') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const response = await api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data?.data?.url || response.data?.data || response.data;
  }
};
