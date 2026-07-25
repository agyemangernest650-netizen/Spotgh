// sw-push.js — minimal push notification service worker
self.addEventListener('push', (event) => {
  let data = { title: 'SpotGH', body: 'You have a new notification', url: '/' };
  try { data = event.data.json(); } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/img/icon-192.png',
      badge: '/assets/img/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
