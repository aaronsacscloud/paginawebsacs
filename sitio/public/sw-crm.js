// ══ Service Worker del CRM (REGLA DE VELOCIDAD) ══
// - /_astro/*: cache-first — los nombres llevan hash, son inmutables. Una
//   visita repetida no toca la red para JS/CSS: el arranque se vuelve local.
// - HTML de /admin/crm: STALE-WHILE-REVALIDATE — se sirve el caché al
//   instante (el TTFB de la función serverless, 300-500 ms, sale del camino
//   crítico de TODAS las pantallas) y la red refresca el caché detrás; la
//   siguiente navegación ya trae la versión nueva. Los assets con hash del
//   HTML viejo siguen servibles porque /_astro/* es cache-first.
// - APIs: NO se tocan aquí (el SWR de sessionStorage ya las cubre y cachear
//   respuestas autenticadas en el SW sería un riesgo).
const VER = 'crm-sw-v2';
const RE_ASSET = /\/_astro\/.+\.(js|css|woff2?)$/;

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VER) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (RE_ASSET.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(VER);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    })());
    return;
  }

  if (url.pathname === '/admin/crm') {
    e.respondWith((async () => {
      const cache = await caches.open(VER);
      const hit = await cache.match('/admin/crm');
      const red = fetch(e.request).then(r => {
        if (r.ok) cache.put('/admin/crm', r.clone());
        return r;
      });
      if (hit) { e.waitUntil(red.catch(() => {})); return hit; }
      try { return await red; } catch { return fetch(e.request); }
    })());
  }
});
