// RVS service worker: app shell works offline (Photo Video Maker runs without internet once loaded). API and uploads are never cached.
const V = 'rvs-v2';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(['/', '/offline.html', '/manifest.webmanifest', '/icon-192.png'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api') || u.pathname.startsWith('/uploads')) return;
  if (r.mode === 'navigate') { // pages: network first (so updates show up), cached app shell when offline
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put('/', copy)); } return res; }).catch(() => caches.match('/').then((hit) => hit || caches.match('/offline.html'))));
    return;
  }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok && u.pathname.startsWith('/assets/')) { const copy = res.clone(); caches.open(V).then((c) => c.put(r, copy)); } return res; })));
});
