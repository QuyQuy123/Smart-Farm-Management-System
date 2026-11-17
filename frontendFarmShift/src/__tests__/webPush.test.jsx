import React from 'react';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  urlBase64ToUint8Array,
  subscribeUserToPush,
  unsubscribeUserFromPush,
  sendTestPushNotification,
} from '../services/webPushClient';
import { api } from '../utils/api';
import { FarmShiftLayout } from '../layouts/FarmShiftLayout';
import { NotificationProvider } from '../context/NotificationContext';
import { AuthProvider } from '../context/AuthContext';
import { IotView } from '../features/farmshift/IotView';
import { listBarns, listFarmAreas } from '../services/farmAreaService';
import { connectEsp32, ESP32_TOPIC_PREFIX } from '../services/esp32MqttService';

vi.mock('../utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../services/farmAreaService', () => ({
  listBarns: vi.fn(),
  listFarmAreas: vi.fn(),
  FARM_AREAS_CHANGED: 'farm-areas-changed',
}));

vi.mock('../services/esp32MqttService', { spy: true });

vi.mock('../services/userService', () => ({
  getProfile: vi.fn().mockResolvedValue({
    email: 'owner@farmshift.local',
    fullName: 'Chủ trại',
    role: 'ROLE_FARM_OWNER',
  }),
}));

vi.mock('../services/farmService', () => ({
  getFarm: vi.fn().mockResolvedValue({ name: 'Trang trại FarmShift', owner: 'Chủ trại' }),
}));

const SAMPLE_VAPID_PUB =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

function setupPushBrowserMocks({
  permission = 'granted',
  existingSubscription = null,
} = {}) {
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const createdSub = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/mock-device-token',
    unsubscribe,
    toJSON: () => ({
      endpoint: 'https://fcm.googleapis.com/fcm/send/mock-device-token',
      keys: {
        p256dh: SAMPLE_VAPID_PUB,
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    }),
  };

  let currentSub = existingSubscription;
  const pushManager = {
    getSubscription: vi.fn(async () => currentSub),
    subscribe: vi.fn(async () => {
      currentSub = createdSub;
      return createdSub;
    }),
  };
  const registration = {
    pushManager,
    showNotification: vi.fn().mockResolvedValue(undefined),
  };

  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    },
  });

  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: function PushManagerMock() {},
  });

  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      permission,
      requestPermission: vi.fn().mockResolvedValue(permission),
    },
  });

  return { registration, pushManager, createdSub, unsubscribe };
}

describe('Web Push Notifications (VAPID + Service Worker)', () => {
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  const originalClose = HTMLDialogElement.prototype.close;

  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModalStub() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function closeStub() {
      this.removeAttribute('open');
    };
  });

  afterAll(() => {
    HTMLDialogElement.prototype.showModal = originalShowModal;
    HTMLDialogElement.prototype.close = originalClose;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'mock-jwt-token');
    localStorage.setItem('user', JSON.stringify({
      email: 'owner@farmshift.local',
      name: 'Chủ trại',
      role: 'ROLE_FARM_OWNER',
    }));

    listFarmAreas.mockResolvedValue([{ id: 1, name: 'Khu Mía Thịt' }]);
    listBarns.mockResolvedValue([{ id: 11, name: 'Nhà A1', areaId: 1 }]);
    connectEsp32.mockResolvedValue({ disconnect: vi.fn() });

    api.get.mockImplementation(async (url) => {
      if (url === '/push/vapid-public-key') {
        return { data: { publicKey: SAMPLE_VAPID_PUB } };
      }
      if (url === '/push/status') {
        return { data: { hasActiveSubscription: false, deviceCount: 0 } };
      }
      return { data: {} };
    });
    api.post.mockImplementation(async (url) => {
      if (url === '/push/subscribe') {
        return { data: { subscribed: true, id: 101 } };
      }
      if (url === '/push/unsubscribe') {
        return { data: { subscribed: false } };
      }
      if (url === '/push/test') {
        return { data: { sentCount: 1, message: 'Đã gửi thông báo thử nghiệm tới thiết bị của bạn.' } };
      }
      if (url === '/push/iot-alert') {
        return { data: { dispatched: true, barnId: 11 } };
      }
      return { data: {} };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('urlBase64ToUint8Array converts Base64URL VAPID public key into 65-byte Uint8Array', () => {
    const bytes = urlBase64ToUint8Array(SAMPLE_VAPID_PUB);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });

  it('subscribeUserToPush registers /sw.js, fetches VAPID key, subscribes PushManager and persists via API', async () => {
    const { pushManager } = setupPushBrowserMocks({ permission: 'granted' });

    const res = await subscribeUserToPush();

    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(window.navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(api.get).toHaveBeenCalledWith('/push/vapid-public-key', { skipCache: true });
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1);

    const subscribeArgs = pushManager.subscribe.mock.calls[0][0];
    expect(subscribeArgs.userVisibleOnly).toBe(true);
    expect(subscribeArgs.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(subscribeArgs.applicationServerKey.length).toBe(65);

    expect(api.post).toHaveBeenCalledWith(
      '/push/subscribe',
      expect.objectContaining({
        endpoint: 'https://fcm.googleapis.com/fcm/send/mock-device-token',
        keys: expect.objectContaining({
          p256dh: SAMPLE_VAPID_PUB,
          auth: 'tBHItJI5svbpez7KI4CCXg',
        }),
      })
    );
    expect(res.subscribed).toBe(true);
  });

  it('unsubscribeUserFromPush unsubscribes browser PushManager and calls /api/push/unsubscribe', async () => {
    const mockUnsub = vi.fn().mockResolvedValue(true);
    setupPushBrowserMocks({
      permission: 'granted',
      existingSubscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/old-endpoint',
        unsubscribe: mockUnsub,
      },
    });

    const result = await unsubscribeUserFromPush();

    expect(mockUnsub).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/push/unsubscribe', {
      endpoint: 'https://fcm.googleapis.com/fcm/send/old-endpoint',
    });
    expect(result.subscribed).toBe(false);
  });

  it('throws clear Vietnamese error when Notification permission is denied', async () => {
    setupPushBrowserMocks({ permission: 'denied' });
    await expect(subscribeUserToPush()).rejects.toThrow(/chặn/i);
  });

  it('sendTestPushNotification triggers POST /api/push/test', async () => {
    const res = await sendTestPushNotification({ title: 'Thử nghiệm' });
    expect(api.post).toHaveBeenCalledWith('/push/test', { title: 'Thử nghiệm' });
    expect(res.sentCount).toBe(1);
  });

  it('Header Notification Bell renders Bật thông báo ĐT and Gửi thử controls and triggers subscribe/test on click', async () => {
    setupPushBrowserMocks({ permission: 'granted' });

    render(
      <MemoryRouter>
        <AuthProvider>
          <NotificationProvider>
            <FarmShiftLayout pageTitle="Tổng quan">
              <div>Content</div>
            </FarmShiftLayout>
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle('Thông báo hệ thống'));

    const toggleBtn = await screen.findByRole('button', { name: /Bật thông báo ĐT/i });
    const testBtn = screen.getByRole('button', { name: /Gửi thử/i });

    expect(toggleBtn).toBeEnabled();
    expect(testBtn).toBeEnabled();

    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/push/subscribe',
        expect.objectContaining({
          endpoint: 'https://fcm.googleapis.com/fcm/send/mock-device-token',
        })
      );
    });
    expect(await screen.findByRole('button', { name: /Đang bật thông báo ĐT/i })).toBeInTheDocument();

    fireEvent.click(testBtn);
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/push/test', {});
    });
  });

  it('IotView renders quick mobile push controls and dispatches /api/push/iot-alert on temperature breach', async () => {
    setupPushBrowserMocks({ permission: 'granted' });
    const publishRelay = vi.fn().mockResolvedValue(undefined);
    let receive;
    connectEsp32.mockImplementation(async ({ onConnection, onMessage }) => {
      receive = onMessage;
      onConnection('connected');
      return { disconnect: vi.fn(), publishRelay };
    });

    render(
      <MemoryRouter initialEntries={['/iot?barn=11']}>
        <AuthProvider>
          <NotificationProvider>
            <IotView />
          </NotificationProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const toggleBtn = await screen.findByRole('button', { name: /Bật thông báo ĐT/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi thử/i })).toBeInTheDocument();

    // Configure Fan automatic threshold & send high temperature from ESP32 sensors
    await screen.findByText('Đã kết nối thiết bị phần cứng');
    const group = screen.getByRole('switch', { name: 'Bật tắt toàn bộ Quạt gió' }).closest('article');
    group.querySelector('details').open = true;
    fireEvent.click(within(group).getByRole('button', { name: 'Chỉnh sửa' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Relay ESP32'), { target: { value: '1' } });
    fireEvent.click(within(dialog).getByLabelText('Điều khiển tự động'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thiết bị' }));

    act(() => {
      receive({ topic: `${ESP32_TOPIC_PREFIX}/temp1`, payload: '41' });
      receive({ topic: `${ESP32_TOPIC_PREFIX}/temp3`, payload: '43' });
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/push/iot-alert',
        expect.objectContaining({
          barnId: 11,
          severity: 'CRITICAL',
        })
      );
    });
  });
});
