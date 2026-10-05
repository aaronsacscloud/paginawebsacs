/**
 * /producto/agentic-commerce — rediseño con la línea de los plugins (5-oct-2026), como /producto/punto-de-venta: se
 * queda el video de arriba y lo demás es nuevo, con entradas y animaciones distintas entre secciones.
 *
 * DECISIÓN DEL DUEÑO (5-oct-2026): «Sácalo como si existiría, la idea es que vean lo que se podrá hacer». La página
 * presenta la visión completa como disponible, SIN testimonios, nombres de clientes, cifras de resultados,
 * certificaciones ni logos de terceros; las pantallas de visión van dibujadas con el diseño de Sacs y los números que
 * aparecen en ellas dicen «Ejemplo».
 *
 * LO QUE EXISTE HOY EN EL CÓDIGO (inventario de sacs_api, sacs3, fashion-forward-catalogue y sacs_inbox, 5-oct-2026):
 *  - Catálogos en XML para Meta y TikTok (variantes, talla, color, precio, disponibilidad; caché de 15 min):
 *    api.sacscloud.com/feeds/<cuenta>/meta|tiktok/products.xml. OJO: las ligas de producto del feed apuntan a
 *    <cuenta>.sacscloud.com/product/… y hoy dan 404 (deben ir a tienda.sacscloud.com/<cuenta>/product/…).
 *  - Datos schema.org Product en cada ficha de la tienda (nombre, imagen, descripción, sku, marca, precio MXN,
 *    disponibilidad, url), pero los agrega el navegador: los rastreadores que no corren JavaScript no los ven.
 *  - Pantallas «Canales de IA» en Comercio en línea (ChatGPT, Gemini, Claude, Muse) con «Activar»: hoy solo guardan
 *    un interruptor y muestran una animación.
 *  - MCP público con 6 calculadoras de moda en www.sacscloud.com/api/mcp (curva de tallas, sale o no sale, nivelar
 *    entre tiendas, margen, punto de reorden, costo de maquila).
 *  - Agente de WhatsApp para clientas en SACS Inbox (existencias por talla, color y sucursal, fotos, carrito, pedido,
 *    pasar a una persona), hoy sin acceso al API en producción y oculto en sacs3; cobrar, facturar, descuentos y envíos
 *    los pasa a una persona; no crea apartados.
 *  - AXO para el equipo dentro de Sacs (pedidos, apartados, promociones con confirmación).
 * LO QUE SE PRESENTA COMO VISIÓN (falta construir): indexar el catálogo en ChatGPT, Gemini, Perplexity y Claude
 * (feeds para asistentes, compra desde el asistente), feed de Google Merchant, llms.txt y sitemap por tienda, datos de
 * producto servidos en el HTML, el agente de WhatsApp que aparta y manda la liga de pago, «Sacs en tu IA» (MCP con tu
 * cuenta para Claude o ChatGPT, con lectura y acciones confirmadas) y la atribución de ventas por asistente de IA.
 * Fotos: gpt-image-2.5. Pantallas reales: «Canales de IA» de la cuenta demo (con su nombre cambiado en pantalla).
 */

export const I = '/images/producto/agentic-commerce/';
const P = '/images/probador/';
const APA = '/images/producto/apartados-y-pedidos/';

export interface Pieza { id: string; t: string; d: string; img?: string; w?: number; h?: number; tono: 'negro' | 'fucsia' | 'marfil' | 'marino' | 'azul'; ancha?: boolean; alta?: boolean; cubre?: boolean; dibujo?: 'cupon' | 'reloj' | 'factura' | 'liga' | 'sobre' | 'reglas' | 'precio' | 'boleto' | 'margen' | 'barras' | 'impulso' | 'chat' | 'canales' | 'bandeja' | 'ias'; fotos?: string[] }

export const INCLUYE: { folio: [string, string]; titulo: string; intro: string; piezas: Pieza[] } = {
  folio: ['01', 'Todo lo que incluye'],
  titulo: 'Que la IA venda tus prendas.',
  intro: 'Tu catálogo listo para que los asistentes de IA lo lean, una vendedora con IA en WhatsApp y Sacs dentro de tu propia IA.',
  piezas: [
    { id: 'gag-pregunta', t: 'Te recomiendan las IAs', d: 'ChatGPT, Gemini y Perplexity sugieren tus prendas con su precio y su talla al día.', img: `${I}pantalla-chatgpt.webp`, w: 1400, h: 881, tono: 'fucsia', ancha: true },
    { id: 'gag-whats', t: 'Tu vendedora de WhatsApp', d: 'Contesta a cualquier hora con tu inventario real y aparta.', dibujo: 'chat', tono: 'azul', alta: true },
    { id: 'gag-catalogo', t: 'Catálogo legible', d: 'Feeds en vivo y datos de producto en cada ficha.', img: `${I}tarjeta-jsonld.webp`, w: 760, h: 520, tono: 'negro' },
    { id: 'gag-canales', t: 'Un clic por asistente', d: 'ChatGPT, Gemini, Claude o Muse, desde Sacs.', img: `${I}pantalla-gemini.webp`, w: 1400, h: 881, tono: 'marfil' },
    { id: 'gag-pregunta', t: 'La venta entra a Sacs', d: 'Como cualquier pedido, con el asistente que la trajo.', img: `${APA}pantalla-pedidos.webp`, w: 1400, h: 863, tono: 'marino' },
    { id: 'gag-mcp', t: 'Sacs en tu IA', d: 'Pregúntale a Claude o ChatGPT por tu negocio.', img: `${I}sofa-900.webp`, w: 900, h: 600, tono: 'negro', cubre: true },
    { id: 'gag-pregunta', t: 'De la pregunta a su puerta', d: 'Pregunta, compra en tu tienda y le llega a su casa.', img: `${I}entrega-900.webp`, w: 900, h: 600, tono: 'fucsia', ancha: true, cubre: true },
    { id: 'gag-atribucion', t: 'Qué IA te vendió', d: 'Pedidos y ventas por asistente.', dibujo: 'ias', tono: 'azul' },
    { id: 'gag-mcp', t: 'Calculadoras en tu IA', d: 'Curva de tallas, margen, reorden y más, gratis.', img: `${I}tarjeta-mcp.webp`, w: 760, h: 520, tono: 'marfil' },
  ],
};

// «Una pregunta, una venta» con el scroll.
export const PREGUNTA = {
  k: 'Una pregunta, una venta',
  h: 'Tu clienta ya no busca en Google. Le pregunta a una IA.',
  pregunta: 'Busco un vestido para una boda de día en Querétaro, talla M, que no pase de $2,000',
  tramos: [
    { n: '01', t: 'Le pregunta a su asistente', d: 'En ChatGPT, Gemini o Perplexity, como le preguntaría a una amiga.', foto: 'pregunta' },
    { n: '02', t: 'La IA lee tu catálogo en vivo', d: 'Precio, tallas, colores y existencias por sucursal, al día.', foto: 'pregunta' },
    { n: '03', t: 'Recomienda tus prendas', d: 'Con foto, precio y «talla M disponible». Y la liga a tu tienda.', foto: 'sofa' },
    { n: '04', t: 'Compra en tu tienda o aparta', d: 'Paga en tu tienda en línea o te escribe por WhatsApp para apartar.', foto: 'sofa' },
    { n: '05', t: 'Llega a Sacs con su origen', d: 'Un pedido como cualquier otro, con el asistente que la trajo.', foto: 'entrega' },
  ],
  catalogo: [
    { p: 'Vestido slip satén · rosa', t: 'M', s: '3 en Polanco', precio: '$1,890', ok: true },
    { p: 'Vestido slip satén · verde', t: 'M', s: '2 en Santa Fe', precio: '$1,890', ok: true },
    { p: 'Vestido slip satén · negro', t: 'M', s: 'Agotado', precio: '$1,890', ok: false },
    { p: 'Blazer de lino · azul', t: 'M', s: '1 en Polanco', precio: '$2,290', ok: false },
    { p: 'Camisa de popelina · blanco', t: 'M', s: '5 en Polanco', precio: '$1,190', ok: false },
  ],
  recomendados: [
    { img: `${P}cat-vestido-rosa-360.webp`, t: 'Vestido slip satén rosa', precio: '$1,890', nota: 'Talla M disponible' },
    { img: `${P}cat-vestido-verde-360.webp`, t: 'Vestido slip satén verde', precio: '$1,890', nota: 'Talla M disponible' },
  ],
};

// «Tu catálogo, legible para las IAs»: feeds y datos de producto (la forma REAL del JSON-LD de la tienda).
export const CATALOGO = {
  k: 'Tu catálogo para las IAs',
  h: 'Tu catálogo, en el idioma de las IAs.',
  p: 'Sacs publica tu catálogo para los asistentes de IA y los buscadores, y cada ficha de tu tienda lleva sus datos de producto. Cambias un precio en Sacs y cambia en todos lados.',
  feeds: [
    { t: 'Asistentes de IA', d: 'ChatGPT, Gemini, Perplexity y Claude' },
    { t: 'Google', d: 'Merchant Center y resultados con precio' },
    { t: 'Meta', d: 'Catálogo de Facebook e Instagram' },
    { t: 'TikTok', d: 'Catálogo de TikTok Shop' },
  ],
  extra: ['schema.org Product en cada ficha', 'llms.txt de tu tienda', 'Sitemap de productos', 'Precio y existencias al día'],
  // la misma forma que arma fashion-forward-catalogue/src/lib/productSeo.ts (buildProductJsonLd)
  jsonld: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Vestido slip satén",
  "image": ["https://…/vestido-slip-saten-rosa.webp"],
  "description": "Vestido midi de satén con tirantes",
  "sku": "VES-SAT-ROS-M",
  "brand": { "@type": "Brand", "name": "Polanco Boutique" },
  "offers": {
    "@type": "Offer",
    "url": "https://tienda.sacscloud.com/…",
    "price": 1890,
    "priceCurrency": "MXN",
    "availability": "https://schema.org/InStock"
  }
}`,
};

// «Un clic por asistente»: las pantallas REALES de Canales de IA y la activación.
export const CANALES = {
  k: 'Comercio en línea › Canales de IA',
  h: 'Un clic, y tu catálogo entra.',
  p: 'Desde Sacs activas cada asistente. Tus productos ya tienen fotos, tallas, colores y precios: no capturas nada extra, y tu inventario se mantiene al día solo.',
  pasos: ['Leyendo tu catálogo · 147 productos', 'Optimizando fotos, tallas, colores y precios', 'Indexando en ChatGPT'],
  listo: 'Indexado y listo en ChatGPT',
  asistentes: ['ChatGPT', 'Gemini', 'Claude', 'Muse'],
};

// «Tu vendedora de WhatsApp con IA».
export const WHATS = {
  k: 'Agente de WhatsApp',
  h: 'Tu vendedora no se va a dormir.',
  p: 'Un agente con IA atiende tu WhatsApp con tu inventario real: existencias por talla, color y sucursal, fotos, precios y promociones. Aparta, comparte la liga para pagar y, cuando hace falta, te pasa la conversación con todo el contexto.',
  chat: [
    { de: 'c', t: 'Hola, ¿tienen el blazer de lino azul en M? Lo necesito para el viernes', h: '23:48' },
    { de: 'a', t: '¡Hola! Sí 🙌 Nos queda 1 en M en Polanco y 2 en Santa Fe. Es de $2,290.', h: '23:48', img: `${P}cat-blazer-360.webp` },
    { de: 'c', t: '¿Me lo apartas en Polanco?', h: '23:49' },
    { de: 'a', t: 'Listo, te lo aparté hasta el sábado. Aquí puedes dejar tu anticipo:', h: '23:49', liga: 'Tu apartado · Abonar ahora' },
  ],
  puntos: [
    { t: 'A cualquier hora', d: 'Contesta en segundos, también de noche y en fin de semana.' },
    { t: 'Con tu inventario real', d: 'Talla, color y sucursal; fotos y precios al día.' },
    { t: 'Aparta y cobra', d: 'Separa la prenda y manda la liga para pagar.' },
    { t: 'Te pasa la conversación', d: 'Cuando hace falta una persona, con todo el contexto.' },
  ],
};

// «Sacs en tu IA»: el MCP para la dueña.
export const MCP = {
  k: 'Sacs en tu IA',
  h: 'Tu negocio, en tu propia IA.',
  p: 'Conectas tu cuenta de Sacs a Claude o ChatGPT y le preguntas por tus ventas, tu inventario o tus clientas. Y cuando le pides algo, lo prepara y te pide confirmar.',
  chat: [
    { de: 'd', t: '¿Qué se vendió más esta semana en Polanco?' },
    { de: 'i', t: 'El vestido slip satén: 23 piezas, la mayoría en M. Te quedan 4 en M en Polanco y 7 en Santa Fe.' },
    { de: 'd', t: 'Pasa 3 en M de Santa Fe a Polanco' },
    { de: 'i', t: 'Preparé el traspaso de 3 vestidos slip satén M, de Santa Fe a Polanco. ¿Lo confirmo?', boton: 'Confirmar traspaso' },
  ],
  calculadoras: ['Curva de tallas', '¿Sale o no sale?', 'Nivelar entre tiendas', 'Margen', 'Punto de reorden', 'Costo de maquila'],
  url: 'https://www.sacscloud.com/api/mcp',
};

// «Sabes qué IA te trajo ventas».
export const ATRIBUCION = {
  k: 'Atribución',
  h: 'Sabes qué IA te trajo cada venta.',
  p: 'Cada pedido guarda de dónde vino. Ves cuánto te vende cada asistente de IA, qué prendas recomiendan más y en qué tallas.',
  barras: [
    { t: 'ChatGPT', v: 100 },
    { t: 'Gemini', v: 58 },
    { t: 'Perplexity', v: 34 },
    { t: 'Claude', v: 21 },
  ],
};

export const RESUELVE = {
  folio: ['Lo que resuelve', 'En la era de la IA'] as [string, string],
  titulo: 'Lo que deja de pasar.',
  puntos: [
    'La IA que recomienda a tu competencia porque no conoce tu catálogo.',
    'El precio viejo que aparece en una búsqueda.',
    'El mensaje de las 11 de la noche que nadie contestó.',
    'La talla que sí tenías, en la otra sucursal.',
    'No saber de dónde llegó la venta.',
  ],
};

export const PREGUNTAS = [
  { question: '¿Qué es Agentic Commerce?', answer: 'Vender a través de asistentes de IA: tu clienta le pregunta a ChatGPT, Gemini o Perplexity qué comprar y el asistente le recomienda tus prendas con su precio, su talla y la liga a tu tienda. Sacs prepara tu catálogo para eso y te dice cuánto vendiste por esa vía.' },
  { question: '¿Tengo que capturar algo extra?', answer: 'No. Tus productos en Sacs ya tienen fotos, tallas, colores, precios y existencias; Sacs los publica para los asistentes y los mantiene al día.' },
  { question: '¿En qué asistentes aparecen mis productos?', answer: 'Los activas desde Sacs, uno por uno: ChatGPT, Gemini, Claude y Muse. Además, tu catálogo sale para Google, Facebook, Instagram y TikTok.' },
  { question: '¿Dónde compra mi clienta?', answer: 'En tu tienda en línea o por tu WhatsApp. La venta es tuya y entra a Sacs como cualquier pedido, con su canal.' },
  { question: '¿El agente de WhatsApp contesta solo?', answer: 'Sí: contesta con tu inventario real por talla, color y sucursal, manda fotos, aparta y comparte la liga para pagar. Cuando hace falta una persona, te pasa la conversación con el contexto.' },
  { question: '¿Qué es «Sacs en tu IA»?', answer: 'Conectar tu cuenta de Sacs a tu propia IA (Claude o ChatGPT) para preguntarle por tus ventas, tu inventario y tus clientas, y pedirle cosas como un traspaso, que te prepara y te pide confirmar.' },
  { question: '¿Las calculadoras por MCP cuestan?', answer: 'No. En www.sacscloud.com/api/mcp hay seis calculadoras de moda gratis para usarlas desde tu IA: curva de tallas, ¿sale o no sale?, nivelar entre tiendas, margen, punto de reorden y costo de maquila.' },
];
