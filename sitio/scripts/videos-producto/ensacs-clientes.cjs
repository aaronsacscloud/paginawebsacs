const f = require('./fid-comun.cjs');
const ficha = async (r) => { await f.ir(r, 'Clientes', 'Nuevo cliente'); await f.escribir(r, 'Buscar por nombre', 'Ximena'); await r.p.keyboard.press('Enter'); await r.esperaTexto('Ximena Ochoa', 60000); await f.clic(r, 'Ximena Ochoa'); await r.esperaTexto('$24,703', 120000); await r.p.waitForTimeout(6000); };
module.exports = {
  slug: 'clientes-y-crm', modulo: 'Clientes',
  nota: 'Capturas del módulo de Clientes de Sacs (octubre de 2026) con una boutique de ejemplo y clientes ficticios.',
  pantallas: [
    { id: 'lista', t: 'Clientes', alt: 'Lista de clientes en Sacs con contacto, sucursal, etiquetas, ventas, nivel de lealtad y cashback', maxAlto: 1500, abrir: async (r) => { await f.ir(r, 'Clientes', 'Nuevo cliente'); await f.clic(r, 'Lealtad', { ymin: 150, ymax: 500 }); await r.p.waitForTimeout(5000); for (const n of f.reales()) await f.ocultarCaja(r, n, { min: 900, alto: 90 }); } },
    { id: 'ficha', t: 'Ficha del cliente', alt: 'Ficha de una clienta en Sacs: total gastado, compras, ticket promedio, monedero, membresía y última actividad', maxAlto: 1430, abrir: ficha },
    { id: 'productos', t: 'Productos más vendidos', alt: 'Prendas que más compra una clienta en Sacs, con foto, SKU, unidades e ingreso', maxAlto: 1600, abrir: async (r) => { await ficha(r); await f.clic(r, 'Productos más vendidos', { ymin: 40, ymax: 200 }); await r.p.waitForTimeout(6000); } },
  ],
  pasos: [
    { p: 'lista', ancla: 'CLIENTE', minW: 1000, t: 'Toda tu clientela, en una lista', d: 'Contacto, sucursal, etiquetas, cuánto ha comprado y cuándo fue la última vez.' },
    { p: 'lista', ancla: 'LEALTAD', minW: 200, t: 'Nivel y cashback a la vista', d: 'Puntos, nivel y saldo del monedero de cada clienta, sin abrir su ficha.' },
    { p: 'ficha', ancla: 'Ximena Ochoa Barrera', minW: 800, t: 'Una ficha por clienta', d: 'Sus datos, su sucursal y sus etiquetas: talla, gustos y si es VIP.' },
    { p: 'ficha', ancla: 'TOTAL GASTADO', minW: 900, t: 'Cuánto vale tu clienta', d: 'Total gastado, número de compras, ticket promedio y saldo del monedero.' },
    { p: 'ficha', ancla: 'Club Atelier', minW: 600, t: 'Su membresía, a la vista', d: 'Plan, vigencia y cuántos beneficios ha usado.' },
    { p: 'productos', ancla: 'Jean barrel', minW: 900, t: 'Lo que más se lleva', d: 'Las prendas que más compra, con foto, SKU y unidades, para recomendarle lo correcto.' },
  ],
};
