// Catálogo central de tipos de contenido para embajadores SACS.
// Usado en: invitación pública, portal partner, admin review.
//
// Cada tipo tiene puntos × duración × ejemplos visuales × refs reales.
// La meta mensual es 100 puntos. Los puntos se acumulan al siguiente mes
// si el partner genera más de la cuota.

export interface ContentType {
  id: string;
  nombre: string;
  puntos: number;
  duracion: string;       // "30-60s" / "5-10 min"
  esfuerzo: 'bajo' | 'medio' | 'medio-alto' | 'alto' | 'muy-alto';
  descripcion: string;
  ideasContenido: string[];
  ejemploImage?: string;  // path en /public/images/content-examples/
  ejemploRefs?: { label: string; url: string }[];
  plataformasSugeridas: string[];
}

export const CONTENT_TYPES: ContentType[] = [
  {
    id: 'story_reel',
    nombre: 'Story / Reel corto',
    puntos: 10,
    duracion: '15-60 seg',
    esfuerzo: 'bajo',
    descripcion: 'Pieza vertical rápida — un feature, un tip, un antes/después. Ideal para Instagram Stories, Reels y TikTok.',
    ideasContenido: [
      'El feature que más me gusta de SACS este mes',
      'Antes vs ahora: cómo cambió mi cierre de día',
      '3 atajos del POS que nadie usa',
      'Un cliente preguntó esto y se lo resolví con SACS',
    ],
    ejemploImage: '/images/content-examples/story-reel.webp',
    ejemploRefs: [
      { label: 'Reels SaaS Mx', url: 'https://www.instagram.com/explore/tags/saasmx/' },
      { label: 'TikTok #retailmx', url: 'https://www.tiktok.com/tag/retailmx' },
    ],
    plataformasSugeridas: ['Instagram Reels', 'TikTok', 'YouTube Shorts'],
  },
  {
    id: 'tutorial',
    nombre: 'Tutorial / Guía paso a paso',
    puntos: 15,
    duracion: '60-120 seg',
    esfuerzo: 'medio',
    descripcion: 'Cómo configurar o usar una funcionalidad específica del sistema. Utilidad práctica directa.',
    ideasContenido: [
      'Cómo configurar tu tienda en línea en 5 minutos',
      'Cómo crear tu primer producto con variantes (talla × color)',
      'Cómo activar el cobro por WhatsApp',
      'Cómo enviar un email marketing a un segmento',
    ],
    ejemploImage: '/images/content-examples/tutorial.webp',
    ejemploRefs: [
      { label: 'Tutoriales Square', url: 'https://www.youtube.com/c/Square' },
      { label: 'Loom tutorial style', url: 'https://www.loom.com/' },
    ],
    plataformasSugeridas: ['YouTube', 'TikTok largo', 'Instagram Reels'],
  },
  {
    id: 'caso_uso',
    nombre: 'Caso de uso en tu negocio',
    puntos: 20,
    duracion: '90-120 seg',
    esfuerzo: 'medio',
    descripcion: 'Cuenta cómo aplicas SACS específicamente en tu negocio. Storytelling de tu propio caso.',
    ideasContenido: [
      'Cómo evito que se me pierda mercancía entre sucursales',
      'Mi proceso de cierre de día (antes 2h, ahora 15 min)',
      'Cómo manejo la temporada alta sin colapsar',
      'El reporte que reviso todos los lunes',
    ],
    ejemploImage: '/images/content-examples/caso-uso.webp',
    ejemploRefs: [
      { label: 'Shopify case studies', url: 'https://www.shopify.com/case-studies' },
    ],
    plataformasSugeridas: ['YouTube', 'LinkedIn', 'Instagram'],
  },
  {
    id: 'tour',
    nombre: 'Tour del sistema en acción',
    puntos: 20,
    duracion: '90-180 seg',
    esfuerzo: 'medio',
    descripcion: 'Walkthrough en pantalla compartida mostrando una sección o flujo completo del sistema.',
    ideasContenido: [
      'Tour del nuevo CRM Omnicanal',
      'Cómo se ve la operación multi-sucursal en SACS',
      'El dashboard que veo cada mañana',
      'Probando el cobro móvil en mi tienda',
    ],
    ejemploImage: '/images/content-examples/tour.webp',
    ejemploRefs: [
      { label: 'Notion product tours', url: 'https://www.notion.so/product' },
    ],
    plataformasSugeridas: ['YouTube', 'LinkedIn'],
  },
  {
    id: 'dia_en_la_vida',
    nombre: 'Un día en la vida',
    puntos: 25,
    duracion: '60-120 seg',
    esfuerzo: 'medio-alto',
    descripcion: 'Sigue tu rutina diaria mostrando cómo SACS se integra en cada momento del día.',
    ideasContenido: [
      'Día en la vida de una dueña de boutique con SACS',
      'Día de un gerente multi-sucursal',
      'Cómo opera mi cocina con SACS',
      '24 horas de un negocio retail moderno',
    ],
    ejemploImage: '/images/content-examples/dia-vida.webp',
    ejemploRefs: [
      { label: '#dayinthelife creators', url: 'https://www.tiktok.com/tag/dayinthelife' },
    ],
    plataformasSugeridas: ['Instagram Reels', 'TikTok', 'YouTube'],
  },
  {
    id: 'testimonial',
    nombre: 'Testimonial / historia',
    puntos: 30,
    duracion: '60-180 seg',
    esfuerzo: 'alto',
    descripcion: 'Cuenta el impacto real de SACS en tu negocio: antes vs ahora con números.',
    ideasContenido: [
      'Mi cierre era un caos. Hoy lo hago en 15 min.',
      'Cómo SACS me ayudó a abrir mi 2da sucursal',
      'Pasé de Excel a SACS en 1 semana',
      'El día que entendí por qué necesitaba un POS pro',
    ],
    ejemploImage: '/images/content-examples/testimonial.webp',
    ejemploRefs: [
      { label: 'Stripe customer stories', url: 'https://stripe.com/customers' },
    ],
    plataformasSugeridas: ['YouTube', 'LinkedIn', 'Instagram'],
  },
  {
    id: 'serie_episodio',
    nombre: 'Episodio de serie embajador',
    puntos: 30,
    duracion: '5-10 min',
    esfuerzo: 'alto',
    descripcion: 'Un episodio de tu serie temática. La serie completa (10 episodios) suma puntos extra.',
    ideasContenido: [
      'Estrategias para retail moderno · Ep 3: Inventario inteligente',
      'Cómo crecer en moda · Ep 5: E-commerce que sí vende',
      'Retail con conciencia · Ep 2: El cliente recurrente',
    ],
    ejemploImage: '/images/content-examples/serie-episodio.webp',
    ejemploRefs: [
      { label: 'Masters of Scale', url: 'https://mastersofscale.com/' },
    ],
    plataformasSugeridas: ['YouTube', 'Spotify (audio)'],
  },
  {
    id: 'webinar',
    nombre: 'Webinar / Sesión en vivo',
    puntos: 40,
    duracion: '15-30 min',
    esfuerzo: 'alto',
    descripcion: 'Sesión en vivo sobre un tema relevante. Q&A con audiencia. Se graba y se reusa.',
    ideasContenido: [
      'Webinar: Tendencias de retail mexicano 2026',
      'Photoshoot pro: cómo se hace en mi tienda',
      'Mejorar tu colección: estrategia paso a paso',
      'Live Q&A: dudas sobre SACS',
    ],
    ejemploImage: '/images/content-examples/webinar.webp',
    ejemploRefs: [
      { label: 'HubSpot webinars', url: 'https://www.hubspot.com/webinars' },
    ],
    plataformasSugeridas: ['Zoom', 'YouTube Live', 'Instagram Live'],
  },
  {
    id: 'mini_documental',
    nombre: 'Mini-documental / Historia',
    puntos: 50,
    duracion: '3-7 min',
    esfuerzo: 'muy-alto',
    descripcion: 'Pieza narrativa con producción cuidada — historia de tu marca o de alguien que usa SACS.',
    ideasContenido: [
      'La historia de mi boutique (transformación digital)',
      'Cómo construí mi red de 10 sucursales',
      'El cliente que volvió a confiar en mi marca',
      'De idea a 1,000 ventas/mes',
    ],
    ejemploImage: '/images/content-examples/mini-documental.webp',
    ejemploRefs: [
      { label: 'Apple "Made on iPad"', url: 'https://www.apple.com/shot-on-iphone/' },
      { label: 'Patagonia stories', url: 'https://www.patagonia.com/stories/' },
    ],
    plataformasSugeridas: ['YouTube', 'Vimeo', 'LinkedIn'],
  },
  {
    id: 'serie_completa',
    nombre: '🎁 Bonus: Serie completa (10 episodios)',
    puntos: 300,
    duracion: 'trimestral',
    esfuerzo: 'muy-alto',
    descripcion: 'Bonus por entregar una serie completa de 10 episodios sobre un tema. Equivale a 30 puntos por episodio + 60 de bonus.',
    ideasContenido: [
      'Estrategias para Retail 2026 (10 eps)',
      'Cómo abrir una boutique exitosa (10 eps)',
      'El sistema operativo del retail (10 eps)',
    ],
    ejemploImage: '/images/content-examples/serie-completa.webp',
    plataformasSugeridas: ['YouTube playlist', 'Spotify'],
  },
];

// Mapeo id → ruta de imagen mockup (generadas con gpt-image-1)
const IMG_BY_ID: Record<string, string> = {
  story_reel: '/images/content-examples/story-reel.webp',
  tutorial: '/images/content-examples/tutorial.webp',
  caso_uso: '/images/content-examples/caso-uso.webp',
  tour: '/images/content-examples/tour.webp',
  dia_en_la_vida: '/images/content-examples/dia-vida.webp',
  testimonial: '/images/content-examples/testimonial.webp',
  serie_episodio: '/images/content-examples/serie-episodio.webp',
  webinar: '/images/content-examples/webinar.webp',
  mini_documental: '/images/content-examples/mini-documental.webp',
  serie_completa: '/images/content-examples/serie-completa.webp',
};
// Asignar ejemploImage automáticamente si no está seteado
for (const c of CONTENT_TYPES) {
  if (!c.ejemploImage && IMG_BY_ID[c.id]) c.ejemploImage = IMG_BY_ID[c.id];
}

export const META_PUNTOS_MES = 100;

// Helper para encontrar un tipo por id
export function getContentType(id: string): ContentType | undefined {
  return CONTENT_TYPES.find(c => c.id === id);
}

export function getPuntosByTipo(id: string): number {
  return getContentType(id)?.puntos || 0;
}
