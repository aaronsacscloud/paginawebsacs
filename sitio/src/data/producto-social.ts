/**
 * /producto/social-commerce — rediseño con la línea de los plugins (5-oct-2026), como /producto/punto-de-venta. Esta
 * página no tenía video: el iPad de arriba lleva una imagen de la dinámica en vivo (dibujada con el diseño de Sacs).
 *
 * Decisión del dueño (5-oct-2026): lo que todavía no está terminado se presenta como si existiera («la idea es que vean
 * lo que se podrá hacer»), sin testimonios, cifras ni certificaciones inventadas.
 *
 * LO QUE EXISTE HOY en el código (inventario de sacs3, sacs_api y sacs_inbox, 5-oct-2026):
 *  - Dinámicas de Redes (plugin, Clientes › Dinámicas): canal Instagram/Facebook/TikTok/WhatsApp; tipo Live, Unboxing,
 *    Promoción o Subasta; en vivo, quien modera crea el PEDIDO o el APARTADO real (separa la prenda y registra el
 *    anticipo) y manda la liga por Instagram, Facebook o WhatsApp; la liga del apartado puede cobrar en línea (Stripe o
 *    Mercado Pago, si se activa); «Terminar Dinámica» regresa lo no vendido; estadísticas (vendido, apartado, devuelto,
 *    conversión, ticket promedio).
 *  - TikTok Shop por API: catálogo (en revisión, por corregir), inventario después de cada movimiento, precios,
 *    pedidos pagados con su canal y la liquidación con la comisión de la plataforma.
 *  - Facebook e Instagram: catálogo en XML con variantes, talla, color, precio y disponibilidad para Commerce Manager.
 *  - WhatsApp: ticket, liga del apartado o del pedido, recordatorios y «ya puede recoger» con un toque; el ticket trae
 *    «Factura tu compra». SACS Inbox (app aparte): bandeja compartida, plantillas, campañas y un agente con IA que busca
 *    existencias por talla y color, manda fotos y crea el pedido (hoy pausado en producción).
 *  - Pedidos con su canal («¿Por dónde llegó el cliente?»: Instagram, Facebook, WhatsApp, TikTok Shop…).
 *  - Estudio de moda: reels y carruseles con liga rastreada por red (qué publicación trajo la venta).
 *  - SE PRESENTA COMO VISIÓN (aún no en el código): mensajes de Instagram y Facebook en la misma bandeja, el agente que
 *    cobra con liga de pago y aparta, el reporte de ventas por red social.
 * Fotos: gpt-image-2.5. Pantallas: TikTok Shop y Facebook/Instagram de la cuenta demo; lo demás dibujado con el diseño y
 * los textos de Sacs.
 */

export const I = '/images/producto/social-commerce/';
const APA = '/images/producto/apartados-y-pedidos/';
const PRO = '/images/producto/promociones/';

export interface Pieza { id: string; t: string; d: string; img?: string; w?: number; h?: number; tono: 'negro' | 'fucsia' | 'marfil' | 'marino' | 'azul'; ancha?: boolean; alta?: boolean; cubre?: boolean; dibujo?: 'cupon' | 'reloj' | 'factura' | 'liga' | 'sobre' | 'reglas' | 'precio' | 'boleto' | 'margen' | 'barras' | 'impulso' | 'chat' | 'canales' | 'bandeja'; fotos?: string[] }

export const INCLUYE: { folio: [string, string]; titulo: string; intro: string; piezas: Pieza[] } = {
  folio: ['01', 'Todo lo que incluye'],
  titulo: 'Tus redes venden. Sacs cobra y separa.',
  intro: 'Lives, mensajes y catálogos en Instagram, Facebook, TikTok y WhatsApp, con el mismo inventario de tu tienda.',
  piezas: [
    { id: 'soc-vivo', t: 'Ventas en vivo', d: 'Mientras transmites, cada «¡lo quiero!» se vuelve pedido o apartado.', img: `${I}live-900.webp`, w: 900, h: 600, tono: 'fucsia', ancha: true, cubre: true },
    { id: 'soc-whats', t: 'WhatsApp que vende', d: 'Responde con existencias reales, manda fotos y la liga para pagar.', dibujo: 'chat', tono: 'azul', alta: true },
    { id: 'soc-catalogo', t: 'TikTok Shop', d: 'Catálogo, inventario, pedidos y envíos, sincronizados.', img: `${I}pantalla-tiktok-panel.webp`, w: 1600, h: 947, tono: 'negro' },
    { id: 'soc-catalogo', t: 'Facebook e Instagram', d: 'Tu catálogo en Commerce Manager, solo.', img: `${I}pantalla-meta.webp`, w: 1100, h: 564, tono: 'marfil' },
    { id: 'soc-vivo', t: 'La liga, por DM', d: 'Su apartado con «Abonar ahora», por Instagram o WhatsApp.', dibujo: 'liga', tono: 'marfil' },
    { id: 'soc-canal', t: 'Cada pedido con su red', d: 'Instagram, TikTok, WhatsApp o Facebook.', img: `${APA}pantalla-pedidos.webp`, w: 1400, h: 863, tono: 'negro' },
    { id: 'soc-contenido', t: 'Contenido que vende', d: 'Reels y carruseles desde tus fotos, con su liga rastreada.', img: `${I}foto-900.webp`, w: 900, h: 600, tono: 'marino', ancha: true, cubre: true },
    { id: 'soc-whats', t: 'Una bandeja para tu equipo', d: 'WhatsApp, Instagram y Facebook en un solo lugar.', dibujo: 'bandeja', tono: 'fucsia' },
    { id: 'soc-canal', t: 'Qué red vendió', d: 'Ventas por canal, sin adivinar.', dibujo: 'canales', tono: 'azul' },
  ],
};

// «Una dinámica en vivo» con el scroll: la transmisión y el panel de Sacs.
export const VIVO = {
  k: 'Dinámicas de redes',
  h: 'Vende en vivo, sin perder un pedido.',
  tramos: [
    { n: '01', t: 'Programas tu dinámica', d: 'Live, unboxing, promoción o subasta; en Instagram, Facebook, TikTok o WhatsApp. Con sus prendas, su meta y quién modera.' },
    { n: '02', t: '«¡La quiero en M!»', d: 'Quien modera crea el pedido o el apartado con un clic: la prenda se separa del inventario en ese momento.' },
    { n: '03', t: 'Su liga, por mensaje', d: 'Se la mandas por Instagram, Facebook o WhatsApp: su apartado con lo que pagó y lo que debe.' },
    { n: '04', t: 'Paga en línea', d: 'Con Mercado Pago o tarjeta, desde su liga. El abono entra solo.' },
    { n: '05', t: 'Terminas y sabes cuánto vendiste', d: 'Lo que no se vendió regresa al inventario. Vendido, apartado, conversión y ticket promedio.' },
  ],
  comentarios: [
    { u: 'fer.ruiz', t: '¡La quiero en M! 😍' },
    { u: 'majo_lopez', t: '¿Hay en negro?' },
    { u: 'sofi.hdz', t: 'Apártame una en S 🙋‍♀️' },
    { u: 'dani.torres', t: '¿Cuánto cuesta?' },
    { u: 'regi_diaz', t: 'Yo la quiero en L' },
    { u: 'cami.ortiz', t: '¿Hacen envíos a Monterrey?' },
  ],
  prenda: { t: 'Gabardina camel', tallas: ['S', 'M', 'L'], precio: '$2,890' },
};

// «WhatsApp que vende»: la conversación con el agente con IA (y lo que ya sale por WhatsApp con un toque).
export const WHATS = {
  k: 'WhatsApp',
  h: 'Contesta a las 11 de la noche.',
  p: 'Un agente con IA contesta por WhatsApp con tu inventario real: tallas, colores y sucursal. Manda fotos, aparta, comparte la liga para pagar y, cuando hace falta, te pasa la conversación.',
  chat: [
    { de: 'c', t: '¿Tienen la camiseta estampada azul en M? 🙏' },
    { de: 'a', t: 'Sí 🙌 Quedan 2 en talla M en Polanco Boutique. Es de $1,290.', img: `${PRO}prenda-azul.webp` },
    { de: 'c', t: '¡Apártamela! La recojo el sábado' },
    { de: 'a', t: 'Listo, te la aparté. Aquí está tu apartado: puedes abonar en línea cuando quieras.', liga: true },
  ],
  puntos: [
    { t: 'Ticket y factura', d: 'El ticket le llega por WhatsApp con su liga para facturar.' },
    { t: 'Apartados y pedidos', d: 'Su liga, los recordatorios y «ya puede recoger», con un toque.' },
    { t: 'Una bandeja para tu equipo', d: 'WhatsApp, Instagram y Facebook en un solo lugar, con plantillas, etiquetas y quién atiende.' },
    { t: 'Campañas', d: 'Mensajes a tus clientas con plantillas aprobadas.' },
  ],
};

// «Tu catálogo, en cada red»: TikTok Shop y Facebook/Instagram.
export const CATALOGO = {
  k: 'Catálogos',
  h: 'Tu catálogo, en cada red.',
  p: 'Lo das de alta una vez en Sacs y aparece en TikTok Shop, Facebook e Instagram con su foto, sus tallas, sus colores y su precio.',
  tiktok: {
    t: 'TikTok Shop',
    d: 'Autorizas a Sacs en TikTok (sin claves) y publicas tu catálogo en cinco pasos: almacén, categorías, comprobación, publicación y revisión. Desde ahí, el inventario sube después de cada venta, los pedidos pagados llegan solos a Sacs, despachas con su guía y ves la liquidación con la comisión de TikTok.',
    estados: ['Pedidos por vencerse', 'Publicados', 'En revisión', 'Por corregir', 'Inventario detenido', 'Lo que se está vendiendo', 'Devoluciones y cancelaciones'],
  },
  meta: {
    t: 'Facebook e Instagram',
    d: 'Tu catálogo en Commerce Manager con variantes, talla, color, precio y disponibilidad, para etiquetar tus productos en Instagram y Facebook y anunciarlos.',
    estados: ['Sincronización automática', 'Etiquetas en Instagram', 'Anuncios con tu catálogo'],
  },
};

// «Cada pedido sabe de qué red vino».
export const CANAL = {
  k: 'Por canal',
  h: 'Sabes qué red te vende.',
  p: 'Cada pedido guarda por dónde llegó la clienta y tu reporte te dice cuánto vendió cada red, cada live y cada publicación.',
  canales: [
    { t: 'Instagram', v: 92 },
    { t: 'TikTok Shop', v: 71 },
    { t: 'WhatsApp', v: 64 },
    { t: 'Facebook', v: 38 },
    { t: 'Tienda en línea', v: 55 },
  ],
};

// «Contenido que vende»: el estudio de moda.
export const CONTENIDO = {
  k: 'Contenido',
  h: 'Del perchero a tus redes, en minutos.',
  p: 'Con el estudio de moda de Sacs, la foto de tu prenda se vuelve fotos en escenario, reels, carruseles e historias. Cada publicación lleva su liga a tu tienda, así sabes cuál vendió.',
  tipos: ['Fotos en escenario', 'Reels', 'Carruseles', 'Historias', 'Lanzamiento', 'Looks'],
};

export const RESUELVE = {
  folio: ['Lo que resuelve', 'En tus redes'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'El «¡lo quiero!» del live que nadie apuntó.',
    'La prenda que se vendió dos veces: una en el live y otra en el mostrador.',
    'Los mensajes que se contestan al otro día.',
    'El catálogo de Instagram con precios de hace dos meses.',
    'No saber qué red te deja dinero.',
  ],
};

export const PREGUNTAS = [
  { question: '¿Qué redes puedo conectar?', answer: 'Instagram, Facebook, TikTok Shop y WhatsApp. El inventario es el mismo de tu tienda física y de tu tienda en línea.' },
  { question: '¿Cómo funciona una venta en vivo?', answer: 'Programas la dinámica con sus prendas. Durante el live, quien modera crea el pedido o el apartado con un clic (la prenda se separa del inventario) y le manda a la clienta su liga por mensaje; la clienta puede pagar en línea. Al terminar, lo que no se vendió regresa al inventario.' },
  { question: '¿El agente de WhatsApp contesta solo?', answer: 'Sí: contesta con tu inventario real (talla, color y sucursal), manda fotos, aparta y comparte la liga para pagar. Cuando la conversación lo necesita, te la pasa a ti o a tu equipo.' },
  { question: '¿Necesito WhatsApp Business?', answer: 'Para el agente y la bandeja compartida se usa la API oficial de WhatsApp Business. Para mandar tickets, ligas y recordatorios desde Sacs basta con tu WhatsApp.' },
  { question: '¿Cómo se sincroniza TikTok Shop?', answer: 'Conectas tu cuenta y Sacs publica tu catálogo, sube el inventario después de cada venta y trae los pedidos pagados con su liquidación y la comisión de TikTok.' },
  { question: '¿Y Facebook e Instagram?', answer: 'Sacs genera el catálogo de tus productos con variantes, talla, color, precio y disponibilidad, y Commerce Manager lo actualiza solo; así etiquetas tus productos en tus publicaciones.' },
  { question: '¿Cómo sé qué red me vende más?', answer: 'Cada pedido guarda su canal y tu reporte de pedidos te dice cuánto vendió cada red. Las publicaciones del estudio de moda llevan su liga rastreada a tu tienda.' },
];
