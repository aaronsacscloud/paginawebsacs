const c = require('./niv-comun.cjs'); const prep = require('./prep.cjs');
module.exports = {
  slug: 'nivelacion-de-inventario', modulo: 'Nivelación de inventario', avisos: ['Desde el corte'],
  nota: 'Capturas del módulo de Nivelación de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'tablero', dice: 'PARADO DONDE', altoFijo: 1700, t: 'Tablero del analista', alt: 'Tablero de nivelación de Sacs: dinero parado, mercancía dormida y veredictos ordenados por dinero en juego', maxAlto: 1900, abrir: async (r) => { await c.abrirTablero(r); } },
    { id: 'nivelaciones', t: 'Nivelaciones', alt: 'Lista de nivelaciones en Sacs con folio, origen, destinos y estado', maxAlto: 1100,
      abrir: async (r) => { await c.abrirTablero(r); const [x, y] = await r.punto('Nivelaciones', { ymax: 80 }); await r.p.mouse.click(x, y); await r.esperaTexto('Nueva nivelación'); await r.p.waitForTimeout(3000); } },
    { id: 'reglas', t: 'Nivelación de moda · Gestor de reglas', alt: 'Gestor de reglas de moda en Sacs: temporadas, configuración al 92 % y preguntas pendientes', maxAlto: 1700,
      abrir: async (r) => { await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, 'Inventarios', 'Nivelación de moda', 'Gestor de reglas'); await r.p.waitForTimeout(3000); } },
  ],
  pasos: [
    { p: 'tablero', ancla: 'TU ANALISTA', minW: 900, t: 'Tu analista amanece con el resumen', d: 'Cada madrugada calcula qué se te acaba y cuánta venta está en juego.' },
    { p: 'tablero', ancla: 'PARADO DONDE NO SE VENDE', minW: 900, t: 'El dinero que no se mueve', d: 'Mercancía parada donde no se vende y lotes dormidos, en pesos.' },
    { p: 'tablero', ancla: 'Cada tarjeta es un veredicto', minW: 900, sube: 3, t: 'Cada tarjeta, una decisión', d: 'Liquidar, rebajar, resurtir o traspasar, ordenado por dinero en juego.' },
    { p: 'nivelaciones', ancla: 'Folio', minW: 1000, t: 'Cada nivelación con folio y estado', d: 'De la bodega a varias tiendas: pendiente, en progreso o completada.' },
    { p: 'reglas', ancla: 'Tu configuración', minW: 600, t: 'Tu configuración de moda, al 92 %', d: 'Sacs te dice qué falta saber de tu catálogo y te lo pregunta.' },
    { p: 'reglas', ancla: 'Buen Fin 2026', minW: 150, sube: 4, t: 'El calendario de moda manda', d: 'Buen Fin, Navidad, Reyes y cada temporada con sus fechas.' },
  ],
};
