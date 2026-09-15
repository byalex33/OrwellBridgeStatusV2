/* Network only: never cache traffic pages or API responses. */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#182b46"><title>Offline | Orwell Bridge Status</title>
<style>body{margin:0;background:#f5f7fa;color:#182b46;font:18px/1.6 system-ui}main{max-width:32rem;margin:15vh auto;padding:24px}a{display:inline-block;color:inherit;padding:12px 0}</style></head>
<body><main><h1>You’re offline</h1><p>Current bridge conditions are unavailable. Connect to the internet and try again before planning your crossing.</p><a href="/">Try again</a></main></body></html>`, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })));
});


self.addEventListener('push', event => {
  let data;
  try { data = event.data?.json(); } catch { return; }
  if (!data || typeof data.id !== 'string' || !/^[a-zA-Z0-9:_-]{1,160}$/.test(data.id) || typeof data.title !== 'string' || !data.title.trim() || data.title.length > 120 || typeof data.body !== 'string' || !data.body.trim() || data.body.length > 500 || data.url !== '/?notification=bridge-closure') return;
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: `bridge-closure-${data.id}`,
    icon: '/icon-192.png',
    data: { url: '/?notification=bridge-closure' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/?notification=bridge-closure'));
});
