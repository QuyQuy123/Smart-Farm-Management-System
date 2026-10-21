// src/__tests__/voiceAssistant.test.jsx
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AIChatbot } from '../components/AIChatbot/AIChatbot';
import * as aiAssistantService from '../services/aiAssistantService';

// Mock aiAssistantService
vi.mock('../services/aiAssistantService', () => ({
  sendAssistantMessage: vi.fn(),
  transcribeAudio: vi.fn(),
}));

describe('Voice Assistant & Actionable AI Chatbot Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock navigator.mediaDevices.getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      }
    });

    // Mock MediaRecorder
    window.MediaRecorder = class {
      constructor() {
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstop = null;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
      static isTypeSupported() {
        return true;
      }
    };

    // Mock Web Speech API SpeechSynthesis
    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn().mockReturnValue([{ lang: 'vi-VN', name: 'Vietnamese' }])
    };
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.rate = 1;
        this.voice = null;
      }
    };

    sessionStorage.clear();
    localStorage.clear();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={['/purchases']}>
        <AIChatbot />
      </MemoryRouter>
    );
  };

  it('renders launcher button and opens chat window with smart microphone button', async () => {
    renderComponent();

    // Floating launcher button should be visible
    const launcherBtn = screen.getByTestId('ai-chatbot-launcher');
    expect(launcherBtn).toBeInTheDocument();

    // Click to open chat window
    fireEvent.click(launcherBtn);

    expect(screen.getByText('Trợ lý AI FarmShift')).toBeInTheDocument();
    expect(screen.getByTestId('voice-mic-button')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i)).toBeInTheDocument();
  });

  it('toggles microphone button to active recording state and displays listening wave banner', async () => {
    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const micBtn = screen.getByTestId('voice-mic-button');

    // Click mic to start listening
    fireEvent.click(micBtn);

    await waitFor(() => {
      expect(screen.getByTestId('listening-banner')).toBeInTheDocument();
    });

    // Click mic again to stop listening
    fireEvent.click(micBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('listening-banner')).not.toBeInTheDocument();
    });
  });

  it('executes actionable voice command, renders Action Execution Card and dispatches farmshift:ai-action event', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: '✅ Đã ghi nhận cho Nhà A1 ăn 50 kg cám Higro 01 vào lứa nuôi hiện tại.',
      actionType: 'LOG_FEED',
      executed: true,
      navigateTo: '/journal',
      uiCommand: 'REFRESH_DATA',
      actionSummary: {
        title: 'Đã ghi nhật ký cám',
        barnName: 'Nhà A1',
        detail: 'Higro 01 • 50.0 kg',
        timestamp: '2026-10-21T11:20:00'
      }
    });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Ghi cám cho Nhà A1 50 kg cám Higro 01' } });

    const sendBtn = screen.getByTitle('Gửi câu lệnh');
    fireEvent.click(sendBtn);

    // Wait for the action execution card to appear
    await waitFor(() => {
      expect(screen.getByTestId('action-execution-card')).toBeInTheDocument();
    });

    const actionCard = screen.getByTestId('action-execution-card');
    expect(actionCard).toHaveTextContent('Đã thực thi trên hệ thống');
    expect(actionCard).toHaveTextContent('Đã ghi nhật ký cám');
    expect(actionCard).toHaveTextContent('Nhà A1');
    expect(actionCard).toHaveTextContent('50.0 kg');

    // Verify global farmshift:ai-action event was dispatched
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'farmshift:ai-action',
        detail: expect.objectContaining({
          actionType: 'LOG_FEED',
          executed: true
        })
      })
    );
  });

  it('allows clicking quick suggestion chips to send command automatically', async () => {
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: '✅ Đã ghi nhận kết quả cân mẫu cho Nhà A1: 1.5 kg.',
      actionType: 'LOG_WEIGHT',
      executed: true,
      uiCommand: 'REFRESH_DATA',
      actionSummary: {
        title: 'Đã ghi nhận cân mẫu',
        barnName: 'Nhà A1',
        detail: '1.5 kg • Mẫu 50 con',
        timestamp: '2026-10-21T11:25:00'
      }
    });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const chipBtn = screen.getByText('⚖️ Cân mẫu Nhà A1 1.5kg');
    fireEvent.click(chipBtn);

    await waitFor(() => {
      expect(aiAssistantService.sendAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cân mẫu Nhà A1 trung bình 1.5 kg mẫu 50 con'
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Đã ghi nhận cân mẫu')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully without crashing and displays fallback message', async () => {
    aiAssistantService.sendAssistantMessage.mockRejectedValueOnce(new Error('Network error'));

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Kiểm tra chuồng A1' } });

    const sendBtn = screen.getByTitle('Gửi câu lệnh');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/Không thể kết nối tới máy chủ Trợ lý AI/i)).toBeInTheDocument();
    });
  });

  it('handles navigateTo and dispatches farmshift:ai-action on navigation command', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: '🚀 Đang chuyển bạn sang màn hình Hóa đơn nhập hàng.',
      actionType: 'NAVIGATE_AND_PREFILL',
      executed: true,
      navigateTo: '/purchases',
      uiCommand: 'OPEN_CREATE_PURCHASE_MODAL',
      prefillData: { supplierName: 'Dabaco' }
    });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Tạo đơn nhập hàng từ công ty Dabaco' } });

    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'farmshift:ai-action',
          detail: expect.objectContaining({
            uiCommand: 'OPEN_CREATE_PURCHASE_MODAL'
          })
        })
      );
    });
  });

  it('resets conversation when clicking the reset button', async () => {
    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const resetBtn = screen.getByTitle('Bắt đầu hội thoại mới');
    fireEvent.click(resetBtn);

    expect(screen.getByText(/Tôi là Trợ lý AI FarmShift/i)).toBeInTheDocument();
  });

  it('renders markdown tables, bold text, and bullet lists in bot responses', async () => {
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: 'Dưới đây là so sánh dinh dưỡng:\n| Loại cám | Protein | Năng lượng |\n| --- | --- | --- |\n| Higro 01 | 21% | 3050 kcal |\n| CP 511 | 19% | 3100 kcal |\n\n- Khuyến nghị: dùng cám giai đoạn 1',
      actionType: 'GENERAL_QNA',
      executed: false
    });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'So sánh cám Higro 01 và CP 511' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(screen.getByText('Higro 01')).toBeInTheDocument();
      expect(screen.getByText('CP 511')).toBeInTheDocument();
      expect(screen.getByText('Protein')).toBeInTheDocument();
      expect(screen.getByText('Khuyến nghị: dùng cám giai đoạn 1')).toBeInTheDocument();
    });
  });

  it('supports Text-to-Speech (TTS) speaker button on bot responses', async () => {
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: 'Nhiệt độ úm gà con tuần đầu từ 32 đến 34 độ C.',
      actionType: 'GENERAL_QNA',
      executed: false
    });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    // Check header TTS toggle button
    const headerTtsBtn = screen.getByTestId('header-tts-toggle');
    expect(headerTtsBtn).toBeInTheDocument();
    fireEvent.click(headerTtsBtn);

    const input = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Nhiệt độ úm gà con' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(screen.getByText(/Nhiệt độ úm gà con tuần đầu/i)).toBeInTheDocument();
    });

    // Check message speaker button
    const speakerBtns = screen.getAllByTestId('message-speaker-btn');
    expect(speakerBtns.length).toBeGreaterThan(0);
    fireEvent.click(speakerBtns[speakerBtns.length - 1]);

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });

  it('restores previous chat history from sessionStorage upon re-rendering', async () => {
    sessionStorage.setItem('farmshift_ai_chat_history', JSON.stringify([
      { id: 'msg_test_1', type: 'user', text: 'Xin chào trợ lý', time: '10:00' },
      { id: 'msg_test_2', type: 'bot', text: 'Chào bạn! Tôi có thể giúp gì cho trang trại?', time: '10:01' }
    ]));

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    expect(screen.getByText('Xin chào trợ lý')).toBeInTheDocument();
    expect(screen.getByText('Chào bạn! Tôi có thể giúp gì cho trang trại?')).toBeInTheDocument();
  });

  it('handles COMPLETE_DAILY_TASKS action and renders deep link to /today-tasks', async () => {
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: '✅ Đã xác nhận hoàn thành thành công 6 công việc hôm nay cho Nhà A1.',
      actionType: 'COMPLETE_DAILY_TASKS',
      executed: true,
      navigateTo: '/today-tasks',
      uiCommand: 'REFRESH_DATA',
      actionSummary: {
        title: 'Đã hoàn thành việc hôm nay',
        barnName: 'Nhà A1',
        detail: 'Hoàn thành 6 việc • cữ cám, thuốc thú y',
        timestamp: '2026-10-21T11:30:00'
      }
    });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const chip = screen.getByText('✅ Xong việc hôm nay');
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByTestId('action-execution-card')).toBeInTheDocument();
      expect(screen.getByText('Đã hoàn thành việc hôm nay')).toBeInTheDocument();
      expect(screen.getByText('Xem tại màn hình đích')).toBeInTheDocument();
    });
  });
});
