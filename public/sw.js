const CACHE_NAME = 'kitchen-companion-v4';
const ASSET_CACHE = 'kitchen-companion-assets-v4';
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const appUrl = (path = '') => `${BASE_PATH}/${path.replace(/^\//, '')}`;

const PRECACHE_URLS = [appUrl(), appUrl('index.html')];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Don't cache Supabase API or external requests
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/functions/')
  ) {
    return;
  }

  // For JS/CSS/image assets: cache-first (they're immutable after build)
  if (
    url.pathname.startsWith(appUrl('assets/')) ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.avif') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  // For navigation/HTML: network-first, fall back to cached shell
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match(appUrl())))
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data
    ? event.data.json()
    : { title: 'Kitchen Companion', body: 'Check your expiring items!' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: appUrl('icons/icon-192.png'),
      badge: appUrl('icons/icon-192.png'),
      tag: 'expiry-reminder',
      data: { url: data.url ? appUrl(data.url) : appUrl('use-soon') },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || appUrl('use-soon')));
});
