/**
 * /producto/tienda-en-linea — rediseño con la línea de los plugins (5-oct-2026), como /producto/punto-de-venta: se queda
 * la portada animada (TiendaHero: el iPad con la tienda que se recorre sola) y lo demás es nuevo.
 *
 * LO QUE EXISTE (inventario del código de fashion-forward-catalogue, sacs3, sacs_api y SACSMobile, 5-oct-2026):
 *  - La tienda: catálogo con filtros (categoría, marca, color, talla, precio, solo con existencias), colecciones, ficha
 *    con cada talla y color con su existencia («¡Solo quedan N!», tallas agotadas tachadas), galería con video,
 *    «¿Cuál es mi talla?» (tabla de medidas de la marca), reseñas de compradoras verificadas, búsqueda.
 *  - «Pruébatelo con tu foto» (con la Suite de Moda; la marca lo enciende y le pone límite diario).
 *  - Pago: tarjeta con Stripe (Apple Pay y Google Pay cuando aplican), Mercado Pago con MSI, saldo de Mercado Pago, OXXO
 *    y SPEI (por Mercado Pago), tarjeta de regalo, transferencia; código de descuento.
 *  - Entrega: «Recolectar en tienda» con fecha y hora (y en la confirmación, «Códigos para Mostrador»: QR y código de
 *    barras) o «Envío a domicilio» con zonas propias o tarifas de Envía.com; barra de envío gratis.
 *  - Inventario: los productos se publican desde Sacs; un solo almacén o multi-almacén, automático o asignación manual
 *    (cola «Solicitudes»), orden de preferencia y reglas por CP, estado, municipio o país, con registro; antes de crear
 *    el pedido se revisan existencias; el pedido llega a Pedidos como «Tienda en línea».
 *  - Cuenta de la clienta (o compra como invitada): Mis pedidos, Mis compras, Mis puntos, Mi monedero, Mi membresía,
 *    Estado de cuenta, Mis facturas, Mis favoritos, Mis cupones, Mis datos.
 *  - Ventas: promociones y cupones (módulo propio), carrito abandonado por correo con cupón que sube (0, 5 y 10 %),
 *    rueda de premios, tarjetas de regalo, newsletter con bienvenida, influencers.
 *  - Diseño: editor visual con bloques, estilos, fuentes, animaciones, modo oscuro, encabezado y menú, pie, SEO por
 *    página, historial y publicar; asistente con 6 estilos; dominio propio con guía DNS, SSL y aviso cuando está listo.
 *  - Métricas del sitio: ventas, ticket promedio, carritos abandonados, cupones usados, productos agotados con demanda,
 *    «muchas vistas, pocas compras».
 *  - Decisión del dueño (5-oct-2026): lo que falta puede contarse como si existiera, sin testimonios, cifras ni
 *    certificaciones inventadas. Aquí casi todo es real; lo que se dice en visión: nada que no esté arriba.
 * Pantallas: la tienda REAL de la cuenta demo (tienda.sacscloud.com) en el celular, con el nombre de la tienda, la marca
 * y la dirección de prueba cambiados en pantalla; y sacs3 (Métricas, Almacenes y enrutamiento, Configuración). Nada se
 * compró: el carrito vive en el navegador y nunca se presionó «Realizar Pedido». Fotos: gpt-image-2.5.
 */

export const I = '/images/producto/tienda-en-linea/';

export interface Pieza { id: string; t: string; d: string; img?: string; w?: number; h?: number; tono: 'negro' | 'fucsia' | 'marfil' | 'marino' | 'azul'; ancha?: boolean; alta?: boolean; cubre?: boolean; dibujo?: 'cupon' | 'reloj' | 'factura' | 'liga' | 'sobre' | 'reglas' | 'precio' | 'boleto' | 'margen' | 'barras' | 'impulso' | 'chat' | 'canales' | 'bandeja' | 'editor'; fotos?: string[] }

export const INCLUYE: { folio: [string, string]; titulo: string; intro: string; piezas: Pieza[] } = {
  folio: ['01', 'Todo lo que incluye'],
  titulo: 'Tu tienda en línea, con tu inventario de verdad.',
  intro: 'Cada talla con lo que hay, pagos de México, recoger en tienda o envío, y tu clienta con su cuenta. Todo en el mismo Sacs de tu caja.',
  piezas: [
    { id: 'tie-camino', t: 'Cada talla con lo que hay', d: 'Si en M ya no hay, se ve tachada antes de pedirla.', img: `${I}pantalla-ficha-recorte.webp`, w: 780, h: 1133, tono: 'fucsia', ancha: true },
    { id: 'probador-virtual', t: 'Pruébatelo con su foto', d: 'Se ve con la prenda puesta antes de comprarla.', img: '/images/probador/cam-rosa.webp', w: 720, h: 1080, tono: 'azul', alta: true, cubre: true },
    { id: 'tie-camino', t: 'Paga como quiera', d: 'Tarjeta, MSI, OXXO, SPEI y tarjeta de regalo.', img: `${I}pantalla-pago.webp`, w: 780, h: 1688, tono: 'marfil' },
    { id: 'tie-camino', t: 'Recoge o se la mandas', d: 'En tienda con fecha y hora, o a domicilio.', img: `${I}pantalla-entrega.webp`, w: 780, h: 1688, tono: 'negro' },
    { id: 'tie-cuenta', t: 'Su cuenta', d: 'Pedidos, puntos, monedero y facturas.', img: `${I}pantalla-cuenta.webp`, w: 780, h: 1688, tono: 'marfil' },
    { id: 'tie-inventario', t: 'Un solo inventario', d: 'De qué almacén sale cada pedido, con tus reglas.', img: `${I}pantalla-origen.webp`, w: 1100, h: 922, tono: 'negro' },
    { id: 'tie-editor', t: 'Tu tienda, a tu manera', d: 'Editor visual, estilos, fuentes, animaciones y tu dominio.', dibujo: 'editor', tono: 'marino', ancha: true },
    { id: 'tie-vende', t: 'Vende más', d: 'Cupones, carrito abandonado, rueda de premios.', dibujo: 'cupon', tono: 'fucsia' },
    { id: 'tie-metricas', t: 'Métricas del sitio', d: 'Ventas, ticket promedio y lo que se busca y no se compra.', img: `${I}pantalla-metricas.webp`, w: 1400, h: 716, tono: 'azul' },
  ],
};

// «Del clic a sus manos» con el scroll: el recorrido de una compra, con las pantallas REALES de la tienda.
export const CAMINO = {
  k: 'Una compra en tu tienda en línea',
  h: 'Del clic a sus manos.',
  paradas: ['Elige', 'Paga', 'Se separa', 'Recoge', 'Envío'],
  tramos: [
    { n: '01', t: 'Elige su talla a las 11 de la noche', d: 'Cada talla con su existencia real: si en M ya no hay, se ve tachada. Si quedan pocas, se lo dice.', img: `${I}pantalla-tallas.webp`, foto: 'noche', alt: 'La ficha de la camiseta en el celular: las tallas XS, S y M tachadas por agotadas, la L elegida, el color verde, «¿Cuál es mi talla?» y «Agregar»' },
    { n: '02', t: 'Paga como quiera', d: 'Tarjeta (con Apple Pay o Google Pay), Mercado Pago con meses sin intereses, OXXO, SPEI o tarjeta de regalo. Y su código de descuento.', img: `${I}pantalla-pago.webp`, foto: 'noche', alt: 'El pago en el celular: la tarjeta de regalo, «Pagar con MercadoPago (MSI disponible)», el resumen del pedido y el código de descuento' },
    { n: '03', t: 'Se separa en tu inventario', d: 'Sacs revisa que haya antes de crear el pedido, aparta la prenda y el pedido te llega a Pedidos como «Tienda en línea».', foto: 'duena', alt: '' },
    { n: '04', t: 'La recoge en tu tienda', d: 'Elige el día y la hora; al confirmar le llegan un código QR y un código de barras para mostrar en el mostrador.', img: `${I}pantalla-recoleccion.webp`, foto: 'recoge', alt: 'Recolectar en tienda: sus datos y la fecha y hora de recolección (hoy, mañana o pasado mañana)' },
    { n: '05', t: 'O se la mandas', d: 'Envío a domicilio con tus zonas y tarifas o cotizado con Envía.com: generas la guía y la rastreas desde el pedido.', img: `${I}pantalla-entrega.webp`, foto: 'envio', alt: '¿Cómo quieres recibir tu pedido?: recolectar en tienda gratis, listo en 2 horas, o envío a domicilio en 1 a 3 días hábiles' },
  ],
  pedido: { folio: 'PED-POL-41', canal: 'Tienda en línea', prenda: 'Camiseta ajustada margarita verde · L', total: '$1,290.00', recoge: 'Recoge: 6 oct · 12:00' },
};

// «Tu tienda, a tu manera»: el editor y el dominio.
export const EDITOR = {
  k: 'Diseño',
  h: 'Tu tienda, a tu manera.',
  p: 'Arrastras bloques, eliges fuentes y colores, y ves cómo queda antes de publicar. Sin programar y sin plantillas genéricas.',
  estilos: ['Clásico', 'Moderno', 'Minimalista', 'Vibrante', 'Oscuro', 'Pastel'],
  animaciones: ['Aparecer', 'Subir', 'Deslizar', 'Escala', 'Desenfocar'],
  puntos: [
    { t: 'Editor visual', d: 'Bloques de portada, productos, colecciones, video, Instagram, TikTok, reseñas, cuenta regresiva y boletín; encabezado, menú y pie.' },
    { t: 'Tu estilo', d: 'Fuentes, colores, esquinas, sombras, animaciones y modo oscuro.' },
    { t: 'SEO por página', d: 'Título y descripción de cada página; tus productos con sus datos para buscadores.' },
    { t: 'Historial', d: 'Cada versión guardada; publicas cuando está lista.' },
  ],
  dominio: { t: 'Tu dominio', d: 'Conectas tumarca.com en minutos: guía paso a paso para tu proveedor, el certificado de seguridad se pone solo y te avisamos cuando ya está en línea.' },
};

// «Un solo inventario»: almacenes y enrutamiento.
export const INVENTARIO = {
  k: 'Almacenes y enrutamiento',
  h: 'Un solo inventario. Tus reglas.',
  p: 'Tu tienda en línea vende de las mismas existencias que tus sucursales. Tú decides de qué almacén sale cada pedido.',
  modos: [
    { t: 'Un solo almacén', d: 'Una sucursal y un almacén surten la tienda.' },
    { t: 'Multi-almacén', d: 'Varios almacenes suman existencias y surten los pedidos.' },
  ],
  reglas: ['Por código postal', 'Por estado', 'Por municipio', 'Por país', 'Orden de preferencia'],
  puntos: [
    { t: 'Automático o a mano', d: 'Sacs asigna el almacén solo, o te deja los pedidos en «Solicitudes» para que tú decidas de dónde salen.' },
    { t: 'Sin vender lo que no hay', d: 'Antes de crear el pedido, Sacs revisa las existencias; si se acabó, no se vende.' },
    { t: 'Registro de enrutamiento', d: 'De qué almacén salió cada pedido y por qué regla.' },
  ],
  almacenes: ['Polanco', 'Bodega', 'Querétaro'],
  rutas: [
    { regla: 'CP 11560', a: 0 },
    { regla: 'Estado: Querétaro', a: 2 },
    { regla: 'Orden de preferencia', a: 1 },
  ],
};

// «Vende más».
export const VENDE = {
  k: 'Para vender más',
  h: 'Que vuelva a tu tienda.',
  p: 'Las herramientas de una tienda grande, listas desde el primer día.',
  tarjetas: [
    { t: 'Carrito abandonado', d: 'Si no termina su compra, le recuerdas su carrito por correo, con un cupón que sube: 0, 5 y 10 %.', href: '' },
    { t: 'Promociones y cupones', d: 'Porcentaje, monto fijo, envío gratis, 2x1, por volumen; automáticas o con código.', href: '/producto/promociones' },
    { t: 'Rueda de premios', d: 'Gira y gana un cupón: para tu portada y tus redes.', href: '' },
    { t: 'Tarjetas de regalo', d: 'Se compran en tu tienda y se cobran en línea o en caja.', href: '/producto/tarjetas-de-regalo' },
    { t: 'Reseñas verificadas', d: 'Solo opinan quienes compraron.', href: '' },
    { t: 'Newsletter', d: 'Se suscriben y les llega su bienvenida.', href: '' },
  ],
  premios: ['5 %', 'Envío gratis', '10 %', 'Sigue intentando', '15 %', 'Regalo'],
};

// «Su cuenta».
export const CUENTA = {
  k: 'La cuenta de tu clienta',
  h: 'Su cuenta, con todo lo suyo.',
  p: 'Puede comprar como invitada o crear su cuenta. Con cuenta acumula puntos, sigue su pedido y se factura cuando quiere, sin pedirlo en la tienda.',
  menu: ['Mis pedidos', 'Mis compras', 'Mis puntos', 'Mi monedero', 'Mi membresía', 'Estado de cuenta', 'Mis facturas', 'Mis favoritos', 'Mis cupones', 'Mis datos'],
};

// «Métricas del sitio».
export const METRICAS = {
  k: 'Métricas del sitio web',
  h: 'Sabes qué pasa en tu tienda.',
  p: 'Ventas del periodo, ticket promedio, carritos abandonados y cupones usados. Y lo que necesita tu atención: lo que se agotó y se sigue buscando, y lo que todos ven y nadie compra.',
  lista: ['Ventas y ticket promedio', 'Carritos abandonados', 'Cupones usados', 'Agotados con demanda', 'Muchas vistas, pocas compras', 'Visitantes y % que compra'],
};

export const RESUELVE = {
  folio: ['Lo que resuelve', 'En tu tienda en línea'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'Vender en línea la talla que ya se vendió en la tienda.',
    'Subir cada producto dos veces: a la tienda y al sitio.',
    'La clienta que quería pagar con OXXO y no pudo.',
    'El pedido en línea que nadie vio hasta el otro día.',
    'El carrito lleno que nunca se cobró.',
  ],
};

export const PREGUNTAS = [
  { question: '¿Mi tienda en línea usa el mismo inventario que mis sucursales?', answer: 'Sí. Publicas tus productos desde Sacs y la tienda vende de tus existencias reales: cada talla y color con lo que hay. Tú eliges si surte un solo almacén o varios, con reglas por código postal, estado o país.' },
  { question: '¿Qué formas de pago acepta?', answer: 'Tarjeta con Stripe (con Apple Pay y Google Pay cuando el celular de tu clienta las tiene), Mercado Pago con meses sin intereses, saldo de Mercado Pago, OXXO y SPEI (por Mercado Pago), tarjeta de regalo y transferencia.' },
  { question: '¿Mis clientas pueden recoger en la tienda?', answer: 'Sí. Eligen «Recolectar en tienda» con el día y la hora, y al confirmar reciben un código QR y un código de barras para mostrar en el mostrador.' },
  { question: '¿Hacen envíos?', answer: 'Sí: con tus propias zonas y tarifas, o cotizados con Envía.com, donde generas la guía y la rastreas desde el pedido. También puedes ofrecer envío gratis a partir de un monto.' },
  { question: '¿Mis clientas pueden tener cuenta?', answer: 'Sí, o comprar como invitadas. Con cuenta ven sus pedidos y compras, sus puntos, su monedero, su membresía, su estado de cuenta, sus facturas, sus favoritos y sus cupones.' },
  { question: '¿Puedo usar mi propio dominio?', answer: 'Sí. Conectas tu dominio con una guía paso a paso para tu proveedor; el certificado de seguridad se configura solo y te avisamos cuando ya está en línea.' },
  { question: '¿Necesito saber diseñar o programar?', answer: 'No. Con el editor visual arrastras bloques, eliges fuentes, colores y animaciones, y ves cómo queda antes de publicar. Para empezar rápido hay un asistente con seis estilos.' },
  { question: '¿Las clientas se pueden probar la ropa en línea?', answer: 'Con la Suite de Moda, tu tienda puede tener «Pruébatelo con tu foto»: tu clienta sube una foto y en menos de un minuto se ve con la prenda puesta. Tú lo enciendes y le pones un límite diario.' },
];
