const g = require('./gcp-comun.cjs');
const vista = async (r, op, espera) => { await g.abrir(r, 'Gastos', 'Nuevo gasto'); await g.clic(r, 'Más acciones'); await g.clic(r, op, espera); };
module.exports = {
  slug: 'gastos', modulo: 'Gastos',
  nota: 'Capturas del módulo de Gastos de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'lista', t: 'Gastos', alt: 'Lista de gastos en Sacs con proveedor, vencimiento, concepto y categoría', maxAlto: 1250, abrir: async (r) => { await g.abrir(r, 'Gastos', 'Nuevo gasto'); } },
    { id: 'analisis', t: 'Dashboard de análisis', alt: 'Análisis de gastos en Sacs: gasto contra ventas por mes, a dónde se va el dinero y a quién le pagas más', dice: 'A dónde se va el dinero', maxAlto: 1300, abrir: async (r) => { await vista(r, 'Dashboard de análisis', 'A dónde se va el dinero'); } },
    { id: 'flujo', t: 'Flujo proyectado', alt: 'Flujo proyectado de gastos en Sacs: vencido, por pagar en 30 días, carga por semana y compromisos', dice: 'Carga por semana', maxAlto: 1800, abrir: async (r) => { await vista(r, 'Flujo proyectado', 'Carga por semana'); } },
    { id: 'detalle', t: 'Gasto', alt: 'Detalle de un gasto en Sacs: cronograma de pagos, recepción de mercancía con faltantes e importe', dice: 'Cronograma de pagos', maxAlto: 1300, abrir: async (r) => { await g.abrir(r, 'Gastos', 'Nuevo gasto'); await r.esperaTexto('OC-D46492'); await g.clic(r, 'OC-D46492', 'Cronograma de pagos'); } },
  ],
  pasos: [
    { p: 'lista', ancla: 'Folio', minW: 1000, t: 'Cada gasto con su categoría', d: 'Compras, servicios, renta, nómina e insumos, con proveedor y vencimiento.' },
    { p: 'analisis', ancla: 'Gasto vs Ventas', minW: 900, t: 'Tu gasto contra tus ventas', d: 'Los últimos seis meses lado a lado, con el porcentaje que se va en gasto.' },
    { p: 'analisis', ancla: 'A dónde se va el dinero', minW: 500, t: 'A dónde se va el dinero', d: 'Nómina, servicios, renta, compras: cuánto y en cuántos gastos.' },
    { p: 'flujo', ancla: 'VENCIDO SIN PAGAR', minW: 1000, t: 'Lo que viene, semana por semana', d: 'Vencido, por pagar en 30 días y la semana más pesada del mes.' },
    { p: 'flujo', ancla: 'Gastos recurrentes configurados', minW: 900, t: 'Gastos recurrentes', d: 'La renta se proyecta sola cada mes y la pausas con un clic.' },
    { p: 'detalle', ancla: 'Recepción de mercancía', minW: 400, t: 'La compra, contra lo que llegó', d: 'Si la recepción vino con faltante, el gasto lo marca prenda por prenda.' },
  ],
};
