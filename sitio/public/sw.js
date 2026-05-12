// SACS Partner Portal · Service Worker
// - Cache shell del portal para uso offline
// - Network-first para APIs (siempre fresco si hay red, fallback a cache)
// - Push notifications handler

const VERSION = 'sacs-portal-v1.0.0';
const SHELL_CACHE = `shell-${VERSION}`;
const API_CACHE = `api-${VERSION}`;
const OFFLINE_URL = '/partner/portal';

// Assets críticos del shell — se cachean al instalar
const SHELL_ASSETS = [
  '/partner/portal',
  '/portal-manifest.json',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // Cache shell. Si alguno falla, no rompemos.
      return Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo manejamos GET del mismo origen
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // API requests: network-first con fallback a cache
  if (url.pathname.startsWith('/api/partner-portal/')) {
    event.respondWith(networkFirstApi(req));
    return;
  }

  // Assets del portal: cache-first con fallback de red
  if (
    url.pathname.startsWith('/partner/portal') ||
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname === '/portal-manifest.json' ||
    url.pathname === '/favicon.svg'
  ) {
    event.respondWith(cacheFirstShell(req));
    return;
  }

  // Default: red normal, sin cache
});

async function networkFirstApi(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirstShell(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Background refresh
    fetch(request).then((fresh) => {
      if (fresh.ok) {
        caches.open(SHELL_CACHE).then((cache) => cache.put(request, fresh.clone()).catch(() => {}));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_e) {
    const fallback = await caches.match(OFFLINE_URL);
    if (fallback) return fallback;
    return new Response('Sin conexión', { status: 503 });
  }
}

// ─── Push notifications ─────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch (_e) { data = { title: event.data?.text() || 'SACS' }; }

  const title = data.title || 'SACS Partner';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || 'sacs-default',
    data: { url: data.url || '/partner/portal', ...data.data },
    requireInteraction: !!data.requireInteraction,
    vibrate: [180, 80, 180],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/partner/portal';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // Si ya hay una ventana del portal abierta, fócala
      const portal = wins.find((w) => w.url.includes('/partner/portal'));
      if (portal) {
        portal.focus();
        portal.navigate(url).catch(() => portal.postMessage({ type: 'navigate', url }));
        return;
      }
      return clients.openWindow(url);
    })
  );
});
