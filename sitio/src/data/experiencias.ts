/**
 * EXPERIENCIA — lo que la clienta de una marca de moda vive con Sacs, en la tienda física y en línea (2-oct-2026).
 *
 * Pedido del dueño: «crea una sección que se llame "Experiencia" en el menú principal; al darle clic aparece la
 * primera experiencia en grande, en formato vertical de imagen, porque vamos a poner varias». Cada experiencia es una
 * página propia (/experiencia/<slug>) con imagen a pantalla completa y la historia contada con el scroll, en la misma
 * línea que /planeacion-de-demanda. Este arreglo alimenta el panel del menú, el índice /experiencia y el pie.
 *
 * Una experiencia nueva = una entrada aquí + su página. La primera va en grande; las demás, a su lado.
 * Nada inventado: lo que una experiencia cuenta tiene que existir en el producto (o ir marcado «en construcción»).
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
];
