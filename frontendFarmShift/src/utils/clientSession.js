// src/utils/clientSession.js
// Unique identifier per browser tab so WebSocket broadcasts skip redundant self-echoes.

const createClientSessionId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export const CLIENT_SESSION_ID = createClientSessionId();
