// src/services/aiAssistantService.js
// Dịch vụ API Trợ lý Giọng nói & AI FarmShift
import { api } from '../utils/api';

const resolveAudioFilename = (audioBlob, explicitFilename) => {
  if (explicitFilename && String(explicitFilename).trim()) {
    return String(explicitFilename).trim();
  }
  const type = String(audioBlob?.type || '').toLowerCase();
  if (type.includes('mp4;codecs=mp4a') || type.includes('m4a')) return 'voice.m4a';
  if (type.includes('mp4')) return 'voice.mp4';
  if (type.includes('ogg')) return 'voice.ogg';
  if (type.includes('wav')) return 'voice.wav';
  if (type.includes('mpeg') || type.includes('mp3')) return 'voice.mp3';
  if (type.includes('aac')) return 'voice.aac';
  return 'voice.webm';
};

/**
 * Gửi file âm thanh thu từ microphone lên API Groq Whisper STT (POST /api/ai/voice/transcribe)
 * @param {Blob} audioBlob - Dữ liệu âm thanh từ MediaRecorder
 * @param {string} [filename] - Tên tệp âm thanh thương thích nền tảng (voice.webm / voice.m4a / voice.mp4)
 * @returns {Promise<{
 *   text: string,
 *   rawText?: string,
 *   normalizedText?: string,
 *   confidence?: number,
 *   durationSec?: number,
 *   autoSubmitEligible?: boolean,
 *   rejectedReason?: string | null,
 *   corrections?: Array<{from: string, to: string}>,
 *   segmentsFiltered?: number,
 *   provider: string,
 *   fallback: boolean,
 *   durationMs: number
 * }>}
 */
export const transcribeAudio = async (audioBlob, filename) => {
  const formData = new FormData();
  const resolvedName = resolveAudioFilename(audioBlob, filename);
  formData.append('file', audioBlob, resolvedName);

  const response = await api.post('/ai/voice/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 35000,
  });

  return response.data;
};

/**
 * Lấy danh sách thẻ gợi ý thông minh theo vai trò và màn hình hiện tại (GET /api/ai/suggestions?route=...)
 * @param {string} [route] - Đường dẫn màn hình hiện tại (mặc định window.location.pathname)
 * @param {Object} [options] - Tùy chọn cache của api.get ({ forceRefresh, ttl, signal })
 * @returns {Promise<{
 *   role: string,
 *   roleLabel: string,
 *   routeLabel: string,
 *   inputPlaceholder: string,
 *   generatedAt: string,
 *   suggestions: Array<{
 *     id: string,
 *     category: 'URGENT' | 'ALERT' | 'ACTION' | 'INSIGHT',
 *     badge: string,
 *     title: string,
 *     subtitle: string,
 *     prompt: string,
 *     autoSend: boolean,
 *     targetRoute: string,
 *     priorityScore: number
 *   }>
 * }>}
 */
export const getAiSuggestions = async (route = window.location.pathname, options = {}) => {
  const response = await api.get('/ai/suggestions', {
    params: { route },
    ttl: 30000,
    ...options,
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
export const sendAssistantMessage = async ({
  message,
  currentRoute = window.location.pathname,
  autoExecute = false,
  history,
  confirmAction,
  pendingActionPayload,
  actionId,
  actionToken,
  sessionId,
  resetSession,
  lastActionContext
}) => {
  const response = await api.post('/ai/assistant', {
    message,
    currentRoute,
    autoExecute,
    history,
    confirmAction,
    pendingActionPayload,
    ...(actionId ? { actionId } : {}),
    ...(actionToken ? { actionToken } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(resetSession ? { resetSession: true } : {}),
    lastActionContext
  });

  return response.data;
};
