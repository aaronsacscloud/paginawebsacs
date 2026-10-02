const g = require('./gcp-comun.cjs');
module.exports = {
  slug: 'cuentas-por-pagar', modulo: 'Cuentas por pagar',
  nota: 'Capturas del módulo de Cuentas por pagar de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'lista', t: 'Cuentas por pagar', alt: 'Lista de cuentas por pagar en Sacs con vencimiento, saldo pendiente y estado', maxAlto: 1250, abrir: async (r) => { await g.abrir(r, 'Cuentas por pagar', 'Nueva Cuenta'); } },
    { id: 'agrupada', t: 'Vista agrupada', alt: 'Cuentas por pagar agrupadas por proveedor en Sacs con próximo vencimiento y total', dice: 'cuentas', maxAlto: 1150, abrir: async (r) => { await g.abrir(r, 'Cuentas por pagar', 'Nueva Cuenta'); await g.clic(r, 'Agrupada'); } },
    { id: 'cuenta', t: 'Cuenta', alt: 'Detalle de una cuenta por pagar en Sacs: aviso de vencida, saldo pendiente y registrar pago', dice: 'SALDO PENDIENTE', maxAlto: 1300, abrir: async (r) => { await g.abrir(r, 'Cuentas por pagar', 'Nueva Cuenta'); await g.clic(r, 'GAS-1', 'SALDO PENDIENTE', { xmin: 200 }); } },
  ],
  pasos: [
    { p: 'lista', ancla: 'Vencido', minW: 150, sube: 2, t: 'Lo vencido, siempre a la vista', d: 'Cuánto debes vencido y lo que vence en los próximos siete días.' },
    { p: 'lista', ancla: 'FOLIO', minW: 1000, t: 'Cada cuenta con su saldo y estado', d: 'Pagada, vencida o pendiente, ordenada por lo más urgente.' },
    { p: 'agrupada', ancla: 'Arrendadora del Valle', minW: 1000, sube: 2, t: 'Agrupado por proveedor', d: 'Cuántas cuentas tienes con cada uno, el próximo vencimiento y el total.' },
    { p: 'cuenta', ancla: 'Cuenta vencida', minW: 400, t: 'Cuánto lleva vencida cada cuenta', d: 'Los días de atraso, a la vista, para hablar con el proveedor a tiempo.' },
    { p: 'cuenta', ancla: 'SALDO PENDIENTE', minW: 200, t: 'Pagas desde la cuenta', d: 'Saldo, total de la factura y «Registrar pago» en el mismo lugar.' },
    { p: 'cuenta', ancla: 'Datos de Factura', minW: 400, t: 'La factura, ligada', d: 'Fecha de factura y de vencimiento, desglose de importes e historial de pagos.' },
  ],
};
