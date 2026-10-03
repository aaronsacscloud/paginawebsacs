const f = require('./fid-comun.cjs');
const tab = async (r, t) => { await f.ir(r, 'Embudos y Campañas', 'Nueva campaña'); if (t) await f.clic(r, t, { ymin: 40, ymax: 200 }); await r.p.waitForTimeout(5000); for (const x of ['Collare nuevos', 'Cliente de collares']) await f.ocultarCaja(r, x, { min: 600, alto: 90 }); };
module.exports = {
  slug: 'marketing-por-correo', modulo: 'Embudos y Campañas',
  nota: 'Capturas del módulo de Embudos y Campañas de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'campanas', t: 'Campañas', alt: 'Campañas de correo en Sacs con avance de envío y ventas atribuidas', maxAlto: 1500, abrir: async (r) => { await tab(r, 'Campañas'); } },
    { id: 'segmentos', t: 'Segmentos', alt: 'Segmentos de clientes de moda en Sacs armados por comportamiento', maxAlto: 1000, abrir: async (r) => { await tab(r, 'Segmentos'); } },
    { id: 'plantillas', t: 'Plantillas', alt: 'Plantillas de correo de moda en Sacs', maxAlto: 1100, abrir: async (r) => { await tab(r, 'Plantillas'); } },
    { id: 'embudos', t: 'Embudos', alt: 'Embudos automáticos de correo en Sacs con disparador y clientes que compraron', maxAlto: 1000, abrir: async (r) => { await tab(r, 'Embudos'); } },
  ],
  pasos: [
    { p: 'campanas', ancla: 'CAMPAÑA', minW: 900, t: 'Cada campaña, con lo que vendió', d: 'Avance del envío y ventas atribuidas a cada correo.' },
    { p: 'segmentos', ancla: 'NOMBRE', minW: 900, t: 'Segmentos por lo que compran', d: 'Compró denim en 90 días, talla M sin compra, VIP de una tienda.' },
    { p: 'plantillas', ancla: 'NOMBRE', minW: 900, t: 'Plantillas con versiones', d: 'Nueva colección, rebajas, llegó tu talla: cada una con su historial.' },
    { p: 'embudos', ancla: 'Bienvenida a Polanco Club', minW: 900, t: 'Embudos que se disparan solos', d: 'Cliente nuevo, vuelta a stock, después de su compra.' },
    { p: 'embudos', ancla: 'COMPRARON', minW: 200, sube: 3, t: 'Cuántos compraron', d: 'Activos, completados y los que terminaron comprando.' },
  ],
};
