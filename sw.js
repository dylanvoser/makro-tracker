self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/.netlify/functions/')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
