/**
 * /producto/facturacion-electronica — rediseño con la línea de los plugins (5-oct-2026), como /producto/punto-de-venta
 * y /producto/apartados-y-pedidos: se queda el video de arriba y lo demás es nuevo.
 *
 * LO QUE EXISTE (inventario del código de sacs3, sacs_api, SACSMobile y la tienda en línea, 5-oct-2026) y es lo que la
 * página cuenta:
 *  - CFDI 4.0 timbrado con el PAC a través del API de Sacs. Facturas: lista con «Timbradas», «No timbradas»,
 *    «Canceladas» y «Globales»; cada una con su canal (Kiosko, Global o Manual); exportar a Excel o PDF; descargar XML y
 *    PDF desde la lista, el detalle, el kiosko y el celular.
 *  - Autofacturación (kiosko): https://<cuenta>.sacscloud.com o tu dominio propio. La clienta pone su RFC, el código y el
 *    PIN del ticket (el QR del ticket ya trae el código y el PIN: «Escanea para facturar — sólo ingresa tu RFC»). Se
 *    valida el PIN, el plazo (si lo activas: «mismo mes de la compra» o «N días después»), que la venta no esté
 *    cancelada y que no esté facturada (si ya lo está, le regresa su XML y PDF); no se puede facturar a «Público en
 *    General». Si dio correo, le llegan el PDF y el XML. El ticket impreso, el de WhatsApp y el de correo traen los
 *    pasos. Con logo, colores y redes propias del kiosko: solo en el plan VIP.
 *  - Desde la caja: en el cobro marcas «Facturar» (con un cliente elegido) y al cobrar Sacs arma la factura (borrador)
 *    con los datos de la venta; tú la revisas y la timbras. También desde Transacciones (una venta a la vez), desde la
 *    ficha del cliente («Nueva factura»), desde cero («Nueva Factura») y desde SACSMobile (crear y timbrar).
 *  - Pedidos, apartados y eventos: «Facturar pedido» con «Factura completa» (un solo CFDI por el total, PUE) o
 *    «Facturar a plazos» (un CFDI PPD + un comprobante de pago por cada abono hasta liquidar), y «Vista previa de la
 *    factura» antes de timbrar.
 *  - Tienda en línea: «Mis facturas», la clienta factura su compra con un botón (sus datos fiscales se piden una vez).
 *  - Factura global: asistente de 6 pasos (Comprobante, Cliente y período, Filtros, Conceptos, Vista previa, Timbrado);
 *    receptor XAXX010101000 · PÚBLICO EN GENERAL; «Solo público en general» o «Todo lo no facturado»; no factura dos
 *    veces la misma venta. Si lo activas, «Generar factura de hoy»: un clic por sucursal.
 *  - Notas de crédito (01 descuentos o bonificaciones, 03 devolución de mercancía), ligadas a la factura, por lo que
 *    elijas; complementos de pago (Pagos 2.0) por cada abono de una factura PPD; cancelación con los motivos del SAT
 *    (01–04), folio de sustitución para el 01 y acuse. Al timbrar, el correo con PDF y XML le llega solo al receptor.
 *  - Antes y al timbrar: no timbra facturas en $0, valida la forma contra el método de pago, reserva el folio, y si se
 *    cae la conexión la factura queda «indeterminada» para no duplicarla. Si el SAT la rechaza, el motivo en español
 *    («El RFC del receptor no coincide con los registros activos del SAT…»). Al cargar tus sellos: detecta la FIEL
 *    subida por error («¡Ups! Este es tu archivo FIEL»), revisa vigencia, contraseña y que la llave sea del certificado.
 *  - Varios emisores (razones sociales), emisor por sucursal, folios por cuenta o por sucursal con serie (FAC-POL-001);
 *    los timbres son de la cuenta.
 *  - NO existe, y no se anuncia: factura global automática o programada (es a mano o con un clic), nota de crédito
 *    automática al devolver en la caja, validar el RFC contra el SAT antes de timbrar, leer la Constancia de Situación
 *    Fiscal, facturar con IA, una factura por varios tickets, nombres de PAC (Facturama, Quadrum…), otros países, el
 *    botón «Facturar» de la pantalla de venta exitosa (en desarrollo), enviar por correo desde las listas de notas y
 *    complementos (próximamente).
 * Pantallas: la lista de facturas y el asistente de la factura global son de una cuenta con facturación real, con
 * nombres, RFC, sucursales y la cuenta cambiados EN PANTALLA (y sin el menú lateral); el kiosko, el panel de
 * facturación y la ilustración de notas son de la cuenta demo (andyaraujoconsultorias), con un RFC de ejemplo escrito
 * en el kiosko (nada se envió ni se timbró). Lo que no se puede mostrar sin timbrar (el ticket, el correo, el modal de
 * «Facturar pedido», el celular) va dibujado con los textos reales de Sacs. Fotos: gpt-image-2.5.
 */

export const I = '/images/producto/facturacion-electronica/';

export interface Pieza { id: string; t: string; d: string; img?: string; w?: number; h?: number; tono: 'negro' | 'fucsia' | 'marfil' | 'marino' | 'azul'; ancha?: boolean; alta?: boolean; dibujo?: 'cupon' | 'reloj' | 'factura' | 'liga' | 'sobre' | 'reglas' }

// «Todo lo que incluye»: 12 celdas exactas en la rejilla de 4 (alta = 2, ancha = 2).
export const INCLUYE: { folio: [string, string]; titulo: string; intro: string; piezas: Pieza[] } = {
  folio: ['01', 'Todo lo que incluye'],
  titulo: 'Facturar deja de ser trabajo.',
  intro: 'Tu clienta se factura sola con su ticket, la factura global sale en un clic y lo demás —notas, complementos y cancelaciones— se hace desde la misma lista.',
  piezas: [
    { id: 'fac-sola', t: 'Se factura sola', d: 'Con el código y el PIN de su ticket, desde su celular.', img: `${I}pantalla-kiosko.webp`, w: 780, h: 1620, tono: 'azul', alta: true },
    { id: 'fac-sola', t: 'Todo en una lista', d: 'Timbradas, por timbrar, canceladas y globales; cada una con su canal.', img: `${I}pantalla-lista-kiosko.webp`, w: 1000, h: 698, tono: 'marfil', ancha: true },
    { id: 'fac-desde', t: 'A plazos', d: 'Pedidos y apartados: factura completa o PPD con un complemento por abono.', img: `${I}pantalla-panel.webp`, w: 640, h: 430, tono: 'negro' },
    { id: 'fac-global', t: 'Factura global', d: 'El público en general del periodo en un solo CFDI.', img: `${I}pantalla-global.webp`, w: 1400, h: 948, tono: 'marino', ancha: true },
    { id: 'fac-notas', t: 'Notas de crédito', d: 'Devoluciones y descuentos, ligadas a su factura.', img: `${I}pantalla-notas.webp`, w: 700, h: 483, tono: 'fucsia' },
    { id: 'fac-desde', t: 'Desde la caja', d: 'Marcas «Facturar» al cobrar y la factura se arma con la venta.', dibujo: 'factura', tono: 'fucsia', ancha: true },
    { id: 'fac-emisores', t: 'Varias razones sociales', d: 'Un emisor por sucursal, cada una con su serie.', img: `${I}pantalla-emisor.webp`, w: 640, h: 307, tono: 'azul', ancha: true },
  ],
};

// «Tu clienta se factura sola», con el scroll: el ticket se imprime, el kiosko en su celular, el correo y tu lista.
export const SOLA = {
  k: 'Autofacturación',
  h: 'Tu clienta se factura sola.',
  // los datos del ticket son los mismos que se ven escritos en el kiosko de la cuenta demo
  ticket: { tienda: 'POLANCO BOUTIQUE', dir: 'Av. Presidente Masaryk 360, Polanco', folio: 's-POL-1791259384120', pin: '48213', fecha: '05/10/2026 13:42', url: 'https://tutienda.sacscloud.com', lineas: [['Camiseta ajustada margarita verde · L', '$1,290.00'], ['Top asimétrico drapeado · XS', '$2,190.00']], total: '$3,480.00' },
  correo: { asunto: 'Polanco Boutique · Factura electrónica FAC-POL-128', hola: '¡Hola Lucía! Te hacemos llegar tu factura electrónica (CFDI) FAC-POL-128.', total: '• Total: $3,480.00', adjunto: '📎 Adjuntamos tu factura electrónica en PDF y XML (el XML es el comprobante fiscal válido ante el SAT).', archivos: ['Factura_FAC-POL-128.pdf', 'Factura_FAC-POL-128.xml'] },
  tramos: [
    { n: '01', t: 'Su ticket trae cómo', d: 'El código, el PIN y un QR que ya los lleva: «Escanea para facturar — sólo ingresa tu RFC». También en el ticket por WhatsApp o correo.', foto: 'caja' },
    { n: '02', t: 'Lo hace desde su celular', d: 'En tu página de facturación pone su RFC, el código y el PIN. Si ya facturó antes, sus datos se llenan solos.', foto: 'cliente' },
    { n: '03', t: 'Le llega a su correo', d: 'El PDF y el XML, timbrados. Y si ese ticket ya estaba facturado, le regresa la misma factura en vez de otra.', foto: 'cliente' },
    { n: '04', t: 'Tú solo la ves llegar', d: 'Aparece en tu lista con el chip «Kiosko», aunque sean las cuatro de la mañana.', foto: 'cliente' },
  ],
  extra: ['Plazo para facturar: el mismo mes o N días', 'Tu dominio propio', 'Con tu logo y colores en el plan VIP'],
};

// «La factura global, en un clic».
export const GLOBAL = {
  k: 'Factura global',
  h: 'El público en general, en una sola factura.',
  p: 'Elige el periodo y qué entra: solo lo de público en general o todo lo que no se facturó. Sacs junta cada venta como un concepto, te enseña la vista previa y la timbras. Ninguna venta se factura dos veces.',
  pasos: ['Comprobante', 'Cliente y período', 'Filtros', 'Conceptos', 'Vista previa', 'Timbrado'],
  receptor: 'XAXX010101000 · PÚBLICO EN GENERAL',
  boton: { t: 'Generar factura de hoy', d: 'Si lo activas, un clic por sucursal con las ventas del día.' },
};

// «Desde donde estés»: pestañas.
export const DESDE = {
  k: 'Emisión',
  h: 'Factura desde donde estés.',
  tabs: [
    { id: 'caja', t: 'En la caja', h: 'Al cobrar, marca «Facturar».', d: 'Con el cliente elegido, al terminar el cobro Sacs arma la factura con los datos de la venta: emisor, conceptos e impuestos. Tú la revisas y la timbras. ¿Se te pasó? Desde Transacciones, con la venta.' },
    { id: 'pedidos', t: 'Pedidos y apartados', h: 'Completa o a plazos.', d: 'Antes de timbrar ves la vista previa. Si ya está pagado, una factura por el total; si va en abonos, una factura PPD y un comprobante de pago por cada abono hasta liquidar.' },
    { id: 'nueva', t: 'Desde cero', h: 'Nueva factura o desde su ficha.', d: 'Elige el emisor y la sucursal, busca tus productos con su clave del SAT y timbra. O desde la ficha del cliente, que ya trae sus datos fiscales.' },
    { id: 'celular', t: 'En el celular', h: 'También en SACSMobile.', d: 'Tus facturas por estado, buscar por folio, receptor o RFC, crear una nueva y timbrarla. Con su PDF y su XML a la mano.' },
    { id: 'tienda', t: 'Tienda en línea', h: 'En «Mis facturas».', d: 'Tu clienta entra a su cuenta y factura su compra con un botón. Sus datos fiscales se piden una sola vez y quedan guardados.' },
  ],
};

// «Notas, complementos y cancelaciones».
export const NOTAS = {
  k: 'Después de timbrar',
  h: 'Lo que pasa después, también.',
  cartas: [
    { t: 'Nota de crédito', tag: 'CFDI de egreso', puntos: ['01 · Descuentos o bonificaciones', '03 · Devolución de mercancía', 'Ligada a la factura que corrige', 'Por el total o solo lo que elijas'] },
    { t: 'Complemento de pago', tag: 'Pagos 2.0', puntos: ['Por cada abono de una factura PPD', 'Con su saldo pendiente', 'Desde el pedido o el apartado, abono por abono', 'Te avisa del plazo del SAT: el día 5 del mes siguiente'] },
    { t: 'Cancelación', tag: 'Motivos del SAT', puntos: ['01 · Con errores, con relación (y su sustituta)', '02 · Con errores, sin relación', '03 · No se llevó a cabo la operación', '04 · Nominativa en una global'] },
  ],
  nota: 'Al timbrar, el PDF y el XML le llegan solos al correo del receptor.',
};

// «Antes de que el SAT te la rebote».
export const SAT = {
  k: 'Sin sorpresas',
  h: 'Antes de que el SAT te la rebote.',
  p: 'Sacs revisa lo que puede antes de timbrar. Y si el SAT la rechaza, te dice por qué, en español.',
  mensajes: ['El RFC del receptor no coincide con los registros activos del SAT…', 'El código postal del receptor no coincide con el registrado en el SAT para ese RFC…'],
  cuida: [
    { t: 'Sin facturas en ceros', d: 'Una factura de $0 no se timbra ni gasta folio.' },
    { t: 'Forma y método de pago', d: 'Si no cuadran, te avisa antes de timbrar.' },
    { t: 'Sin duplicados', d: 'Si se cae el internet al timbrar, la factura queda «indeterminada» y no se vuelve a timbrar a ciegas.' },
    { t: 'Tus sellos, bien cargados', d: '«¡Ups! Este es tu archivo FIEL»: detecta la FIEL subida por error, la vigencia y la contraseña de la llave.' },
  ],
};

// «Varias razones sociales».
export const EMISORES = {
  k: 'Emisores y folios',
  h: 'Cada sucursal factura con su razón social.',
  p: 'Da de alta los emisores que necesites y amarra cada uno a su sucursal. Los folios pueden ir por cuenta o por sucursal, con su serie; los timbres son de toda la cuenta.',
  series: [
    { suc: 'Polanco', serie: 'FAC-POL', n: 128 },
    { suc: 'Santa Fe', serie: 'FAC-SFE', n: 94 },
    { suc: 'Coyoacán', serie: 'FAC-COY', n: 61 },
  ],
};

export const RESUELVE = {
  folio: ['Lo que resuelve', 'En tu mostrador'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'La fila que se detiene porque alguien pidió factura.',
    'El correo con fotos de tickets que llega el día 30.',
    'La factura global que se hace a mano, venta por venta.',
    'El ticket que se facturó dos veces.',
    'El «me rechazó el SAT» sin saber por qué.',
  ],
};

export const PREGUNTAS = [
  { question: '¿Mis clientes pueden facturar solos?', answer: 'Sí. Su ticket trae el código, el PIN y un QR que ya los lleva; en tu página de facturación ponen su RFC y listo. Les llegan el PDF y el XML a su correo. Si el ticket ya estaba facturado, les regresa la misma factura.' },
  { question: '¿Puedo poner un plazo para facturar?', answer: 'Sí. Lo activas en la configuración del kiosko: hasta el fin del mes de la compra o un número de días después. El plazo sale impreso en el ticket.' },
  { question: '¿La factura global se hace sola?', answer: 'No es automática: la haces en el asistente (eliges el periodo y qué entra) o, si activas el botón, con un clic por sucursal con las ventas del día. Las ventas que ya se facturaron no vuelven a entrar.' },
  { question: '¿Qué tipo de factura emite?', answer: 'CFDI 4.0: facturas de ingreso, notas de crédito, complementos de pago (Pagos 2.0) y la factura global, con su PDF y su XML. Las cancelaciones van con los motivos del SAT.' },
  { question: '¿Si devuelven algo en la caja se hace la nota de crédito?', answer: 'No en automático: Sacs te avisa que la venta ya está facturada y la nota de crédito la haces en Notas de crédito, ligada a su factura, por el total o solo por lo devuelto.' },
  { question: '¿Puedo facturar con varias razones sociales?', answer: 'Sí. Das de alta varios emisores y amarras cada uno a su sucursal; los folios pueden ir por sucursal con su propia serie.' },
  { question: '¿El kiosko puede llevar mi marca?', answer: 'Puede ir en tu dominio propio. El logo, los colores y las redes del kiosko se personalizan en el plan VIP.' },
  { question: '¿Qué necesito para empezar?', answer: 'Tus sellos digitales (CSD): el certificado, la llave y su contraseña. Sacs revisa que sean los correctos al cargarlos.' },
];
