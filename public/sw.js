self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open('mekaerp-v1')
      .then((cache) =>
        cache.addAll([
          '/',
          '/login',
          '/pos',
          '/offline.html',
          '/manifest.webmanifest',
          '/icon.svg',
        ])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((k) => (k === 'mekaerp-v1' ? Promise.resolve() : caches.delete(k))))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open('mekaerp-v1').then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icon')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open('mekaerp-v1').then((cache) => cache.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open('mekaerp-v1').then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
