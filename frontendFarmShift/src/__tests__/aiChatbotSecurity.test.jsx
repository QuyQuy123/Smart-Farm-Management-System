// src/__tests__/aiChatbotSecurity.test.jsx
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { act } from '@testing-library/react';
import { AIChatbot } from '../components/AIChatbot/AIChatbot';
import * as aiAssistantService from '../services/aiAssistantService';
import {
  clearAiChatStorage,
  AI_SESSIONS_STORAGE_KEY,
  AI_ACTIVE_SESSION_STORAGE_KEY,
  AI_LEGACY_HISTORY_KEY,
  AI_CHAT_OPEN_KEY,
  AI_CHAT_OWNER_KEY,
} from '../utils/aiChatStorage';

vi.mock('../services/aiAssistantService', () => ({
  sendAssistantMessage: vi.fn(),
  transcribeAudio: vi.fn(),
}));

describe('AI Chatbot Cryptographic Signing & Security Guard UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  const renderChatbot = () => render(
    <MemoryRouter initialEntries={['/journal']}>
      <AIChatbot userRole="ROLE_FARM_WORKER" />
    </MemoryRouter>
  );

  it('renders signed-action-badge and forwards actionId + actionToken on confirm', async () => {
    const dispatched = [];
    const onAiAction = (e) => dispatched.push(e.detail);
    window.addEventListener('farmshift:ai-action', onAiAction);

    aiAssistantService.sendAssistantMessage
      .mockResolvedValueOnce({
        reply: 'Bạn có muốn ghi nhận cho Nhà A1 ăn 50 kg cám không?',
        actionType: 'LOG_FEED',
        executed: false,
        requiresConfirmation: true,
        pendingAction: {
          actionType: 'LOG_FEED',
          actionId: 'act-uuid-1234',
          actionToken: 'hmac-sig-abcdef',
          expiresAt: Date.now() + 300000,
          title: 'Ghi nhận cám: Nhà A1',
          description: 'Ghi nhận 50 kg cám Higro 01',
          details: {
            'Chuồng nuôi': 'Nhà A1',
            'Kho xuất tự động': 'Kho cám Khu A'
          },
          payload: {
            actionType: 'LOG_FEED',
            barnId: 1,
            cycleId: 10,
            totalKg: 50,
            actionId: 'act-uuid-1234',
            actionToken: 'hmac-sig-abcdef'
          }
        }
      })
      .mockResolvedValueOnce({
        reply: '✅ Đã ghi nhận cho Nhà A1 ăn 50 kg cám Higro 01.',
        actionType: 'LOG_FEED',
        executed: true,
        uiCommand: 'REFRESH_DATA',
        actionSummary: { title: 'Đã ghi nhật ký cám', barnName: 'Nhà A1' }
      });

    renderChatbot();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Cho nhà A1 ăn 50kg cám' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    const badge = await screen.findByTestId('signed-action-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/Đã ký xác thực/i);

    const confirmBtn = screen.getByTestId('confirm-accept-btn');
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn); // Rapid double-click must not re-fire

    await waitFor(() => {
      expect(screen.getByText(/Đã ghi nhận cho Nhà A1 ăn 50 kg cám/i)).toBeInTheDocument();
    });

    expect(aiAssistantService.sendAssistantMessage).toHaveBeenCalledTimes(2);
    expect(aiAssistantService.sendAssistantMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      confirmAction: true,
      actionId: 'act-uuid-1234',
      actionToken: 'hmac-sig-abcdef',
      pendingActionPayload: expect.objectContaining({
        actionType: 'LOG_FEED',
        barnId: 1,
        totalKg: 50
      })
    }));
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].actionType).toBe('LOG_FEED');
    window.removeEventListener('farmshift:ai-action', onAiAction);
  });

  it('displays 403 tampered/expired signature error reply cleanly and hides badge when unsigned', async () => {
    const authError = new Error('Request failed with status code 403');
    authError.response = {
      status: 403,
      data: {
        actionType: 'SECURITY_TOKEN_INVALID',
        reply: '⛔ Chữ ký xác thực thao tác không hợp lệ hoặc tham số đã bị sửa đổi.'
      }
    };

    aiAssistantService.sendAssistantMessage
      .mockResolvedValueOnce({
        reply: 'Bạn có muốn ghi nhận cân mẫu?',
        actionType: 'LOG_WEIGHT',
        executed: false,
        requiresConfirmation: true,
        pendingAction: {
          actionType: 'LOG_WEIGHT',
          title: 'Ghi nhận cân mẫu',
          details: { 'Chuồng nuôi': 'Nhà A1' },
          payload: { actionType: 'LOG_WEIGHT', barnId: 1, avgWeight: 1.5 }
        }
      })
      .mockRejectedValueOnce(authError);

    renderChatbot();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Cân mẫu nhà A1 1.5kg' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    const confirmBtn = await screen.findByTestId('confirm-accept-btn');
    expect(screen.queryByTestId('signed-action-badge')).not.toBeInTheDocument();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Chữ ký xác thực thao tác không hợp lệ hoặc tham số đã bị sửa đổi/i)).toBeInTheDocument();
    });
  });

  it('supports multiple chat sections, remembers barn context per section, and creates a new section on plus', async () => {
    aiAssistantService.sendAssistantMessage
      .mockResolvedValueOnce({
        reply: '🏡 Tình trạng Nhà A1: Đang nuôi 2.000 con.',
        actionType: 'QUERY_FARM_STATUS',
        executed: false,
        actionContext: {
          barnId: 1,
          barnName: 'Nhà A1',
          lastIntent: 'QUERY_FARM_STATUS'
        }
      })
      .mockResolvedValueOnce({
        reply: '👍 Tôi đã ghi nhận thao tác trong phiên mới.',
        actionType: 'CONVERSATIONAL_ACK',
        executed: false,
        actionContext: {
          barnId: 2,
          barnName: 'Nhà B1',
          lastIntent: 'QUERY_FARM_STATUS'
        }
      });

    renderChatbot();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Tình trạng Nhà A1 thế nào?' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(screen.getByText(/Đang nuôi 2\.000 con/i)).toBeInTheDocument();
    });

    const firstSessionId = aiAssistantService.sendAssistantMessage.mock.calls[0][0].sessionId;
    expect(firstSessionId).toBeTruthy();

    // Clicking '+' creates a brand-new section while preserving the first section in History
    fireEvent.click(screen.getByTestId('new-session-btn'));

    expect(screen.getByTestId('session-count-badge').textContent).toBe('2');

    const newInput = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(newInput, { target: { value: 'Tình trạng Nhà B1 thế nào?' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(screen.getByText(/Tôi đã ghi nhận thao tác trong phiên mới/i)).toBeInTheDocument();
    });

    const secondSessionId = aiAssistantService.sendAssistantMessage.mock.calls[1][0].sessionId;
    expect(secondSessionId).toBeTruthy();
    expect(secondSessionId).not.toBe(firstSessionId);

    // Open History drawer, verify remembered barn context metadata & switch back to first section
    fireEvent.click(screen.getByTestId('session-list-toggle-btn'));
    const panel = screen.getByTestId('session-list-panel');
    expect(panel.textContent).toContain('Nhớ: Nhà A1');
    expect(panel.textContent).toContain('Nhớ: Nhà B1');

    fireEvent.click(screen.getByTestId(`session-list-item-${firstSessionId}`));

    expect(screen.getByText(/Đang nuôi 2\.000 con/i)).toBeInTheDocument();

    // Expand / restore size button next to '+' toggles expanded layout cleanly
    const chatWindow = screen.getByTestId('ai-chat-window');
    const expandBtn = screen.getByTestId('expand-chat-btn');
    expect(chatWindow.className).not.toMatch(/chatWindowExpanded/);
    fireEvent.click(expandBtn);
    expect(chatWindow.className).toMatch(/chatWindowExpanded/);
    fireEvent.click(expandBtn);
    expect(chatWindow.className).not.toMatch(/chatWindowExpanded/);
  });

  it('wipes Owner chat sessions on clearAiChatStorage (logout) so Worker cannot read them after login', async () => {
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: 'Doanh thu tháng này là 500 triệu đ và công nợ còn 45 triệu đ.',
      actionType: 'QUERY_FARM_STATUS',
      executed: false,
    });

    const ownerView = render(
      <MemoryRouter initialEntries={['/reports']}>
        <AIChatbot key="owner@farm.vn" userRole="ROLE_FARM_OWNER" userScope="owner@farm.vn" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Xem báo cáo lãi lỗ và công nợ' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(screen.getByText(/Doanh thu tháng này là 500 triệu đ/i)).toBeInTheDocument();
    });

    expect(sessionStorage.getItem(AI_CHAT_OWNER_KEY)).toBe('owner@farm.vn');
    expect(sessionStorage.getItem(AI_SESSIONS_STORAGE_KEY)).toContain('500 triệu đ');

    // Simulate logout wiping storage and notifying mounted chatbot
    act(() => {
      clearAiChatStorage();
    });

    expect(sessionStorage.getItem(AI_SESSIONS_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(AI_ACTIVE_SESSION_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(AI_CHAT_OPEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(AI_CHAT_OWNER_KEY)).toBeNull();
    expect(screen.queryByText(/Doanh thu tháng này là 500 triệu đ/i)).not.toBeInTheDocument();

    ownerView.unmount();

    // Ensure logout reset did not re-write storage keys on unmount
    expect(sessionStorage.getItem(AI_SESSIONS_STORAGE_KEY)).toBeNull();

    // Worker logs in on the same browser tab
    render(
      <MemoryRouter initialEntries={['/today-tasks']}>
        <AIChatbot key="worker@farm.vn" userRole="ROLE_FARM_WORKER" userScope="worker@farm.vn" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('ai-chat-window')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    expect(screen.queryByText(/Doanh thu tháng này là 500 triệu đ/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Xem báo cáo lãi lỗ và công nợ/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(AI_CHAT_OWNER_KEY)).toBe('worker@farm.vn');
  });

  it('fail-closes and purges mismatched or untagged legacy chat storage when a different account mounts', async () => {
    // Case A: Direct cross-account mount when sessionStorage still holds Owner's scoped sessions
    sessionStorage.setItem(AI_CHAT_OWNER_KEY, 'owner@farm.vn');
    sessionStorage.setItem(AI_CHAT_OPEN_KEY, 'true');
    sessionStorage.setItem(
      AI_SESSIONS_STORAGE_KEY,
      JSON.stringify({
        ownerScope: 'owner@farm.vn',
        sessions: [
          {
            id: 'session_secret_owner',
            title: 'Bí mật công nợ',
            messages: [{ id: 10, type: 'bot', text: 'Công nợ bí mật 999 triệu', time: '09:00' }],
          },
        ],
      })
    );

    const viewA = render(
      <MemoryRouter initialEntries={['/today-tasks']}>
        <AIChatbot key="worker@farm.vn" userRole="ROLE_FARM_WORKER" userScope="worker@farm.vn" />
      </MemoryRouter>
    );

    // Must NOT restore Owner's open state or secret message
    expect(screen.queryByTestId('ai-chat-window')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    expect(screen.queryByText(/Công nợ bí mật 999 triệu/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(AI_CHAT_OWNER_KEY)).toBe('worker@farm.vn');
    viewA.unmount();

    // Case B: Untagged legacy history key must NOT load into an authenticated user's chatbox
    sessionStorage.clear();
    sessionStorage.setItem(
      AI_LEGACY_HISTORY_KEY,
      JSON.stringify([{ id: 11, type: 'bot', text: 'Lịch sử cũ chưa gắn owner', time: '08:00' }])
    );

    render(
      <MemoryRouter initialEntries={['/today-tasks']}>
        <AIChatbot key="worker@farm.vn" userRole="ROLE_FARM_WORKER" userScope="worker@farm.vn" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    expect(screen.queryByText(/Lịch sử cũ chưa gắn owner/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(AI_LEGACY_HISTORY_KEY)).toBeNull();
  });

  it('drops in-flight assistant response from previous account if logout occurs before completion', async () => {
    let resolveInFlight;
    aiAssistantService.sendAssistantMessage.mockImplementation(
      () => new Promise((resolve) => { resolveInFlight = resolve; })
    );

    render(
      <MemoryRouter initialEntries={['/reports']}>
        <AIChatbot key="owner@farm.vn" userRole="ROLE_FARM_OWNER" userScope="owner@farm.vn" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Xem doanh thu mật' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    expect(aiAssistantService.sendAssistantMessage).toHaveBeenCalledTimes(1);

    // User logs out while request is still in flight
    act(() => {
      clearAiChatStorage();
    });

    // Late response resolves after logout
    await act(async () => {
      resolveInFlight({
        reply: 'Dữ liệu mật của Chủ trại: 800 triệu đ',
        actionType: 'QUERY_FARM_STATUS',
        executed: false,
      });
    });

    expect(screen.queryByText(/Dữ liệu mật của Chủ trại: 800 triệu đ/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(AI_SESSIONS_STORAGE_KEY)).toBeNull();
  });
});
