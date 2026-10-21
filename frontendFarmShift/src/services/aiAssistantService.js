// src/services/aiAssistantService.js
// Dịch vụ API Trợ lý Giọng nói & AI FarmShift
import { api } from '../utils/api';

/**
 * Gửi file âm thanh thu từ microphone lên API Groq Whisper STT (POST /api/ai/transcribe)
 * @param {Blob} audioBlob - Dữ liệu âm thanh từ MediaRecorder
 * @returns {Promise<{text: string, provider: string, fallback: boolean, durationMs: number}>}
 */
export const transcribeAudio = async (audioBlob) => {
  const formData = new FormData();
  const filename = audioBlob.type.includes('mp4') ? 'voice_command.mp4' : 'voice_command.webm';
  formData.append('file', audioBlob, filename);

  const response = await api.post('/ai/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 35000,
  });

  return response.data;
};

/**
 * Gửi câu lệnh tới Trợ lý AI FarmShift để phân tích ý định và thực thi thao tác (POST /api/ai/assistant)
 * @param {Object} payload - { message: string, currentRoute?: string, autoExecute?: boolean }
 * @returns {Promise<{
 *   reply: string,
 *   actionType: string,
 *   executed: boolean,
 *   navigateTo?: string,
 *   uiCommand?: string,
 *   actionSummary?: { title: string, barnName?: string, detail: string, timestamp: string },
 *   prefillData?: Object,
 *   dataCard?: Object
 * }>}
 */
export const sendAssistantMessage = async ({ message, currentRoute = window.location.pathname, autoExecute = true }) => {
  const response = await api.post('/ai/assistant', {
    message,
    currentRoute,
    autoExecute,
  });

  return response.data;
};
