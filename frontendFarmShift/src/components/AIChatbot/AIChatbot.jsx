// src/components/AIChatbot/AIChatbot.jsx
// Trợ lý Giọng nói & AI FarmShift (Actionable Voice Assistant & System Automation)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles, X, Send, RotateCcw, Plus, History, Trash2,
  Maximize2, Minimize2, Mic, MicOff, ShieldCheck,
  Zap, ExternalLink, Volume2, VolumeX, Check, AlertCircle
} from 'lucide-react';
import { transcribeAudio, sendAssistantMessage } from '../../services/aiAssistantService';
import farmLogo from '../../assets/logo_Farm.png';
import styles from './AIChatbot.module.css';

let nextMsgId = 100;
const generateMessageId = () => `msg_${Date.now()}_${++nextMsgId}`;

let nextSessionSeq = 0;
const SESSIONS_STORAGE_KEY = 'farmshift_ai_sessions_v1';
const ACTIVE_SESSION_STORAGE_KEY = 'farmshift_ai_active_session_id';
const LEGACY_HISTORY_KEY = 'farmshift_ai_chat_history';

const formatCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const formatSessionTitle = (text) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Phiên mới';
  return clean.length > 26 ? `${clean.slice(0, 26)}…` : clean;
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

export const AIChatbot = ({ userRole: propRole }) => {
  const userRole = propRole || (typeof localStorage !== 'undefined' ? localStorage.getItem('farmshift_user_role') : null);
  const activeSuggestions = (userRole && ROLE_SUGGESTIONS[userRole]) ? ROLE_SUGGESTIONS[userRole] : SUGGESTIONS;
  const navigate = useNavigate();
  const location = useLocation();
  const confirmInFlightRef = useRef(new Set());

  // Restore previous open/closed status from sessionStorage across routes & tabs
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return sessionStorage.getItem('farmshift_ai_chat_open') === 'true';
    } catch (_e) {
      return false;
    }
  });

  // Sync isOpen state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('farmshift_ai_chat_open', String(isOpen));
    } catch (_e) {
      // ignore
    }
  }, [isOpen]);

  // Restore multi-session conversations & active session from sessionStorage
  const [sessions, setSessions] = useState(() => {
    try {
      const savedSessions = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
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
      const legacySaved = sessionStorage.getItem(LEGACY_HISTORY_KEY);
      if (legacySaved) {
        const parsedLegacy = JSON.parse(legacySaved);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          return [createSessionObject(1, parsedLegacy)];
        }
      }
    } catch (_e) {
      // ignore
    }
    return [createSessionObject(1, [INITIAL_MESSAGE])];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    try {
      const savedActive = sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (savedActive) return savedActive;
    } catch (_e) {
      // ignore
    }
    return sessions[0]?.id;
  });

  const [isSessionListOpen, setIsSessionListOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');

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
  const endOfMessagesRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const interimTranscriptRef = useRef('');

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

  // Persist multi-session conversations & active session across views in sessionStorage
  useEffect(() => {
    try {
      if (sessions.length > 0) {
        sessionStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      }
      if (effectiveSessionId) {
        sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, effectiveSessionId);
      }
      if (messages.length > 0) {
        sessionStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify(messages));
      }
    } catch (_e) {
      // ignore
    }
  }, [sessions, effectiveSessionId, messages]);

  // Dọn dẹp media streams và Web Speech API khi unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_e) { /* ignore */ }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (_e) { /* ignore */ }
      }
      if (streamRef.current) {
        try { streamRef.current.getTracks().forEach(track => track.stop()); } catch (_e) { /* ignore */ }
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

  // Đóng box chat khi bấm ra ngoài hoặc nhấn phím Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
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
  }, [isOpen]);

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

  // ── Trình Thu âm Thông minh (MediaRecorder + Web Speech API song song) ──
  const startListening = async () => {
    setIsListening(true);
    setVoiceNotice('🎙️ Đang nghe... Bấm lần nữa để gửi');
    audioChunksRef.current = [];
    interimTranscriptRef.current = '';

    // Khởi tạo MediaRecorder
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Dọn dẹp tracks microphone
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        let recognizedText = normalizeWebSpeechText(interimTranscriptRef.current);

        // Thử gửi audioBlob lên Groq Whisper STT
        if (audioBlob.size > 0) {
          setVoiceNotice('⚡ Đang xử lý giọng nói qua Groq Whisper...');
          try {
            const sttResult = await transcribeAudio(audioBlob);
            if (!sttResult.fallback && sttResult.text && sttResult.text.trim()) {
              recognizedText = sttResult.text.trim();
            }
          } catch (sttErr) {
            console.warn('Groq Whisper STT thất bại, dùng văn bản Web Speech API:', sttErr);
          }
        }

        setIsListening(false);
        setVoiceNotice('');

        if (recognizedText && recognizedText.trim()) {
          sendQuery(recognizedText.trim());
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (mediaErr) {
      console.warn('Không thể truy cập Micro qua MediaRecorder:', mediaErr);
    }

    // Chạy song song Web Speech API để hiển thị live preview và làm fallback
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setIsListening(true);
          setVoiceNotice('🎙️ Đang nghe... Bấm lần nữa để gửi');
        };

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
            setTimeout(() => setVoiceNotice(''), 4000);
          }
        };

        recognition.onend = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try { mediaRecorderRef.current.stop(); } catch (_e) { /* ignore */ }
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (e) {
        console.warn('Lỗi khởi tạo Web Speech API:', e);
      }
    } else {
      setIsListening(true);
      setVoiceNotice('🎙️ Đang thu âm... Bấm lần nữa để gửi');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch (_e) { /* ignore */ }
    }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach(track => track.stop()); } catch (_e) { /* ignore */ }
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_e) { /* ignore */ }
    }
    setIsListening(false);
    setVoiceNotice('');
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSend = () => {
    sendQuery(input);
  };

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
                title={isExpanded ? 'Thu về kích thước chuẩn' : 'Phóng to cửa sổ chat'}
                data-testid="expand-chat-btn"
                onClick={() => setIsExpanded(prev => !prev)}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
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
              <div
                key={msg.id}
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

                  {msg.showChips && (
                    <div className={styles.chipsContainer}>
                      <span className={styles.chipsLabel}>Thao tác & câu hỏi gợi ý nhanh:</span>
                      <div className={styles.chipsList}>
                        {activeSuggestions.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={styles.chip}
                            onClick={() => sendQuery(item.query)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
                    <span>Trợ lý AI đang xử lý thao tác trên dữ liệu trại...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          {/* ── Input Box ── */}
          <div className={styles.inputArea}>
            {/* Listening Wave Banner */}
            {isListening && (
              <div className={styles.listeningBanner} data-testid="listening-banner">
                <div className={styles.soundWave}>
                  <span className={styles.soundBar} />
                  <span className={styles.soundBar} />
                  <span className={styles.soundBar} />
                  <span className={styles.soundBar} />
                </div>
                <span>{voiceNotice || 'Đang lắng nghe... Bấm lần nữa để gửi'}</span>
              </div>
            )}

            {voiceNotice && !isListening && (
              <div className={styles.voiceNoticeBanner}>
                {voiceNotice}
              </div>
            )}

            <div className={styles.inputRow}>
              <input
                type="text"
                className={styles.input}
                placeholder={isListening ? 'Đang nhận diện giọng nói...' : 'Hỏi hoặc ra lệnh: ghi cám Nhà A1, cân mẫu, nhập kho...'}
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
