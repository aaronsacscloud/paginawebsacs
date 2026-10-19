/**
 * Casos del carrusel (inicio y /planes): los mismos que hoy tiene /casos-de-exito, con sus datos de ahí.
 * 19-oct-2026: se movieron de planes.astro aquí para que el inicio muestre los casos actuales (antes tenía
 * La Bella Pandita, Liveshow y Casa Maca escritos a mano). Un caso nuevo se agrega solo aquí.
 */
export interface CasoCarrusel {
  href: string;
  brand: string;
  tag: string;
  /** fondo de la etiqueta */
  color: string;
  img: string;
  alt: string;
  /** object-position de la foto */
  pos?: string;
  stats: [{ num: string; label: string }, { num: string; label: string }];
}

export const casosCarrusel: CasoCarrusel[] = [
  { href: '/casos-de-exito/liveshow', brand: 'Live Shows Merchandising', tag: 'Moda · Merch oficial', color: 'rgba(236,72,153,0.92)',
    img: '/images/ls-guts-fans.webp', alt: 'Fan con la sudadera oficial del GUTS World Tour frente a la pared de playeras',
    stats: [{ num: '100+', label: 'puntos de venta a la vez' }, { num: '8', label: 'países con oficina' }] },
  { href: '/casos-de-exito#sthela', brand: 'Sthela & Co.', tag: 'Moda femenina · Mayorista', color: 'rgba(168,85,247,0.92)',
    img: '/images/casos-carrusel/sthela.webp', alt: 'Clienta con vestido de noche negro frente al espejo de una boutique', pos: 'center 30%',
    stats: [{ num: '2', label: 'boutiques propias en Jalisco' }, { num: 'Intermoda', label: 'fabricante y mayorista' }] },
  { href: '/casos-de-exito/vende-tu-closet', brand: 'Vende Tu Clóset', tag: 'Lujo pre-loved · Consignación', color: 'rgba(22,163,74,0.92)',
    img: '/images/vtc-bolsas.webp', alt: 'Bolsas de lujo Dior y Fendi en el showroom de Vende Tu Clóset', pos: 'center 40%',
    stats: [{ num: '4', label: 'ciudades' }, { num: '100%', label: 'piezas autenticadas' }] },
  { href: '/casos-de-exito/las-alazanas', brand: 'Talabartería Las Alazanas', tag: 'Ropa vaquera · Talabartería', color: 'rgba(180,83,9,0.92)',
    img: '/images/casos-carrusel/alazanas.webp', alt: 'Artesano repujando a mano un cinturón de piel, con sillas y sombreros vaqueros al fondo', pos: 'center 45%',
    stats: [{ num: '4', label: 'sucursales' }, { num: 'Taller', label: 'propio, hecho a mano' }] },
  { href: '/casos-de-exito/mits', brand: 'Mexico Is The Shit', tag: 'Moda mexicana · Hecho en México', color: 'rgba(251,146,60,0.92)',
    img: '/images/mits-poncho.webp', alt: 'Mujer con el poncho «Mexico Is The Shit»', pos: 'center 30%',
    stats: [{ num: '7', label: 'colecciones' }, { num: '100%', label: 'hecho en México' }] },
];
