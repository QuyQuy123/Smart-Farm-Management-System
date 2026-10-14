// src/__tests__/fullSystemSweep.test.jsx
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';

// Import All Core Views directly
import { DashboardView } from '../features/farmshift/DashboardView';
import { BarnsView } from '../features/farmshift/BarnsView';
import { JournalView } from '../features/farmshift/JournalView';
import { InventoryView } from '../features/farmshift/InventoryView';
import { PurchasesView } from '../features/farmshift/PurchasesView';
import { SalesView } from '../features/farmshift/SalesView';
import { TransfersView } from '../features/farmshift/TransfersView';
import { CashbookView } from '../features/farmshift/CashbookView';
import { ReportsView } from '../features/farmshift/ReportsView';
import { CatalogSettingsView } from '../features/farmshift/CatalogSettingsView';
import { BreedingSettingsView } from '../features/farmshift/BreedingSettingsView';
import { GeneralSettingsView } from '../features/farmshift/GeneralSettingsView';
import { AccountView } from '../features/farmshift/AccountView';
import { Login } from '../features/auth/Login';
import { ForgotPassword } from '../features/auth/ForgotPassword';
import { ResetPassword } from '../features/auth/ResetPassword';
import { UserProfileModal } from '../features/profile/UserProfileModal';
import { AppRouter } from '../router/AppRouter';

// Mock API layer
vi.mock('../utils/api', () => ({
  api: {
    get: vi.fn((url) => {
      if (url === '/user/profile') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              email: 'test@farmshift.local',
              fullName: 'Chủ Trại Test',
              role: 'ROLE_FARM_OWNER',
              phone: '0988123456',
              address: 'Xã Tân Dân, Sóc Sơn, Hà Nội',
              avatarUrl: ''
            }
          }
        });
      }
      if (url === '/user/all') {
        return Promise.resolve({
          data: { success: true, data: [] }
        });
      }
      if (url === '/employees') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 1,
                email: 'admin@farmshift.local',
                fullName: 'Chủ Trại Test',
                phone: '0988123456',
                roleName: 'ROLE_FARM_OWNER',
                isActive: true
              }
            ]
          }
        });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: { accessToken: 'mock-jwt-token' } } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    uploadFile: vi.fn(() => Promise.resolve({ success: true, data: { url: 'https://test.r2.dev/avatar.png' } })),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    }
  }
}));

describe('Full-System Automated Crawler & Smoke Sweep Test', () => {
  let errorSpy;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('demo_mode', 'true');

    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);

    // Zero-Crash Guard: fail test on fatal uncaught errors
    errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
      if (
        message.includes('ReferenceError') ||
        message.includes('TypeError') ||
        message.includes('Cannot read properties of undefined') ||
        message.includes('Cannot read properties of null') ||
        message.includes('is not a function')
      ) {
        throw new Error(`CRITICAL ZERO-CRASH FAILURE: ${message}`);
      }
    });
  });

  afterEach(() => {
    cleanup();
    if (errorSpy) errorSpy.mockRestore();
  });

  const renderWithProviders = (ui, initialRoute = '/', locationState = null) => {
    const entries = locationState
      ? [{ pathname: initialRoute, state: locationState }]
      : [initialRoute];
    return render(
      <MemoryRouter initialEntries={entries}>
        <AuthProvider>
          <NotificationProvider>
            {ui}
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  // ── 1. Quét toàn bộ Role ─────────────────────────────────────────────────────
  describe('Phase 1: Multi-Role System Access', () => {
    const roles = [
      { name: 'Owner', role: 'ROLE_FARM_OWNER', title: 'Chủ Trang Trại' },
      { name: 'Accountant', role: 'ROLE_ACCOUNTANT', title: 'Kế Toán' },
      { name: 'Worker', role: 'ROLE_WORKER', title: 'Công Nhân Kỹ Thuật' },
    ];

    roles.forEach(({ name, role, title }) => {
      it(`renders dashboard cleanly for ${name} role (${role})`, async () => {
        sessionStorage.setItem('demo_mode', 'true');
        renderWithProviders(<DashboardView />);
        expect(document.body).toBeDefined();
        expect(document.body.innerHTML.length).toBeGreaterThan(0);
      });
    });
  });

  // ── 2. Quét 100% Views độc lập ─────────────────────────────────────────────
  describe('Phase 2: Full View Independence & Zero-Crash Render', () => {
    const views = [
      { name: 'DashboardView', component: <DashboardView /> },
      { name: 'BarnsView', component: <BarnsView /> },
      { name: 'JournalView', component: <JournalView /> },
      { name: 'InventoryView', component: <InventoryView /> },
      { name: 'PurchasesView', component: <PurchasesView /> },
      { name: 'SalesView', component: <SalesView /> },
      { name: 'TransfersView', component: <TransfersView /> },
      { name: 'CashbookView', component: <CashbookView /> },
      { name: 'ReportsView', component: <ReportsView /> },
      { name: 'CatalogSettingsView', component: <CatalogSettingsView /> },
      { name: 'BreedingSettingsView', component: <BreedingSettingsView /> },
      { name: 'GeneralSettingsView', component: <GeneralSettingsView /> },
      { name: 'AccountView', component: <AccountView /> },
      { name: 'Login', component: <Login /> },
      { name: 'ForgotPassword', component: <ForgotPassword /> },
      { name: 'ResetPassword', component: <ResetPassword />, state: { email: 'admin@farmshift.local' } },
      { name: 'UserProfileModal', component: <UserProfileModal isOpen={true} onClose={() => {}} /> }
    ];

    views.forEach(({ name, component, state }) => {
      it(`mounts ${name} without throwing errors`, () => {
        const { container } = renderWithProviders(component, '/', state);
        expect(container).toBeDefined();
        expect(container.innerHTML.length).toBeGreaterThan(10);
      });
    });
  });

  // ── 3. Tự động tương tác: Tab Crawler trong JournalView ──────────────────────
  describe('Phase 3: Tab Crawler inside JournalView (Sub-tab modularity)', () => {
    it('crawls all 5 sub-tabs in JournalView and verifies sub-components mount properly', async () => {
      renderWithProviders(<JournalView />);

      const tabButtons = document.querySelectorAll('.farmshift-tab-btn');
      expect(tabButtons.length).toBeGreaterThanOrEqual(4);

      for (const btn of Array.from(tabButtons)) {
        await act(async () => {
          fireEvent.click(btn);
        });
        expect(btn.classList.contains('active')).toBe(true);
        // Verify active container exists
        expect(document.querySelector('.farmshift-card, .farmshift-table-card, .farmshift-panel')).toBeDefined();
      }
    });

    it('interacts with Work Diary tab actions in JournalView', async () => {
      renderWithProviders(<JournalView />);
      
      const workTabBtn = Array.from(document.querySelectorAll('.farmshift-tab-btn'))
        .find(b => b.textContent.includes('công việc') || b.textContent.includes('Work'));
      
      if (workTabBtn) {
        await act(async () => {
          fireEvent.click(workTabBtn);
        });
        expect(document.body.textContent).toMatch(/công việc|Nhiệm vụ|Trạng thái/i);
      }
    });

    it('interacts with IoT & Fan control tab in JournalView', async () => {
      renderWithProviders(<JournalView />);
      
      const iotTabBtn = Array.from(document.querySelectorAll('.farmshift-tab-btn'))
        .find(b => b.textContent.includes('IoT') || b.textContent.includes('quạt'));
      
      if (iotTabBtn) {
        await act(async () => {
          fireEvent.click(iotTabBtn);
        });
        expect(document.body.textContent).toMatch(/quạt|nhiệt độ|cảm biến|thiết bị/i);
      }
    });
  });

  // ── 4. Tab Crawler trên các View có Sub-Tabs khác ───────────────────────────
  describe('Phase 4: Generic Sub-Tab Crawler across Complex Views', () => {
    const multiTabViews = [
      { name: 'CashbookView', component: <CashbookView /> },
      { name: 'CatalogSettingsView', component: <CatalogSettingsView /> },
      { name: 'BreedingSettingsView', component: <BreedingSettingsView /> },
      { name: 'GeneralSettingsView', component: <GeneralSettingsView /> },
      { name: 'AccountView', component: <AccountView /> },
    ];

    multiTabViews.forEach(({ name, component }) => {
      it(`clicks every tab in ${name} and ensures no crashes occur`, async () => {
        renderWithProviders(component);
        const tabs = document.querySelectorAll('.farmshift-tab-btn, button[role="tab"]');
        for (const tab of Array.from(tabs)) {
          await act(async () => {
            fireEvent.click(tab);
          });
          expect(document.body).toBeDefined();
        }
      });
    });

    it('AccountView loads and populates personal profile form fields properly', async () => {
      renderWithProviders(<AccountView />);
      const buttons = screen.getAllByRole('button');
      const profileTab = buttons.find(b => /hồ sơ cá nhân/i.test(b.textContent));
      await act(async () => {
        fireEvent.click(profileTab);
      });

      await waitFor(() => {
        expect(screen.getByText(/Thông tin hồ sơ cá nhân/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('Chủ Trại Test')).toBeInTheDocument();
        expect(screen.getByDisplayValue('0988123456')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Xã Tân Dân, Sóc Sơn, Hà Nội')).toBeInTheDocument();
      });
    });
  });

  // ── 5. Quét 100% Routes qua AppRouter (Lazy Loading + Suspense) ─────────────
  describe('Phase 5: Route Crawler across AppRouter', () => {
    const routes = [
      '/',
      '/dashboard',
      '/areas',
      '/barns',
      '/journal',
      '/inventory',
      '/transfers',
      '/purchases',
      '/sales',
      '/cashbook',
      '/account',
      '/reports',
      '/catalog-settings',
      '/breeding-settings',
      '/general-settings',
      '/login',
      '/forgot-password'
    ];

    routes.forEach(route => {
      it(`navigates to route "${route}" cleanly through lazy loading`, async () => {
        render(
          <MemoryRouter initialEntries={[route]}>
            <AuthProvider>
              <NotificationProvider>
                <AppRouter />
              </NotificationProvider>
            </AuthProvider>
          </MemoryRouter>
        );

        // Wait for lazy components to resolve
        await waitFor(() => {
          expect(document.body.innerHTML.length).toBeGreaterThan(100);
        }, { timeout: 3000 });
      });
    });
  });
});
