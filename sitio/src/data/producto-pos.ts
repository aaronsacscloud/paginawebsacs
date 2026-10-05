/**
 * /producto/punto-de-venta — rediseño con la línea de los plugins (4-oct-2026).
 *
 * Pedido del dueño: «con esta misma lógica [la de /plugins/staff y /plugins/administracion] cambia estas secciones…
 * solo dejamos la parte del video inicial y de ahí optimizas, cambiando un poco entre secciones la lógica de entrada y
 * metiendo algunas animaciones diferentes», empezando por Punto de venta y luego el resto de «Vende».
 *
 * LO QUE EXISTE (inventario del código de sacs3, sacs_api y SACSMobile, 4-oct-2026) y es lo que la página cuenta:
 *  - Venta: búsqueda por nombre, SKU o código (lector de código de barras), tablero con fotos, cada talla y color con su
 *    precio y existencia, matriz de existencias por sucursal × color × talla, carrito con descuento por línea o a toda la
 *    venta, vendedor por prenda, nota en el ticket, ventas guardadas, venta rápida, teclas rápidas.
 *  - Cobro: efectivo con cambio, tarjeta, transferencia, cheque, crédito, monedero, tarjeta de regalo, terminal Mercado
 *    Pago Point (la única terminal integrada) y pagos combinados («Usar múltiples métodos de pago»).
 *  - Sin internet: el punto de venta descarga los catálogos al equipo; las ventas se guardan en el equipo y se
 *    sincronizan solas al volver la conexión. Funciona si la caja ya estaba abierta antes de que se fuera el internet.
 *  - Cambios: Cambio Exprés (otra talla o color del mismo artículo, sin cobro), cambio por otra prenda (cobra o devuelve la
 *    diferencia), devolución (al método que elijas o al monedero del cliente), cancelación; en otra sucursal si se activa.
 *  - Caja: fondo, corte con desglose por método (estimado, contado, diferencia), corte ciego, efectivo que se queda para
 *    el siguiente turno, retiro de caja sugerido, PIN de supervisor, movimientos de caja, arqueo, historial de cortes.
 *    Resumen del corte por WhatsApp pidiéndoselo a AXO (asistente de WhatsApp) y la «Estafeta» al cerrar.
 *  - Equipo: usuarios con caja asignada, PIN de 4 dígitos, bloqueo de pantalla, permisos por grupo, tope de descuento,
 *    sin precio menor al normal, el costo oculto para quien no tiene permiso, «Mi comisión».
 *  - Clientes y precios: listas de precios por tipo de cliente, precio por volumen, crédito con fecha límite y abonos,
 *    apartados y pedidos desde el carrito, tarjetas de regalo, promociones automáticas (y el aviso al cajero de la
 *    promoción por desbloquear), cashback y puntos.
 *  - Ticket: impreso (58 u 80 mm; RawBT y Bluetooth en Android, sin diálogo en Windows), por WhatsApp o por correo,
 *    reimpresión desde «Últimas transacciones»; el ticket trae código y PIN para que el cliente se facture solo.
 *  - Celular: SACSMobile tiene el punto de venta completo (escanear con la cámara, buscar por foto con IA, cobro, ticket,
 *    sin internet, apertura y corte).
 *  - NO existe, y no se anuncia: OXXO o SPEI en caja, otras terminales bancarias, traspaso desde el punto de venta,
 *    entrega de pedidos con QR que se cierra sola, el botón «Facturar» de la venta (está en desarrollo), báscula, cajón.
 * Pantallas: recortes REALES de la cuenta demo (andyaraujoconsultorias, «Polanco Boutique»), 4-oct-2026; se ocultó un
 * método de pago de prueba. Lo que no se puede mostrar sin hacer una venta real (el ticket por WhatsApp, el PIN) va
 * dibujado con el diseño y los textos reales de Sacs. Fotos: gpt-image-2.5.
 */

export const I = '/images/producto/punto-de-venta/';

// La venta con el scroll: cada paso pone su pantalla real dentro de la tablet de la foto.
export const VENTA = {
  k: 'Una venta',
  h: 'De la prenda al ticket, sin soltar a tu clienta.',
  tramos: [
    { n: '01', t: 'Busca o escanea', d: 'Por nombre, SKU o con tu lector de código de barras. Cada talla y color con su precio y lo que hay.', img: 'pantalla-buscar', mw: 900, mh: 649, alt: 'El punto de venta buscando «blazer»: cada talla y color del blazer sastre cruzado con su SKU, su precio y lo disponible' },
    { n: '02', t: 'Mira lo que hay en cada tienda', d: 'La matriz de la prenda: cuántas hay por talla, color y sucursal, en verde, amarillo o rojo.', img: 'pantalla-matriz', mw: 900, mh: 1223, alt: 'La matriz de existencias del blazer: sucursal y color por renglón, tallas S a XS por columna, con colores según lo que hay' },
    { n: '03', t: 'Arma la venta', d: 'Descuento por prenda o a toda la venta, el vendedor de cada prenda y una nota que sale en el ticket.', img: 'pantalla-carrito', mw: 772, mh: 860, alt: 'El carrito con el blazer en talla M beige y el vestido de punto en talla S camel, el subtotal, el IVA y el botón Cobrar' },
    { n: '04', t: 'Cobra como prefiera', d: 'Efectivo con su cambio, tarjeta, terminal Mercado Pago Point, monedero o tarjeta de regalo. Y combinados en la misma venta.', img: 'pantalla-cobro', mw: 900, mh: 605, alt: 'Registrar venta: $5,780 pagados con $1,000 en efectivo y $4,780 con tarjeta de crédito; restan $0' },
  ],
  extra: ['Ventas guardadas para cobrar después', 'Venta rápida: creas la prenda y la vendes', 'Teclas rápidas para todo'],
};

// «Todo lo que incluye»: el mapa (cada pieza lleva a su sección).
export const INCLUYE = [
  { id: 'pos-venta', t: 'Venta en segundos', d: 'Busca o escanea, elige talla y color, y cobra.', img: 'pantalla-buscar', w: 1800, h: 1200, tono: 'fucsia', ancha: true },
  { id: 'pos-venta', t: 'Existencias por talla', d: 'La matriz de cada prenda, tienda por tienda.', img: 'pantalla-matriz-alta', w: 1040, h: 1118, tono: 'azul', alto: true },
  { id: 'pos-cambios', t: 'Cambios y devoluciones', d: 'Otra talla en un minuto, sin discutir.', img: 'pantalla-cambio-express', w: 1400, h: 1004, tono: 'marfil' },
  { id: 'pos-offline', t: 'Sin internet', d: 'Sigues vendiendo y se sincroniza solo.', img: 'pantalla-sync', w: 1400, h: 800, tono: 'negro' },
  { id: 'pos-corte', t: 'Corte de caja', d: 'Corte ciego, retiros y el efectivo que se queda.', img: 'pantalla-corte', w: 1400, h: 1240, tono: 'marino' },
  { id: 'pos-equipo', t: 'Tu equipo en la caja', d: 'Cada quien con su PIN y sus permisos.', tono: 'marfil', icono: 'pin' },
  { id: 'pos-clientes', t: 'Precios, crédito y apartados', d: 'Listas de precios, mayoreo, crédito con abonos y apartados desde el carrito.', img: 'pantalla-apartar', w: 1400, h: 933, tono: 'azul', ancha: true },
  { id: 'pos-ticket', t: 'Ticket donde lo quiera', d: 'Impreso, por WhatsApp o por correo, con su autofactura.', tono: 'negro', icono: 'ticket', ancha: true },
];

// Cambios y devoluciones: un caso por pestaña.
export const CAMBIOS = {
  k: 'Cambios y devoluciones',
  h: 'Los cambios ya no se discuten.',
  p: 'La talla que no quedó, el color que no era, la prenda que ya no quiso. Cada caso tiene su camino en Sacs, y el inventario y la caja quedan bien solos.',
  casos: [
    { id: 'expres', t: 'Otra talla o color', d: 'Cambio Exprés: el mismo artículo en otra talla o color, sin cobro. Eliges lo que devuelve el cliente y lo que se lleva, y listo.', img: 'pantalla-cambio-express', w: 1400, h: 1004, alt: 'Cambio Exprés: otra talla o color del mismo artículo, sin cobro, buscando el blazer' },
    { id: 'prenda', t: 'Por otra prenda', d: 'Buscas la venta por folio, cliente o RFC, o escaneas el ticket. Si la nueva cuesta más cobras la diferencia; si cuesta menos, la devuelves.', img: 'pantalla-cambio', w: 1400, h: 933, alt: 'Cambio de productos: busca la venta por folio, cliente o RFC, o escanea el código' },
    { id: 'devolucion', t: 'Devolución', d: 'Le devuelves con el método que elijas, o al monedero de tu cliente para que lo use en su siguiente compra, en cualquier sucursal.', img: 'pantalla-devolucion', w: 1400, h: 933, alt: 'Devolución de producto: selecciona la venta y los productos que el cliente devuelve' },
  ],
  extra: ['Cambios y devoluciones de otra sucursal, si lo activas', 'Ticket del cambio por separado', 'Todo queda en el corte de la caja'],
};

// Sin internet.
export const OFFLINE = {
  k: 'Sin internet',
  h: 'Se fue el internet. La venta no.',
  p: 'El punto de venta guarda en tu equipo tus productos, precios y clientes. Si se cae la conexión, sigues cobrando: las ventas se guardan ahí mismo y se sincronizan solas cuando vuelve.',
  estados: [
    { c: 'ok', t: 'Conexión estable' },
    { c: 'mal', t: 'Sin conexión' },
    { c: 'cola', t: 'Ventas por sincronizar (3)' },
    { c: 'sync', t: 'Sincronizando ventas...' },
    { c: 'ok', t: '¡Felicidades! Todas tus ventas se han sincronizado' },
  ],
  notas: [
    { t: 'Tus catálogos, en el equipo', d: 'Productos, variantes, precios, clientes e imágenes se descargan y se actualizan cada 15 minutos.' },
    { t: 'Cada venta, a salvo', d: 'Se guarda primero en el equipo y luego sube. Si algo falla, queda para reintentarla.' },
    { t: 'Lo que espera a que vuelva', d: 'Sin internet no ves el inventario de otras sucursales ni entras a otros módulos, y la terminal Mercado Pago necesita conexión. La caja debe estar abierta antes de que se vaya.' },
  ],
};

// Corte de caja.
export const CORTE = {
  k: 'Corte de caja',
  h: 'El corte, sin sorpresas.',
  p: 'Abres con tu fondo, cierras con el corte. Sacs te dice cuánto debería haber por cada forma de pago, tu cajero cuenta y la diferencia sale sola.',
  notas: [
    { n: '01', t: 'Desglose por forma de pago', d: 'Estimado, contado y diferencia de efectivo, tarjeta y lo demás, con los cambios y devoluciones del turno.' },
    { n: '02', t: 'Corte ciego', d: 'Si lo activas, el cajero cuenta sin ver cuánto debería haber.' },
    { n: '03', t: 'El efectivo que se queda', d: 'Solo el fondo, fondo y sobrante, o todo: el siguiente turno abre con lo que dejó el anterior.' },
  ],
  extra: ['Retiro de caja sugerido por monto o por horario', 'Ingresos y egresos de caja', 'Autorización con PIN de supervisor', 'Historial de cortes en Excel', 'Arqueo cuando quieras'],
  axo: 'Y si le escribes a AXO por WhatsApp «el corte de hoy», te manda el resumen con su PDF.',
};

// Tu equipo.
export const EQUIPO = {
  k: 'Tu equipo',
  h: 'Cada quien entra con lo suyo.',
  p: 'Cada vendedora con su usuario, su caja y su PIN. Y tú decides qué puede hacer cada grupo: descuentos, cancelaciones, devoluciones, cortes.',
  permisos: ['Aplicar descuentos a la venta', 'Editar precios de productos', 'Eliminar items del carrito', 'Cancelar ventas', 'Realizar devoluciones', 'Realizar cambios', 'Realizar corte de caja', 'Cambiar cajero asignado'],
  puntos: [
    { t: 'PIN y bloqueo de pantalla', d: 'Si lo activas, después de cada venta la pantalla se bloquea y entra quien teclea su PIN o escanea su gafete.' },
    { t: 'Topes que se respetan', d: 'Un tope de descuento por venta y nunca un precio menor al normal, si así lo quieres.' },
    { t: 'Cada prenda con su vendedor', d: 'Para que la comisión sea de quien vendió; cada quien ve la suya en «Mi comisión».' },
    { t: 'El costo, solo para quien debe', d: 'Tus vendedoras ven precio y existencias; el costo solo lo ve quien tiene permiso.' },
  ],
};

// Precios, clientes, crédito y apartados (carrusel).
export const CLIENTES = {
  k: 'Precios y clientes',
  h: 'Todo se resuelve desde el carrito.',
  p: 'El precio correcto para cada cliente, el crédito, el apartado y el pedido, sin salir de la venta.',
  tarjetas: [
    { t: 'Listas de precios', d: 'Un precio para cada tipo de cliente y sucursal: mayoreo, distribuidor, empleado.', tag: 'Por tipo de cliente' },
    { t: 'Precio por volumen', d: 'De 1 a 5 piezas un precio, de 6 a 11 otro. El carrito marca el escalón.', tag: 'Vol.2' },
    { t: 'Crédito con abonos', d: 'Asignas el crédito con su fecha límite y cobras los abonos desde la ficha del cliente.', tag: 'Fecha límite de cobro' },
    { t: 'Apartados', d: 'Con su anticipo y su plan de abonos, desde el carrito y sin salir del punto de venta.', tag: 'Anticipo a cobrar ahora' },
    { t: 'Pedidos', d: 'Con fecha de entrega, envío y pago inicial; y una liga para que el cliente pague en línea, si lo configuras.', tag: 'Fecha de entrega' },
    { t: 'Promociones solas', d: 'El 3x2 o el descuento se aplican al cobrar, y Sacs le avisa al cajero qué puede agregar el cliente para ganarse una promoción.', tag: '¡Promoción por desbloquear!' },
    { t: 'Monedero y puntos', d: 'Tu clienta ve cuánto cashback y cuántos puntos gana con esta compra, y paga con su saldo.', tag: 'Cashback' },
    { t: 'Tarjetas de regalo', d: 'Las vendes en la caja, se envían por correo y se cobran como forma de pago.', tag: 'SACS-XXXX-XXXX' },
  ],
};

// El ticket.
export const TICKET = {
  k: 'El ticket',
  h: 'El ticket, donde lo quiera.',
  p: 'Impreso en tu impresora de tickets, por WhatsApp o por correo. Y con el código y el PIN para que tu cliente se facture solo.',
  mensaje: [
    'Gracias por tu compra en Polanco Boutique',
    'Folio V-10482 · 2 artículos',
    'Blazer sastre cruzado M Beige  $3,290.00',
    'Vestido de punto manga larga S Camel  $2,490.00',
    'Total  $5,780.00',
    '¿Necesitas factura? Entra a la página de facturación con tu Código y PIN.',
  ],
  impresion: [
    { t: 'Impresora de tickets', d: 'De 58 u 80 mm, con tu logo y lo que quieras que diga.' },
    { t: 'Desde tablet o celular', d: 'Por Bluetooth o con RawBT en Android.' },
    { t: 'Sin el cuadro de imprimir', d: 'En Windows imprime directo, sin preguntar.' },
    { t: 'Reimprime cuando sea', d: 'Desde «Últimas transacciones»: reimprimir, WhatsApp o correo.' },
  ],
};

// En el celular (SACSMobile).
export const CELULAR = {
  k: 'También en el celular',
  h: 'Tu punto de venta, en el bolsillo.',
  p: 'Para el bazar, la venta en el piso o la tienda pequeña: el celular cobra igual que la caja, con su app de Sacs.',
  puntos: [
    { t: 'Escanea con la cámara', d: 'Uno por uno o varios seguidos, con linterna.' },
    { t: 'Busca por foto con IA', d: 'Le tomas foto a la prenda y Sacs te dice cuál es.' },
    { t: 'Cobra y manda el ticket', d: 'Pagos combinados, ticket impreso o por WhatsApp.' },
    { t: 'También sin internet', d: 'Abre tu caja, vende y haz tu corte desde el celular.' },
  ],
};

export const RESUELVE = {
  folio: ['Lo que resuelve', 'En tu caja'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'La fila que crece mientras buscas la talla en la bodega.',
    'La venta que se pierde porque se cayó el internet.',
    'El cambio de talla que acaba en discusión.',
    'El corte que no cuadra y nadie sabe por qué.',
    'El descuento que nadie autorizó.',
  ],
};

export const PREGUNTAS_POS = [
  { question: '¿Necesito comprar equipo especial?', answer: 'No. Funciona en la computadora, la tablet o el celular que ya tienes. Si quieres, le conectas tu impresora de tickets (58 u 80 mm), tu lector de código de barras y la terminal Mercado Pago Point.' },
  { question: '¿De verdad funciona sin internet?', answer: 'Sí, con una condición: la caja debe estar abierta antes de que se vaya la conexión. El punto de venta guarda tus catálogos en el equipo; cada venta se queda guardada ahí y se sincroniza sola cuando vuelve el internet. La terminal Mercado Pago sí necesita conexión.' },
  { question: '¿Qué formas de pago acepta?', answer: 'Efectivo con cálculo de cambio, tarjeta de crédito y débito, transferencia, cheque, crédito, monedero, tarjeta de regalo y las que tú agregues. Puedes combinar varias en la misma venta. La terminal integrada es Mercado Pago Point; con otras terminales registras el pago a mano.' },
  { question: '¿Cómo funcionan los cambios de talla?', answer: 'Con el Cambio Exprés eliges lo que devuelve el cliente y lo que se lleva (el mismo artículo en otra talla o color) y queda hecho, sin cobro. Si cambia por otra prenda, cobras o devuelves la diferencia; y en una devolución puedes regresarle el dinero o mandarlo a su monedero.' },
  { question: '¿Puedo controlar lo que hace cada vendedor?', answer: 'Sí. Cada quien entra con su PIN y tú decides por grupo qué puede hacer: descuentos, editar precios, cancelar, devolver o hacer el corte. Además pones un tope de descuento y puedes impedir vender abajo del precio normal.' },
  { question: '¿Mi cliente puede facturar su compra?', answer: 'Sí. Su ticket trae un código y un PIN para que se facture solo en tu página de autofacturación. También puedes facturar desde Transacciones o hacer la factura global del día.' },
  { question: '¿Funciona en el celular?', answer: 'Sí. La app de Sacs para el celular tiene el punto de venta completo: escanea con la cámara, busca por foto con IA, cobra con pagos combinados, manda el ticket y hace tu apertura y tu corte, también sin internet.' },
];
