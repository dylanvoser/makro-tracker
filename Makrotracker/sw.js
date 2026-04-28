// Minimal service worker - nur für PWA Install, kein Caching das externe Requests blockiert
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
// Kein fetch handler - lässt alle Requests normal durch
