// src/components/AIChatbot/AIChatbot.jsx
// Trợ lý Trí tuệ Nhân tạo FarmShift (Chẩn đoán Thú y & Tra cứu Vận hành)
import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, X, Send, Bot, RotateCcw,
  Wheat, Stethoscope, Activity, Pill, Thermometer, ChevronDown,
  Mic, MicOff, ShieldAlert
} from 'lucide-react';
import { getSystemMessage } from '../../constants/systemMessages';
import styles from './AIChatbot.module.css';

const formatCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const INITIAL_MESSAGE = {
  id: 1,
  type: 'bot',
  text: 'Xin chào! Tôi là Trợ lý AI FarmShift. Tôi có thể hỗ trợ bạn tra cứu tồn kho thức ăn, tình trạng sức khỏe đàn gà, chẩn đoán bệnh thú y và tự động hóa chuồng trại.',
  time: formatCurrentTime(),
  showChips: true
};

const SUGGESTIONS = [
  { label: '🌾 Tồn kho cám CP', query: 'Kho cám hiện tại còn bao nhiêu bao?' },
  { label: '🩺 Gà thở khò khè', query: 'Gà có triệu chứng thở khò khè, ngáp gió điều trị thế nào?' },
  { label: '📊 Tình trạng Chuồng 2', query: 'Chuồng 2 nuôi được bao nhiêu ngày rồi?' },
  { label: '💊 Gà đi phân sáp', query: 'Gà đi phân sáp lẫn máu là bệnh gì?' },
  { label: '🌡️ Cảnh báo IoT', query: 'Nhiệt độ các chuồng trại hiện tại ra sao?' },
];

const KNOWLEDGE_BASE = [
  {
    keywords: ['cám', 'kho', 'bao nhiêu', 'thức ăn'],
    response: '📦 Theo dõi kho tức thời:\n- Cám CP 511 (Giai đoạn 2): Còn 250 bao\n- Cám CP 512 (Giai đoạn 3): Còn 180 bao\n- Cám Higro 01: Còn 15 bao (Chạm ngưỡng cảnh báo tối thiểu!)\n👉 Đề xuất bạn tạo phiếu nhập thêm 50 bao Higro 01 vào hôm nay.',
  },
  {
    keywords: ['chuồng 2', 'nuôi', 'ngày', 'gà-2024-09'],
    response: '🐥 Lứa gà GÀ-2024-09 tại Chuồng J2:\n- Thời gian nuôi: 28 ngày tuổi\n- Số lượng hiện tại: 2,485 con\n- Trọng lượng ước tính: 1.25 kg/con\n- Tỷ lệ hao hụt lũy kế: 0.6% (Đạt chuẩn an toàn sinh học).',
  },
  {
    keywords: ['khò khè', 'thở', 'ngáp', 'crd', 'hen'],
    response: '🩺 Chẩn đoán thú y sơ bộ:\nTriệu chứng thở khò khè, vẩy mỏ, ngáp gió là dấu hiệu bệnh Hen gà (CRD) ghép E.coli hoặc Viêm phế quản truyền nhiễm (IB).\n💊 Phác đồ khuyến nghị:\n1. Phun sát trùng chuồng bằng dung dịch Iod (1:200)\n2. Dùng kháng sinh Doxycycline 50% kết hợp Tylosin (Kho thuốc hiện đang có sẵn 50 lọ)\n3. Tăng cường thông gió và giữ chuồng ấm về đêm.',
  },
  {
    keywords: ['phân sáp', 'cầu trùng', 'máu', 'tiêu chảy'],
    response: '⚠️ Cảnh báo bệnh Cầu trùng (Coccidiosis):\nPhân sáp vàng hoặc có lẫn vệt máu tươi là bệnh cầu trùng manh tràng.\n💊 Xử lý khẩn cấp:\n1. Cho uống Toltrazuril (Baycox) 2.5% liều 1ml/lít nước liên tục 2 ngày\n2. Bổ sung Vitamin K chống xuất huyết và men vi sinh tiêu hóa\n3. Rải thêm trấu khô độn chuồng để giảm độ ẩm.',
  },
  {
    keywords: ['nhiệt độ', 'iot', 'cảm biến', 'chuông'],
    response: '📡 Dữ liệu cảm biến IoT thời gian thực:\n- Nhà A1: 29.2°C | Độ ẩm: 74% (Quạt hút 3 đang chạy tăng tốc)\n- Nhà J1: 27.5°C | Độ ẩm: 68% (Ổn định)\n- Nhà Mía 1: 27.2°C | Độ ẩm: 67% (Lý tưởng)\nHệ thống cảm biến hoạt động bình thường, không có lỗi kết nối.',
  },
  {
    keywords: ['vacxin', 'tiêm', 'lịch', 'phòng bệnh'],
    response: '💉 Lịch phòng vacxin tuần này:\n- Đàn J1 (32 ngày): Uống vacxin Newcastle (ND-IB) nhắc lại lần 2.\n- Đàn A2 (14 ngày): Nhỏ mắt mũi Gumboro chủng trung bình.\nBạn có thể vào mục Ghi nhật ký để tích xác nhận đã hoàn thành.',
  }
];

export const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const endOfMessagesRef = useRef(null);
  const recognitionRef = useRef(null);

  // Dọn dẹp Web Speech API khi unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setIsListening(false);
      setVoiceNotice('');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói Web Speech API (Khuyến nghị dùng Google Chrome hoặc Microsoft Edge). Bạn có thể gõ câu hỏi bằng bàn phím nhé!');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceNotice('🎙️ Đang lắng nghe... Hãy nói câu hỏi bằng tiếng Việt');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setVoiceNotice('⚠️ Vui lòng cấp quyền Micro trên trình duyệt để sử dụng.');
          setTimeout(() => setVoiceNotice(''), 4000);
        } else if (event.error === 'no-speech') {
          setVoiceNotice('⚠️ Chưa nghe thấy giọng nói, bạn hãy thử lại nhé.');
          setTimeout(() => setVoiceNotice(''), 3000);
        } else {
          setVoiceNotice('');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setVoiceNotice('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Lỗi khởi tạo Voice to Text:', err);
      setIsListening(false);
      setVoiceNotice('');
    }
  };

  useEffect(() => {
    if (isOpen && endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const sendQuery = (queryText) => {
    if (!queryText.trim()) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { }
      setIsListening(false);
      setVoiceNotice('');
    }

    const userMsg = {
      id: Date.now(),
      type: 'user',
      text: queryText.trim(),
      time: formatCurrentTime()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let botResponse = 'Cảm ơn câu hỏi của bạn. Trợ lý AI FarmShift đang kết nối dữ liệu chuồng trại. Bạn có thể cung cấp thêm tên chuồng hoặc triệu chứng cụ thể hơn để tôi hỗ trợ chính xác nhất.';
      const lowercaseInput = queryText.toLowerCase();

      for (const entry of KNOWLEDGE_BASE) {
        const matches = entry.keywords.some(k => lowercaseInput.includes(k));
        if (matches) {
          botResponse = entry.response;
          break;
        }
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'bot',
          text: botResponse,
          time: formatCurrentTime()
        }
      ]);
      setIsTyping(false);
    }, 1100);
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
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { }
      setIsListening(false);
      setVoiceNotice('');
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
                  <span>· Thú y & Quản lý trại</span>
                </div>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                className={styles.iconBtn}
                title="Bắt đầu hội thoại mới"
                onClick={handleReset}
              >
                <RotateCcw size={15} />
              </button>
              <button
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
                  <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                  <div className={styles.messageTime}>{msg.time}</div>

                  {msg.showChips && (
                    <div className={styles.chipsContainer}>
                      <span className={styles.chipsLabel}>Câu hỏi gợi ý nhanh:</span>
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
                    <span>Trợ lý đang tra cứu dữ liệu chuồng trại...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          {/* ── Input Box ── */}
          <div className={styles.inputArea}>
            {/* Listening Banner */}
            {isListening && (
              <div className={styles.listeningBanner}>
                <div className={styles.soundWave}>
                  <span className={styles.soundBar} />
                  <span className={styles.soundBar} />
                  <span className={styles.soundBar} />
                  <span className={styles.soundBar} />
                </div>
                <span>{voiceNotice || 'Đang lắng nghe... Nói câu hỏi của bạn'}</span>
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
                placeholder={isListening ? 'Đang nhận diện giọng nói...' : 'Hỏi về bệnh gà, tồn kho cám, nhiệt độ chuồng...'}
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
                title={isListening ? 'Đang lắng nghe... Bấm để dừng' : 'Nói để nhập bằng giọng nói (Voice to Text)'}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <button
                type="button"
                className={styles.sendBtn}
                disabled={!input.trim()}
                onClick={handleSend}
                title="Gửi câu hỏi"
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
              Nhấn <strong>Enter</strong> hoặc bấm Micro 🎙️ để nói · AI hỗ trợ chẩn đoán thú y
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
      >
        <span className={styles.pulseRing} />
        {isOpen ? <X size={26} /> : <Sparkles size={26} />}
      </button>
    </div>
  );
};
