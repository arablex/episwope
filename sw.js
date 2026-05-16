const CACHE = 'episwope-v3';   // bump → landing/app split, old cache cleared
const SHELL = [
  '/',
  '/ru/',
  '/app.html',
  '/ru/app.html',
  '/globe.js',
  '/manifest.json',
  '/icon.svg',
];

// Always fetch fresh (landing, app, critical JS) — never serve stale
const NET_FIRST = new Set(['/', '/ru/', '/app.html', '/ru/app.html', '/globe.js']);

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;
  if (e.request.method !== 'GET') return;

  if (NET_FIRST.has(url.pathname)) {
    // Network-first: всегда свежий JS и HTML, при ошибке — кеш
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && res.type === 'basic') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first для иконок, манифеста и прочего статика
    e.respondWith(
      caches.match(e.request).then(cached => {
        const net = fetch(e.request).then(res => {
          if (res.ok && res.type === 'basic') {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        });
        return cached || net;
      })
    );
  }
});

// ── Push: show notification ───────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'EpiScope', body: 'New outbreak alert', url: '/' };
  try { data = { ...data, ...e.data.json() }; } catch (_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icon.svg',
      badge:   '/icon.svg',
      tag:     data.tag || 'episwope-alert',
      data:    { url: data.url },
      vibrate: [200, 100, 200],
      actions: [{ action: 'view', title: 'View' }],
    })
  );
});

// ── Notification click: focus or open app ────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const match = cs.find(c => new URL(c.url).pathname === target);
      if (match) return match.focus();
      return clients.openWindow(target);
    })
  );
});
