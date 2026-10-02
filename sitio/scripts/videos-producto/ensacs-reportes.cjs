const c = require('./rep-comun.cjs');
module.exports = {
  slug: 'reportes-y-analitica', modulo: 'Reportes', ocultar: ['Alimentos y Bebidas'],
  nota: 'Capturas de los reportes de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'hub', t: 'Tus reportes a un clic', alt: 'Centro de reportes de Sacs: preguntas frecuentes y reportes por área', maxAlto: 1500, abrir: async (r) => { await c.abrirHub(r); } },
    { id: 'categoria', t: 'Ventas por talla', alt: 'Ventas por talla en Sacs de los últimos 7 días', maxAlto: 1500, abrir: async (r) => { await c.ventas(r, 'variante3'); } },
    { id: 'producto', t: 'Ventas por producto', alt: 'Reporte de ventas por prenda en Sacs con foto, SKU, fecha y vendedor', maxAlto: 1300, abrir: async (r) => { await c.abrirHub(r); { const [x, y] = await r.punto('Reporte de Ventas por producto', { xmin: 330, ymax: 860 }); await r.p.mouse.click(x, y); } await r.p.waitForTimeout(15000); } },
  ],
  pasos: [
    { p: 'hub', ancla: 'faltantes de caja', minW: 700, t: 'Pregunta en tus palabras', d: 'Faltantes de caja, quién me debe, qué no se vende: un clic y abre el reporte.' },
    { p: 'hub', ancla: 'ACCESOS RÁPIDOS', minW: 900, sube: 3, t: 'Tus reportes de siempre, a un clic', d: 'Análisis de inventario, cortes de caja, análisis de ventas y vendedores.' },
    { p: 'categoria', ancla: 'SUCURSAL', minW: 900, t: 'Arma el reporte en cuatro pasos', d: 'Sucursal, cómo agrupar, qué medir y el periodo. Y lo comparas.' },
    { p: 'categoria', ancla: 'TOTALES', minW: 900, sube: 4, t: 'Día por día, con su ganancia', d: 'Piezas, ventas, impuestos, costo y ganancia de cada día del periodo.' },
    { p: 'categoria', ancla: 'Generar reporte', minW: 900, sube: 6, t: 'Qué categoría vende más', d: 'Agrupa por categoría, marca, talla, color, ocasión o estilo.' },
    { p: 'producto', ancla: 'Nombre del producto', minW: 900, t: 'Cada prenda vendida', d: 'Foto, SKU, fecha, origen y vendedor de cada línea; a Excel con un clic.' },
  ],
};
