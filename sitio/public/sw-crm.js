// ══ Service Worker del CRM (REGLA DE VELOCIDAD) ══
// - /_astro/*: cache-first — los nombres llevan hash, son inmutables. Una
//   visita repetida no toca la red para JS/CSS: el arranque se vuelve local.
// - HTML de /admin/crm: network-first con timeout de 2.5 s y fallback al
//   caché — la app abre aunque la red esté floja; la versión se refresca sola
//   en cuanto la red responde.
// - APIs: NO se tocan aquí (el SWR de sessionStorage ya las cubre y cachear
//   respuestas autenticadas en el SW sería un riesgo).
const VER = 'crm-sw-v1';
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
      try {
        const r = await Promise.race([
          fetch(e.request),
          new Promise((_, rej) => setTimeout(() => rej(new Error('lenta')), 2500)),
        ]);
        if (r.ok) cache.put('/admin/crm', r.clone());
        return r;
      } catch {
        const hit = await cache.match('/admin/crm');
        if (hit) return hit;
        return fetch(e.request);
      }
    })());
  }
});
