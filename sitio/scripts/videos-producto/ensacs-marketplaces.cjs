// Marketplaces (prototipo): pantallas de Canales de venta en la app
const f = require('./fid-comun.cjs');
const canal = async (r, nombre, esp) => {
  const p = r.p;
  if (!(await r.hayTexto('Regresar al menú'))) {
    await r.go('dashboard/list/index', 'Ingresos'); await p.waitForTimeout(2500); await f.promo(r);
    for (let i = 0; i < 3; i++) { try { await f.clic(r, 'Canales de venta', { xmax: 300 }); break; } catch (e) { if (i === 2) throw e; await p.mouse.click(32, (await p.evaluate(() => innerHeight)) - 25); await p.waitForTimeout(2000); } }
    await p.waitForTimeout(4000);
  }
  if (!(await r.hayTexto(esp))) { const [c, d] = await r.punto('Google My Business', { xmax: 300 }); await p.mouse.click(c, d); await p.waitForTimeout(5000); }
  const [a, b] = await r.punto(nombre, { xmax: 300 }); await p.mouse.click(a, b); await r.esperaTexto(esp, 120000); await p.waitForTimeout(5000);
};
module.exports = {
  slug: 'marketplaces', modulo: 'Canales de venta',
  nota: 'Capturas de Canales de venta en Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'mercadolibre', t: 'Mercado Libre', alt: 'Canal de Mercado Libre en Sacs: catálogo, pedidos y stock', maxAlto: 1500, abrir: async (r) => { await canal(r, 'MercadoLibre', 'Tus productos en el'); } },
    { id: 'shein', t: 'SHEIN', alt: 'Canal de SHEIN en Sacs: prendas, tallas y colores desde tu catálogo', maxAlto: 1500, abrir: async (r) => { await canal(r, 'SHEIN', 'Tu moda en SHEIN'); } },
    { id: 'liverpool', t: 'Liverpool', alt: 'Canal de Liverpool en Sacs: ropa, calzado y accesorios con tu catálogo', maxAlto: 1500, abrir: async (r) => { await canal(r, 'Liverpool', 'Vende en Liverpool'); } },
  ],
  pasos: [
    { p: 'mercadolibre', ancla: 'MARKETPLACES', minW: 200, t: 'Los marketplaces, en tu menú', d: 'Mercado Libre, Amazon, SHEIN, Liverpool y Google, en Canales de venta.' },
    { p: 'mercadolibre', ancla: 'Tus productos en el', minW: 600, t: 'Mercado Libre', d: 'Tu catálogo de Sacs con fotos, variantes, precios y stock.' },
    { p: 'shein', ancla: 'Tu moda en SHEIN', minW: 600, t: 'SHEIN', d: 'Tallas, colores y fotos salen de tu catálogo de Sacs.' },
    { p: 'liverpool', ancla: 'Vende en Liverpool', minW: 600, t: 'Liverpool', d: 'Ropa, calzado y accesorios frente a millones de clientes.' },
    { p: 'liverpool', ancla: 'Quiero saber más por WhatsApp', minW: 200, t: 'Te acompañamos a conectarlo', d: 'Lo platicas con un asesor por WhatsApp y lo conectamos contigo.' },
  ],
};
