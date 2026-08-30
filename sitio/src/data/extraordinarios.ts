/**
 * Módulos extraordinarios — el contenido de /extraordinarios y del
 * mega-menú "Temporada e IA".
 *
 * Registro editorial: esta página se permite más color y más escala que el
 * resto del sitio (es la vitrina de lo novedoso), pero usa los mismos tokens
 * de tipografía y el mismo cierre. Cada módulo trae su acento propio.
 *
 * Nombres y precios salen del catálogo real de complementos (plugins.json):
 * moda-probador-virtual, moda-fotografia-ia, moda-video-ia,
 * moda-sugerencia-outfits, moda-lookbooks, moda-preordenes.
 */
export interface ModuloExtraordinario {
  id: string;
  num: string;
  nombre: string;
  corto: string;
  gancho: string;
  descripcion: string;
  puntos: string[];
  precio: string;
  imagen: string;
  alt: string;
  color: string;
  color2: string;
  tinta: string;
}

export const extraordinarios: ModuloExtraordinario[] = [
  {
    id: 'probador',
    num: '01',
    nombre: 'Probador virtual',
    corto: 'Probador',
    gancho: 'Se lo prueba sin quitarse nada.',
    descripcion:
      'Una pantalla en tu piso de venta donde tu clienta se ve con la prenda en otro color, en otra talla o con el outfit completo. Lo que no cabe en el probador, cabe en la pantalla.',
    puntos: [
      'Cambia color y talla en pantalla, sin ir por la pieza',
      'Arma el look completo con lo que sí tienes en existencia',
      'Lo que se prueba ahí, se puede apartar en el momento',
    ],
    precio: 'Desde $19,900 por tienda/año',
    imagen: '/images/extraordinarios/probador.webp',
    alt: 'Clienta frente a una pantalla vertical en una boutique, viéndose con un vestido de otro color',
    color: '#7C3AED',
    color2: '#C026D3',
    tinta: '#F5F3FF',
  },
  {
    id: 'fotografia',
    num: '02',
    nombre: 'Fotografía con IA',
    corto: 'Foto IA',
    gancho: 'Una foto entra. Sale la campaña.',
    descripcion:
      'Subes la prenda como la tienes: colgada, plana, en el mostrador. La IA la pone en un modelo, le da pose, fondo y luz — y te la devuelve en todos tus colorways. Sin sesión, sin estudio, sin esperar tres semanas.',
    puntos: [
      'Modelo, pose y fondo generados para tu prenda',
      'El mismo modelo en todos los colores del drop',
      'Sale lista para tu tienda en línea y tus redes',
    ],
    precio: 'Desde $14,900 por tienda/año',
    imagen: '/images/extraordinarios/fotografia.webp',
    alt: 'Comparación editorial: la prenda plana en estudio y la misma prenda en una modelo con luz de campaña',
    color: '#DB2777',
    color2: '#F472B6',
    tinta: '#FDF2F8',
  },
  {
    id: 'video',
    num: '03',
    nombre: 'Video con IA',
    corto: 'Video IA',
    gancho: 'La misma foto, ahora en movimiento.',
    descripcion:
      'De la foto sale el video: la prenda se mueve, gira, cambia de ángulo y de color. El contenido que TikTok y Reels te piden cada semana, sin volver a montar una producción.',
    puntos: [
      'De foto fija a video con movimiento y ángulos',
      'Listo para TikTok Shop, Reels y tu tienda en línea',
      'Un drop nuevo cada semana sin equipo de producción',
    ],
    precio: 'Desde $17,900 por tienda/año',
    imagen: '/images/extraordinarios/video.webp',
    alt: 'Modelo girando con vestido en movimiento, capturada en varios cuadros superpuestos con luz naranja',
    color: '#EA580C',
    color2: '#FB923C',
    tinta: '#FFF7ED',
  },
  {
    id: 'outfits',
    num: '04',
    nombre: 'Outfits con IA',
    corto: 'Outfits',
    gancho: 'Nadie se lleva una sola pieza.',
    descripcion:
      'La IA arma el look completo con lo que hay en tu piso: la blusa que va con ese pantalón, el bolso que lo cierra. En el mostrador y en tu tienda en línea, con existencia real.',
    puntos: [
      'El look se arma solo con lo que sí tienes',
      'Sugerencia en el mostrador y en la tienda en línea',
      'Sube el ticket sin que la vendedora tenga que adivinar',
    ],
    precio: 'Desde $8,900 por tienda/año',
    imagen: '/images/extraordinarios/outfits.webp',
    alt: 'Outfit completo acomodado a vista de pájaro: vestido, bolso, zapatos y accesorios sobre superficie verde',
    color: '#0D9488',
    color2: '#2DD4BF',
    tinta: '#F0FDFA',
  },
  {
    id: 'lookbooks',
    num: '05',
    nombre: 'Lookbooks digitales',
    corto: 'Lookbooks',
    gancho: 'La colección, en el WhatsApp de tu clienta.',
    descripcion:
      'El catálogo de la temporada armado como lookbook: tus looks, tus fotos, tu marca. La vendedora lo manda a su cartera y la clienta compra desde ahí.',
    puntos: [
      'Los looks de la colección en un catálogo con tu marca',
      'Se manda por WhatsApp a la cartera de cada vendedora',
      'Lo agotado se cae solo del lookbook',
    ],
    precio: 'Desde $4,900 por tienda/año',
    imagen: '/images/extraordinarios/lookbooks.webp',
    alt: 'Manos sosteniendo una tablet con el lookbook de la colección sobre una mesa de mármol',
    color: '#4B7BE5',
    color2: '#7C9CF0',
    tinta: '#EEF2FF',
  },
  {
    id: 'preordenes',
    num: '06',
    nombre: 'Pre-órdenes de colección',
    corto: 'Pre-órdenes',
    gancho: 'Vendida antes de llegar.',
    descripcion:
      'Tus clientas de siempre apartan la pieza de la colección nueva antes del drop, con anticipo. Tú sabes cuánto vas a vender antes de recibir el pedido del proveedor.',
    puntos: [
      'Aparta con anticipo antes de que llegue la mercancía',
      'Aviso automático a la clienta cuando su pieza entra',
      'Sabes qué se va a vender antes de pagar el pedido',
    ],
    precio: 'Desde $6,900 por tienda/año',
    imagen: '/images/extraordinarios/preordenes.webp',
    alt: 'Prenda exclusiva en gancho de terciopelo bajo un reflector cálido en una boutique en penumbra',
    color: '#B45309',
    color2: '#F59E0B',
    tinta: '#FFFBEB',
  },
];
