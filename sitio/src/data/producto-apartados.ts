/**
 * /producto/apartados-y-pedidos — rediseño con la línea de los plugins (5-oct-2026), como /producto/punto-de-venta:
 * se queda el video de arriba y lo demás es nuevo, con entradas y animaciones distintas entre secciones.
 *
 * LO QUE EXISTE (inventario del código de sacs3, sacs_api y SACSMobile, 5-oct-2026) y es lo que la página cuenta:
 *  - Un apartado es un pedido con su marca: mismo motor (crear, cobrar, preparar, cancelar, entregar).
 *  - Apartados: lista con «Por cobrar», «Por vencer», «Vencidos», «Sobre pedido» y «Liquidados»; «Ver resumen» (por
 *    cobrar, por vencer en 7 días, vencidos, tasa de cancelación, antigüedad de la cartera, clientes con mayor saldo);
 *    «Ruta de cobranza» (a quién cobrarle hoy); detalle con abonos, mora, próximo abono del plan, cambiar productos,
 *    prórroga, liga pública, imprimir y enviar por WhatsApp o correo.
 *  - Crear: desde el carrito del punto de venta («Apartar» / «Hacer pedido», sin salir del POS) o en el módulo (cliente,
 *    sucursal, productos y pago, con semáforo del cliente). Anticipo mínimo (porcentaje o importe fijo; siempre, a partir
 *    de un monto o de cierto número de piezas; distinto por tipo de cliente). La fecha límite sale de tu regla (24 horas si
 *    no la cambias) y se alarga con prórroga.
 *  - Abonos: en el módulo (con cargo por mora opcional), en el POS («Ver pedidos» → cobrar el saldo), en SACSMobile y, si
 *    lo activas con Mercado Pago o Stripe conectados, en línea desde la liga (abono o liquidación; «Apartado entre
 *    varios» y prórroga pagada).
 *  - Liga pública: estado, saldo, tiempo restante, seguimiento (Apartado → Abonando → Liquidado → Preparado → Listo),
 *    productos, comprobantes con su acuse, datos del negocio y sus políticas; «Recordarme» (calendario), «Compartir» y
 *    «Abonar ahora» (abre el WhatsApp de la tienda: no es un pago).
 *  - Vencimiento: cada hora; según tu regla se cancela y libera la mercancía o solo avisa. Aviso al dueño (correo y en
 *    Sacs). Recordatorios automáticos antes del vencimiento y de cada abono del plan (si los activas).
 *  - Inventario: al crear el apartado o el pedido la mercancía pasa de disponible a apartada (en el kárdex); al cancelar
 *    regresa; «Cambiar productos» ajusta lo reservado.
 *  - Sobre pedido (si lo activas): genera la orden de compra o el traspaso; al recibirla se aparta sola y a la clienta le
 *    llega «¡Tu mercancía ya llegó!» por correo; alerta de mercancía sobre pedido sin entregar.
 *  - Entregar: solo liquidado («Entregar al cliente»). Cashback al liquidar si tienes lealtad.
 *  - Pedidos: lista con «No preparados», «Cobranza», «Abiertos», «Cerrados»; canal («¿Por dónde llegó el cliente?»:
 *    tienda física, tienda en línea, Instagram, Facebook, WhatsApp, TikTok Shop, llamada); los de la tienda en línea
 *    llegan solos a la misma lista (con «Recoge: fecha · hora»); nuevo pedido desde una foto, un XML (CFDI), importando o
 *    con artículo personalizado; preparar, abonos, imprimir, etiquetas, liga pública; envío manual, gratis o cotizado y
 *    con guía de Envía.com (si lo conectas); cotización → «Convertir a pedido».
 *  - Facturar: factura completa (PUE) o a plazos (PPD + un comprobante de pago por cada abono).
 *  - Reportes: de apartados y de pedidos (Excel, CSV, PDF; enviar o programar).
 *  - Celular: SACSMobile trae apartados y pedidos (crear, cobrar, entregar, imprimir).
 *  - NO existe, y no se anuncia: el anticipo convertido en vale o monedero al cancelar (solo es texto; el sistema
 *    revierte los pagos), entrega por QR que se cierra sola, apartar desde la tienda en línea, conversión automática de
 *    cotizaciones, términos y plan de abonos en la liga pública, WhatsApp automático garantizado (depende de la cuenta).
 * Pantallas: recortes REALES de la cuenta demo (andyaraujoconsultorias, «Polanco Boutique»), 5-oct-2026, con los
 * nombres, teléfonos y direcciones de las clientas de prueba cambiados EN PANTALLA por nombres de ejemplo. Fotos:
 * gpt-image-2.5.
 */

export const I = '/images/producto/apartados-y-pedidos/';
const POS = '/images/producto/punto-de-venta/';

export interface Pieza { id: string; t: string; d: string; img?: string; w?: number; h?: number; tono: 'negro' | 'fucsia' | 'marfil' | 'marino' | 'azul'; ancha?: boolean; alta?: boolean; dibujo?: 'cupon' | 'reloj' | 'factura' | 'liga' | 'sobre' | 'reglas' }

export const INCLUYE: { folio: [string, string]; titulo: string; intro: string; piezas: Pieza[] } = {
  folio: ['01', 'Todo lo que incluye'],
  titulo: 'Del anticipo a la entrega.',
  intro: 'Aparta con anticipo, cobra los abonos donde sea y entrega cuando esté liquidado. Y los pedidos de todos tus canales, en una sola lista.',
  piezas: [
    { id: 'apa-vida', t: 'Apartado con anticipo', d: 'Anticipo mínimo, fecha límite y plan de abonos, desde el carrito.', img: `${I}pantalla-crear.webp`, w: 760, h: 964, tono: 'fucsia', ancha: true },
    { id: 'apa-liga', t: 'Su liga en el celular', d: 'Su saldo, los días que le quedan y sus comprobantes.', dibujo: 'liga', tono: 'azul', alta: true },
    { id: 'apa-cartera', t: 'La cartera a la vista', d: 'Por cobrar, por vencer y a quién cobrarle hoy.', img: `${I}pantalla-lista.webp`, w: 1400, h: 863, tono: 'marfil' },
    { id: 'apa-reglas', t: 'Tus reglas', d: 'Anticipo, plazo, mora, prórrogas y qué pasa si vence.', dibujo: 'reglas', tono: 'negro' },
    { id: 'apa-vida', t: 'Abonos donde sea', d: 'En caja, en el módulo, en el celular o en línea.', img: `${I}pantalla-abono.webp`, w: 900, h: 824, tono: 'marfil' },
    { id: 'ped-sobre', t: 'Vende lo que no tienes', d: 'Sobre pedido: llega y se aparta sola.', tono: 'fucsia', dibujo: 'sobre' },
    { id: 'ped-lista', t: 'Pedidos de todos lados', d: 'Tienda, en línea, Instagram, WhatsApp, TikTok Shop: una lista.', img: `${I}pantalla-pedidos.webp`, w: 1400, h: 863, tono: 'marino', ancha: true },
    { id: 'apa-vida', t: 'La mercancía se separa', d: 'Nadie la vende dos veces; si se cancela, regresa.', img: `${I}pantalla-reserva.webp`, w: 780, h: 480, tono: 'azul', ancha: true },
  ],
};

// «La vida de un apartado» con el scroll: el anillo se llena con lo abonado y la pantalla real de cada paso. Todo es el
// mismo apartado de la cuenta demo (APA-POL-1: dos prendas, $3,480, anticipo de $696 = 20 %).
export const VIDA = {
  k: 'La vida de un apartado',
  h: 'Aparta hoy. Liquida a su ritmo.',
  total: 3480,
  tramos: [
    { n: '01', t: 'Aparta desde el carrito', d: 'Sin salir de la venta. El anticipo mínimo lo pones tú (aquí, 20 %) y la fecha límite sale de tu regla.', img: `${I}pantalla-crear.webp`, w: 760, h: 964, pagado: 696, foto: 'mostrador', alt: 'Crear apartado desde el carrito: la camiseta y el top, la sucursal, el anticipo de $696 (el mínimo, 20 % del total) y su método de pago' },
    { n: '02', t: 'La mercancía se separa', d: 'Pasa de disponible a apartada: nadie la vende dos veces. Si se cancela, regresa sola al inventario.', img: `${I}pantalla-reserva.webp`, w: 780, h: 480, pagado: 696, foto: 'mostrador', alt: 'Movimientos de inventario del apartado: cada prenda con «Mercancía reservada» y verificado' },
    { n: '03', t: 'Le llega su liga', d: 'Por WhatsApp o correo. Ve su saldo, los días que le quedan y cada abono con su comprobante.', img: `${I}pantalla-liga.webp`, w: 780, h: 1688, pagado: 696, foto: 'telefono', cel: true, alt: 'La liga del apartado en el celular de la clienta: apartado vigente, saldo de $2,784, 12 días restantes y el seguimiento' },
    { n: '04', t: 'Abona a su ritmo', d: 'En caja, en el módulo o en línea si conectas Mercado Pago o Stripe. Con su plan de abonos y, si quieres, cargo por mora.', img: `${I}pantalla-abono.webp`, w: 900, h: 824, pagado: 3480, foto: 'telefono', alt: 'Registrar abono: el monto con atajos para liquidar o abonar la mitad, el método de pago y el nuevo saldo' },
    { n: '05', t: 'Se la lleva', d: 'Liquidado, «Entregar al cliente» cierra el apartado y registra la venta. Y si tienes lealtad, gana su cashback.', pagado: 3480, foto: 'entrega', alt: '' },
  ],
};

// «Tus reglas»: frases con las opciones reales de Configuración › Apartados; los valores se van cambiando solos.
export const REGLAS = {
  k: 'Configuración › Apartados',
  h: 'Las reglas las pones tú.',
  p: 'Una vez, para todas tus sucursales. Sacs las aplica en cada apartado, lo haga quien lo haga.',
  frases: [
    { antes: 'Pide un anticipo de', valores: ['30 % del total', '20 % del total', '$500 fijos'], despues: 'en todos los apartados.' },
    { antes: 'Dale', valores: ['15 días', '30 días', '24 horas'], despues: 'para liquidar.' },
    { antes: 'Si vence,', valores: ['cancela y libera la mercancía', 'avisa al vendedor sin cancelar'], despues: '.' },
    { antes: 'Divide el saldo en', valores: ['3 abonos quincenales', '4 abonos semanales', '2 abonos mensuales'], despues: 'y recuérdale antes de cada uno.' },
    { antes: 'Cobra', valores: ['5 % del saldo', '$100 fijos'], despues: 'de mora si se atrasa, y permite hasta 2 prórrogas.' },
    { antes: 'Vuélvelo venta', valores: ['al liquidar', 'al entregar', 'al crear el apartado'], despues: '.' },
  ],
  extra: ['Anticipo distinto por tipo de cliente', 'Aviso de apartado duplicado', 'Tu ticket y tus términos', 'Editar apartados de días cerrados, a tu manera'],
};

// «La cartera, a la vista»: la lista real, el resumen y la ruta de cobranza.
export const CARTERA = {
  k: 'Tu cartera',
  h: 'Sabes cuánto te deben.',
  p: 'Cada apartado con su saldo, su fecha límite y su estado. En «Ver resumen», la cartera completa. Y en «Ruta de cobranza», a quién cobrarle hoy.',
  kpis: [
    { v: '$41,553', t: 'Por cobrar' },
    { v: '22', t: 'Apartados por cobrar' },
    { v: '6', t: 'Liquidados' },
  ],
  puntos: [
    { t: 'Ver resumen', d: 'Por vencer en 7 días, vencidos, tasa de cancelación, antigüedad de la cartera y las clientas con mayor saldo.' },
    { t: 'Ruta de cobranza', d: 'Vencidos, planes atrasados y los que vencen esta semana, con el total esperado.' },
    { t: 'Recordar a varias', d: 'Selecciona y les escribes por WhatsApp, SMS o correo desde tu equipo.' },
  ],
};

// «Pedidos de todos lados»: canales reales de «¿Por dónde llegó el cliente?» y el recorrido de un pedido.
export const PEDIDOS = {
  k: 'Pedidos',
  h: 'Todos tus canales, una sola lista.',
  p: 'Los de la tienda en línea llegan solos; los de Instagram, WhatsApp o una llamada los capturas en un minuto, hasta desde la foto de una nota escrita a mano. Y cada uno sabe por dónde llegó.',
  canales: ['Tienda física', 'Tienda en línea', 'Instagram', 'Facebook', 'WhatsApp', 'TikTok Shop', 'Llamada telefónica'],
  columnas: [
    { t: 'Sin preparar', chip: 'ABIERTO · SIN PREPARAR' },
    { t: 'Preparado', chip: 'PREPARADO · PAGADO' },
    { t: 'Entregado', chip: 'CERRADO · ENTREGADO' },
  ],
  tarjeta: { folio: 'PED-AND-12', cliente: 'Jimena Castro Luna', canal: 'Tienda en línea', total: '$2,583.00', entrega: 'Recoge en sucursal · 10:00' },
  nuevo: ['Búsqueda exacta', 'Importar', 'Desde una foto', 'XML (CFDI)', 'Artículo personalizado'],
  puntos: [
    { t: 'Envío a tu manera', d: 'Manual, gratis o cotizado con Envía.com: generas la guía y la rastreas desde el pedido.' },
    { t: 'De cotización a pedido', d: 'La cotización aceptada se convierte en pedido con su cobro, sin capturar de nuevo.' },
    { t: 'Su liga y su ticket', d: 'Liga pública, PDF con tu diseño, etiquetas y ticket.' },
  ],
};

// «Vende lo que no tienes»: venta sobre pedido.
export const SOBRE = {
  k: 'Sobre pedido',
  h: 'Vende la talla que no tienes.',
  p: 'Activas la venta sobre pedido y el apartado o el pedido se marca «📦 Sobre pedido». Desde ahí pides la mercancía y Sacs hace lo demás.',
  pasos: [
    { t: 'Lo vendes', d: 'Con su anticipo, aunque no esté en tu inventario.' },
    { t: 'Lo pides', d: 'Generas la orden de compra o el traspaso desde el mismo apartado.' },
    { t: 'Llega y se aparta', d: 'Al recibirla, se aparta sola para tu clienta.' },
    { t: 'Le avisamos', d: 'Le llega «¡Tu mercancía ya llegó!» por correo.' },
  ],
  nota: 'Y si se tarda, Sacs te avisa de la mercancía sobre pedido sin entregar.',
};

// «Su liga»: lo que ve la clienta (la página pública real, en su celular).
export const LIGA = {
  k: 'La liga del apartado',
  h: 'Su apartado, en su bolsillo.',
  p: 'Cada apartado y cada pedido tiene su liga. Tu clienta la abre en su celular, sin descargar nada y sin cuenta.',
  puntos: [
    { t: 'Tiempo restante', d: 'Los días que le quedan y la fecha límite, a la vista.' },
    { t: 'Seguimiento', d: 'Apartado, abonando, liquidado, preparado y listo.' },
    { t: 'Sus comprobantes', d: 'Cada abono con su acuse de pago.' },
    { t: 'Recordarme', d: 'Lo agrega a su calendario en un toque.' },
    { t: 'Abona en línea', d: 'Si conectas Mercado Pago o Stripe: abona, liquida o lo pagan entre varias.' },
    { t: 'Tu tienda', d: 'Cómo llegar, tu WhatsApp y tus políticas de cambios y apartados.' },
  ],
};

export const RESUELVE = {
  folio: ['Lo que resuelve', 'En tu mostrador'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'El cuaderno de apartados que nadie entiende.',
    'La prenda apartada que alguien más vendió.',
    'El apartado que venció hace un mes y sigue colgado en la bodega.',
    'La clienta que pregunta cuánto debe y nadie sabe.',
    'El pedido de Instagram que se perdió en el chat.',
  ],
};

export const PREGUNTAS = [
  { question: '¿Puedo pedir un anticipo mínimo?', answer: 'Sí. Por porcentaje del total o como importe fijo; en todos los apartados, a partir de cierto monto o desde cierto número de piezas. Y puedes poner un anticipo distinto por tipo de cliente.' },
  { question: '¿Qué pasa si la clienta no liquida a tiempo?', answer: 'Lo decides tú: el apartado se cancela solo y la mercancía regresa al inventario, o solo te avisa para que hables con ella. Puedes darle prórrogas (con un límite) y cobrar un cargo por mora.' },
  { question: '¿La mercancía apartada se descuenta del inventario?', answer: 'Se separa: pasa de disponible a apartada y queda en el kárdex, así nadie la vende dos veces. Si cambias los productos del apartado, lo reservado se ajusta; si se cancela, regresa.' },
  { question: '¿Mi clienta puede abonar en línea?', answer: 'Sí, desde la liga de su apartado, si conectas Mercado Pago o Stripe y activas los abonos en línea: abona, liquida o lo pagan entre varias. Si no lo activas, el botón «Abonar ahora» la lleva a tu WhatsApp.' },
  { question: '¿Puedo facturar un apartado?', answer: 'Sí. Una factura completa al liquidar, o a plazos: una factura (PPD) y un comprobante de pago por cada abono hasta liquidar.' },
  { question: '¿Los pedidos de mi tienda en línea llegan aquí?', answer: 'Sí, solos y a la misma lista, con su canal. Los que recogen en sucursal traen la fecha y la hora. Los de Instagram, WhatsApp o una llamada los capturas con su canal para saber de dónde vino cada venta.' },
  { question: '¿Puedo vender algo que no tengo en inventario?', answer: 'Con la venta sobre pedido: lo vendes con anticipo, generas la orden de compra o el traspaso y, cuando llega, se aparta sola y a tu clienta le llega un correo de que ya llegó.' },
  { question: '¿Funciona en el celular?', answer: 'Sí. En la app de Sacs para el celular creas apartados y pedidos, registras abonos, mandas la liga y entregas.' },
];
