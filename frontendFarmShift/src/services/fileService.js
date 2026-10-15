// src/services/fileService.js
// Cloudflare R2 / S3 file upload service connected to Spring Boot backend
import { api } from '../utils/api';

export const fileService = {
  uploadAvatar: async (file, preview) => {
    if (!file) {
      if (!preview?.startsWith('data:image/')) throw new Error('Không có ảnh để tải lên.');
      const blob = await (await fetch(preview)).blob();
      file = new File([blob], 'avatar', { type: blob.type });
    }
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/user/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
    const url = response.data?.data?.url;
    if (typeof url !== 'string' || !url) throw new Error('Máy chủ chưa trả về đường dẫn ảnh.');
    return url;
  },
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
