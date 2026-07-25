// SpotGH Service Worker — v3 (caching + push notifications)
const CACHE = 'sgh-v4';
const STATIC = ['/', '/assets/css/styles.css', '/assets/js/api.js', '/assets/js/auth.js', '/assets/js/main.js', '/assets/js/theme.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
  if (new URL(e.request.url).origin !== self.location.origin) return; // let cross-origin CDN requests go straight to network, untouched by the SW
  e.respondWith(
    fetch(e.request).then(r => {
      const toCache = (r && r.status === 200 && r.type !== 'opaque') ? r.clone() : null; // clone synchronously, before the body can be consumed elsewhere
      if (toCache) caches.open(CACHE).then(c => c.put(e.request, toCache));
      return r;
    }).catch(() => caches.match(e.request).then(cached => cached || Response.error()))
  );
});

// ── Push Notifications
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const title = data.title || 'SpotGH';
  const options = {
    body: data.body || data.message || '',
    icon: data.icon || '/assets/images/icon-192.png',
    badge: '/assets/images/badge-72.png',
    data: { url: data.url || '/' },
    actions: data.actions || [],
    tag: data.tag || 'sgh-notification',
    renotify: true,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
