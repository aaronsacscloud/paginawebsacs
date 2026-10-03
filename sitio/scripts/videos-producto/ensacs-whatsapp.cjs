const f = require('./fid-comun.cjs');
const notif = async (r, cats) => {
  await r.go('dashboard/list/index', 'Ingresos'); const p = r.p;
  if (!(await r.hayTexto('Cerrar sesión'))) { await p.mouse.click(32, 875); await p.waitForTimeout(1500); }
  const [x, y] = await r.punto('Configuración'); await p.mouse.click(x, y); await r.esperaTexto('Configuración y personalización'); await p.waitForTimeout(4000);
  await f.clic(r, 'Notificaciones', { xmax: 300, ymin: 150, ymax: 500 }); await r.esperaTexto('Notificaciones automáticas', 60000); await p.waitForTimeout(4000);
  // cerrar Punto de Venta y abrir las categorías pedidas
  try { await f.clic(r, 'Punto de Venta', { xmin: 300 }); } catch (e) {}
  for (const c of cats) { await f.clic(r, c, { xmin: 300 }); await p.waitForTimeout(2500); }
  for (const t of ['Suite Joyería', 'Órdenes de servicio', 'Conteo por zona · Accesorios de notificaciones (arquitectura)']) await f.ocultarCaja(r, t, { min: 400, max: 1000, alto: 600 });
  await f.ocultarCaja(r, 'UNKNOWN', { min: 0, max: 120, alto: 30 }); await f.reemplazar(r, [[' (vía Kapso)', ''], ['(vía Kapso)', '']]);
  await f.aislar(r, 'Notificaciones automáticas', 600, 700); await p.waitForTimeout(1500);
};
module.exports = {
  slug: 'marketing-por-whatsapp', modulo: 'Notificaciones',
  nota: 'Capturas de las notificaciones automáticas de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'lealtad', t: 'Notificaciones · Lealtad', alt: 'Notificaciones automáticas de lealtad en Sacs por WhatsApp y correo', maxAlto: 2100, abrir: async (r) => { await notif(r, ['Lealtad']); } },
    { id: 'apartados', t: 'Notificaciones · Pedidos', alt: 'Notificaciones automáticas de pedidos en Sacs por WhatsApp y correo', maxAlto: 1500, abrir: async (r) => { await notif(r, ['Pedidos']); } },
  ],
  pasos: [
    { p: 'lealtad', ancla: 'Notificaciones', minW: 600, sube: 2, t: 'WhatsApp y correo, por evento', d: 'Cada aviso a tus clientas con su canal: lo activas o lo pruebas.' },
    { p: 'lealtad', ancla: 'Bienvenida al programa', minW: 500, t: 'Bienvenida al programa', d: 'Al unirse, tu clienta recibe su aviso por WhatsApp y por correo.' },
    { p: 'lealtad', ancla: 'Cashback / monedero abonado', minW: 500, t: 'Cashback abonado', d: 'Se entera en el momento en que le cae saldo en su monedero.' },
    { p: 'lealtad', ancla: 'Subiste de nivel', minW: 500, t: 'Subiste de nivel', d: 'El aviso sale solo cuando sube de nivel en el programa.' },
    { p: 'apartados', ancla: 'Pedido confirmado', minW: 500, t: 'Pedido confirmado', d: 'Plantilla aprobada por Meta: tú solo la activas o mandas una prueba.' },
    { p: 'apartados', ancla: 'Pedido preparado', minW: 500, t: 'Listo para recoger', d: 'Cuando el pedido está preparado, tu clienta lo sabe sin que nadie le escriba.' },
  ],
};
