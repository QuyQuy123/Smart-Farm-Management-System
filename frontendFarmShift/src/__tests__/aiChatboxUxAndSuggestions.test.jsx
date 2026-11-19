// src/__tests__/aiChatboxUxAndSuggestions.test.jsx
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AIChatbot } from '../components/AIChatbot/AIChatbot';
import { DashboardView } from '../features/farmshift/DashboardView';
import * as aiAssistantService from '../services/aiAssistantService';
import * as dashboardService from '../services/dashboardService';
import { DataCache, shouldSkipCache } from '../services/dataCache';

vi.mock('../services/aiAssistantService', () => ({
  getAiSuggestions: vi.fn(),
  sendAssistantMessage: vi.fn(),
  transcribeAudio: vi.fn(),
}));

vi.mock('../services/dashboardService', () => ({
  getDashboard: vi.fn(),
}));

vi.mock('../services/farmAreaService', () => ({
  listBarns: vi.fn().mockResolvedValue([]),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'ROLE_FARM_OWNER', fullName: 'Chủ trại Test' } }),
}));

vi.mock('../layouts/FarmShiftLayout', () => ({
  FarmShiftLayout: ({ children }) => <main>{children}</main>,
}));

describe('AI Chatbox Live Suggestions, UX Overhaul & Dashboard Ask-AI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();

    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn().mockReturnValue([{ lang: 'vi-VN', name: 'Vietnamese' }]),
    };
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
        this.lang = '';
      }
    };
  });

  it('renders live suggestions (and skeleton while loading), distinguishes autoSend=true vs template edit with "..." selection', async () => {
    let resolveSuggestions;
    aiAssistantService.getAiSuggestions.mockImplementation(
      () => new Promise((resolve) => { resolveSuggestions = resolve; })
    );
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: '✅ Đã tổng hợp 2 việc quá giờ tại Nhà A1.',
      actionType: 'QUERY_FARM_STATUS',
      executed: false,
      navigateTo: '/today-tasks',
    });

    render(
      <MemoryRouter initialEntries={['/today-tasks']}>
        <AIChatbot userRole="ROLE_FARM_OWNER" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    // Skeleton shimmer is shown while API call is in flight
    expect(await screen.findByTestId('suggestions-skeleton')).toBeInTheDocument();

    resolveSuggestions({
      role: 'ROLE_FARM_OWNER',
      roleLabel: 'Chủ trại',
      routeLabel: 'Việc hôm nay',
      inputPlaceholder: 'Hỏi hoặc ra lệnh: FCR, lãi lỗ, công nợ, việc quá giờ, nhập kho...',
      suggestions: [
        {
          id: 'owner_overdue_tasks',
          category: 'URGENT',
          badge: 'Quá giờ',
          title: 'Nhà A1: 2 việc quá giờ',
          subtitle: 'Kiểm tra ngay',
          prompt: 'Xem các việc quá giờ tại Nhà A1',
          autoSend: true,
          targetRoute: '/today-tasks',
          priorityScore: 120,
        },
        {
          id: 'owner_tpl_feed',
          category: 'ACTION',
          badge: 'Ghi cám',
          title: 'Ghi nhanh khẩu phần cám · Nhà A1',
          subtitle: 'Điền số lượng cám',
          prompt: 'Ghi ... kg cám cho Nhà A1',
          autoSend: false,
          targetRoute: '/journal',
          priorityScore: 72,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.queryByTestId('suggestions-skeleton')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('live-suggestion-card')).toHaveLength(2);
    });

    const cards = screen.getAllByTestId('live-suggestion-card');
    expect(cards[0]).toHaveAttribute('data-category', 'URGENT');
    expect(cards[0]).toHaveAttribute('data-autosend', 'true');
    expect(cards[1]).toHaveAttribute('data-category', 'ACTION');
    expect(cards[1]).toHaveAttribute('data-autosend', 'false');

    // Click autoSend=false template card -> populates input & selects "..." WITHOUT calling sendAssistantMessage
    fireEvent.click(cards[1]);

    const inputEl = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    await waitFor(() => {
      expect(inputEl.value).toBe('Ghi ... kg cám cho Nhà A1');
      const selected = inputEl.value.slice(inputEl.selectionStart, inputEl.selectionEnd);
      expect(selected).toBe('...');
    });
    expect(aiAssistantService.sendAssistantMessage).not.toHaveBeenCalled();

    // Click autoSend=true card -> immediately calls sendAssistantMessage & shows deep-link pill
    fireEvent.click(cards[0]);

    await waitFor(() => {
      expect(aiAssistantService.sendAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Xem các việc quá giờ tại Nhà A1' })
      );
      expect(screen.getByTestId('bot-deeplink-btn')).toHaveTextContent('Mở Việc hôm nay');
    });
  });

  it('supports Ctrl+J toggle (ignoring external inputs), explicit close button, and non-closing docked Side-Drawer', async () => {
    aiAssistantService.getAiSuggestions.mockResolvedValue({
      role: 'ROLE_FARM_OWNER',
      roleLabel: 'Chủ trại',
      routeLabel: 'Bảng tin',
      inputPlaceholder: 'Hỏi hoặc ra lệnh: FCR, lãi lỗ...',
      suggestions: [],
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <div>
          <input data-testid="external-form-input" defaultValue="" />
          <AIChatbot userRole="ROLE_FARM_OWNER" />
        </div>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('ai-chat-window')).not.toBeInTheDocument();

    // Ctrl+J on external input must NOT hijack user typing
    const externalInput = screen.getByTestId('external-form-input');
    externalInput.focus();
    fireEvent.keyDown(externalInput, { key: 'j', ctrlKey: true, bubbles: true });
    expect(screen.queryByTestId('ai-chat-window')).not.toBeInTheDocument();

    // Ctrl+J globally opens chatbox
    externalInput.blur();
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
    expect(await screen.findByTestId('ai-chat-window')).toBeInTheDocument();

    // Toggle Side-Drawer dock mode
    const chatWin = screen.getByTestId('ai-chat-window');
    fireEvent.click(screen.getByTestId('expand-chat-btn'));
    expect(chatWin.className).toMatch(/chatWindowExpanded/);

    // Outside click in Side-Drawer mode keeps drawer open cleanly
    fireEvent.mouseDown(document.body);
    expect(screen.getByTestId('ai-chat-window')).toBeInTheDocument();

    // Explicit header Close ('X') button closes drawer
    fireEvent.click(screen.getByTestId('close-chat-btn'));
    expect(screen.queryByTestId('ai-chat-window')).not.toBeInTheDocument();
  });

  it('opens AI Chatbox and submits alert prompt when clicking "Hỏi AI" on Dashboard alert row or dispatching farmshift:open-ai-chat', async () => {
    aiAssistantService.getAiSuggestions.mockResolvedValue({
      role: 'ROLE_FARM_OWNER',
      roleLabel: 'Chủ trại',
      routeLabel: 'Bảng tin',
      inputPlaceholder: 'Hỏi hoặc ra lệnh: FCR...',
      suggestions: [],
    });
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: 'Phân tích hao hụt Nhà A1: tỷ lệ 0.6%, nên tách gà bệnh và kiểm tra nhiệt độ chuồng.',
      actionType: 'GENERAL_QNA',
      executed: false,
    });
    dashboardService.getDashboard.mockResolvedValue({
      date: '2026-10-30',
      kpis: {
        liveQuantity: 2000,
        activeBarns: 1,
        lossToday: 12,
        loss7d: 15,
        loss7dRate: 0.75,
        tasksDone: 2,
        tasksTotal: 4,
        overdueTasks: 0,
        supplierDebt: 0,
        unpaidInvoices: 0,
      },
      alerts: [
        {
          level: 'DANGER',
          type: 'LOSS',
          title: 'Nhà A1: hao hụt 12 con hôm nay',
          detail: 'Tỷ lệ 0.6% số con trong chuồng.',
          barnId: 1,
        },
      ],
      barns: [],
      upcoming: [],
      restock: [],
      finance: null,
      taskHistory: [],
      growth: [],
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardView />
        <AIChatbot userRole="ROLE_FARM_OWNER" />
      </MemoryRouter>
    );

    const askBtn = await screen.findByTestId('dashboard-alert-ask-ai');
    fireEvent.click(askBtn);

    expect(await screen.findByTestId('ai-chat-window')).toBeInTheDocument();

    await waitFor(() => {
      expect(aiAssistantService.sendAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Nhà A1: hao hụt 12 con hôm nay'),
        })
      );
      expect(screen.getByText(/nên tách gà bệnh/i)).toBeInTheDocument();
    });
  });

  it('displays Header Context Pill (routeLabel · roleLabel) and worker-safe inputPlaceholder for ROLE_FARM_WORKER', async () => {
    aiAssistantService.getAiSuggestions.mockResolvedValueOnce({
      role: 'ROLE_FARM_WORKER',
      roleLabel: 'Công nhân',
      routeLabel: 'Nhật ký nuôi',
      inputPlaceholder: 'Hỏi hoặc ra lệnh: ghi cám, cân mẫu, hao hụt, việc hôm nay...',
      suggestions: [
        {
          id: 'worker_tpl_feed',
          category: 'ACTION',
          badge: 'Ghi cám',
          title: 'Ghi nhật ký cho ăn · Nhà A1',
          subtitle: 'Điền nhanh khối lượng cám',
          prompt: 'Ghi ... kg cám cho Nhà A1',
          autoSend: false,
          targetRoute: '/journal',
          priorityScore: 91,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/journal']}>
        <AIChatbot userRole="ROLE_FARM_WORKER" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    const pill = await screen.findByTestId('ai-context-pill');
    await waitFor(() => {
      expect(pill).toHaveTextContent('Nhật ký nuôi');
      expect(pill).toHaveTextContent('Công nhân');
    });

    const inputEl = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    const placeholderLower = inputEl.placeholder.toLowerCase();
    expect(placeholderLower).not.toContain('nhập kho');
    expect(placeholderLower).not.toContain('công nợ');
    expect(placeholderLower).not.toContain('hóa đơn');
    expect(placeholderLower).not.toContain('lãi/lỗ');
    expect(placeholderLower).not.toContain('đơn giá');
  });

  it('caches /ai/suggestions in DataCache and invalidates on purchase/farm mutations', () => {
    expect(shouldSkipCache('/ai/suggestions?route=/dashboard')).toBe(false);
    expect(shouldSkipCache('/ai/assistant')).toBe(true);
    expect(shouldSkipCache('/ai/assistant/stream')).toBe(true);
    expect(shouldSkipCache('/ai/voice/transcribe')).toBe(true);

    const cache = new DataCache({ attachListeners: false });
    cache.setUserScope('owner@farm.test');
    cache.set('/ai/suggestions?route=/dashboard', { suggestions: [{ id: 's1' }] }, 30000);
    expect(cache.peek('/ai/suggestions?route=/dashboard')).toEqual({ suggestions: [{ id: 's1' }] });

    cache.invalidateForMutation('/purchases');
    expect(cache.peek('/ai/suggestions?route=/dashboard')).toBeNull();

    cache.set('/ai/suggestions?route=/reports', { suggestions: [{ id: 's2' }] }, 30000);
    cache.invalidateAllFarmData();
    expect(cache.peek('/ai/suggestions?route=/reports')).toBeNull();
    cache.destroy();
  });
});
