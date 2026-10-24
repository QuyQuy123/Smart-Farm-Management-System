// src/components/AIChatbot/AIChatbot.jsx
// Trợ lý Giọng nói & AI FarmShift (Actionable Voice Assistant & System Automation)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles, X, Send, Bot, RotateCcw,
  ChevronDown, Mic, MicOff, ShieldAlert,
  Zap, ExternalLink, Volume2, VolumeX, Check, AlertCircle
} from 'lucide-react';
import { getSystemMessage } from '../../constants/systemMessages';
import { transcribeAudio, sendAssistantMessage } from '../../services/aiAssistantService';
import styles from './AIChatbot.module.css';

let nextMsgId = 100;
const generateMessageId = () => `msg_${Date.now()}_${++nextMsgId}`;

const formatCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const INITIAL_MESSAGE = {
  id: 1,
  type: 'bot',
  text: 'Xin chào! Tôi là Trợ lý AI FarmShift. Tôi có thể thực thi trực tiếp các thao tác ghi cám, cân mẫu, báo cáo hao hụt, nhập kho hoặc giải đáp thú y & điều hành trang trại.',
  time: formatCurrentTime(),
  showChips: true
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

export const AIChatbot = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);

  // Restore previous session messages from sessionStorage
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('farmshift_ai_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_e) {
      // ignore
    }
    return [INITIAL_MESSAGE];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const [lastActionContext, setLastActionContext] = useState(null);

  // TTS Voice Synthesis States
  const [isAutoSpeakEnabled, setIsAutoSpeakEnabled] = useState(() => {
    try {
      return localStorage.getItem('farmshift_ai_auto_speak') === 'true';
    } catch (_e) {
      return false;
    }
  });
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  const endOfMessagesRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const interimTranscriptRef = useRef('');

  // Persist messages across views in sessionStorage
  useEffect(() => {
    try {
      if (messages.length > 0) {
        sessionStorage.setItem('farmshift_ai_chat_history', JSON.stringify(messages));
      }
    } catch (_e) {
      // ignore
    }
  }, [messages]);

  // Dọn dẹp media streams và Web Speech API khi unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_e) { /* ignore */ }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (_e) { /* ignore */ }
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
        setSpeakingMsgId(null);
      } catch (_e) { /* ignore */ }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // ── Web Speech API Text-to-Speech (TTS) Voice Synthesis ──
  const toggleAutoSpeak = () => {
    setIsAutoSpeakEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('farmshift_ai_auto_speak', String(next));
      } catch (_e) { /* ignore */ }
      if (!next && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setSpeakingMsgId(null);
      }
      return next;
    });
  };

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
        return { route: '/journal', label: 'Xem Nhật ký cho ăn' };
      case 'LOG_WEIGHT':
        return { route: '/barns', label: 'Xem Cân mẫu chuồng' };
      case 'LOG_MORTALITY':
        return { route: '/barns', label: 'Xem Đàn gà & Chuồng' };
      case 'LOG_EXPENSE':
        return { route: '/cashbook', label: 'Xem Sổ quỹ chi phí' };
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

    const userMsg = {
      id: generateMessageId(),
      type: 'user',
      text: textToSend,
      time: formatCurrentTime()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Build conversation history of past turns for multi-turn awareness
      const historyPayload = messages
        .filter(m => m.id !== 1 && m.text)
        .slice(-8)
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      const response = await sendAssistantMessage({
        message: textToSend,
        currentRoute: location.pathname,
        history: historyPayload,
        lastActionContext: lastActionContext || undefined,
        autoExecute: false
      });

      if (response.actionContext) {
        setLastActionContext(response.actionContext);
      } else if (response.actionSummary) {
        setLastActionContext(response.actionSummary);
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

      setMessages(prev => [...prev, botMsg]);

      // Auto-read response if enabled
      if (isAutoSpeakEnabled && response.reply) {
        speakText(response.reply, botMsg.id);
      }

      // Phát sự kiện toàn cục để các màn hình lắng nghe tự reload dữ liệu
      if (response.executed || response.uiCommand === 'REFRESH_DATA' || response.uiCommand === 'OPEN_CREATE_PURCHASE_MODAL') {
        window.dispatchEvent(new CustomEvent('farmshift:ai-action', { detail: response }));
      }

      // Điều hướng màn hình nếu AI yêu cầu
      if (response.navigateTo) {
        navigate(response.navigateTo);
      }
    } catch (error) {
      console.warn('Lỗi kết nối Trợ lý AI, sử dụng câu trả lời dự phòng:', error);
      setMessages(prev => [
        ...prev,
        {
          id: generateMessageId(),
          type: 'bot',
          text: '⚠️ Không thể kết nối tới máy chủ Trợ lý AI vào lúc này. Vui lòng kiểm tra lại kết nối mạng.',
          time: formatCurrentTime()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // ── Xử lý xác nhận thực thi hành động đã yêu cầu (Human-in-the-loop Confirm) ──
  const handleConfirmAction = async (msgId, pendingAction) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, confirmationStatus: 'confirming' } : m));
    try {
      const payload = pendingAction?.payload || pendingAction;
      const response = await sendAssistantMessage({
        message: 'Xác nhận thực hiện',
        confirmAction: true,
        pendingActionPayload: payload,
        currentRoute: location.pathname,
        lastActionContext: lastActionContext || undefined
      });

      if (response.actionContext) {
        setLastActionContext(response.actionContext);
      } else if (response.actionSummary) {
        setLastActionContext(response.actionSummary);
      }

      setMessages(prev => prev.map(m => {
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
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, confirmationStatus: 'pending' } : m));
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

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        let recognizedText = interimTranscriptRef.current;

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
            interimTranscriptRef.current = transcript;
            setInput(transcript);
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

  const handleReset = () => {
    setMessages([INITIAL_MESSAGE]);
    try {
      sessionStorage.removeItem('farmshift_ai_chat_history');
    } catch (_e) { /* ignore */ }
    if (isListening) {
      stopListening();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
    }
  };

  return (
    <div className={styles.chatbotWidget}>
      {isOpen && (
        <div className={styles.chatWindow}>
          {/* ── Header ── */}
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.avatarWrapper}>
                <Bot size={22} />
                <span className={styles.statusDot} />
              </div>
              <div className={styles.headerText}>
                <div className={styles.headerTitle}>
                  <span>Trợ lý AI FarmShift</span>
                  <Sparkles size={14} color="#f59e0b" />
                </div>
                <div className={styles.headerSubtitle}>
                  <span className={styles.onlineBadge}>● Đang trực tuyến</span>
                  <span>· Thú y & Điều hành trại</span>
                </div>
              </div>
            </div>

            <div className={styles.headerActions}>
              {'speechSynthesis' in window && (
                <button
                  type="button"
                  className={`${styles.ttsHeaderBtn} ${isAutoSpeakEnabled ? styles.ttsHeaderBtnActive : ''}`}
                  title={isAutoSpeakEnabled ? 'Tắt tự động đọc giọng nói' : 'Bật tự động đọc giọng nói (Auto-TTS)'}
                  onClick={toggleAutoSpeak}
                  data-testid="header-tts-toggle"
                >
                  {isAutoSpeakEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              )}
              <button
                type="button"
                className={styles.iconBtn}
                title="Bắt đầu hội thoại mới"
                onClick={handleReset}
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                title="Thu nhỏ cửa sổ"
                onClick={() => setIsOpen(false)}
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* ── Message Stream ── */}
          <div className={styles.messages}>
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`${styles.messageRow} ${msg.type === 'user' ? styles.messageRowUser : styles.messageRowBot}`}
              >
                {msg.type === 'bot' && (
                  <div className={styles.botIconSmall}>
                    <Bot size={15} />
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
                        {SUGGESTIONS.map((item, idx) => (
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
                  <Bot size={15} />
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

            {/* Advisory Banner (MSG38) */}
            <div style={{
              fontSize: '11px',
              color: '#92400e',
              backgroundColor: '#fffbeb',
              borderTop: '1px solid #fef3c7',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              lineHeight: 1.4
            }}>
              <ShieldAlert size={13} color="#d97706" style={{ flexShrink: 0 }} />
              <span>{getSystemMessage('MSG38')}</span>
            </div>

            <div className={styles.inputHint}>
              Nhấn <strong>Enter</strong> hoặc bấm Micro 🎙️ để ra lệnh bằng giọng nói
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Action Launcher Button ── */}
      <button
        type="button"
        className={styles.chatButton}
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
