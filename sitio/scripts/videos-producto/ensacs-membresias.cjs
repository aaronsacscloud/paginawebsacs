const f = require('./fid-comun.cjs');
const abrirM = async (r, tab) => { await f.ir(r, 'Membresías', 'Nuevo plan'); if (tab) await f.clic(r, tab, { ymin: 60, ymax: 200, xmin: 100 }); await r.p.waitForTimeout(4000); };
module.exports = {
  slug: 'membresias-y-suscripciones', modulo: 'Membresías',
  nota: 'Capturas del módulo de Membresías de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'planes', t: 'Planes', alt: 'Planes de membresía de moda en Sacs con precio mensual y anual y beneficios contados', maxAlto: 1000, abrir: async (r) => { await abrirM(r); } },
    { id: 'membresias', t: 'Membresías', alt: 'Membresías vendidas en Sacs con clienta, plan, vigencia y consumo de beneficios', maxAlto: 1400, abrir: async (r) => { await abrirM(r, 'Membresías'); } },
    { id: 'tablero', t: 'Tablero', alt: 'Tablero de membresías en Sacs: ingresos, activas, renovaciones, utilización y rentabilidad', maxAlto: 1700, abrir: async (r) => { await abrirM(r, 'Tablero'); await f.clic(r, 'Este año'); await r.p.waitForTimeout(5000); await f.reemplazar(r, [['al joyero', 'al taller']]); } },
  ],
  pasos: [
    { p: 'planes', ancla: 'Club Atelier', minW: 250, t: 'Planes con beneficios contados', d: 'Ajustes de bastilla, vaporizado o styling: cuántos incluye cada plan.' },
    { p: 'planes', ancla: 'Club Gala', minW: 250, t: 'Precio mensual o anual', d: 'Cada plan con su precio por mes y por año, para venderlo en tienda y en línea.' },
    { p: 'membresias', ancla: 'Ximena', minW: 1000, t: 'Cada membresía, con su vigencia', d: 'Quién la tiene, qué plan, cuándo vence y cuánto ha usado.' },
    { p: 'tablero', ancla: 'INGRESOS', minW: 1100, t: 'Activas, por vencer y canceladas', d: 'Ingresos del año, membresías vigentes por plan y renovaciones próximas.' },
    { p: 'tablero', ancla: 'VALOR VENDIDO', minW: 1000, t: 'Lo vendido contra lo consumido', d: 'Cuánto se ha cobrado, cuánto se ha usado y cuánto falta por consumir.' },
    { p: 'tablero', ancla: 'Rentabilidad de las membresías', minW: 1000, t: 'Si el programa deja dinero', d: 'Cobrado contra el costo real de los servicios: utilidad y margen.' },
  ],
};
