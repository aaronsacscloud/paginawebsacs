const c = require('./conteo-comun.cjs');
module.exports = {
  slug: 'conteo-fisico', modulo: 'Conteo físico',
  nota: 'Capturas del módulo Conteo físico de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'lista', t: 'Conteo físico', alt: 'Lista de conteos físicos en Sacs con su estado', maxAlto: 1300, abrir: async (r) => { await c.abrirConteos(r); } },
    { id: 'resumen', t: 'Resumen de conteo', alt: 'Resumen de un conteo en Sacs: cada prenda con su foto, existencia, contado y diferencia en piezas y en pesos', maxAlto: 1500,
      abrir: async (r) => { await c.abrirConteos(r); const [x, y] = await r.punto('CON - 23'); await r.p.mouse.click(x, y); await c.listo(r, 'Resumen de Conteo'); } },
    { id: 'analisis', t: 'Análisis de conteos', alt: 'Análisis de conteos en Sacs: faltante, exactitud, tendencia por mes, faltante por categoría y prendas reincidentes', maxAlto: 3600,
      abrir: async (r) => { await c.abrirConteos(r); const [x, y] = await r.punto('Análisis'); await r.p.mouse.click(x, y); await c.listo(r, 'VALOR FALTANTE'); await r.p.waitForTimeout(2500); } },
  ],
  pasos: [
    { p: 'lista', ancla: 'Todas', minW: 900, t: 'Todos tus conteos, con su estado', d: 'Pendientes y completados, por tienda y almacén. Exporta la lista a Excel.' },
    { p: 'resumen', ancla: 'No coinciden', minW: 1000, t: 'Lo que no cuadra, en piezas y en pesos', d: 'Un clic y te quedas solo con las prendas con diferencia: −21 piezas, −$17,650.' },
    { p: 'resumen', ancla: 'Blusa cuello alto', minW: 1000, t: 'Cada prenda con su foto, talla y color', d: 'Existencia del sistema contra lo contado, y lo que vale cada diferencia.' },
    { p: 'analisis', ancla: 'VALOR FALTANTE', minW: 1100, t: 'Cuánto pierdes, de un vistazo', d: 'Faltante, sobrantes y exactitud de todos tus conteos del periodo.' },
    { p: 'analisis', ancla: 'Faltante por categoría', minW: 500, t: 'Dónde se va el dinero', d: 'Pantalones, camisetas, bufandas: el faltante por categoría y por tienda.' },
    { p: 'analisis', ancla: 'Productos que requieren supervisión', minW: 1100, t: 'Las prendas que faltan una y otra vez', d: 'Con un clic armas un conteo parcial solo con ellas.' },
  ],
};
