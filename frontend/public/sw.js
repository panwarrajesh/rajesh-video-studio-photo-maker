// Minimal service worker: makes the app installable (Add to Home screen). No caching, so you never see stale builds.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
