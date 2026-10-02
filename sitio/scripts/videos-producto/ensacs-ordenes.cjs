const c = require('./oc-comun.cjs');
module.exports = {
  slug: 'ordenes-de-compra', modulo: 'Órdenes de compra',
  nota: 'Capturas de las órdenes de compra y recepciones de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'lista', t: 'Recepción de productos', alt: 'Lista de órdenes de compra y recepciones en Sacs con proveedor, total y estado', maxAlto: 1300, abrir: async (r) => { await c.abrirRec(r, true); } },
    { id: 'orden', t: 'Orden de compra', alt: 'Orden de compra en Sacs: ordenado contra recibido por prenda y el flujo de la orden', dice: 'TOTAL DE LA ORDEN', maxAlto: 1300, abrir: async (r) => { await c.abrirRec(r); await c.abrirFolio(r, await c.folioPorTotal(r, '$140,276.00', 'OC-'), 'TOTAL DE LA ORDEN'); } },
    { id: 'recepcion', t: 'Recepción', alt: 'Recepción completada en Sacs: prendas recibidas con cantidad, costo y descuento', dice: 'Pantalón palazzo', maxAlto: 1500, abrir: async (r) => { await c.abrirRec(r); await c.abrirFolio(r, await c.folioPorTotal(r, '$64,799.98', 'REC-'), 'Pantalón palazzo'); } },
  ],
  pasos: [
    { p: 'lista', ancla: 'FOLIO', minW: 1000, t: 'Cada orden con su proveedor y estado', d: 'Órdenes enviadas, recepciones completadas y borradores, en una lista.' },
    { p: 'orden', ancla: 'TOTAL DE LA ORDEN', minW: 200, t: 'El total de la orden, al día', d: 'Productos, piezas, subtotal e impuestos de lo que pediste.' },
    { p: 'orden', ancla: 'ORDENADO', minW: 400, t: 'Ordenado contra recibido', d: 'Cuántas piezas pediste, cuántas llegaron y la diferencia, prenda por prenda.' },
    { p: 'orden', ancla: 'Productos', minW: 200, t: 'De la orden al pago', d: 'Productos, envío, recepción y factura y pago: sabes en qué paso va.' },
    { p: 'recepcion', ancla: 'TOTAL DE LA RECEPCIÓN', minW: 200, t: 'La recepción, cerrada', d: 'Piezas, productos y costo de lo que entró al almacén.' },
    { p: 'recepcion', ancla: 'PRODUCTO', minW: 400, t: 'Cada prenda que entró, con su costo', d: 'Cantidad, costo con impuesto y descuento por línea.' },
  ],
};
