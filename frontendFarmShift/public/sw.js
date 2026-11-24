/* FarmShift PWA Service Worker - Web Push Notifications (RFC 8030 / VAPID) */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'FarmShift · Cảnh báo trang trại',
    body: 'Bạn có một thông báo mới từ hệ thống FarmShift.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'farmshift-alert',
    url: '/iot',
    severity: 'INFO',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = { ...payload, ...parsed };
      }
    } catch {
      const text = event.data.text();
      if (text) {
        payload.body = text;
      }
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/favicon.png',
    badge: payload.badge || '/favicon.png',
    tag: payload.tag || 'farmshift-alert',
    renotify: true,
    vibrate: [200, 100, 200, 100, 300],
    requireInteraction: payload.severity === 'CRITICAL',
    data: {
      url: payload.url || '/iot',
    },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'FarmShift · Thông báo', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification?.data?.url || '/iot';
  const targetUrl = typeof rawUrl === 'string' && rawUrl.startsWith('/') && !rawUrl.startsWith('//') ? rawUrl : '/iot';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus().catch(() => {});
          if ('navigate' in client) {
            await client.navigate(targetUrl).catch(() => {});
          } else if ('postMessage' in client) {
            client.postMessage({ type: 'FARMSHIFT_NAVIGATE', url: targetUrl });
          }
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});
