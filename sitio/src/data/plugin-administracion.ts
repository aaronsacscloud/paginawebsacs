/**
 * /plugins/administracion — «Administración», el plugin de Sacs para el dinero de la tienda (3-oct-2026).
 *
 * Pedido del dueño: «ese mismo formato [el de /plugins/staff] aplícalo para el de gastos… que tenga su propia landing
 * con la misma lógica de diseño», sin atarla al pilar «Controla».
 *
 * LO QUE EXISTE (revisado en sacs_api y sacs3 el 3-oct-2026) y es lo que la página cuenta:
 *  - Gastos: lista con «Por pagar» y pestañas Todos · Pagados · Pendientes · Por aprobar · Sin factura · Sin complemento.
 *    Asistente Método → Captura → Datos → Monto → Pago → Confirmar: manual, con recibo (foto o PDF: Claude vision con
 *    confianza por campo; lo dudoso llega vacío para revisarlo, «nunca inventar») o con factura (el XML del CFDI se lee
 *    sin IA). La IA elige la categoría del catálogo de la cuenta. Factura con UUID ya registrado: se rechaza. Factura que
 *    llega después: se liga al gasto. Pago de contado, parcial (abono + cuotas) o programado (parcialidades). Gastos
 *    recurrentes, aprobación desde un monto, presupuesto mensual por categoría con semáforo, alertas al capturar
 *    (presupuesto al 80 %, gasto atípico vs. el promedio del proveedor, posible duplicado sin UUID), complementos de
 *    pago y notas de crédito, carga por lote, Excel, Flujo proyectado y Dashboard de análisis.
 *  - Cuentas por pagar: Vencido y 0-7 días; lista, agrupada por proveedor y calendario; Registrar Pago; vencimiento por
 *    los días de crédito; Flujo de Efectivo, Timeline de Pagos, Antigüedad de Saldos (por vencer, 1-30, 31-60, 61-90,
 *    90+; estado de cuenta por proveedor; Excel) y Corrida de Pagos («Pagar lo que vence antes de» → pago masivo).
 *  - Cuentas de Efectivo y Bancos: total en tesorería, bancos y cajas, «Requiere atención», proyección a 30 días,
 *    entradas por corte (cada cierre de caja reparte el dinero a sus cuentas), traslados, cortes por recibir,
 *    aprobaciones, cuadre, pagos, vales, personas, reportes y Conciliación con IA (pegas el estado de cuenta).
 *  - NO existe, y no se anuncia: captura de gastos desde el teléfono (SACSMobile no la tiene), aprobación con PIN o en
 *    varios niveles, subcategorías, estado de resultados por sucursal, bitácora inalterable, reembolsos, fotos HEIC.
 *    Tampoco es contabilidad ni declara impuestos.
 * Pantallas: recortes REALES de la cuenta demo (andyaraujoconsultorias, 3-oct-2026), sin los registros de prueba ni la
 * marca real que aparece como proveedor. NO se usan las de dibujotecnico: son las finanzas reales de un cliente. Lo que
 * la demo no tiene en pantalla (la IA leyendo un recibo, el resultado de la conciliación, las alertas) va dibujado con
 * el diseño y los textos reales de Sacs y datos de ejemplo. Fotos: gpt-image-2.5.
 */

const I = '/images/plugins/administracion/';

export const ADMIN = {
  folio: 'Plugin · Administración',
  etiqueta: 'Para tu dinero',
  titulo: 'Cada peso, en su lugar.',
  bajada: 'Le tomas foto al recibo y la IA captura el gasto. Sabes qué le debes a cada proveedor y cuándo vence, cuánto hay en cada banco y en cada caja, y cómo vas a terminar el mes.',
};

// «Todo lo que incluye»: el mapa del plugin (cada pieza lleva a su sección).
export const INCLUYE = [
  { id: 'admin-captura', t: 'Gastos con IA', d: 'Foto del recibo o la factura, y la IA llena el gasto.', img: `${I}metodo.webp`, w: 1680, h: 960, tono: 'fucsia', ancha: true },
  { id: 'admin-tesoreria', t: 'Bancos y cajas', d: 'Cuánto tienes y dónde, con la proyección a 30 días.', img: `${I}bancos-tarjetas.webp`, w: 724, h: 748, tono: 'azul', alto: true },
  { id: 'admin-pagar', t: 'Cuentas por pagar', d: 'Qué debes, a quién y cuándo vence.', img: `${I}cxp-vencida-movil.webp`, w: 744, h: 784, tono: 'marfil' },
  { id: 'admin-corrida', t: 'Corrida de pagos', d: 'Todo lo que vence antes de una fecha, pagado de una vez.', img: `${I}corrida.webp`, w: 2400, h: 1580, tono: 'marino' },
  { id: 'admin-antiguedad', t: 'Antigüedad de saldos', d: 'Cuánto le debes a cada proveedor y desde cuándo.', img: `${I}antiguedad.webp`, w: 2400, h: 834, tono: 'marfil' },
  { id: 'admin-cortes', t: 'Entradas por corte', d: 'Cada corte de caja llega solo a su cuenta.', img: `${I}cortes-movil.webp`, w: 1132, h: 1012, tono: 'fucsia' },
  { id: 'admin-conciliacion', t: 'Conciliación con IA', d: 'Pegas tu estado de cuenta y la IA lo empata con tus movimientos.', tono: 'negro', icono: 'conciliacion', ancha: true },
  { id: 'admin-flujo', t: 'Flujo y análisis', d: 'Lo que viene semana por semana y a dónde se va el dinero.', img: `${I}flujo.webp`, w: 2540, h: 1336, tono: 'marino', ancha: true },
];

// «Todo lo que sale, en una sola lista»: la lista real de gastos y el análisis.
export const GASTOS = {
  k: 'Gastos',
  h: 'Todo lo que sale, en una sola lista.',
  p: 'Cada gasto con su folio, su categoría, su comprobante y su fecha de pago. Y las pestañas te dicen qué falta.',
  notas: [
    { n: '01', t: 'Lo pendiente no se pierde', d: 'Por aprobar, sin factura y sin complemento de pago, cada uno en su pestaña.' },
    { n: '02', t: 'A dónde se va el dinero', d: 'Por categoría, con un presupuesto del mes y su semáforo: verde, ámbar al 80 % y rojo al pasarte.' },
    { n: '03', t: 'Te avisa lo raro', d: 'Un gasto muy arriba de lo que le pagas a ese proveedor, o uno que se parece demasiado a otro de la semana.' },
  ],
  // «A dónde se va el dinero» de la cuenta demo (los mismos datos de la captura), para dibujarla en el teléfono
  categorias: [
    { n: 'Nómina', t: '$25,000.00', c: 1, pct: 100 },
    { n: 'Servicios', t: '$20,199.00', c: 2, pct: 80.8 },
    { n: 'Renta', t: '$17,000.00', c: 1, pct: 68 },
    { n: 'Compras', t: '$12,617.19', c: 3, pct: 50.5 },
    { n: 'Insumos', t: '$800.00', c: 3, pct: 3.2 },
    { n: 'Mantenimiento', t: '$200.00', c: 1, pct: 0.8 },
  ],
  // las alertas reales de Sacs al capturar (sacs_api gastos.js detectarAlertas) en la tarjeta del Dashboard de análisis,
  // con datos de ejemplo (la demo no tiene presupuestos ni historial suficiente para dispararlas)
  alertas: [
    {
      folio: 'GAS-0214', concepto: 'Bolsas kraft, papel china y etiquetas', detalle: 'Empaques Condesa · $2,784.00 · 2026-10-02',
      msgs: [
        { nivel: 'ambar', msg: '⚠️ Este gasto es 85% mayor que el promedio histórico de Empaques Condesa ($1,504.86 en 6 gastos).' },
        { nivel: 'ambar', msg: '🟡 Cerca del presupuesto de Insumos: con este gasto llevas $7,240.00 de $8,000.00 (90.5%) este mes.' },
      ],
    },
    {
      folio: 'GAS-0213', concepto: 'Lavado de cortinas del probador', detalle: 'Lavandería Roma · $1,450.00 · 2026-10-01',
      msgs: [{ nivel: 'rojo', msg: '🚨 Posible duplicado: ya capturaste GAS-0187 a Lavandería Roma por un monto casi idéntico el 2026-09-29. Verifica antes de pagar dos veces.' }],
    },
  ],
};

// La captura con IA, un paso por tramo del scroll.
export const CAPTURA = {
  k: 'Captura con IA',
  h: 'Un gasto, en lo que tardas en tomarle foto.',
  tramos: [
    { n: '01', t: 'Le tomas foto al recibo', d: 'O subes el PDF o el XML de la factura. Acepta JPG, PNG, PDF y XML (CFDI).' },
    { n: '02', t: 'La IA lo lee por ti', d: 'Proveedor, fecha, concepto, total y categoría. Lo que no lee con certeza te lo marca para revisarlo: nunca inventa.' },
    { n: '03', t: 'Decides cómo se paga', d: 'De contado, con un abono y el resto en cuotas, o programado en parcialidades, como la renta.' },
  ],
  extra: ['La factura que ya registraste no entra dos veces', 'Si la factura llega después, se liga al gasto', 'Varias facturas de un jalón, por lote'],
  // el recibo de ejemplo (y lo que la IA saca de él)
  recibo: {
    tienda: 'EMPAQUES CONDESA',
    sucursal: 'Suc. Roma Norte · Tel. 55 0000 0000',
    fecha: '02/10/2026  12:41',
    lineas: [
      { d: 'BOLSA KRAFT C/ASA 32X40', c: '200', i: '1,600.00' },
      { d: 'PAPEL CHINA BCO PAQ/100', c: '4', i: '480.00' },
      { d: 'ETIQUETA COLGANTE', c: '500', i: '320.00' },
    ],
    subtotal: '2,400.00',
    iva: '384.00',
    total: '2,784.00',
  },
  datos: [
    { k: 'Proveedor / Razón Social', v: 'Empaques Condesa', ico: 'store', ancho: true },
    { k: 'Fecha de Emisión', v: '2 oct 2026', ico: 'calendar' },
    { k: 'Categoría', v: 'Insumos', ico: 'tag', chip: true },
    { k: 'Concepto', v: 'Bolsas kraft, papel china y etiquetas', ico: 'doc', ancho: true },
  ],
  tipos: [
    { t: 'Contado', d: 'Una sola exhibición. Se paga después desde la lista.' },
    { t: 'Parcial', d: 'Abono inicial + saldo programado en cuotas.' },
    { t: 'Programado', d: 'Varias parcialidades futuras (ej: cuotas o renta).' },
  ],
  cronograma: [
    { n: 'Parcialidad 1', f: '15 oct 2026', m: '$928.00' },
    { n: 'Parcialidad 2', f: '15 nov 2026', m: '$928.00' },
    { n: 'Parcialidad 3', f: '15 dic 2026', m: '$928.00' },
  ],
};

// Cuentas por pagar.
export const PAGAR = {
  k: 'Cuentas por pagar',
  h: 'Sabes qué debes, a quién y cuándo.',
  p: 'Cada gasto y cada compra a crédito vence solo, con los días de crédito de tu proveedor. Lo vencido sale en rojo, con los días que lleva, antes de que llegue el recargo.',
  puntos: [
    { t: 'Ordenadas por lo más urgente', d: 'En lista, agrupadas por proveedor o en un calendario.' },
    { t: 'Registras el pago ahí mismo', d: 'Total o parcial: eliges de qué cuenta sale y su saldo se actualiza.' },
    { t: 'Flujo de efectivo y timeline', d: 'Lo que viene semana por semana, con una sugerencia de qué pagar primero.' },
  ],
  vencida: 'Cuenta vencida hace 95 días',
};

// Corrida de pagos y antigüedad de saldos.
export const CORRIDA = {
  k: 'Corrida de pagos',
  h: 'Paga lo que toca, de una sola vez.',
  p: 'Eliges una fecha y Sacs arma la propuesta: todo lo que vence antes, agrupado por proveedor, con lo pagable, lo bloqueado y cuántas partidas son. Palomeas y pagas.',
  puntos: [
    { t: 'Antigüedad de saldos', d: 'Cuánto le debes a cada proveedor: por vencer, de 1 a 30, de 31 a 60, de 61 a 90 y más de 90 días.' },
    { t: 'Estado de cuenta por proveedor', d: 'Cada documento con su saldo, para que hables con números.' },
    { t: 'A Excel, para tu contador', d: 'La antigüedad, la lista de gastos y las cuentas, en un clic.' },
  ],
};

// Tesorería: bancos y cajas.
export const TESORERIA = {
  k: 'Bancos y cajas',
  h: 'Cuánto tienes, y dónde.',
  p: 'Tus bancos, tu bóveda y tus cajas chicas, con su saldo al momento. Y lo más importante: cómo vas a estar en 30 días con lo que ya tienes programado.',
  notas: [
    { n: '01', t: 'Total en tesorería', d: 'La suma de todas tus cuentas, siempre arriba.' },
    { n: '02', t: 'Requiere atención', d: 'El pago que no salió de ninguna cuenta, antes de que tus saldos dejen de cuadrar.' },
    { n: '03', t: 'Proyección a 30 días', d: 'Si con lo programado tu tesorería va a bajar de cero, te lo dice con tiempo.' },
  ],
};

// Entradas por corte.
export const CORTES = {
  k: 'Entradas por corte',
  h: 'Cierras caja y el dinero llega solo a su cuenta.',
  p: 'Cada corte del punto de venta reparte lo que entró: lo de tarjeta, al banco; el efectivo, a la bóveda. Ves de dónde salió, quién lo cerró y a qué cuenta llegó.',
  pasos: [
    { n: '01', t: 'Cierras caja', d: 'En el punto de venta, como siempre.' },
    { n: '02', t: 'Sacs reparte el dinero', d: 'Cada forma de pago, a la cuenta que le toca.' },
    { n: '03', t: 'Lo ves en tu tesorería', d: 'Con su sucursal, su caja, su hora y quién lo cerró.' },
  ],
  extra: ['Traslados entre cuentas', 'Cortes por recibir', 'Vales de caja', 'Cuadre y arqueo'],
};

// Conciliación con IA (el resultado va dibujado: la demo no tiene estado de cuenta).
export const CONCILIACION = {
  k: 'Conciliación con IA',
  h: 'Tu estado de cuenta, conciliado en minutos.',
  p: 'Eliges la cuenta, pegas el estado de cuenta del banco tal como venga y la IA lo empata contra tus movimientos. Tú revisas, palomeas y aplicas.',
  tipos: [
    { c: 'match', t: 'Empata', d: 'La línea del banco y el movimiento de Sacs son el mismo.' },
    { c: 'comision', t: 'Comisión', d: 'Lo que se quedó la terminal o el banco, ya calculado.' },
    { c: 'no_registrado', t: 'No registrado', d: 'Un depósito o un cargo que no estaba en Sacs.' },
    { c: 'pendiente', t: 'Pendiente', d: 'Lo que registraste y todavía no aparece en el banco.' },
  ],
  ejemplo: {
    cuenta: 'BBVA empresarial',
    resumen: '1 exactos · 2 comisiones ($383.49) · 1 no registrados · 1 pendientes',
    filas: [
      { tipo: 'match', banco: 'SPEI ENVIADO RENTA LOCAL · $18,000.00', mov: 'Pago de renta · Local Polanco', movM: '$18,000.00', com: '', conf: '99%' },
      { tipo: 'comision', banco: 'ABONO TPV 02OCT · $6,571.25', mov: 'Corte #1042 · Tarjeta', movM: '$6,800.00', com: '-$228.75', conf: '96%' },
      { tipo: 'comision', banco: 'ABONO TPV 03OCT · $4,445.26', mov: 'Corte #1045 · Tarjeta', movM: '$4,600.00', com: '-$154.74', conf: '95%' },
      { tipo: 'no_registrado', banco: 'DEP EFECTIVO SUC 0451 · $3,100.00', mov: '—', movM: '', com: '', conf: '90%' },
      { tipo: 'pendiente', banco: '—', mov: 'Pago a Empaques Condesa', movM: '$2,784.00', com: '', conf: '88%' },
    ],
  },
};

// Flujo proyectado y análisis.
export const FLUJO = {
  k: 'Flujo proyectado',
  h: 'Lo que viene, semana por semana.',
  p: 'Lo vencido, lo que toca pagar en los próximos 30 días, los gastos recurrentes que vienen y la semana más pesada del mes. Para que la quincena no te sorprenda.',
  acciones: ['Exportar Excel', 'Vista de tabla', 'Por días pendientes', 'Flujo proyectado', 'Dashboard de análisis'],
};

// En automático (y AXO).
export const AUTO = {
  k: 'En automático',
  h: 'Lo que antes hacías a mano, ya no.',
  items: [
    { t: 'Los gastos recurrentes', d: 'La renta o la limpieza se registran solas cada periodo.' },
    { t: 'Los vencimientos', d: 'Salen de los días de crédito de cada proveedor.' },
    { t: 'Los saldos de cada cuenta', d: 'Cada pago descuenta la cuenta de donde salió.' },
    { t: 'El dinero de cada corte', d: 'Llega solo al banco o a la bóveda.' },
    { t: 'Las aprobaciones', d: 'Los gastos desde el monto que tú definas esperan su visto bueno.' },
    { t: 'Las facturas duplicadas', d: 'Si el folio fiscal ya está registrado, no entra dos veces.' },
  ],
  axo: {
    k: 'Con AXO',
    h: 'Pregúntale por tu dinero.',
    chat: [
      { q: '¿Cuánto les debo a mis proveedores?', a: '$86,733.86 en 11 cuentas, todas vencidas. La más antigua es la renta de junio con Arrendadora del Valle: $18,000, con 95 días.' },
      { q: '¿Me alcanza para pagar todo hoy?', a: 'Sí. Tienes $437,536.67 en tesorería; después de pagar lo vencido te quedarían $350,802.81.' },
    ],
  },
};

export const RESUELVE = {
  folio: ['Lo que resuelve', 'Para tu dinero'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'Los tickets en una caja, esperando a que alguien los capture.',
    'El pago al proveedor que se te pasó, y el recargo.',
    'La misma factura, pagada dos veces.',
    'El corte de caja que nadie sabe a qué cuenta llegó.',
    'Enterarte a fin de mes de que no te alcanza.',
  ],
};

export const PREGUNTAS_ADMIN = [
  { question: '¿Qué necesito para empezar?', answer: 'Dar de alta tus cuentas (bancos, bóveda y cajas chicas) con su saldo y tus proveedores con sus días de crédito. Desde ahí, cada gasto, cada pago y cada corte de caja se acomoda solo.' },
  { question: '¿La IA lee cualquier recibo?', answer: 'Lee fotos (JPG y PNG) y PDF de recibos y facturas; el XML del CFDI se lee directo, sin IA. Cada dato trae su nivel de confianza: lo que no lee con certeza lo deja marcado para que tú lo completes. Nunca inventa un dato.' },
  { question: '¿Funciona con mis facturas electrónicas?', answer: 'Sí. Subes el XML del CFDI y Sacs toma el proveedor, el RFC, el folio fiscal, el subtotal, el IVA y el total. Si ese folio fiscal ya está en otro gasto, lo rechaza para que no pagues dos veces. También reconoce los complementos de pago y las notas de crédito.' },
  { question: '¿Puedo pedir aprobación para los gastos grandes?', answer: 'Sí. Defines el monto desde el que un gasto necesita aprobación, y esos gastos esperan en la pestaña «Por aprobar» hasta que alguien con permiso los apruebe.' },
  { question: '¿Cómo funciona la conciliación con IA?', answer: 'Eliges la cuenta de banco y pegas el estado de cuenta tal como lo descargas. La IA empata cada línea con tus movimientos y te marca las comisiones de tarjeta, los depósitos que no registraste y lo que sigue pendiente. Tú revisas y aplicas solo lo que palomeas.' },
  { question: '¿Sustituye a mi contador?', answer: 'No. Administración lleva al día tus gastos, tus pagos a proveedores y tu tesorería, y todo se exporta a Excel. La contabilidad y los impuestos los sigue llevando tu contador, ahora con la información en orden.' },
  { question: '¿Cuánto cuesta?', answer: 'Administración es un plugin de Sacs. En la demo te damos el precio para el tamaño de tu operación.' },
];
