// NOVA Guided Navigation Lite application shell cache.  It caches only public
// static files; API responses, routes, GPS data and Captain data never enter
// this cache.  This makes a weak connection friendlier without claiming fully
// offline maps or retaining location data.
const CACHE_NAME = 'spnx-nav-lite-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/spnx-splash-symbol-v3.webp'];

async function cacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('spnx-nav-lite-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response?.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match('/index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response?.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith('/assets/') || /\.(?:css|js|mjs|png|jpe?g|webp|svg|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
