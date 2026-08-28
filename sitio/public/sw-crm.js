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
      const red = fetch(e.request).then(async (r) => {
        if (!r.ok) return r;
        // ¿La versión de red es OTRA? Entonces el usuario está viendo la de
        // ayer: se le avisa a la app para que se refresque cuando pueda. Sin
        // esto, un cambio desplegado tarda en aparecer y parece que no se hizo.
        try {
          const nuevo = (await r.clone().text()).match(/CrmDashboard\.[A-Za-z0-9_-]+\.js/);
          const viejo = hit ? (await hit.clone().text()).match(/CrmDashboard\.[A-Za-z0-9_-]+\.js/) : null;
          if (nuevo && viejo && nuevo[0] !== viejo[0]) {
            const wins = await self.clients.matchAll({ type: 'window' });
            wins.forEach(w => w.postMessage({ tipo: 'crm-version-nueva' }));
          }
        } catch (_) { /* comparar es un lujo, no un requisito */ }
        cache.put('/admin/crm', r.clone());
        return r;
      });
      if (hit) { e.waitUntil(red.catch(() => {})); return hit; }
      try { return await red; } catch { return fetch(e.request); }
    })());
  }
});

// ══ Avisos push del CRM ═══════════════════════════════════════════════════
// Un lead nuevo llega por WhatsApp al equipo, pero ahí compite con cientos de
// mensajes. El push suena como lo que es —algo que atender ahora— y al tocarlo
// abre el lead, no la portada.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: (e.data && e.data.text()) || 'SACS' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'SACS CRM', {
    body: d.body || '',
    icon: '/crm-icon-192.png',
    badge: '/crm-icon-192.png',
    tag: d.tag || 'crm',
    renotify: true,
    data: { url: d.url || '/admin/crm', ...(d.data || {}) },
    requireInteraction: !!d.requireInteraction,
    vibrate: [160, 70, 160],
  }));
  // E7.2 · El ícono de la PWA lleva el número: al llegar un aviso con la app
  // cerrada, el badge sube; el inbox lo pone en su valor real al abrirse.
  e.waitUntil((async () => {
    try {
      if (!self.registration.getNotifications) return;
      const n = await self.registration.getNotifications();
      if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(n.length || 1);
    } catch (_) { /* navegador sin badge */ }
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/admin/crm';
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Si el CRM ya está abierto se reutiliza esa ventana: abrir una segunda
    // pestaña del mismo inbox es justo lo que desordena el trabajo.
    const abierta = wins.find(w => w.url.includes('/admin/crm'));
    if (abierta) { await abierta.focus(); return abierta.navigate(url).catch(() => abierta.postMessage({ tipo: 'ir', url })); }
    return clients.openWindow(url);
  })());
});
