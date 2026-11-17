// src/services/webPushClient.js
// W3C Web Push + VAPID Service Worker Client Utility for FarmShift PWA
import { api } from '../utils/api';

const SW_PATH = '/sw.js';

/**
 * Converts a Base64URL VAPID public key string into a Uint8Array expected by PushManager.
 */
export function urlBase64ToUint8Array(base64String) {
  const clean = String(base64String || '').trim();
  const padding = '='.repeat((4 - (clean.length % 4)) % 4);
  const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isWebPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isIosSafariNeedingInstall() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(ua);
  if (!isIos) return false;
  const isStandalone = Boolean(window.navigator.standalone)
    || Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches);
  return !isStandalone;
}

export async function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  if (navigator.serviceWorker.ready) {
    try {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch {
      // Ignore ready race failures; registration object is still usable.
    }
  }
  return registration;
}

export async function getLocalPushSubscription() {
  if (!isWebPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration?.(SW_PATH)
      || await navigator.serviceWorker.getRegistration?.('/');
    if (!existing?.pushManager) return null;
    return await existing.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function getPushStatus() {
  const [serverRes, localSub] = await Promise.all([
    api.get('/push/status', { skipCache: true }),
    getLocalPushSubscription(),
  ]);
  const serverData = serverRes?.data || {};
  return {
    hasActiveSubscription: Boolean(serverData.hasActiveSubscription),
    deviceCount: Number(serverData.deviceCount || 0),
    localSubscribed: Boolean(localSub),
    endpoint: localSub?.endpoint || null,
  };
}

export async function subscribeUserToPush() {
  if (!isWebPushSupported()) {
    throw new Error('Trình duyệt hiện tại không hỗ trợ thông báo đẩy Web Push (cần HTTPS hoặc Chrome/Safari PWA).');
  }

  const permission = await window.Notification.requestPermission();
  if (permission === 'denied') {
    throw new Error('Quyền thông báo đã bị chặn trên trình duyệt. Hãy bật lại trong cài đặt trang web.');
  }
  if (permission !== 'granted') {
    throw new Error('Bạn cần cấp quyền thông báo để nhận cảnh báo về điện thoại.');
  }

  const registration = await registerServiceWorker();
  if (!registration?.pushManager) {
    throw new Error('Không thể khởi tạo Service Worker nhận thông báo đẩy.');
  }

  const keyRes = await api.get('/push/vapid-public-key', { skipCache: true });
  const publicKey = keyRes?.data?.publicKey;
  if (!publicKey) {
    throw new Error('Máy chủ chưa cung cấp khóa công khai VAPID.');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
  const payload = {
    endpoint: json?.endpoint || subscription.endpoint,
    keys: {
      p256dh: json?.keys?.p256dh,
      auth: json?.keys?.auth,
    },
    userAgent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 500) : '',
  };

  const res = await api.post('/push/subscribe', payload);
  return {
    ...(res?.data || { subscribed: true }),
    endpoint: payload.endpoint,
  };
}

export async function unsubscribeUserFromPush() {
  const localSub = await getLocalPushSubscription();
  const endpoint = localSub?.endpoint || null;

  if (localSub) {
    try {
      await localSub.unsubscribe();
    } catch {
      // Continue notifying backend even if browser-side unsubscribe was already cleared.
    }
  }

  if (endpoint) {
    await api.post('/push/unsubscribe', { endpoint });
  }
  return { subscribed: false };
}

export async function sendTestPushNotification(customPayload = {}) {
  const res = await api.post('/push/test', customPayload);
  return res?.data || { sentCount: 0, message: '' };
}

export async function dispatchBarnIotAlert({ barnId, title, body, severity = 'CRITICAL' }) {
  if (!barnId) return null;
  const res = await api.post('/push/iot-alert', { barnId, title, body, severity });
  return res?.data || null;
}

/**
 * Local fallback bridge: if the app is open with granted Notification permission
 * and a warning/IoT alert fires while background push isn't registered yet, show via SW.
 */
export async function showLocalSwNotification({
  title = 'FarmShift · Cảnh báo',
  body = '',
  url = '/iot',
  tag = 'farmshift-local-alert',
  severity = 'WARN',
} = {}) {
  if (typeof window === 'undefined' || !('Notification' in window) || window.Notification.permission !== 'granted') {
    return false;
  }
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration?.(SW_PATH)
      || await registerServiceWorker();
    if (!registration?.showNotification) return false;
    await registration.showNotification(title, {
      body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag,
      renotify: true,
      requireInteraction: severity === 'CRITICAL',
      data: { url },
    });
    return true;
  } catch {
    return false;
  }
}
