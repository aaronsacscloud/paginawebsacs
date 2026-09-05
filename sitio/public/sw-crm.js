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
// v3: sube A PROPÓSITO para que el `activate` borre el caché v2. Los teléfonos
// que hoy tienen guardada una versión vieja del HTML —por el bug del clon que
// impedía avisar— la sueltan en el primer arranque tras este despliegue, sin
// que nadie tenga que reinstalar la app.
const VER = 'crm-sw-v4';   // v4: purga los assets viejos al detectar build nuevo
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
      // ⚠️ El clon se saca AQUÍ, antes de entregarle `hit` al navegador.
      // Clonarlo después —que es lo que se hacía— revienta con "body already
      // used": en cuanto se devuelve `hit`, el navegador empieza a leer su
      // cuerpo y ya no se puede clonar. El error caía en el catch de abajo, que
      // lo daba por "un lujo", así que el aviso de versión nueva NUNCA se
      // mandaba y la PWA se quedaba con la versión de ayer para siempre.
      // Verificado envenenando el caché a mano: sin este cambio, cero avisos.
      const clonVieja = hit ? hit.clone() : null;
      const red = fetch(e.request).then(async (r) => {
        if (!r.ok) return r;
        // ¿La versión de red es OTRA? Entonces el usuario está viendo la de
        // ayer: se le avisa a la app para que se refresque cuando pueda. Sin
        // esto, un cambio desplegado tarda en aparecer y parece que no se hizo.
        try {
          const nuevo = (await r.clone().text()).match(/CrmDashboard\.[A-Za-z0-9_-]+\.js/);
          const viejo = clonVieja ? (await clonVieja.text()).match(/CrmDashboard\.[A-Za-z0-9_-]+\.js/) : null;
          if (nuevo && viejo && nuevo[0] !== viejo[0]) {
            /* HAY VERSIÓN NUEVA → SE TIRAN LOS ASSETS VIEJOS.
               Los /_astro/* son inmutables y se guardaban para siempre. El
               problema no es el espacio: es que el HTML viejo y los chunks
               viejos conviven con los nuevos, y basta que UN chunk viejo ya no
               exista en el servidor para que su pantalla no cargue —se ve el
               velo del panel y ningún panel—. Pasó con el menú del inbox.
               Se borran en cuanto se detecta build nuevo, no al recargar: si
               se espera, la siguiente pantalla que se abra puede pedir
               justamente el chunk muerto. Volver a bajarlos cuesta un viaje;
               una pantalla en blanco cuesta la confianza. */
            const c = await caches.open(VER);
            for (const req of await c.keys()) {
              if (RE_ASSET.test(new URL(req.url).pathname)) await c.delete(req);
            }
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

// ══ Apagar un aviso al LEERLO dentro de la app ════════════════════════════
// El push se queda en la pantalla de bloqueo hasta que alguien lo toca. Si
// abriste el hilo desde el CRM y ya leíste el mensaje, ese aviso ya no es un
// aviso: es basura que te hace revisar dos veces lo mismo.
// La app manda {tipo:'cerrar-aviso', tag} al abrir una conversación o un canal,
// y aquí se cierran las notificaciones de ese tag. El badge se recalcula con lo
// que quede.
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.tipo !== 'cerrar-aviso' || !d.tag) return;
  e.waitUntil((async () => {
    try {
      if (!self.registration.getNotifications) return;
      const ns = await self.registration.getNotifications({ tag: d.tag });
      ns.forEach(n => n.close());
      const quedan = await self.registration.getNotifications();
      if (self.navigator && self.navigator.setAppBadge) {
        if (quedan.length) await self.navigator.setAppBadge(quedan.length);
        else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
      }
    } catch (_) { /* navegador sin soporte: el aviso se queda, no pasa nada grave */ }
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
