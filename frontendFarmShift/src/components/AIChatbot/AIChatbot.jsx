// src/components/AIChatbot/AIChatbot.jsx
// AI Chatbot Thú y & Tra cứu nội bộ (Feature 12)
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import styles from './AIChatbot.module.css';

const INITIAL_MESSAGE = {
  id: 1,
  type: 'bot',
  text: 'Chào bạn, tôi là Trợ lý AI FarmShift. Bạn cần tra cứu thông tin kho, báo cáo, hay cần tư vấn bệnh thú y gì không?',
};

// Simulation mock responses
const KNOWLEDGE_BASE = [
  {
    keywords: ['cám', 'kho', 'bao nhiêu'],
    response: 'Hiện tại trong kho tổng còn: 250 bao Cám CP 511 (Giai đoạn 2) và 180 bao Cám CP 512 (Giai đoạn 3). Bạn có muốn tôi lập phiếu xuất kho không?',
  },
  {
    keywords: ['chuồng 2', 'nuôi', 'ngày'],
    response: 'Lứa gà GÀ-2024-09 ở Chuồng 2 hiện tại đã nuôi được 28 ngày tuổi. Trọng lượng trung bình dự kiến là 1.2kg/con.',
  },
  {
    keywords: ['khò khè', 'thở', 'ngáp'],
    response: 'Triệu chứng gà thở khò khè, ngáp gió có thể là biểu hiện của bệnh CRD (Hen gà) hoặc IB (Viêm phế quản truyền nhiễm). Đề xuất kiểm tra lại nhiệt độ chuồng và sử dụng kháng sinh Doxycycline kết hợp Tylosin (hiện đang có sẵn 50 lọ trong kho).',
  },
  {
    keywords: ['phân sáp', 'cầu trùng', 'máu'],
    response: 'Phân sáp vàng hoặc có lẫn máu thường là biểu hiện của bệnh Cầu trùng ghép viêm ruột hoại tử. Bạn nên dùng ngay thuốc Toltrazuril hoặc Amprolium trong 3-5 ngày liên tục.',
  },
];

export const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), type: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // AI simulation logic
    setTimeout(() => {
      let botResponse = 'Xin lỗi, tôi chưa hiểu rõ ý của bạn. Bạn có thể nói rõ hơn về triệu chứng của gà hoặc câu hỏi tra cứu không?';
      const lowercaseInput = userMsg.text.toLowerCase();

      // Find matching knowledge base entry
      for (const entry of KNOWLEDGE_BASE) {
        // If user input contains at least 2 keywords from an entry
        const matchCount = entry.keywords.filter(k => lowercaseInput.includes(k)).length;
        if (matchCount >= 1) { // lowered to 1 for easier matching in demo
          botResponse = entry.response;
          break;
        }
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, type: 'bot', text: botResponse }]);
      setIsTyping(false);
    }, 1500); // simulate 1.5s thinking time
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className={styles.chatbotWidget}>
      {isOpen && (
        <div className={styles.chatWindow}>
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <Bot size={20} />
              AI Assistant
            </div>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className={styles.messages}>
            {messages.map(msg => (
              <div key={msg.id} className={`${styles.message} ${msg.type === 'user' ? styles.messageUser : styles.messageBot}`}>
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div className={`${styles.message} ${styles.messageBot}`}>
                <div className={styles.loadingDots}>
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                </div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          <div className={styles.inputArea}>
            <input
              type="text"
              className={styles.input}
              placeholder="Nhập câu hỏi (VD: Gà thở khò khè)..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button 
              className={styles.sendBtn} 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button className={styles.chatButton} onClick={() => setIsOpen(true)}>
          <MessageSquare size={24} />
        </button>
      )}
    </div>
  );
};
