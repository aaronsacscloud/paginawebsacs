/**
 * EXPERIENCIA — lo que se vive con Sacs en una marca de moda: la clienta en la tienda física y en línea, y la marca en
 * su bodega (2-oct-2026; la 02, el alta de productos con AXO, el 3-oct-2026).
 *
 * Pedido del dueño: «crea una sección que se llame "Experiencia" en el menú principal; al darle clic aparece la
 * primera experiencia en grande, en formato vertical de imagen, porque vamos a poner varias». Cada experiencia es una
 * página propia (/experiencia/<slug>) con imagen a pantalla completa y la historia contada con el scroll, en la misma
 * línea que /planeacion-de-demanda. Este arreglo alimenta el panel del menú, el índice /experiencia y el pie.
 *
 * Una experiencia nueva = una entrada aquí + su página. La primera va en grande; las demás, a su lado.
 * Nada inventado: lo que una experiencia cuenta tiene que existir en el producto (o ir marcado «en construcción»).
 * 3-oct-2026: la 03, 04 y 05 (cámaras con IA, conteo de personas, RFID) se presentan como disponibles por decisión
 * del dueño («quita eso que dice en construcción, todo ponlo como si ya lo tenemos»), como las vende la app en
 * «Extiende tu Sacs › Hardware + IA». `obra` queda para cuando haga falta marcar una.
 */
export interface Experiencia {
  slug: string;
  num: string;
  titulo: string;
  /** Una línea: qué vive la clienta. */
  bajada: string;
  href: string;
  /** Foto VERTICAL (2:3) para el panel del menú y el índice. */
  imagen: string;
  imagenAncho: number;
  imagenAlto: number;
  alt: string;
  /** Color de acento de la tarjeta. */
  acento: string;
  /** En construcción: la tarjeta lo dice (sin fecha ni promesa). */
  obra?: boolean;
}

export const experiencias: Experiencia[] = [
  {
    slug: 'probador-virtual',
    num: '01',
    titulo: 'Probador virtual en tienda',
    bajada: 'Tu clienta se ve con la prenda puesta antes de comprarla, en el piso de tu tienda o desde su casa.',
    href: '/experiencia/probador-virtual',
    imagen: '/images/experiencia/probador-portada-800.webp',
    imagenAncho: 800,
    imagenAlto: 1200,
    alt: 'Clienta en una boutique mirando su celular, donde se ve con un vestido verde que no se ha probado',
    acento: '#E0457B',
  },
  {
    slug: 'alta-de-productos',
    num: '02',
    titulo: 'De la caja a la venta con AXO',
    bajada: 'Pones la prenda frente al celular, le hablas a AXO y en unos 30 minutos ya se vende en tu caja y tu tienda en línea.',
    href: '/experiencia/alta-de-productos',
    imagen: '/images/experiencia/alta-vertical-800.webp',
    imagenAncho: 800,
    imagenAlto: 1200,
    alt: 'Dueña de una boutique junto a las cajas de mercancía nueva; un celular en un tripié fotografía un vestido mandarina colgado en la pared',
    acento: '#F08A4B',
  },
  {
    slug: 'camaras-con-ia',
    num: '03',
    titulo: 'Lo que tu clienta mira, en un mapa',
    bajada: 'Cámaras con IA: el mapa de calor de tu piso, cuánto se queda tu clienta en cada mesa y lo que mira sin comprar.',
    href: '/experiencia/camaras-con-ia',
    imagen: '/images/experiencia/camaras-vertical-800.webp',
    imagenAncho: 800,
    imagenAlto: 1200,
    alt: 'Una boutique vista desde el techo: clientas alrededor de la mesa redonda de novedades',
    acento: '#FF7A1A',
  },
  {
    slug: 'conteo-de-personas',
    num: '04',
    titulo: 'Cuántas entran y cuántas compran',
    bajada: 'Conteo de personas con IA: visitas por hora, tu conversión y tus horas pico, junto a tu venta de Sacs.',
    href: '/experiencia/conteo-de-personas',
    imagen: '/images/experiencia/conteo-vertical-800.webp',
    imagenAncho: 800,
    imagenAlto: 1200,
    alt: 'Dos amigas entran a una boutique luminosa desde la calle',
    acento: '#5B86EA',
  },
  {
    slug: 'rfid',
    num: '05',
    titulo: 'Toda tu tienda, contada en minutos',
    bajada: 'RFID: el rack completo de una pasada, dónde está cada talla y la puerta que avisa lo que sale sin pagar.',
    href: '/experiencia/rfid',
    imagen: '/images/experiencia/rfid-vertical-800.webp',
    imagenAncho: 800,
    imagenAlto: 1200,
    alt: 'Una vendedora lee con un lector RFID un rack de prendas de lino',
    acento: '#F07FA6',
  },
];
