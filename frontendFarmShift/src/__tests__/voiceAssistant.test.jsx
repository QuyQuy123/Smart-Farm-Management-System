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

  it('displays default welcome message when opened', async () => {
    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

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

  it('prompts confirmation card before executing mutating action, and executes upon clicking accept', async () => {
    aiAssistantService.sendAssistantMessage
      .mockResolvedValueOnce({
        reply: 'Bạn có muốn ghi nhận cho Nhà A1 ăn 50 kg cám Higro 01 không?',
        actionType: 'LOG_FEED',
        executed: false,
        requiresConfirmation: true,
        pendingAction: {
          actionType: 'LOG_FEED',
          title: 'Ghi nhật ký cám: Nhà A1',
          description: 'Cám Higro 01 • 50 kg',
          details: { 'Chuồng nuôi': 'Nhà A1', 'Khối lượng': '50 kg' },
          payload: { actionType: 'LOG_FEED', barnId: 1, cycleId: 1, feedName: 'Higro 01', totalKg: 50 }
        }
      })
      .mockResolvedValueOnce({
        reply: '✅ Đã ghi nhận cho Nhà A1 ăn 50 kg cám Higro 01.',
        actionType: 'LOG_FEED',
        executed: true,
        uiCommand: 'REFRESH_DATA',
        actionSummary: {
          title: 'Đã ghi nhật ký cám',
          barnName: 'Nhà A1',
          detail: 'Higro 01 • 50 kg',
          timestamp: '2026-10-21T11:40:00'
        }
      });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Cho Nhà A1 ăn 50kg cám' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    // Confirmation card should appear with accept & reject buttons
    await waitFor(() => {
      expect(screen.getByTestId('confirmation-card')).toBeInTheDocument();
      expect(screen.getByText('Ghi nhật ký cám: Nhà A1')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-accept-btn')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-reject-btn')).toBeInTheDocument();
    });

    // Click Accept button
    fireEvent.click(screen.getByTestId('confirm-accept-btn'));

    await waitFor(() => {
      expect(aiAssistantService.sendAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmAction: true,
          pendingActionPayload: expect.objectContaining({
            actionType: 'LOG_FEED',
            feedName: 'Higro 01'
          })
        })
      );
      expect(screen.getByTestId('action-execution-card')).toBeInTheDocument();
      expect(screen.getByText('Đã thực thi trên hệ thống')).toBeInTheDocument();
    });
  });

  it('allows rejecting confirmation card and restoring with retry button if accidentally cancelled', async () => {
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: 'Bạn có muốn tạo chuồng nuôi mới Nhà B2 không?',
      actionType: 'CREATE_BARN',
      executed: false,
      requiresConfirmation: true,
      pendingAction: {
        actionType: 'CREATE_BARN',
        title: 'Tạo chuồng nuôi mới: Nhà B2',
        description: 'Chuồng Nhà B2 • 600 m²',
        details: { 'Tên chuồng': 'Nhà B2', 'Diện tích': '600 m²' },
        payload: { actionType: 'CREATE_BARN', name: 'Nhà B2', floorArea: 600 }
      }
    });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Tạo chuồng Nhà B2 diện tích 600m2' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-card')).toBeInTheDocument();
    });

    // Click reject (e.g. accidentally clicked reject)
    fireEvent.click(screen.getByTestId('confirm-reject-btn'));

    // Should display cancelled notice and retry button
    expect(screen.getByText('✕ Bạn đã hủy thao tác này.')).toBeInTheDocument();
    const retryBtn = screen.getByTestId('confirm-retry-btn');
    expect(retryBtn).toBeInTheDocument();

    // Click retry button to restore confirmation card
    fireEvent.click(retryBtn);

    // Confirmation buttons are restored!
    expect(screen.getByTestId('confirm-accept-btn')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-reject-btn')).toBeInTheDocument();
  });

  it('closes chat window when clicking outside the chat window', async () => {
    renderComponent();
    const launcherBtn = screen.getByTestId('ai-chatbot-launcher');
    fireEvent.click(launcherBtn);

    expect(screen.getByText('Trợ lý AI FarmShift')).toBeInTheDocument();

    // Click outside on document body
    fireEvent.mouseDown(document.body);

    // Chat window should be closed
    expect(screen.queryByText('Trợ lý AI FarmShift')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('farmshift_ai_chat_open')).toBe('false');
  });

  it('closes chat window when pressing Escape key', async () => {
    renderComponent();
    const launcherBtn = screen.getByTestId('ai-chatbot-launcher');
    fireEvent.click(launcherBtn);

    expect(screen.getByText('Trợ lý AI FarmShift')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Trợ lý AI FarmShift')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('farmshift_ai_chat_open')).toBe('false');
  });

  it('preserves open state across remounts via sessionStorage when opening another tab', async () => {
    sessionStorage.setItem('farmshift_ai_chat_open', 'true');
    const { unmount } = renderComponent();

    // Chat window should already be open on initial mount
    expect(screen.getByText('Trợ lý AI FarmShift')).toBeInTheDocument();

    // Simulate route navigation / component remounting
    unmount();
    renderComponent();

    // Chat window remains open after remounting
    expect(screen.getByText('Trợ lý AI FarmShift')).toBeInTheDocument();
  });

  it('navigates accurately to /journal when receiving navigation command "Mở ghi nhật ký"', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: '🚀 Đang chuyển bạn sang màn hình Ghi nhật ký chăn nuôi.',
      actionType: 'NAVIGATE_AND_PREFILL',
      executed: true,
      navigateTo: '/journal'
    });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Mở ghi nhật ký' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(aiAssistantService.sendAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Mở ghi nhật ký'
        })
      );
    });

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'farmshift:ai-action',
          detail: expect.objectContaining({
            navigateTo: '/journal'
          })
        })
      );
    });
  });

  it('displays old -> new diff in Pending Action Card for mutation updates', async () => {
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: 'Bạn có muốn cập nhật thông tin cho Nhà A1 không?',
      actionType: 'UPDATE_BARN_INFO',
      executed: false,
      requiresConfirmation: true,
      pendingAction: {
        actionType: 'UPDATE_BARN_INFO',
        title: 'Cập nhật thông tin: Nhà A1',
        details: {
          'Chuồng nuôi': 'Nhà A1',
          'Sức chứa': '5.000 con → 6.000 con'
        },
        payload: {
          actionType: 'UPDATE_BARN_INFO',
          barnId: 1,
          capacity: 6000
        }
      }
    });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Sửa sức chứa Nhà A1 thành 6000 con' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-card')).toBeInTheDocument();
    });

    const card = screen.getByTestId('confirmation-card');
    expect(card).toHaveTextContent('Cập nhật thông tin: Nhà A1');
    expect(card).toHaveTextContent('5.000 con → 6.000 con');
  });

  it('dispatches farmshift:ai-action when AI returns quick modal uiCommand (OPEN_OCR_MODAL)', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: '🚀 Đang chuyển tới trang Hóa đơn nhập hàng và mở công cụ Bóc tách hóa đơn thông minh (AI OCR).',
      actionType: 'NAVIGATE_AND_PREFILL',
      executed: true,
      navigateTo: '/purchases',
      uiCommand: 'OPEN_OCR_MODAL'
    });

    renderComponent();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Quét hóa đơn OCR' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'farmshift:ai-action',
          detail: expect.objectContaining({
            navigateTo: '/purchases',
            uiCommand: 'OPEN_OCR_MODAL'
          })
        })
      );
    });
  });
});
