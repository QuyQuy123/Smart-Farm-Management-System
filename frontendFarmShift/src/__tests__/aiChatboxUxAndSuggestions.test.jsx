// src/__tests__/aiChatboxUxAndSuggestions.test.jsx
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AIChatbot } from '../components/AIChatbot/AIChatbot';
import { DashboardView } from '../features/farmshift/DashboardView';
import * as aiAssistantService from '../services/aiAssistantService';
import * as dashboardService from '../services/dashboardService';
import * as audioRecorder from '../utils/audioRecorder';
import { DataCache, shouldSkipCache } from '../services/dataCache';

vi.mock('../services/aiAssistantService', () => ({
  getAiSuggestions: vi.fn(),
  sendAssistantMessage: vi.fn(),
  transcribeAudio: vi.fn(),
}));

vi.mock('../utils/audioRecorder', async () => {
  const actual = await vi.importActual('../utils/audioRecorder');
  return {
    ...actual,
    createAdaptiveVoiceRecorder: vi.fn((...args) => actual.createAdaptiveVoiceRecorder(...args)),
  };
});

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

  it('renders interactive clarificationOptions (autoSend vs template "...") and supports senior-friendly Auto-Speak toggle', async () => {
    aiAssistantService.getAiSuggestions.mockResolvedValue({
      role: 'ROLE_FARM_OWNER',
      roleLabel: 'Chủ trại',
      routeLabel: 'Bảng tin',
      inputPlaceholder: 'Hỏi hoặc ra lệnh...',
      suggestions: [],
    });
    aiAssistantService.sendAssistantMessage
      .mockResolvedValueOnce({
        reply: '🤔 Bạn muốn ghi nhận cho ăn 50 kg cám cho chuồng nuôi nào?',
        actionType: 'CLARIFICATION_REQUIRED',
        executed: false,
        requiresConfirmation: false,
        clarificationOptions: [
          {
            badge: 'Ghi cám',
            label: '🌾 Cho Nhà A1 ăn 50 kg cám',
            description: 'Lập thẻ xác nhận trừ kho & ghi nhật ký cám',
            prompt: 'Cho Nhà A1 ăn 50 kg cám',
            autoSend: true,
          },
          {
            badge: 'Nhập số khác',
            label: '✏️ Cho ... ăn ... kg cám',
            description: 'Điền nhanh chuồng & số kg',
            prompt: 'Cho ... ăn ... kg cám',
            autoSend: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        reply: 'Bạn có muốn ghi nhận cho Nhà A1 ăn 50.0 kg cám không?',
        actionType: 'LOG_FEED',
        executed: false,
        requiresConfirmation: true,
        pendingAction: {
          actionType: 'LOG_FEED',
          title: 'Ghi nhận cám: Nhà A1',
          payload: { actionType: 'LOG_FEED', barnId: 1, totalKg: 50 },
        },
      });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AIChatbot userRole="ROLE_FARM_OWNER" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    // Senior accessibility Auto-Speak toggle defaults off, toggles on, and persists to localStorage
    const autoSpeakBtn = await screen.findByTestId('auto-speak-toggle-btn');
    expect(autoSpeakBtn).toHaveTextContent('Tự đọc: Tắt');
    fireEvent.click(autoSpeakBtn);
    expect(autoSpeakBtn).toHaveTextContent('Tự đọc: Bật');
    expect(localStorage.getItem('farmshift_ai_auto_speak')).toBe('true');

    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Cho ăn 50 kg cám' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    const clarifyBox = await screen.findByTestId('clarification-options');
    expect(clarifyBox).toBeInTheDocument();
    const optBtns = screen.getAllByTestId('clarification-option-btn');
    expect(optBtns).toHaveLength(2);

    // Auto-speak spoke the clarification prompt AND options automatically
    expect(window.speechSynthesis.speak).toHaveBeenCalled();

    // Clicking template option (autoSend=false) prefills input and selects "..." without calling API
    fireEvent.click(optBtns[1]);
    await waitFor(() => {
      expect(input.value).toBe('Cho ... ăn ... kg cám');
      expect(input.value.slice(input.selectionStart, input.selectionEnd)).toBe('...');
    });
    expect(aiAssistantService.sendAssistantMessage).toHaveBeenCalledTimes(1);

    // Clicking confirmed option (autoSend=true) immediately dispatches confirmed command
    fireEvent.click(optBtns[0]);
    await waitFor(() => {
      expect(aiAssistantService.sendAssistantMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
        message: 'Cho Nhà A1 ăn 50 kg cám',
      }));
    });
  });

  it('testPendingActionCard_StripsRawBackticksAndRendersCleanLotBadge', async () => {
    aiAssistantService.getAiSuggestions.mockResolvedValue({
      role: 'ROLE_ACCOUNTANT',
      roleLabel: 'Kế toán',
      routeLabel: 'Xuất nhập kho',
      inputPlaceholder: 'Hỏi hoặc ra lệnh...',
      suggestions: [],
    });
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: 'Bạn có muốn tạo phiếu **Xuất hủy** cho **2 bao Cám Higro 01** `#20261112-2204` không?',
      actionType: 'INTERNAL_STOCK_VOUCHER',
      executed: false,
      requiresConfirmation: true,
      pendingAction: {
        actionType: 'INTERNAL_STOCK_VOUCHER',
        title: 'Xác nhận phiếu Xuất hủy `#20261112-2204`',
        description: 'Thực hiện xuất hủy (EXPORT) trong hệ thống kho nội bộ',
        details: {
          'Loại phiếu': 'Xuất hủy (EXPORT)',
          'Kho xuất': 'Kho cám',
          'Mặt hàng & Lô áp dụng': 'Cám Higro 01 `#20261112-2204` (2 bao)',
          'Tồn kho sau thao tác': '18 bao (Giảm 2 bao)',
        },
        payload: {
          actionType: 'INTERNAL_STOCK_VOUCHER',
          movementType: 'EXPORT',
          categoryName: 'Xuất hủy',
          productName: 'Cám Higro 01',
          quantity: 2,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/transfers']}>
        <AIChatbot userRole="ROLE_ACCOUNTANT" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Xuất hủy 2 bao cám Higro 01' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    const card = await screen.findByTestId('confirmation-card');
    expect(card).toBeInTheDocument();

    // Must render clean lot badge #20261112-2204 with zero literal backtick characters anywhere
    expect(card.textContent).toContain('#20261112-2204');
    expect(card.textContent).not.toContain('`');
    expect(card.textContent).not.toContain('(EXPORT)');
    expect(screen.getByTestId('ai-chat-window').textContent).not.toContain('`');

    const codeBadges = card.querySelectorAll('code');
    expect(codeBadges.length).toBeGreaterThanOrEqual(2);
    expect(Array.from(codeBadges).some((el) => el.textContent === '#20261112-2204')).toBe(true);
  });

  it('testPendingActionCard_UsesAccessibleSeniorFriendlyButtonsAndStackedDetails', async () => {
    aiAssistantService.getAiSuggestions.mockResolvedValue({
      role: 'ROLE_FARM_OWNER',
      roleLabel: 'Chủ trại',
      routeLabel: 'Bảng tin',
      inputPlaceholder: 'Hỏi hoặc ra lệnh...',
      suggestions: [],
    });
    aiAssistantService.sendAssistantMessage
      .mockResolvedValueOnce({
        reply: 'Bạn có muốn ghi nhận cho Nhà A1 ăn 4 bao cám Cargill 1502 không?',
        actionType: 'LOG_FEED',
        executed: false,
        requiresConfirmation: true,
        pendingAction: {
          actionType: 'LOG_FEED',
          title: 'Ghi nhận cám: Nhà A1',
          description: 'Ghi nhận 4 bao (100 kg) cám Cargill 1502',
          details: {
            'Chuồng nuôi': 'Nhà A1',
            'Kho xuất tự động': 'Kho cám Khu A',
            'Mặt hàng & Số lượng': '4 bao (100 kg) Cargill 1502',
            'Tồn kho dự kiến sau xuất': '400 kg',
          },
          payload: {
            actionType: 'LOG_FEED',
            barnId: 1,
            barnName: 'Nhà A1',
            feedName: 'Cargill 1502',
            unitDetail: '4 bao',
            totalKg: 100,
          },
        },
      })
      .mockResolvedValueOnce({
        reply: '✅ Đã ghi nhận cho Nhà A1 ăn 4 bao cám Cargill 1502.',
        actionType: 'LOG_FEED',
        executed: true,
        actionSummary: {
          title: 'Đã ghi nhật ký cám',
          barnName: 'Nhà A1',
          detail: 'Cargill 1502 • 4 bao',
          timestamp: '2026-11-21T10:00:00',
        },
      });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AIChatbot userRole="ROLE_FARM_OWNER" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Cho Nhà A1 ăn 4 bao cám Cargill 1502' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    const card = await screen.findByTestId('confirmation-card');
    const detailsList = within(card).getByTestId('confirm-details-list');
    const detailRows = within(detailsList).getAllByTestId('confirm-detail-row');
    expect(detailRows).toHaveLength(4);
    expect(detailRows[0]).toHaveTextContent('Chuồng nuôi');
    expect(detailRows[0]).toHaveTextContent('Nhà A1');

    const acceptBtn = within(card).getByTestId('confirm-accept-btn');
    const rejectBtn = within(card).getByTestId('confirm-reject-btn');
    expect(acceptBtn).toHaveTextContent('Đồng ý lưu');
    expect(rejectBtn).toHaveTextContent('Hủy bỏ');

    // Cancel then restore to verify full interactivity
    fireEvent.click(rejectBtn);
    expect(within(card).getByText('✕ Bạn đã hủy thao tác này.')).toBeInTheDocument();
    fireEvent.click(within(card).getByTestId('confirm-retry-btn'));

    const restoredAccept = within(card).getByTestId('confirm-accept-btn');
    fireEvent.click(restoredAccept);
    await waitFor(() => {
      expect(aiAssistantService.sendAssistantMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
        confirmAction: true,
      }));
      expect(screen.getByTestId('action-execution-card')).toBeInTheDocument();
    });
  });

  it('testAutoSpeakToggle_StripsMarkdownAndReadsConciseConfirmationSummary', async () => {
    aiAssistantService.getAiSuggestions.mockResolvedValue({
      role: 'ROLE_ACCOUNTANT',
      roleLabel: 'Kế toán',
      routeLabel: 'Xuất nhập kho',
      inputPlaceholder: 'Hỏi hoặc ra lệnh...',
      suggestions: [],
    });
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: '🤔 Bạn có muốn tạo phiếu **Xuất hủy** (`EXPORT`) cho **2 bao Cám Higro 01** `#20261112-2204` không?',
      actionType: 'INTERNAL_STOCK_VOUCHER',
      executed: false,
      requiresConfirmation: true,
      pendingAction: {
        actionType: 'INTERNAL_STOCK_VOUCHER',
        title: 'Xác nhận phiếu Xuất hủy',
        details: {
          'Loại phiếu': 'Xuất hủy (EXPORT)',
          'Mặt hàng & Lô áp dụng': 'Cám Higro 01 `#20261112-2204` (2 bao)',
        },
        payload: {
          actionType: 'INTERNAL_STOCK_VOUCHER',
          movementType: 'EXPORT',
          categoryName: 'Xuất hủy',
          productName: 'Cám Higro 01',
          quantity: 2,
        },
      },
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/transfers']}>
        <AIChatbot userRole="ROLE_ACCOUNTANT" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    fireEvent.click(await screen.findByTestId('auto-speak-toggle-btn'));

    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Xuất hủy 2 bao cám Higro 01' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    });

    const spokenText = window.speechSynthesis.speak.mock.calls[0][0].text;
    expect(spokenText).not.toContain('`');
    expect(spokenText).not.toContain('*');
    expect(spokenText).not.toContain('#');
    expect(spokenText).not.toContain('EXPORT');
    expect(spokenText).not.toContain('20261112-2204');
    expect(spokenText).toContain('Xuất hủy');
    expect(spokenText).toContain('Cám Higro 01');
    expect(spokenText).toContain('Bấm Đồng ý lưu để thực hiện');

    // Closing chatbox and unmounting must cancel active speech synthesis
    window.speechSynthesis.cancel.mockClear();
    fireEvent.click(screen.getByTestId('close-chat-btn'));
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();

    window.speechSynthesis.cancel.mockClear();
    unmount();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it('auto-speaks concise confirmation summary when turn originates from voice microphone even if autoSpeak toggle is off', async () => {
    aiAssistantService.getAiSuggestions.mockResolvedValue({
      role: 'ROLE_FARM_OWNER',
      roleLabel: 'Chủ trại',
      routeLabel: 'Bảng tin',
      inputPlaceholder: 'Hỏi hoặc ra lệnh...',
      suggestions: [],
    });

    let triggerVoiceComplete;
    audioRecorder.createAdaptiveVoiceRecorder.mockImplementationOnce(async ({ onComplete }) => {
      triggerVoiceComplete = onComplete;
      return {
        stop: () => onComplete({
          blob: new Blob(['voice-bytes'], { type: 'audio/webm' }),
          filename: 'voice.webm',
        }),
        cancel: vi.fn(),
      };
    });

    aiAssistantService.transcribeAudio.mockResolvedValueOnce({
      text: 'Cho Nhà A1 ăn 4 bao cám Cargill 1502',
      normalizedText: 'Cho Nhà A1 ăn 4 bao cám Cargill 1502',
      confidence: 0.96,
      autoSubmitEligible: true,
      corrections: [],
    });

    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: 'Bạn có muốn ghi nhận cho **Nhà A1** ăn **4 bao** cám **Cargill 1502** không?',
      actionType: 'LOG_FEED',
      executed: false,
      requiresConfirmation: true,
      pendingAction: {
        actionType: 'LOG_FEED',
        title: 'Ghi nhận cám: Nhà A1',
        details: { 'Chuồng nuôi': 'Nhà A1', 'Thức ăn': 'Cargill 1502', 'Số lượng': '4 bao' },
        payload: {
          actionType: 'LOG_FEED',
          barnId: 1,
          barnName: 'Nhà A1',
          feedName: 'Cargill 1502',
          unitDetail: '4 bao',
          totalKg: 100,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AIChatbot userRole="ROLE_FARM_OWNER" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    expect(await screen.findByTestId('auto-speak-toggle-btn')).toHaveTextContent('Tự đọc: Tắt');

    const micBtn = screen.getByTestId('voice-mic-button');
    fireEvent.click(micBtn);
    await waitFor(() => {
      expect(typeof triggerVoiceComplete).toBe('function');
    });
    // Stop mic to complete voice capture
    fireEvent.click(micBtn);

    await waitFor(() => {
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    });
    const spokenVoiceReply = window.speechSynthesis.speak.mock.calls[0][0].text;
    expect(spokenVoiceReply).toBe('Xác nhận ghi Nhà A1 ăn 4 bao cám Cargill 1502. Bấm Đồng ý lưu để thực hiện.');
  });

  it('strips enum tags from bot bubbles, avoids duplicate "cám Cám" in TTS, and cancels speech when clicking Hủy bỏ', async () => {
    localStorage.setItem('farmshift_ai_auto_speak', 'true');
    aiAssistantService.getAiSuggestions.mockResolvedValue({
      role: 'ROLE_FARM_OWNER',
      roleLabel: 'Chủ trại',
      routeLabel: 'Bảng tin',
      inputPlaceholder: 'Hỏi hoặc ra lệnh...',
      suggestions: [],
    });
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: 'Bạn có muốn ghi nhận phiếu **Xuất hủy** (`EXPORT`) cho **Cám Gà vỗ béo Cargill 1502** `#20261112-2204` không?',
      actionType: 'LOG_FEED',
      executed: false,
      requiresConfirmation: true,
      pendingAction: {
        actionType: 'LOG_FEED',
        title: 'Xác nhận **Ghi cám** (`EXPORT`)',
        description: 'Ghi nhận 25 kg **Cám Gà vỗ béo Cargill 1502** (`TRANSFER`)',
        details: {
          'Chuồng nuôi': 'Nhà A1',
          'Mặt hàng & Lô áp dụng': 'Cám Gà vỗ béo Cargill 1502 (`EXPORT`) `#20261112-2204`',
        },
        payload: {
          actionType: 'LOG_FEED',
          barnId: 1,
          barnName: 'Nhà A1',
          feedName: 'Cám Gà vỗ béo Cargill 1502',
          unitDetail: '25 kg',
          totalKg: 25,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AIChatbot userRole="ROLE_FARM_OWNER" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    expect(await screen.findByTestId('auto-speak-toggle-btn')).toHaveTextContent('Tự đọc: Bật');

    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Cho Nhà A1 ăn 25 kg Cám Gà vỗ béo Cargill 1502' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    const chatWin = await screen.findByTestId('ai-chat-window');
    await waitFor(() => {
      expect(screen.getByTestId('confirmation-card')).toBeInTheDocument();
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    });

    // Neither bubble nor confirmation card may leak raw backticks, "**", or "(EXPORT)"/"(TRANSFER)"
    expect(chatWin.textContent).not.toContain('`');
    expect(chatWin.textContent).not.toContain('**');
    expect(chatWin.textContent).not.toContain('EXPORT');
    expect(chatWin.textContent).not.toContain('TRANSFER');
    expect(chatWin.textContent).toContain('#20261112-2204');

    const spokenText = window.speechSynthesis.speak.mock.calls[0][0].text;
    expect(spokenText).toBe('Xác nhận ghi Nhà A1 ăn 25 kg Cám Gà vỗ béo Cargill 1502. Bấm Đồng ý lưu để thực hiện.');
    expect(spokenText.toLowerCase()).not.toContain('cám cám');

    // Clicking Cancel ("Hủy bỏ") immediately stops active TTS playback
    window.speechSynthesis.cancel.mockClear();
    fireEvent.click(screen.getByTestId('confirm-reject-btn'));
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it('synchronizes open, expanded Side-Drawer, messages, session list and input draft cleanly across route remounts', async () => {
    aiAssistantService.getAiSuggestions.mockResolvedValue({
      role: 'ROLE_FARM_OWNER',
      roleLabel: 'Chủ trại',
      routeLabel: 'Hóa đơn & Mua hàng',
      inputPlaceholder: 'Hỏi hoặc ra lệnh: FCR, lãi lỗ...',
      suggestions: [],
    });
    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: '✅ Đã ghi nhận thanh toán 53.760.000 đ cho hóa đơn NHCG000009.',
      actionType: 'PAY_PURCHASE_INVOICE',
      executed: true,
    });

    const purchasesMount = render(
      <MemoryRouter initialEntries={['/purchases']}>
        <AIChatbot userRole="ROLE_FARM_OWNER" userEmail="admin@farmshift.local" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    fireEvent.click(await screen.findByTestId('expand-chat-btn'));
    expect(document.documentElement.classList.contains('farmshift-ai-drawer-open')).toBe(true);

    const input = await screen.findByPlaceholderText(/Hỏi hoặc ra lệnh/i);
    fireEvent.change(input, { target: { value: 'Cập nhật đơn NHCG000009' } });
    fireEvent.click(screen.getByTitle('Gửi câu lệnh'));

    await waitFor(() => {
      expect(screen.getByText(/Đã ghi nhận thanh toán 53\.760\.000 đ/i)).toBeInTheDocument();
    });

    // Type an unsent draft and open session history drawer before navigating to another route
    fireEvent.change(input, { target: { value: 'Chuyển 5 bao cám' } });
    fireEvent.click(screen.getByTestId('session-list-toggle-btn'));
    expect(screen.getByTestId('session-list-panel')).toBeInTheDocument();

    await waitFor(() => {
      expect(sessionStorage.getItem('farmshift_ai_chat_expanded')).toBe('true');
      expect(sessionStorage.getItem('farmshift_ai_chat_draft_input')).toBe('Chuyển 5 bao cám');
      expect(sessionStorage.getItem('farmshift_ai_chat_session_list_open')).toBe('true');
    });

    // Simulate leaving /purchases layout and mounting /transfers layout
    purchasesMount.unmount();

    render(
      <MemoryRouter initialEntries={['/transfers']}>
        <AIChatbot userRole="ROLE_FARM_OWNER" userEmail="admin@farmshift.local" />
      </MemoryRouter>
    );

    const nextWin = await screen.findByTestId('ai-chat-window');
    expect(nextWin.className).toMatch(/chatWindowExpanded/);
    expect(nextWin.className).toMatch(/chatWindowNoAnim/);
    expect(document.documentElement.classList.contains('farmshift-ai-drawer-open')).toBe(true);
    expect(screen.getByText(/Đã ghi nhận thanh toán 53\.760\.000 đ/i)).toBeInTheDocument();
    expect(screen.getByTestId('session-list-panel')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i).value).toBe('Chuyển 5 bao cám');
  });
});
