// src/utils/aiChatStorage.js
// User-scoped AI Chatbox session storage with fail-closed cross-account isolation.

export const AI_SESSIONS_STORAGE_KEY = 'farmshift_ai_sessions_v1';
export const AI_ACTIVE_SESSION_STORAGE_KEY = 'farmshift_ai_active_session_id';
export const AI_LEGACY_HISTORY_KEY = 'farmshift_ai_chat_history';
export const AI_CHAT_OPEN_KEY = 'farmshift_ai_chat_open';
export const AI_CHAT_EXPANDED_KEY = 'farmshift_ai_chat_expanded';
export const AI_CHAT_SESSION_LIST_OPEN_KEY = 'farmshift_ai_chat_session_list_open';
export const AI_CHAT_DRAFT_INPUT_KEY = 'farmshift_ai_chat_draft_input';
export const AI_CHAT_OWNER_KEY = 'farmshift_ai_chat_owner';
export const AI_CHAT_RESET_EVENT = 'farmshift:ai-chat-reset';

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const decoded = atob(base64);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Resolves the stable lowercase owner scope for AI chat persistence.
 * Priority: explicitScope prop -> active JWT sub/email -> demo mode -> 'anonymous'.
 */
export const resolveAiChatOwnerScope = (explicitScope) => {
  if (typeof explicitScope === 'string' && explicitScope.trim()) {
    return explicitScope.trim().toLowerCase();
  }
  try {
    if (typeof window !== 'undefined') {
      const token = window.localStorage?.getItem('token') || window.sessionStorage?.getItem('token');
      if (token) {
        const payload = decodeJwtPayload(token);
        const identity = payload?.sub || payload?.email;
        if (typeof identity === 'string' && identity.trim()) {
          return identity.trim().toLowerCase();
        }
        return token.slice(0, 16);
      }
      if (window.sessionStorage?.getItem('demo_mode') === 'true') {
        return 'demo';
      }
    }
  } catch {
    // Ignore storage access errors and fall back to anonymous
  }
  return 'anonymous';
};

/**
 * Removes all AI chat storage keys from sessionStorage (including any farmshift_ai_* keys)
 * and removes stale role hint from localStorage without dispatching events.
 */
export const purgeAiChatStorageKeys = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const keysToRemove = new Set([
        AI_SESSIONS_STORAGE_KEY,
        AI_ACTIVE_SESSION_STORAGE_KEY,
        AI_LEGACY_HISTORY_KEY,
        AI_CHAT_OPEN_KEY,
        AI_CHAT_EXPANDED_KEY,
        AI_CHAT_SESSION_LIST_OPEN_KEY,
        AI_CHAT_DRAFT_INPUT_KEY,
        AI_CHAT_OWNER_KEY,
      ]);
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith('farmshift_ai_')) {
          keysToRemove.add(k);
        }
      }
      keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
    }
  } catch {
    // Ignore storage errors
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('farmshift_user_role');
    }
  } catch {
    // Ignore storage errors
  }
};

/**
 * Clears persisted AI chat storage and notifies any mounted AIChatbot to wipe in-memory state.
 */
export const clearAiChatStorage = () => {
  purgeAiChatStorageKeys();
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AI_CHAT_RESET_EVENT));
    }
  } catch {
    // Ignore event dispatch errors
  }
};

const normalizeSessionsList = (rawList, createSessionFn, initialMessage) => {
  if (!Array.isArray(rawList) || rawList.length === 0) return null;
  return rawList.map((s, idx) => ({
    ...s,
    id: s?.id || `session_restored_${idx + 1}`,
    title: s?.title || `Phiên #${idx + 1}`,
    messages: Array.isArray(s?.messages) && s.messages.length > 0 ? s.messages : [initialMessage],
    lastActionContext: s?.lastActionContext || null,
  }));
};

/**
 * Loads AI chat state strictly for ownerScope; fails closed by purging mismatched or
 * untagged legacy storage whenever an authenticated scope is active.
 */
export const loadAiChatState = (ownerScope, createSessionFn, initialMessage) => {
  const buildFresh = () => {
    const fresh = createSessionFn(1, [initialMessage]);
    return {
      sessions: [fresh],
      activeSessionId: fresh.id,
      isOpen: false,
      isExpanded: false,
      isSessionListOpen: false,
      draftInput: '',
    };
  };

  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return buildFresh();
    }

    const storedOwner = window.sessionStorage.getItem(AI_CHAT_OWNER_KEY);
    if (storedOwner && storedOwner !== ownerScope) {
      purgeAiChatStorageKeys();
      return buildFresh();
    }
    if (!storedOwner && ownerScope !== 'anonymous') {
      purgeAiChatStorageKeys();
      return buildFresh();
    }

    const isOpen = window.sessionStorage.getItem(AI_CHAT_OPEN_KEY) === 'true';
    const isExpanded = window.sessionStorage.getItem(AI_CHAT_EXPANDED_KEY) === 'true';
    const isSessionListOpen = window.sessionStorage.getItem(AI_CHAT_SESSION_LIST_OPEN_KEY) === 'true';
    const draftInput = window.sessionStorage.getItem(AI_CHAT_DRAFT_INPUT_KEY) || '';
    let restoredSessions = null;

    const savedSessionsRaw = window.sessionStorage.getItem(AI_SESSIONS_STORAGE_KEY);
    if (savedSessionsRaw) {
      const parsed = JSON.parse(savedSessionsRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (parsed.ownerScope !== ownerScope) {
          purgeAiChatStorageKeys();
          return buildFresh();
        }
        restoredSessions = normalizeSessionsList(parsed.sessions, createSessionFn, initialMessage);
      } else if (Array.isArray(parsed) && (storedOwner === ownerScope || ownerScope === 'anonymous')) {
        restoredSessions = normalizeSessionsList(parsed, createSessionFn, initialMessage);
      }
    } else if (ownerScope === 'anonymous') {
      const legacyRaw = window.sessionStorage.getItem(AI_LEGACY_HISTORY_KEY);
      if (legacyRaw) {
        const parsedLegacy = JSON.parse(legacyRaw);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          restoredSessions = [createSessionFn(1, parsedLegacy)];
        }
      }
    }

    const sessions = restoredSessions || [createSessionFn(1, [initialMessage])];
    const savedActive = window.sessionStorage.getItem(AI_ACTIVE_SESSION_STORAGE_KEY);
    const hasSavedActive = Boolean(savedActive && sessions.some((s) => s.id === savedActive));

    return {
      sessions,
      activeSessionId: hasSavedActive ? savedActive : sessions[0]?.id,
      isOpen,
      isExpanded,
      isSessionListOpen,
      draftInput,
    };
  } catch {
    return buildFresh();
  }
};

/**
 * Persists AI chat state tagged with ownerScope, removing legacy untagged history copies.
 */
export const saveAiChatState = (ownerScope, { sessions, activeSessionId, isOpen, isExpanded, isSessionListOpen, draftInput }) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(AI_CHAT_OWNER_KEY, ownerScope);
    if (Array.isArray(sessions) && sessions.length > 0) {
      window.sessionStorage.setItem(
        AI_SESSIONS_STORAGE_KEY,
        JSON.stringify({ ownerScope, sessions })
      );
    }
    if (activeSessionId) {
      window.sessionStorage.setItem(AI_ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
    }
    window.sessionStorage.setItem(AI_CHAT_OPEN_KEY, String(Boolean(isOpen)));
    window.sessionStorage.setItem(AI_CHAT_EXPANDED_KEY, String(Boolean(isExpanded)));
    window.sessionStorage.setItem(AI_CHAT_SESSION_LIST_OPEN_KEY, String(Boolean(isSessionListOpen)));
    window.sessionStorage.setItem(AI_CHAT_DRAFT_INPUT_KEY, typeof draftInput === 'string' ? draftInput : '');
    window.sessionStorage.removeItem(AI_LEGACY_HISTORY_KEY);
  } catch {
    // Ignore storage quota or serialization errors
  }
};
