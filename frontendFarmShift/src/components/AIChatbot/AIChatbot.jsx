// src/components/AIChatbot/AIChatbot.jsx
// Trợ lý Giọng nói & AI FarmShift (Actionable Voice Assistant & System Automation)
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles, X, Send, RotateCcw, Plus, History, Trash2,
  PanelRightOpen, PanelRightClose, Mic, MicOff, ShieldCheck,
  Zap, ExternalLink, Volume2, VolumeX, Check, AlertCircle,
  ArrowUpRight, PenLine
} from 'lucide-react';
import * as aiAssistantService from '../../services/aiAssistantService';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { createAdaptiveVoiceRecorder, NO_SPEECH_HINT, VAD_CONFIG } from '../../utils/audioRecorder';
import farmLogo from '../../assets/logo_Farm.png';
import styles from './AIChatbot.module.css';

const { transcribeAudio, sendAssistantMessage } = aiAssistantService;

const resolveGetSuggestionsFn = () => {
  try {
    return typeof aiAssistantService?.getAiSuggestions === 'function'
      ? aiAssistantService.getAiSuggestions
      : null;
  } catch (_e) {
    return null;
  }
};

const ROLE_LABELS = {
  ROLE_FARM_WORKER: 'Công nhân',
  ROLE_ACCOUNTANT: 'Kế toán',
  ROLE_FARM_OWNER: 'Chủ trại',
};

const ROUTE_LABELS = [
  ['/dashboard', 'Bảng tin'],
  ['/today-tasks', 'Việc hôm nay'],
  ['/barns', 'Chuồng nuôi'],
  ['/areas', 'Khu nuôi'],
  ['/journal', 'Nhật ký nuôi'],
  ['/inventory', 'Tồn kho'],
  ['/internal-stock', 'Xuất nhập kho'],
  ['/transfers', 'Xuất nhập kho'],
  ['/purchases', 'Hóa đơn & Mua hàng'],
  ['/sales', 'Xuất bán'],
  ['/reports', 'Báo cáo'],
  ['/iot', 'Môi trường IoT'],
  ['/general-settings', 'Thiết lập'],
  ['/catalog-settings', 'Thiết lập'],
  ['/breeding-settings', 'Thiết lập'],
  ['/account', 'Tài khoản'],
];

const resolveLocalRouteLabel = (pathname) => {
  const path = String(pathname || '/dashboard').toLowerCase();
  const matched = ROUTE_LABELS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return matched ? matched[1] : 'Trang trại';
};

const resolveRoleDefaultPlaceholder = (role) => {
  if (role === 'ROLE_FARM_WORKER') {
    return 'Hỏi hoặc ra lệnh: ghi cám, cân mẫu, hao hụt, việc hôm nay...';
  }
  if (role === 'ROLE_ACCOUNTANT') {
    return 'Hỏi hoặc ra lệnh: nhập kho, công nợ NCC, tồn kho, chuyển kho...';
  }
  return 'Hỏi hoặc ra lệnh: ghi cám Nhà A1, cân mẫu, FCR, công nợ...';
};

const getDeepLinkLabel = (route) => {
  const path = String(route || '').split('?')[0].toLowerCase();
  if (path.startsWith('/today-tasks')) return 'Mở Việc hôm nay';
  if (path.startsWith('/journal')) return 'Mở Nhật ký nuôi';
  if (path.startsWith('/purchases')) return 'Mở Hóa đơn & Mua hàng';
  if (path.startsWith('/inventory')) return 'Mở Tồn kho';
  if (path.startsWith('/internal-stock') || path.startsWith('/transfers')) return 'Mở Xuất nhập kho';
  if (path.startsWith('/reports')) return 'Mở Báo cáo';
  if (path.startsWith('/barns')) return 'Mở Chuồng nuôi';
  if (path.startsWith('/sales')) return 'Mở Xuất bán';
  if (path.startsWith('/iot')) return 'Mở Môi trường IoT';
  return 'Xem tại màn hình đích';
};

const THINKING_STEPS = [
  'Đang kiểm tra dữ liệu chuồng & kho...',
  'Đang phân tích chỉ số thực tế...',
  'Đang tổng hợp câu trả lời...',
];

let nextMsgId = 100;
const generateMessageId = () => `msg_${Date.now()}_${++nextMsgId}`;

let nextSessionSeq = 0;
const SESSIONS_STORAGE_KEY = 'farmshift_ai_sessions_v1';
const ACTIVE_SESSION_STORAGE_KEY = 'farmshift_ai_active_session_id';

const formatCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const formatSessionTitle = (text) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Phiên mới';
  return clean.length > 26 ? `${clean.slice(0, 26)}…` : clean;
};

const formatRecordingClock = (seconds) => {
  const s = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const INITIAL_MESSAGE = {
  id: 1,
  type: 'bot',
  text: 'Xin chào! Tôi là Trợ lý AI FarmShift. Tôi có thể thực thi trực tiếp các thao tác ghi cám, cân mẫu, báo cáo hao hụt, nhập kho hoặc giải đáp thú y & điều hành trang trại.',
  time: formatCurrentTime(),
  showChips: true
};

const createSessionObject = (index = 1, seedMessages = [INITIAL_MESSAGE]) => {
  const msgs = Array.isArray(seedMessages) && seedMessages.length > 0 ? seedMessages : [INITIAL_MESSAGE];
  const firstUser = msgs.find(m => m.type === 'user' && m.text);
  const now = Date.now();
  return {
    id: `session_${now}_${++nextSessionSeq}`,
    title: firstUser ? formatSessionTitle(firstUser.text) : `Phiên #${index}`,
    createdAt: now,
    updatedAt: now,
    messages: msgs,
    lastActionContext: null
  };
};

export const ROLE_SUGGESTIONS = {
  ROLE_FARM_WORKER: [
    { label: '🎙️ Ghi cám hôm nay', query: 'Ghi 50kg cám Nhà A1' },
    { label: '⚖️ Báo cân mẫu', query: 'Cân mẫu Nhà A1 trung bình 1.5 kg mẫu 50 con' },
    { label: '📋 Việc chưa làm hôm nay', query: 'Việc hôm nay đã làm xong' },
  ],
  ROLE_ACCOUNTANT: [
    { label: '📦 Kiểm tra lô tồn kho & giá TB', query: 'Kiểm tra tồn kho thuốc và giá trung bình hiện tại' },
    { label: '🔄 Tạo phiếu chuyển kho', query: 'Chuyển 10 bao cám Higro 02 từ Kho cám sang Kho Khu B' },
    { label: '💰 Công nợ nhà cung cấp', query: 'Công nợ nhà cung cấp' },
  ],
  ROLE_FARM_OWNER: [
    { label: '📊 Phân tích FCR & Hao hụt', query: 'Hiệu suất FCR và tỷ lệ hao hụt các chuồng' },
    { label: '🌡️ Nhiệt độ & Độ ẩm các chuồng', query: 'Nhiệt độ và độ ẩm các chuồng hiện tại' },
    { label: '💵 Tổng hợp lãi lỗ lứa nuôi', query: 'Báo cáo lãi lỗ' },
  ],
};

const SUGGESTIONS = [
  { label: '✅ Xong việc hôm nay', query: 'Việc hôm nay đã làm xong' },
  { label: '⚖️ Cân mẫu Nhà A1 1.5kg', query: 'Cân mẫu Nhà A1 trung bình 1.5 kg mẫu 50 con' },
  { label: '🩺 Gà thở khò khè', query: 'Gà có triệu chứng thở khò khè, ngáp gió điều trị thế nào?' },
];

/**
 * Pure Vanilla React Markdown & Table Renderer
 * Render formatting (bold, italics, inline code, bullet/numbered lists, and responsive markdown tables)
 */
export const FormattedBotText = ({ text }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const blocks = [];
  let currentTable = null;
  let currentList = null;
  let currentParagraph = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'p', content: currentParagraph.join('\n') });
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  const flushTable = () => {
    if (currentTable) {
      blocks.push(currentTable);
      currentTable = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line is a table row: starts and ends with |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      flushParagraph();
      flushList();
      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      const isSeparator = cells.every(c => /^:?-+:?$/.test(c));
      if (!currentTable) {
        currentTable = { type: 'table', headers: cells, rows: [] };
      } else if (isSeparator) {
        // Separator row, skip
      } else {
        currentTable.rows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // Check if line is bullet list: "- " or "* " or "• "
    if (/^[-*•]\s+/.test(trimmed)) {
      flushParagraph();
      const itemContent = trimmed.replace(/^[-*•]\s+/, '');
      if (!currentList || currentList.listType !== 'ul') {
        flushList();
        currentList = { type: 'list', listType: 'ul', items: [itemContent] };
      } else {
        currentList.items.push(itemContent);
      }
      continue;
    }

    // Check if line is numbered list: "1. " or "2) "
    if (/^\d+[.)]\s+/.test(trimmed)) {
      flushParagraph();
      const itemContent = trimmed.replace(/^\d+[.)]\s+/, '');
      if (!currentList || currentList.listType !== 'ol') {
        flushList();
        currentList = { type: 'list', listType: 'ol', items: [itemContent] };
      } else {
        currentList.items.push(itemContent);
      }
      continue;
    }

    // Otherwise, normal paragraph line
    flushList();
    if (trimmed === '') {
      flushParagraph();
    } else {
      currentParagraph.push(line);
    }
  }

  flushParagraph();
  flushList();
  flushTable();

  const renderInline = (str) => {
    if (!str) return null;
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(<code key={match.index} className={styles.inlineCode}>{token.slice(1, -1)}</code>);
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }
    return parts.length > 0 ? parts : str;
  };

  return (
    <div className={styles.markdownContent}>
      {blocks.map((block, idx) => {
        if (block.type === 'table') {
          return (
            <div key={idx} className={styles.tableScrollWrapper}>
              <table className={styles.markdownTable}>
                <thead>
                  <tr>
                    {block.headers.map((h, hIdx) => (
                      <th key={hIdx}>{renderInline(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx}>{renderInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === 'list') {
          const ListTag = block.listType;
          return (
            <ListTag key={idx} className={block.listType === 'ul' ? styles.markdownUl : styles.markdownOl}>
              {block.items.map((it, itIdx) => (
                <li key={itIdx}>{renderInline(it)}</li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={idx} className={styles.markdownP}>
            {block.content.split('\n').map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {renderInline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};

export const AIChatbot = ({ userRole: propRole, role: legacyRole, userEmail }) => {
  const userRole = propRole || legacyRole || (typeof localStorage !== 'undefined' ? localStorage.getItem('farmshift_user_role') : null);
  const userScope = String(userEmail || userRole || 'default').trim().toLowerCase() || 'default';
  const isDefaultScope = userScope === 'default';
  const openStorageKey = isDefaultScope ? 'farmshift_ai_chat_open' : `farmshift_ai_chat_open::${userScope}`;
  const sessionsStorageKey = isDefaultScope ? SESSIONS_STORAGE_KEY : `${SESSIONS_STORAGE_KEY}::${userScope}`;
  const activeSessionStorageKey = isDefaultScope ? ACTIVE_SESSION_STORAGE_KEY : `${ACTIVE_SESSION_STORAGE_KEY}::${userScope}`;

  const fallbackCards = useMemo(() => {
    const raw = (userRole && ROLE_SUGGESTIONS[userRole]) ? ROLE_SUGGESTIONS[userRole] : SUGGESTIONS;
    return raw.map((item, idx) => ({
      id: `fallback_${userRole || 'default'}_${idx}`,
      category: idx === 0 ? 'ACTION' : 'INSIGHT',
      badge: idx === 0 ? 'Thao tác' : 'Gợi ý',
      title: item.label,
      subtitle: item.query,
      prompt: item.query,
      autoSend: true,
      targetRoute: '/dashboard',
      priorityScore: 50 - idx,
    }));
  }, [userRole]);
  const navigate = useNavigate();
  const location = useLocation();
  const confirmInFlightRef = useRef(new Set());

  const readScopedSessions = useCallback((sKey, allowLegacyFallback = false) => {
    try {
      const savedSessions = sessionStorage.getItem(sKey);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s, idx) => ({
            ...s,
            id: s.id || `session_restored_${idx + 1}`,
            title: s.title || `Phiên #${idx + 1}`,
            messages: Array.isArray(s.messages) && s.messages.length > 0 ? s.messages : [INITIAL_MESSAGE],
            lastActionContext: s.lastActionContext || null
          }));
        }
      }
      if (allowLegacyFallback) {
        const legacySaved = sessionStorage.getItem('farmshift_ai_chat_history');
        if (legacySaved) {
          const parsedLegacy = JSON.parse(legacySaved);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            return [createSessionObject(1, parsedLegacy)];
          }
        }
      }
    } catch (_e) {
      // ignore
    }
    return [createSessionObject(1, [INITIAL_MESSAGE])];
  }, []);

  // Track which userScope owns the current in-memory chat state so switching accounts never writes old messages into the new user's storage key
  const stateScopeRef = useRef(userScope);

  // Restore previous open/closed status from user-scoped sessionStorage across routes & tabs
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return sessionStorage.getItem(openStorageKey) === 'true';
    } catch (_e) {
      return false;
    }
  });

  // Sync isOpen state to user-scoped sessionStorage
  useEffect(() => {
    if (stateScopeRef.current !== userScope) return;
    try {
      sessionStorage.setItem(openStorageKey, String(isOpen));
    } catch (_e) {
      // ignore
    }
  }, [isOpen, openStorageKey, userScope]);

  // Restore multi-session conversations & active session from user-scoped sessionStorage
  const [sessions, setSessions] = useState(() => readScopedSessions(sessionsStorageKey, isDefaultScope));

  const [activeSessionId, setActiveSessionId] = useState(() => {
    try {
      const savedActive = sessionStorage.getItem(activeSessionStorageKey);
      if (savedActive) return savedActive;
    } catch (_e) {
      // ignore
    }
    return sessions[0]?.id;
  });

  const [isSessionListOpen, setIsSessionListOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Sync Side-Drawer layout offset on root element so fixed drawer never hides Dashboard KPIs
  useEffect(() => {
    const active = Boolean(isOpen && isExpanded);
    document.documentElement.classList.toggle('farmshift-ai-drawer-open', active);
    return () => {
      document.documentElement.classList.remove('farmshift-ai-drawer-open');
    };
  }, [isOpen, isExpanded]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const effectiveSessionId = activeSession?.id;
  const messages = useMemo(
    () => (Array.isArray(activeSession?.messages) ? activeSession.messages : [INITIAL_MESSAGE]),
    [activeSession]
  );
  const lastActionContext = activeSession?.lastActionContext || null;

  const updateSessionMessages = (targetSessionId, updater) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== targetSessionId) return s;
      const prevMsgs = Array.isArray(s.messages) ? s.messages : [INITIAL_MESSAGE];
      const nextMsgs = typeof updater === 'function' ? updater(prevMsgs) : updater;
      const firstUser = nextMsgs.find(m => m.type === 'user' && m.text);
      return {
        ...s,
        title: firstUser ? formatSessionTitle(firstUser.text) : s.title,
        updatedAt: Date.now(),
        messages: nextMsgs
      };
    }));
  };

  const setSessionActionContext = (targetSessionId, nextCtx) => {
    setSessions(prev => prev.map(s => (
      s.id === targetSessionId
        ? { ...s, lastActionContext: nextCtx, updatedAt: Date.now() }
        : s
    )));
  };

  const setMessages = (updater) => {
    if (effectiveSessionId) {
      updateSessionMessages(effectiveSessionId, updater);
    }
  };

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [liveSuggestions, setLiveSuggestions] = useState(null);
  const [liveMeta, setLiveMeta] = useState(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const [voiceRms, setVoiceRms] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceCorrections, setVoiceCorrections] = useState([]);
  const [voiceConfidence, setVoiceConfidence] = useState(null);
  const [handsFreeMode, setHandsFreeMode] = useState(() => {
    try {
      return localStorage.getItem('farmshift_ai_hands_free') !== 'false';
    } catch (_e) {
      return true;
    }
  });

  // TTS Voice Synthesis States
  const [isAutoSpeakEnabled] = useState(() => {
    try {
      return localStorage.getItem('farmshift_ai_auto_speak') === 'true';
    } catch (_e) {
      return false;
    }
  });
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  const chatWindowRef = useRef(null);
  const chatButtonRef = useRef(null);
  const inputRef = useRef(null);
  const endOfMessagesRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const stopRequestedBeforeReadyRef = useRef(false);
  const interimTranscriptRef = useRef('');
  const handsFreeModeRef = useRef(handsFreeMode);
  const suggestionsReqRef = useRef(0);
  const sendQueryRef = useRef(null);
  handsFreeModeRef.current = handsFreeMode;

  const normalizeWebSpeechText = (raw) => {
    if (!raw) return '';
    return raw
      .replace(/\bnhật\s+(?:kí|kỉ|kỹ|ky|kì|kỷ)\b/giu, 'nhật ký')
      .replace(/\b(?:cần\s+mẫu|cân\s+mẩu)\b/giu, 'cân mẫu')
      .replace(/\bhao\s+hục\b/giu, 'hao hụt')
      .replace(/\bthải\s+lọai\b/giu, 'thải loại')
      .replace(/\b(?:hai|hi|hy)\s*(?:gờ\s*|gơ\s*)?(?:rô|grô|gro)\s*0?1\b/giu, 'Higro 01')
      .replace(/\bcám\s+số\s+1\b/giu, 'Higro 01')
      .replace(/\b(?:hai|hi|hy)\s*(?:gờ\s*|gơ\s*)?(?:rô|grô|gro)\s*0?2\b/giu, 'Higro 02')
      .replace(/\bcám\s+số\s+2\b/giu, 'Higro 02')
      .replace(/\b(?:xi\s*pi|si\s*pi|cp)\s*511\b/giu, 'CP 511')
      .replace(/\b(?:đa\s+ba\s+cô|da\s+ba\s+co|đabacô)\b/giu, 'Dabaco')
      .replace(/\b(?:han\s+vét|hàn\s+vét)\b/giu, 'Hanvet')
      .replace(/\b(?:la\s+sô\s+ta|la\s+xô\s+ta|lasôta)\b/giu, 'Lasota')
      .replace(/\b(?:gum\s+bô\s+rô|găm\s+bô\s+rô)\b/giu, 'Gumboro')
      .replace(/\b(?:niu\s+cát\s+xơn|niu\s+cat\s+xon|niu\s+cát\s+xơ)\b/giu, 'Newcastle')
      .replace(/\bnhà\s+a\s*(?:một|1)\b/giu, 'Nhà A1')
      .replace(/\bnhà\s+a\s*(?:hai|2)\b/giu, 'Nhà A2')
      .replace(/\bnhà\s+(?:b|bê)\s*(?:một|1)\b/giu, 'Nhà B1')
      .replace(/\bnhà\s+(?:b|bê)\s*(?:hai|2)\b/giu, 'Nhà B2')
      .replace(/\bchuồng\s+a\s*(?:một|1)\b/giu, 'Chuồng A1')
      .replace(/\bchuồng\s+a\s*(?:hai|2)\b/giu, 'Chuồng A2')
      .replace(/\bchuồng\s+(?:b|bê)\s*(?:một|1)\b/giu, 'Chuồng B1')
      .replace(/\bchuồng\s+(?:b|bê)\s*(?:hai|2)\b/giu, 'Chuồng B2')
      .replace(/\bkhu\s+(?:di|gi|j)\s+thịt\b/giu, 'Khu J Thịt')
      .replace(/\bkhu\s+mía(?:\s+thịt)?\b/giu, 'Khu Mía Thịt');
  };

  // Persist multi-session conversations & active session per userScope in sessionStorage
  useEffect(() => {
    if (stateScopeRef.current !== userScope) return;
    try {
      if (sessions.length > 0) {
        sessionStorage.setItem(sessionsStorageKey, JSON.stringify(sessions));
      }
      if (effectiveSessionId) {
        sessionStorage.setItem(activeSessionStorageKey, effectiveSessionId);
      }
    } catch (_e) {
      // ignore
    }
  }, [sessions, effectiveSessionId, sessionsStorageKey, activeSessionStorageKey, userScope]);

  useEffect(() => {
    if (stateScopeRef.current === userScope) return;
    stateScopeRef.current = userScope;
    suggestionsReqRef.current += 1;
    const scoped = readScopedSessions(sessionsStorageKey, isDefaultScope);
    setSessions(scoped);
    try {
      const savedActive = sessionStorage.getItem(activeSessionStorageKey);
      setActiveSessionId(savedActive || scoped[0]?.id);
      setIsOpen(sessionStorage.getItem(openStorageKey) === 'true');
    } catch (_e) {
      setActiveSessionId(scoped[0]?.id);
      setIsOpen(false);
    }
    setLiveSuggestions(null);
    setLiveMeta(null);
    setIsExpanded(false);
    setIsSessionListOpen(false);
    setInput('');
  }, [userScope, isDefaultScope, sessionsStorageKey, activeSessionStorageKey, openStorageKey, readScopedSessions]);

  // Dọn dẹp media streams, Web Audio VAD và Web Speech API khi unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_e) { /* ignore */ }
      }
      if (voiceRecorderRef.current) {
        try { voiceRecorderRef.current.cancel(); } catch (_e) { /* ignore */ }
        voiceRecorderRef.current = null;
      }
      if ('speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (_e) { /* ignore */ }
      }
    };
  }, []);

  // Stop speech when chat window is closed
  useEffect(() => {
    if (!isOpen && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_e) { /* ignore */ }
    }
  }, [isOpen]);

  // ── Nạp & làm mới Gợi ý Sống (Live Role & Route Suggestions) ──
  const fetchSuggestions = useCallback(async (forceRefresh = false) => {
    const fetcher = resolveGetSuggestionsFn();
    if (!fetcher) return;

    const reqId = ++suggestionsReqRef.current;
    setSuggestionsLoading(true);
    try {
      const data = await fetcher(
        location.pathname,
        forceRefresh ? { forceRefresh: true } : {}
      );
      if (reqId !== suggestionsReqRef.current || !data) return;
      setLiveMeta({
        role: data.role,
        roleLabel: data.roleLabel,
        routeLabel: data.routeLabel,
        inputPlaceholder: data.inputPlaceholder,
      });
      if (Array.isArray(data.suggestions)) {
        setLiveSuggestions(data.suggestions);
      }
    } catch (_err) {
      // Giữ fallback cards nếu backend chưa sẵn sàng
    } finally {
      if (reqId === suggestionsReqRef.current) {
        setSuggestionsLoading(false);
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;
    fetchSuggestions(false);
  }, [isOpen, location.pathname, userRole, userScope, fetchSuggestions]);

  useRealtimeRefresh(
    ['/ai/suggestions', '/today-tasks', '/journal', '/inventory-items', '/purchases', '/debts', '/barns', '/cycles'],
    () => fetchSuggestions(true),
    {
      enabled: isOpen && Boolean(resolveGetSuggestionsFn()),
      skipLocalApiMutation: false,
    }
  );

  // Cycle contextual thinking steps while assistant is reasoning
  useEffect(() => {
    if (!isTyping) {
      setThinkingIndex(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setThinkingIndex(prev => (prev + 1) % THINKING_STEPS.length);
    }, 1400);
    return () => clearInterval(timer);
  }, [isTyping]);

  // Helper điền prompt mẫu & bôi đen chỗ '...' để điền số lượng nhanh
  const pendingSelectionRef = useRef(null);
  const applyPromptTemplate = useCallback((promptText) => {
    const text = String(promptText || '');
    const idx = text.indexOf('...');
    pendingSelectionRef.current = idx !== -1
      ? { text, start: idx, end: idx + 3 }
      : { text, start: text.length, end: text.length };
    setInput(text);
    setTimeout(() => {
      const el = inputRef.current;
      const pending = pendingSelectionRef.current;
      if (!el || !pending || el.value !== pending.text) return;
      el.focus();
      if (typeof el.setSelectionRange === 'function') {
        el.setSelectionRange(pending.start, pending.end);
      }
      pendingSelectionRef.current = null;
    }, 0);
  }, []);

  useEffect(() => {
    const pending = pendingSelectionRef.current;
    const el = inputRef.current;
    if (!pending || !el || input !== pending.text || el.value !== pending.text) return;
    el.focus();
    if (typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(pending.start, pending.end);
    }
    pendingSelectionRef.current = null;
  }, [input]);

  const handleSuggestionClick = (card) => {
    if (!card?.prompt) return;
    if (card.autoSend === false) {
      applyPromptTemplate(card.prompt);
    } else {
      sendQuery(card.prompt);
    }
  };

  // Phím tắt toàn cục Ctrl + J / Cmd + J để bật/tắt AI Chatbox
  useEffect(() => {
    const handleGlobalShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (String(event.key || '').toLowerCase() !== 'j') return;
      const active = document.activeElement;
      const isEditable = Boolean(
        active && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable
        )
      );
      const insideChatbot = Boolean(active && chatWindowRef.current?.contains(active));
      if (isEditable && !insideChatbot) return;
      event.preventDefault();
      setIsOpen(prev => !prev);
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  // Sự kiện mở nhanh AI từ Dashboard ("Hỏi AI") hoặc màn hình khác
  useEffect(() => {
    const handleOpenAiChat = (event) => {
      const detail = event?.detail || {};
      setIsOpen(true);
      if (detail.prompt && String(detail.prompt).trim()) {
        if (detail.autoSend) {
          setTimeout(() => {
            sendQueryRef.current?.(detail.prompt);
          }, 0);
        } else {
          applyPromptTemplate(detail.prompt);
        }
      } else {
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };

    const handleAiActionCache = (event) => {
      const detail = event?.detail;
      if (!detail) return;
      const isMutation = Boolean(detail.executed || detail.uiCommand === 'REFRESH_DATA');
      if (isMutation) {
        fetchSuggestions(true);
      }
    };

    window.addEventListener('farmshift:open-ai-chat', handleOpenAiChat);
    window.addEventListener('farmshift:ai-action', handleAiActionCache);
    return () => {
      window.removeEventListener('farmshift:open-ai-chat', handleOpenAiChat);
      window.removeEventListener('farmshift:ai-action', handleAiActionCache);
    };
  }, [applyPromptTemplate, fetchSuggestions]);

  // Đóng box chat khi bấm ra ngoài (ở chế độ popover) hoặc nhấn phím Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (isExpanded) return;
      // Nếu bấm bên trong cửa sổ chat hoặc nút launcher thì không đóng
      if (
        chatWindowRef.current?.contains(event.target) ||
        chatButtonRef.current?.contains(event.target)
      ) {
        return;
      }

      // Nếu bấm chuyển tab hoặc menu điều hướng (sidebar, tab bar...), giữ nguyên box chat mở
      if (event.target.closest('nav, aside, [role="tab"], [class*="tab"], .farmshift-sidebar, a[href]')) {
        return;
      }

      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isExpanded]);

  useEffect(() => {
    if (isOpen && endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // ── Web Speech API Text-to-Speech (TTS) Voice Synthesis ──
  const speakText = (text, msgId) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown characters before speech synthesis
    const cleanText = (text || '')
      .replace(/[#*_`|~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(v => v.lang === 'vi-VN' || v.lang.startsWith('vi'));
    if (viVoice) {
      utterance.voice = viVoice;
    }

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Helper to determine destination route and friendly button label
  const getDestination = (msg) => {
    if (msg.navigateTo) {
      return { route: msg.navigateTo, label: 'Xem tại màn hình đích' };
    }
    switch (msg.actionType) {
      case 'LOG_FEED':
        return { route: '/today-tasks', label: 'Xem Việc hôm nay' };
      case 'LOG_WEIGHT':
        return { route: '/journal?tab=weight', label: 'Xem Cân mẫu chuồng' };
      case 'LOG_MORTALITY':
        return { route: '/journal?tab=loss', label: 'Xem Hao hụt chuồng' };
      case 'LOG_EXPENSE':
        return { route: '/barns', label: 'Xem Chi phí lứa nuôi' };
      case 'COMPLETE_DAILY_TASKS':
        return { route: '/today-tasks', label: 'Xem Việc hôm nay' };
      case 'IMPORT_PURCHASE_STOCK':
        return { route: '/purchases', label: 'Xem Hóa đơn nhập hàng' };
      case 'QUERY_FARM_STATUS':
        return { route: '/reports', label: 'Xem Báo cáo trang trại' };
      default:
        return null;
    }
  };

  // ── Xử lý gửi câu lệnh tới Trợ lý AI và Đồng bộ Hệ thống ──
  const sendQuery = async (queryText) => {
    const textToSend = (queryText || '').trim();
    if (!textToSend) return;

    // Dừng thu âm nếu đang bật
    if (isListening) {
      stopListening();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
    }

    const targetSessionId = effectiveSessionId;
    const sessionMessages = messages;
    const sessionContext = lastActionContext;

    const userMsg = {
      id: generateMessageId(),
      type: 'user',
      text: textToSend,
      time: formatCurrentTime()
    };

    // Nếu ngay phía trên đang có thẻ chờ xác nhận và người dùng gõ lời đồng ý tự nhiên -> thực thi xác nhận luôn
    const lastMsg = sessionMessages[sessionMessages.length - 1];
    const normalizedReply = textToSend
      .toLowerCase()
      .replace(/[?!.,:;]+$/g, '')
      .trim();
    const isVerbalConfirmOfPendingCard = Boolean(
      lastMsg
      && lastMsg.type === 'bot'
      && lastMsg.requiresConfirmation
      && lastMsg.pendingAction
      && lastMsg.confirmationStatus === 'pending'
      && /^(?:ok|oke|okay|xác nhận|đồng ý|chốt|làm đi|thực hiện đi|ừ|uh|vâng|đúng rồi)$/i.test(normalizedReply)
    );

    updateSessionMessages(targetSessionId, prev => [...prev, userMsg]);
    setInput('');

    if (isVerbalConfirmOfPendingCard) {
      await handleConfirmAction(lastMsg.id, lastMsg.pendingAction, targetSessionId, sessionContext);
      return;
    }

    setIsTyping(true);

    try {
      // Build conversation history of past turns for multi-turn awareness within the same session
      const historyPayload = sessionMessages
        .filter(m => m.id !== 1 && m.text)
        .slice(-14)
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      const response = await sendAssistantMessage({
        message: textToSend,
        currentRoute: location.pathname,
        history: historyPayload,
        sessionId: targetSessionId,
        lastActionContext: sessionContext || undefined,
        autoExecute: false
      });

      if (response.actionContext) {
        setSessionActionContext(targetSessionId, response.actionContext);
      } else if (response.actionSummary) {
        setSessionActionContext(targetSessionId, response.actionSummary);
      }

      const botMsg = {
        id: generateMessageId(),
        type: 'bot',
        text: response.reply,
        executed: response.executed,
        actionType: response.actionType,
        actionSummary: response.actionSummary,
        navigateTo: response.navigateTo,
        requiresConfirmation: response.requiresConfirmation,
        pendingAction: response.pendingAction,
        confirmationStatus: response.requiresConfirmation ? 'pending' : null,
        time: formatCurrentTime()
      };

      updateSessionMessages(targetSessionId, prev => [...prev, botMsg]);

      // Auto-read response if enabled
      if (isAutoSpeakEnabled && response.reply) {
        speakText(response.reply, botMsg.id);
      }

      // Phát sự kiện toàn cục để các màn hình lắng nghe tự reload dữ liệu hoặc mở modal nhanh
      if (response.executed || response.uiCommand) {
        window.dispatchEvent(new CustomEvent('farmshift:ai-action', { detail: response }));
      }

      // Điều hướng màn hình nếu AI yêu cầu
      if (response.navigateTo) {
        navigate(response.navigateTo);
      }
    } catch (error) {
      console.warn('Lỗi kết nối Trợ lý AI, sử dụng câu trả lời dự phòng:', error);
      updateSessionMessages(targetSessionId, prev => [
        ...prev,
        {
          id: generateMessageId(),
          type: 'bot',
          text: (error?.response?.status === 429 || error?.status === 429)
            ? '⚠️ Quá nhiều yêu cầu gửi tới Trợ lý AI trong thời gian ngắn (tối đa 30 yêu cầu/phút). Vui lòng thử lại sau giây lát.'
            : '⚠️ Không thể kết nối tới máy chủ Trợ lý AI vào lúc này. Vui lòng kiểm tra lại kết nối mạng.',
          time: formatCurrentTime()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // ── Xử lý xác nhận thực thi hành động đã yêu cầu (Human-in-the-loop Confirm) ──
  const handleConfirmAction = async (
    msgId,
    pendingAction,
    targetSessionId = effectiveSessionId,
    sessionContext = lastActionContext
  ) => {
    if (confirmInFlightRef.current.has(msgId)) return;
    confirmInFlightRef.current.add(msgId);
    updateSessionMessages(targetSessionId, prev => prev.map(m => m.id === msgId ? { ...m, confirmationStatus: 'confirming' } : m));
    try {
      const payload = pendingAction?.payload || pendingAction;
      const actionId = pendingAction?.actionId ?? payload?.actionId;
      const actionToken = pendingAction?.actionToken ?? payload?.actionToken;
      const response = await sendAssistantMessage({
        message: 'Xác nhận thực hiện',
        confirmAction: true,
        pendingActionPayload: payload,
        actionId,
        actionToken,
        sessionId: targetSessionId,
        currentRoute: location.pathname,
        lastActionContext: sessionContext || undefined
      });

      if (response.actionContext) {
        setSessionActionContext(targetSessionId, response.actionContext);
      } else if (response.actionSummary) {
        setSessionActionContext(targetSessionId, response.actionSummary);
      }

      updateSessionMessages(targetSessionId, prev => prev.map(m => {
        if (m.id === msgId) {
          return {
            ...m,
            confirmationStatus: 'confirmed',
            executed: response.executed,
            actionSummary: response.actionSummary || m.actionSummary,
            navigateTo: response.navigateTo || m.navigateTo,
            text: response.reply || m.text
          };
        }
        return m;
      }));

      if (response.reply && isAutoSpeakEnabled) {
        speakText(response.reply, msgId);
      }

      if (response.executed || response.uiCommand === 'REFRESH_DATA') {
        window.dispatchEvent(new CustomEvent('farmshift:ai-action', { detail: response }));
      }
      if (response.navigateTo) {
        navigate(response.navigateTo);
      }
    } catch (err) {
      console.warn('Lỗi khi xác nhận thao tác:', err);
      const backendMsg = err.response?.data?.reply || err.response?.data?.message || err.message || 'Không thể thực hiện thao tác. Vui lòng kiểm tra lại.';
      const textToShow = backendMsg.startsWith('⚠️') ? backendMsg : `⚠️ ${backendMsg}`;
      updateSessionMessages(targetSessionId, prev => [
        ...prev.map(m => m.id === msgId ? { ...m, confirmationStatus: 'pending' } : m),
        {
          id: Date.now() + 1,
          type: 'bot',
          text: textToShow,
          time: formatCurrentTime(),
          actionCard: null
        }
      ]);
    } finally {
      confirmInFlightRef.current.delete(msgId);
    }
  };

  // Hủy bỏ thao tác nếu chưa muốn thực hiện
  const handleCancelAction = (msgId) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, confirmationStatus: 'cancelled' } : m));
  };

  // Khôi phục lại thẻ xác nhận nếu lỡ tay bấm từ chối/hủy
  const handleRetryAction = (msgId) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, confirmationStatus: 'pending' } : m));
  };

  const toggleHandsFreeMode = () => {
    setHandsFreeMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('farmshift_ai_hands_free', String(next));
      } catch (_e) { /* ignore */ }
      return next;
    });
  };

  // ── Trình Thu âm Thông minh (Web Audio VAD + MediaRecorder + Hybrid Confidence Routing) ──
  const startListening = async () => {
    setIsListening(true);
    setIsTranscribing(false);
    setVoiceRms(0);
    setRecordingSeconds(0);
    setVoiceCorrections([]);
    setVoiceConfidence(null);
    stopRequestedBeforeReadyRef.current = false;
    interimTranscriptRef.current = '';
    setVoiceNotice(
      handsFreeModeRef.current
        ? '🎙️ Đang nghe... (tự gửi khi ngừng nói)'
        : '🎙️ Đang nghe... Bấm lần nữa để kết thúc'
    );

    // Khởi tạo Adaptive Voice Recorder (Android WebM / iOS MP4-M4A + VAD hiệu chuẩn nhiễu)
    try {
      const recorderHandle = await createAdaptiveVoiceRecorder({
        onLevel: (rms) => setVoiceRms(rms),
        onTick: (sec) => setRecordingSeconds(sec),
        onRejected: (_reason, hint) => {
          if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (_e) { /* ignore */ }
          }
          voiceRecorderRef.current = null;
          setIsListening(false);
          setIsTranscribing(false);
          setVoiceRms(0);
          setRecordingSeconds(0);
          setVoiceNotice(hint || NO_SPEECH_HINT);
        },
        onError: () => {
          voiceRecorderRef.current = null;
          setIsListening(false);
          setIsTranscribing(false);
          setVoiceRms(0);
          setRecordingSeconds(0);
          setVoiceNotice('⚠️ Không thể thu âm từ micro. Vui lòng thử lại.');
        },
        onComplete: async ({ blob, filename }) => {
          if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (_e) { /* ignore */ }
          }
          voiceRecorderRef.current = null;
          setIsListening(false);
          setVoiceRms(0);
          setRecordingSeconds(0);

          const fallbackText = normalizeWebSpeechText(interimTranscriptRef.current);

          if (blob && blob.size > 0) {
            setIsTranscribing(true);
            setVoiceNotice('⚡ Đang chuyển giọng nói thành văn bản...');
            try {
              const sttResult = await transcribeAudio(blob, filename);
              setIsTranscribing(false);

              if (sttResult?.rejectedReason) {
                const rejectMsg = sttResult.rejectedReason === 'SECURITY_BLOCKED'
                  ? '⛔ Nội dung giọng nói vi phạm chính sách bảo mật và đã bị chặn.'
                  : NO_SPEECH_HINT;
                setVoiceNotice(rejectMsg);
                setVoiceCorrections([]);
                setVoiceConfidence(null);
                return;
              }

              const finalText = (!sttResult?.fallback
                ? (sttResult?.normalizedText || sttResult?.text || '')
                : (sttResult?.text || fallbackText || '')
              ).trim();

              if (!finalText) {
                setVoiceNotice(fallbackText ? '' : NO_SPEECH_HINT);
                if (fallbackText) {
                  sendQuery(fallbackText);
                }
                return;
              }

              const confidence = typeof sttResult?.confidence === 'number' ? sttResult.confidence : 1.0;
              const autoSubmitEligible = sttResult?.autoSubmitEligible !== false && confidence >= 0.82;

              if (autoSubmitEligible && handsFreeModeRef.current) {
                setVoiceNotice('');
                setVoiceCorrections([]);
                setVoiceConfidence(null);
                sendQuery(finalText);
              } else {
                setInput(finalText);
                setVoiceConfidence(confidence);
                setVoiceCorrections(Array.isArray(sttResult?.corrections) ? sttResult.corrections : []);
                setVoiceNotice(
                  confidence < 0.82
                    ? `📝 Độ tự tin nhận diện (${Math.round(confidence * 100)}%) — kiểm tra nhanh rồi bấm Gửi.`
                    : '📝 Đã điền câu lệnh — kiểm tra nhanh rồi bấm Gửi.'
                );
              }
              return;
            } catch (sttErr) {
              console.warn('Groq Whisper STT thất bại, dùng văn bản Web Speech API:', sttErr);
              setIsTranscribing(false);
            }
          }

          setIsTranscribing(false);
          setVoiceNotice('');
          if (fallbackText && fallbackText.trim()) {
            sendQuery(fallbackText.trim());
          }
        }
      });

      if (stopRequestedBeforeReadyRef.current) {
        recorderHandle.cancel();
        return;
      }
      voiceRecorderRef.current = recorderHandle;
    } catch (mediaErr) {
      console.warn('Không thể truy cập Micro qua AdaptiveRecorder:', mediaErr);
      setIsListening(false);
      setVoiceNotice('⚠️ Vui lòng cấp quyền Micro trên trình duyệt để sử dụng.');
    }

    // Chạy song song Web Speech API để hiển thị live preview và làm fallback khi offline
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            const normalized = normalizeWebSpeechText(transcript);
            interimTranscriptRef.current = normalized;
            setInput(normalized);
          }
        };

        recognition.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setVoiceNotice('⚠️ Vui lòng cấp quyền Micro trên trình duyệt để sử dụng.');
          }
        };

        recognition.onend = () => {
          if (voiceRecorderRef.current && !handsFreeModeRef.current) {
            voiceRecorderRef.current.stop('manual');
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (e) {
        console.warn('Lỗi khởi tạo Web Speech API:', e);
      }
    }
  };

  const stopListening = () => {
    stopRequestedBeforeReadyRef.current = true;
    const hasActiveRecorder = Boolean(voiceRecorderRef.current);
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.stop('manual');
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_e) { /* ignore */ }
    }
    setIsListening(false);
    setVoiceRms(0);
    setRecordingSeconds(0);
    if (!hasActiveRecorder && !isTranscribing) {
      setVoiceNotice('');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSend = () => {
    setVoiceCorrections([]);
    setVoiceConfidence(null);
    setVoiceNotice('');
    sendQuery(input);
  };

  sendQueryRef.current = sendQuery;

  const displayedSuggestions = (Array.isArray(liveSuggestions) && liveSuggestions.length > 0)
    ? liveSuggestions
    : fallbackCards;
  const contextRouteLabel = liveMeta?.routeLabel || resolveLocalRouteLabel(location.pathname);
  const contextRoleLabel = liveMeta?.roleLabel || ROLE_LABELS[userRole] || 'Trợ lý';
  const effectivePlaceholder = liveMeta?.inputPlaceholder || resolveRoleDefaultPlaceholder(userRole);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const stopVoiceAndAudio = () => {
    if (isListening) {
      stopListening();
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_e) { /* ignore */ }
      setSpeakingMsgId(null);
    }
  };

  const handleCreateNewSession = () => {
    stopVoiceAndAudio();
    const hasConversation = messages.some(m => m.type === 'user');
    const fresh = createSessionObject(
      hasConversation ? sessions.length + 1 : Math.max(1, sessions.findIndex(s => s.id === effectiveSessionId) + 1),
      [{ ...INITIAL_MESSAGE, time: formatCurrentTime() }]
    );
    if (hasConversation) {
      setSessions(prev => [...prev, fresh]);
    } else {
      setSessions(prev => prev.map(s => (s.id === effectiveSessionId ? fresh : s)));
    }
    setActiveSessionId(fresh.id);
    setIsSessionListOpen(false);
  };

  const handleSwitchSession = (sessionId) => {
    stopVoiceAndAudio();
    setActiveSessionId(sessionId);
    setIsSessionListOpen(false);
  };

  const handleDeleteSession = (sessionId, event) => {
    event.stopPropagation();
    stopVoiceAndAudio();
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== sessionId);
      if (remaining.length === 0) {
        const fresh = createSessionObject(1, [{ ...INITIAL_MESSAGE, time: formatCurrentTime() }]);
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (sessionId === effectiveSessionId) {
        setActiveSessionId(remaining[remaining.length - 1].id);
      }
      return remaining;
    });
  };

  return (
    <div className={styles.chatbotWidget}>
      {isOpen && (
        <div
          className={`${styles.chatWindow} ${isExpanded ? styles.chatWindowExpanded : ''}`}
          ref={chatWindowRef}
          data-testid="ai-chat-window"
        >
          {/* ── Header ── */}
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.avatarWrapper}>
                <img src={farmLogo} alt="FarmShift AI" className={styles.avatarLogo} />
                <span className={styles.statusDot} />
              </div>
              <div className={styles.headerText}>
                <div className={styles.headerTitle}>
                  <span>Trợ lý AI FarmShift</span>
                  <Sparkles size={14} color="#f59e0b" />
                </div>
                <div className={styles.contextPill} data-testid="ai-context-pill">
                  <span>{contextRouteLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{contextRoleLabel}</span>
                </div>
              </div>
            </div>

            <div className={styles.headerActions}>
              <div className={styles.iconBtnBadgeWrapper}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  title="Lịch sử các phiên trò chuyện"
                  data-testid="session-list-toggle-btn"
                  onClick={() => setIsSessionListOpen(prev => !prev)}
                >
                  <History size={16} />
                </button>
                {sessions.length > 0 && (
                  <span className={styles.sessionCountBadge} data-testid="session-count-badge">
                    {sessions.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={styles.iconBtn}
                title="Cuộc trò chuyện mới"
                data-testid="new-session-btn"
                onClick={handleCreateNewSession}
              >
                <Plus size={17} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                title={isExpanded ? 'Thu về cửa sổ nổi' : 'Ghim thành ngăn bên phải (Side-Drawer)'}
                data-testid="expand-chat-btn"
                onClick={() => setIsExpanded(prev => !prev)}
              >
                {isExpanded ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                title="Đóng cửa sổ chat (Esc)"
                data-testid="close-chat-btn"
                onClick={() => setIsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {isSessionListOpen && (
            <div className={styles.sessionListPanel} data-testid="session-list-panel">
              <div className={styles.sessionListHeader}>
                <span>Các phiên trò chuyện ({sessions.length})</span>
              </div>
              {sessions.map((s) => {
                const isCurrent = s.id === effectiveSessionId;
                const turnCount = Array.isArray(s.messages) ? s.messages.filter(m => m.type === 'user').length : 0;
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    className={`${styles.sessionListItem} ${isCurrent ? styles.sessionListItemActive : ''}`}
                    data-testid={`session-list-item-${s.id}`}
                    onClick={() => handleSwitchSession(s.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSwitchSession(s.id); }}
                  >
                    <div className={styles.sessionListMeta}>
                      <span className={styles.sessionListTitle}>{s.title}</span>
                      <span className={styles.sessionListSub}>
                        {turnCount} câu hỏi
                        {s.lastActionContext?.barnName ? ` • Nhớ: ${s.lastActionContext.barnName}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.sessionDeleteBtn}
                      title="Xóa phiên này"
                      data-testid={`delete-session-${s.id}`}
                      onClick={(e) => handleDeleteSession(s.id, e)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Message Stream ── */}
          <div className={styles.messages}>
            {messages.map(msg => (
              <React.Fragment key={msg.id}>
                <div
                  className={`${styles.messageRow} ${msg.type === 'user' ? styles.messageRowUser : styles.messageRowBot}`}
                >
                {msg.type === 'bot' && (
                  <div className={styles.botIconSmall}>
                    <img src={farmLogo} alt="FarmShift AI" className={styles.botLogoSmall} />
                  </div>
                )}
                <div className={`${styles.message} ${msg.type === 'user' ? styles.messageUser : styles.messageBot}`}>
                  {msg.type === 'user' ? (
                    <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                  ) : (
                    <FormattedBotText text={msg.text} />
                  )}

                  {/* ── Thẻ Xác nhận Thao tác Thay đổi Dữ liệu (Confirmation Card) ── */}
                  {msg.requiresConfirmation && msg.pendingAction && msg.confirmationStatus !== 'confirmed' && (
                    <div className={styles.confirmCard} data-testid="confirmation-card">
                      <div className={styles.confirmHeader}>
                        <AlertCircle size={15} className={styles.confirmIcon} />
                        <span className={styles.confirmTitle}>{msg.pendingAction.title || 'Xác nhận thao tác'}</span>
                        {(msg.pendingAction.actionToken || msg.pendingAction.payload?.actionToken) && (
                          <span className={styles.securityBadge} data-testid="signed-action-badge">
                            <ShieldCheck size={12} />
                            <span>Đã ký xác thực (5 phút)</span>
                          </span>
                        )}
                      </div>
                      {msg.pendingAction.description && (
                        <div className={styles.confirmDesc}>{msg.pendingAction.description}</div>
                      )}
                      {msg.pendingAction.details && (
                        <div className={styles.confirmDetails}>
                          {Object.entries(msg.pendingAction.details).map(([key, val]) => (
                            <div key={key} className={styles.confirmDetailRow}>
                              <span className={styles.confirmDetailKey}>{key}:</span>
                              <span className={styles.confirmDetailVal}>{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.pendingAction.batchItems && Array.isArray(msg.pendingAction.batchItems) && (
                        <div className={styles.confirmDetails} data-testid="batch-confirmation-items">
                          {msg.pendingAction.batchItems.map((bItem, bIdx) => (
                            <div key={bIdx} className={styles.confirmDetailRow}>
                              <span className={styles.confirmDetailKey}>{bItem.barnName}:</span>
                              <span className={styles.confirmDetailVal}>{bItem.oldValue} → {bItem.newValue} ({bItem.diff})</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.confirmationStatus === 'pending' && (
                        <div className={styles.confirmButtonGroup}>
                          <button
                            type="button"
                            className={styles.confirmAcceptBtn}
                            data-testid="confirm-accept-btn"
                            onClick={() => handleConfirmAction(msg.id, msg.pendingAction)}
                          >
                            <Check size={14} />
                            <span>Xác nhận thực hiện</span>
                          </button>
                          <button
                            type="button"
                            className={styles.confirmRejectBtn}
                            data-testid="confirm-reject-btn"
                            onClick={() => handleCancelAction(msg.id)}
                          >
                            <X size={14} />
                            <span>Hủy bỏ</span>
                          </button>
                        </div>
                      )}

                      {msg.confirmationStatus === 'confirming' && (
                        <div className={styles.confirmStatusPending}>
                          <div className={styles.miniSpinner} />
                          <span>Đang áp dụng thay đổi vào hệ thống...</span>
                        </div>
                      )}

                      {msg.confirmationStatus === 'cancelled' && (
                        <div className={styles.confirmCancelledRow}>
                          <span className={styles.confirmCancelledText}>✕ Bạn đã hủy thao tác này.</span>
                          <button
                            type="button"
                            className={styles.confirmRetryBtn}
                            data-testid="confirm-retry-btn"
                            onClick={() => handleRetryAction(msg.id)}
                            title="Khôi phục để xem xét và thực hiện lại"
                          >
                            <RotateCcw size={12} />
                            <span>Khôi phục & Làm lại</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Thẻ Kết quả Thao tác Hệ thống (Action Execution Card) ── */}
                  {msg.executed && msg.actionSummary && (
                    <div className={styles.actionCard} data-testid="action-execution-card">
                      <div className={styles.actionBadge}>
                        <Zap size={12} />
                        <span>Đã thực thi trên hệ thống</span>
                      </div>
                      <div className={styles.actionCardTitle}>{msg.actionSummary.title}</div>
                      <div className={styles.actionCardDetail}>
                        {msg.actionSummary.barnName ? `🏡 ${msg.actionSummary.barnName} • ` : ''}
                        {msg.actionSummary.detail}
                      </div>
                      <div className={styles.actionCardFooter}>
                        <span className={styles.actionTimestamp}>
                          {msg.actionSummary.timestamp ? new Date(msg.actionSummary.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : msg.time}
                        </span>
                        {(() => {
                          const dest = getDestination(msg);
                          if (!dest) return null;
                          return (
                            <button
                              type="button"
                              className={styles.actionNavBtn}
                              onClick={() => navigate(dest.route)}
                              title={`Chuyển tới ${dest.route}`}
                            >
                              <span>{dest.label}</span>
                              <ExternalLink size={12} />
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* ── Deep-link pill cho phản hồi hỏi đáp có màn hình liên quan ── */}
                  {msg.type === 'bot' && msg.navigateTo && !(msg.executed && msg.actionSummary) && (
                    <button
                      type="button"
                      className={styles.botDeepLinkBtn}
                      data-testid="bot-deeplink-btn"
                      onClick={() => navigate(msg.navigateTo)}
                    >
                      <span>{getDeepLinkLabel(msg.navigateTo)}</span>
                      <ExternalLink size={12} />
                    </button>
                  )}

                  {/* ── Message Footer: Time and Speaker button for Bot ── */}
                  <div className={styles.messageFooter}>
                    {msg.type === 'bot' && 'speechSynthesis' in window ? (
                      <button
                        type="button"
                        className={`${styles.messageTtsBtn} ${speakingMsgId === msg.id ? styles.messageTtsBtnSpeaking : ''}`}
                        onClick={() => speakText(msg.text, msg.id)}
                        title={speakingMsgId === msg.id ? 'Dừng đọc' : 'Đọc câu trả lời bằng giọng nói'}
                        data-testid="message-speaker-btn"
                      >
                        {speakingMsgId === msg.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
                        <span>{speakingMsgId === msg.id ? 'Đang đọc...' : 'Đọc'}</span>
                      </button>
                    ) : <span />}
                    <div className={styles.messageTime}>{msg.time}</div>
                  </div>
                </div>
              </div>

              {msg.showChips && (
                <div className={styles.suggestionsSection} data-testid="live-suggestions-container">
                  <div className={styles.suggestionsHeaderRow}>
                    <span className={styles.suggestionsLabel}>Gợi ý thông minh theo tình hình trại:</span>
                  </div>
                  {suggestionsLoading && !liveSuggestions ? (
                    <div className={styles.suggestionsList} data-testid="suggestions-skeleton">
                      <div className={styles.suggestionSkeleton} />
                      <div className={styles.suggestionSkeleton} />
                      <div className={styles.suggestionSkeleton} />
                    </div>
                  ) : (
                    <div className={styles.suggestionsList}>
                      {displayedSuggestions.map((card, idx) => {
                        const category = card.category || 'INSIGHT';
                        const catStyle = styles[`suggestion${category}`] || styles.suggestionINSIGHT;
                        const badgeStyle = styles[`badge${category}`] || styles.badgeINSIGHT;
                        return (
                          <button
                            key={card.id || idx}
                            type="button"
                            className={`${styles.suggestionCard} ${catStyle}`}
                            data-testid="live-suggestion-card"
                            data-category={category}
                            data-autosend={String(card.autoSend !== false)}
                            onClick={() => handleSuggestionClick(card)}
                          >
                            <div className={styles.suggestionCardTop}>
                              <span className={`${styles.suggestionBadge} ${badgeStyle}`}>
                                {card.badge || 'Gợi ý'}
                              </span>
                              <span className={styles.suggestionCueIcon} aria-hidden="true">
                                {card.autoSend === false ? <PenLine size={13} /> : <ArrowUpRight size={13} />}
                              </span>
                            </div>
                            <div className={styles.suggestionCardTitle}>{card.title}</div>
                            {card.subtitle && (
                              <div className={styles.suggestionCardSub}>{card.subtitle}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              </React.Fragment>
            ))}

            {isTyping && (
              <div className={`${styles.messageRow} ${styles.messageRowBot}`}>
                <div className={styles.botIconSmall}>
                  <img src={farmLogo} alt="FarmShift AI" className={styles.botLogoSmall} />
                </div>
                <div className={`${styles.message} ${styles.messageBot}`}>
                  <div className={styles.typingWrapper}>
                    <div className={styles.loadingDots}>
                      <span className={styles.dot} />
                      <span className={styles.dot} />
                      <span className={styles.dot} />
                    </div>
                    <span data-testid="ai-thinking-status">{THINKING_STEPS[thinkingIndex]}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          {/* ── Input Box ── */}
          <div className={styles.inputArea}>
            {/* Listening Wave Banner */}
            {(isListening || isTranscribing) && (
              <div className={styles.listeningBanner} data-testid="listening-banner">
                <div className={styles.soundWave}>
                  {[0.8, 1.4, 1.0, 1.25].map((mult, idx) => {
                    const liveScale = isListening && voiceRms > 0
                      ? Math.min(1.6, Math.max(0.35, voiceRms * 12 * mult))
                      : undefined;
                    return (
                      <span
                        key={idx}
                        className={styles.soundBar}
                        style={liveScale ? { transform: `scaleY(${liveScale})` } : undefined}
                      />
                    );
                  })}
                </div>
                <span className={styles.voiceStatusText}>
                  {voiceNotice || 'Đang nghe... (tự gửi khi ngừng nói)'}
                </span>
                {isListening && (
                  <span className={styles.voiceTimer} data-testid="voice-recording-timer">
                    {formatRecordingClock(recordingSeconds)} / {formatRecordingClock(Math.floor(VAD_CONFIG.maxRecordingMs / 1000))}
                  </span>
                )}
                <button
                  type="button"
                  className={`${styles.handsFreeBtn} ${handsFreeMode ? styles.handsFreeBtnActive : ''}`}
                  data-testid="hands-free-toggle-btn"
                  onClick={toggleHandsFreeMode}
                  title={handsFreeMode ? 'Tắt chế độ tự gửi khi ngừng nói' : 'Bật chế độ tự gửi khi ngừng nói'}
                >
                  {handsFreeMode ? 'Tự gửi: Bật' : 'Tự gửi: Tắt'}
                </button>
              </div>
            )}

            {voiceNotice && !isListening && !isTranscribing && (
              <div className={styles.voiceNoticeBanner} data-testid="voice-notice-banner">
                <span>{voiceNotice}</span>
                {voiceConfidence !== null && voiceConfidence < 0.82 && (
                  <span className={styles.confidencePill} data-testid="voice-confidence-pill">
                    Tin cậy {Math.round(voiceConfidence * 100)}%
                  </span>
                )}
              </div>
            )}

            {voiceCorrections.length > 0 && !isListening && (
              <div className={styles.voiceCorrectionsBanner} data-testid="voice-corrections-banner">
                {voiceCorrections.map((c, idx) => (
                  <span key={`${c.from}-${c.to}-${idx}`} className={styles.correctionChip}>
                    Đã chuẩn hóa: &quot;{c.from}&quot; → &quot;{c.to}&quot;
                  </span>
                ))}
              </div>
            )}

            <div className={styles.inputRow}>
              <input
                ref={inputRef}
                type="text"
                className={styles.input}
                placeholder={isListening ? 'Đang nhận diện giọng nói...' : effectivePlaceholder}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />

              {/* Voice-to-Text Button */}
              <button
                type="button"
                className={`${styles.micBtn} ${isListening ? styles.micBtnActive : ''}`}
                onClick={toggleListening}
                title={isListening ? 'Đang lắng nghe... Bấm để dừng và gửi' : 'Nói để ra lệnh bằng giọng nói (Voice Command)'}
                data-testid="voice-mic-button"
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <button
                type="button"
                className={styles.sendBtn}
                disabled={!input.trim()}
                onClick={handleSend}
                title="Gửi câu lệnh"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Action Launcher Button ── */}
      <button
        type="button"
        className={styles.chatButton}
        ref={chatButtonRef}
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Đóng Trợ lý AI' : 'Mở Trợ lý AI FarmShift'}
        data-testid="ai-chatbot-launcher"
      >
        <span className={styles.pulseRing} />
        {isOpen ? <X size={26} /> : <Sparkles size={26} />}
      </button>
    </div>
  );
};
