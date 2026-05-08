// Catálogo central de tipos de contenido para embajadores SACS.
// Usado en: invitación pública, portal partner, admin review.
//
// Cada tipo tiene puntos × duración × ejemplos visuales × refs reales.
// La meta mensual es 100 puntos. Los puntos se acumulan al siguiente mes
// si el partner genera más de la cuota.

export type Perfil = 'influencer' | 'nomada' | 'dueño' | 'consultor';

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
  categoria?: 'contenido' | 'apoyo' | 'filantropia'; // default 'contenido'
  perfiles?: Perfil[];    // si está definido, solo se muestra a esos perfiles. Si no, aplica a todos.
}

export const CATEGORIAS = [
  { id: 'contenido',  label: 'Contenido',           descripcion: 'Piezas que produces y publicas en tus redes para posicionar SACS y tu marca personal.' },
  { id: 'apoyo',      label: 'Acciones de apoyo',   descripcion: 'Acciones de marketing y crecimiento que extienden a SACS sin ser contenido publicado: demos en eventos, reseñas, intros, activaciones in situ.' },
  { id: 'filantropia', label: 'Filantropía',         descripcion: 'Acciones para ayudar a personas o animales — voluntariado, refugios, comedores, jornadas, mentorías. Documentadas con foto/video.' },
] as const;

export const PERFILES = [
  { id: 'todos',      label: 'Todos los perfiles',      descripcion: 'Sin filtro — todas las acciones disponibles.' },
  { id: 'influencer', label: 'Influencer',              descripcion: 'Para creadores con audiencia construida que monetizan su alcance.' },
  { id: 'nomada',     label: 'Nómada digital',          descripcion: 'Para quienes trabajan remoto desde donde sea — la mayor parte aplica.' },
  { id: 'dueño',      label: 'Dueño de negocio',        descripcion: 'Para dueños de tienda, distribuidores y comerciantes con clientela B2B.' },
  { id: 'consultor',  label: 'Consultor / Coach / Mentor', descripcion: 'Para asesores, contadores, consultores fiscales y mentores con cartera B2B que pueden recomendar SACS y certificarse para cobrar implementaciones.' },
] as const;

export type PerfilFilter = typeof PERFILES[number]['id'];

// Helper: ¿este content type aplica al perfil dado? Si no tiene perfiles definidos, aplica a todos.
export function appliesToPerfil(c: ContentType, perfil: PerfilFilter): boolean {
  if (perfil === 'todos') return true;
  if (!c.perfiles || c.perfiles.length === 0) return true;
  return c.perfiles.includes(perfil);
}

export const CONTENT_TYPES: ContentType[] = [
  {
    id: 'story_reel',
    nombre: 'Story / Reel corto',
    puntos: 20,
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
    puntos: 30,
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
    puntos: 40,
    duracion: '90-120 seg',
    esfuerzo: 'medio',
    perfiles: ['dueño', 'nomada', 'consultor'],
    descripcion: 'Cuenta cómo aplicas SACS específicamente en tu negocio. Storytelling de tu propio caso o del de un cliente que asesoras.',
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
    puntos: 40,
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
    puntos: 50,
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
    puntos: 60,
    duracion: '60-180 seg',
    esfuerzo: 'alto',
    perfiles: ['dueño', 'consultor'],
    descripcion: 'Cuenta el impacto real de SACS en un negocio: antes vs ahora con números (tuyo o de un cliente que asesoras).',
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
    puntos: 60,
    duracion: '5-10 min',
    esfuerzo: 'alto',
    perfiles: ['influencer', 'nomada', 'consultor'],
    descripcion: 'Un episodio de tu serie temática (consultoría, retail, casos). La serie completa (10 episodios) suma puntos extra.',
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
    puntos: 80,
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
    puntos: 100,
    duracion: '3-7 min',
    esfuerzo: 'muy-alto',
    perfiles: ['influencer'],
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
    puntos: 600,
    duracion: 'trimestral',
    esfuerzo: 'muy-alto',
    perfiles: ['influencer'],
    descripcion: 'Bonus por entregar una serie completa de 10 episodios sobre un tema. Equivale a 60 puntos por episodio entregados juntos como serie cohesiva.',
    ideasContenido: [
      'Estrategias para Retail 2026 (10 eps)',
      'Cómo abrir una boutique exitosa (10 eps)',
      'El sistema operativo del retail (10 eps)',
    ],
    ejemploImage: '/images/content-examples/serie-completa.webp',
    plataformasSugeridas: ['YouTube playlist', 'Spotify'],
  },
];

// ─────────────────────────────────────────────────────────────
// CATEGORÍA: ACCIONES DE APOYO
// Acciones de marketing y crecimiento que apoyan a SACS sin ser
// contenido publicado en redes. Documentadas con foto/video o link
// (reseñas, eventos, intros). Aprueba admin como cualquier otra acción.
// ─────────────────────────────────────────────────────────────
const APOYO_TYPES: ContentType[] = [
  {
    id: 'demo_evento_sector', nombre: 'Demo de SACS en evento del sector',
    puntos: 50, duracion: '1-3 horas', esfuerzo: 'medio-alto', categoria: 'apoyo',
    perfiles: ['dueño', 'nomada', 'consultor'],
    descripcion: 'Mostrar SACS funcionando en un evento, feria o expo del sector retail/restaurantes. Subes foto del stand o sesión + lista de asistentes/contactos generados.',
    ideasContenido: [
      'Stand SACS en expo de retail',
      'Demo en mesa redonda de la cámara de comercio',
      'Live demo en meetup de emprendedores',
    ],
    plataformasSugeridas: ['Ferias del sector', 'Expos retail', 'Cámaras de comercio'],
  },
  {
    id: 'resena_publica', nombre: 'Reseña pública en plataforma de software',
    puntos: 20, duracion: '20-30 min', esfuerzo: 'bajo', categoria: 'apoyo',
    descripcion: 'Reseña honesta y detallada de SACS en G2, Capterra, GetApp o Google Maps. Mín. 200 palabras + screenshot real de tu cuenta.',
    ideasContenido: [
      'Reseña en G2 con caso de uso real',
      'Review en Capterra con pros y contras',
      'Reseña en Google Maps de tu sucursal con SACS',
    ],
    plataformasSugeridas: ['G2', 'Capterra', 'GetApp', 'Google Maps'],
  },
  {
    id: 'activacion_sucursal', nombre: 'Activación abierta en tu sucursal',
    puntos: 60, duracion: '4-6 horas', esfuerzo: 'alto', categoria: 'apoyo',
    perfiles: ['dueño'],
    descripcion: 'Día abierto donde otros dueños de negocio vienen a tu sucursal a ver SACS funcionando en vivo. Mín. 5 asistentes externos. Documentar con foto + lista.',
    ideasContenido: [
      'Open day "POS en acción" en tu boutique',
      'Demo abierta para colegas de tu mercado',
      'Tour de operación con dueños de la zona',
    ],
    plataformasSugeridas: ['Tu sucursal', 'Coworkings locales'],
  },
  {
    id: 'speaking_panel', nombre: 'Speaking en panel o foro del sector',
    puntos: 70, duracion: '1-2 horas', esfuerzo: 'alto', categoria: 'apoyo',
    descripcion: 'Hablar como embajador SACS en un panel, foro o conferencia donde se mencione la marca. Documentar con foto del evento + grabación o programa.',
    ideasContenido: [
      'Panel de retail moderno en feria nacional',
      'Foro de mujeres emprendedoras',
      'Conferencia de tecnología en LATAM',
    ],
    plataformasSugeridas: ['Conferencias', 'Foros del sector', 'Webinars de aliados'],
  },
  {
    id: 'intro_calificada', nombre: 'Intro calificada (lead vivo)',
    puntos: 30, duracion: '15-30 min', esfuerzo: 'bajo', categoria: 'apoyo',
    descripcion: 'Conectar al equipo SACS con un prospecto cualificado (decisor real de un negocio con 1+ sucursal). Cuenta cuando el lead acepta una llamada.',
    ideasContenido: [
      'Presentar al dueño de una cadena de restaurantes',
      'Intro a una boutique multi-tienda',
      'Conexión con un retailer de tu cámara',
    ],
    plataformasSugeridas: ['Email', 'WhatsApp', 'LinkedIn'],
  },
  {
    id: 'meetup_local', nombre: 'Meetup o mesa redonda en tu local',
    puntos: 60, duracion: '2-3 horas', esfuerzo: 'medio-alto', categoria: 'apoyo',
    perfiles: ['dueño', 'consultor'],
    descripcion: 'Hostear un meetup presencial sobre retail, ecommerce, finanzas o gestión de negocio con SACS visible. Mín. 10 asistentes — en tu sucursal o en un espacio aliado.',
    ideasContenido: [
      '"Café con dueños": cómo opero mi multi-sucursal',
      'Mesa redonda de retail moderno',
      'Networking de boutiques de la zona',
    ],
    plataformasSugeridas: ['Tu sucursal', 'Espacios aliados'],
  },
  {
    id: 'co_marketing', nombre: 'Co-marketing con marca aliada',
    puntos: 50, duracion: 'variable', esfuerzo: 'medio', categoria: 'apoyo',
    perfiles: ['influencer', 'consultor'],
    descripcion: 'Colaboración con una marca o consultoría complementaria (no competidora) que mencione a SACS en su canal. Reels conjuntos, blog cruzado, evento doble.',
    ideasContenido: [
      'Reel conjunto con marca de mobiliario retail',
      'Blog cruzado con consultora de ecommerce',
      'Evento doble con academia de emprendimiento',
    ],
    plataformasSugeridas: ['Instagram', 'LinkedIn', 'Eventos físicos'],
  },
  {
    id: 'beta_feedback', nombre: 'Beta tester con feedback estructurado',
    puntos: 30, duracion: '2-4 horas', esfuerzo: 'medio', categoria: 'apoyo',
    descripcion: 'Probar a fondo una feature nueva de SACS y mandar reporte estructurado (qué funcionó, qué no, sugerencias). Mín. 1 página de notas + screenshots.',
    ideasContenido: [
      'Beta del nuevo CRM Omnicanal',
      'Pruebas del cobro WhatsApp',
      'Feedback de la app móvil de inventario',
    ],
    plataformasSugeridas: ['Notion', 'Google Docs', 'Loom'],
  },
  {
    id: 'material_local', nombre: 'Material físico de SACS en tu local',
    puntos: 20, duracion: 'continuo', esfuerzo: 'bajo', categoria: 'apoyo',
    perfiles: ['dueño'],
    descripcion: 'Mantener material visible en tu sucursal: QR, folleto, tarjeta, sticker o display SACS. Sumas puntos cada mes que se mantenga visible. Foto mensual.',
    ideasContenido: [
      'QR a tu landing visible en caja',
      'Folleto SACS en mostrador',
      'Display "operado con SACS" en vitrina',
    ],
    plataformasSugeridas: ['Tu sucursal'],
  },
  {
    id: 'stand_feria', nombre: 'Compartir stand en feria del sector',
    puntos: 100, duracion: '1-2 días', esfuerzo: 'muy-alto', categoria: 'apoyo',
    perfiles: ['dueño'],
    descripcion: 'Representar la marca SACS desde un stand propio o compartido en una feria/expo regional o nacional. Documentar con foto + reporte de leads.',
    ideasContenido: [
      'Stand en ANTAD',
      'Compartir espacio en feria de moda',
      'Stand SACS en expo de restauranteros',
    ],
    plataformasSugeridas: ['Ferias regionales', 'Expos nacionales'],
  },
];

// ─────────────────────────────────────────────────────────────
// CATEGORÍA: FILANTROPÍA
// Acciones para ayudar a personas o animales. Documentadas con
// foto/video o link a publicación. Aprueba admin SACS.
// ─────────────────────────────────────────────────────────────
const FILANTROPIA_TYPES: ContentType[] = [
  {
    id: 'voluntariado_animales', nombre: 'Voluntariado en refugio de animales',
    puntos: 40, duracion: '4 horas', esfuerzo: 'medio', categoria: 'filantropia',
    descripcion: 'Donar mínimo 4 horas en un refugio canino, felino, equino o de fauna en riesgo. Limpiar, alimentar, pasear, ayudar en consultas. Documentar con foto.',
    ideasContenido: [
      'Jornada en refugio canino',
      'Pasear perros del albergue municipal',
      'Apoyo en santuario de fauna rescatada',
    ],
    plataformasSugeridas: ['Refugios locales', 'Albergues municipales'],
  },
  {
    id: 'jornada_adopcion', nombre: 'Jornada de adopción o esterilización',
    puntos: 60, duracion: '6-8 horas', esfuerzo: 'alto', categoria: 'filantropia',
    descripcion: 'Organizar o apoyar logísticamente una jornada de adopción o esterilización gratuita de animales. Documentar con foto + cantidad de adopciones/esterilizaciones.',
    ideasContenido: [
      'Jornada de adopción en parque público',
      'Brigada de esterilización gratuita',
      'Campaña de vacunación de mascotas',
    ],
    plataformasSugeridas: ['Veterinarias aliadas', 'Asociaciones civiles', 'Plazas públicas'],
  },
  {
    id: 'banco_alimentos', nombre: 'Voluntariado en banco de alimentos',
    puntos: 40, duracion: '4 horas', esfuerzo: 'medio', categoria: 'filantropia',
    descripcion: 'Donar mínimo 4 horas a un banco de alimentos: selección, empaque, distribución, logística. Documentar con foto + nombre del banco.',
    ideasContenido: [
      'Empaque de despensas en banco local',
      'Distribución a familias en colonias vulnerables',
      'Recolección y selección de alimentos',
    ],
    plataformasSugeridas: ['BAMX', 'Bancos de alimentos locales'],
  },
  {
    id: 'comedor_comunitario', nombre: 'Apoyo en comedor comunitario',
    puntos: 50, duracion: '4-6 horas', esfuerzo: 'medio', categoria: 'filantropia',
    descripcion: 'Cocinar, servir o donar insumos en un comedor comunitario para personas en situación vulnerable. Mín. medio día de jornada.',
    ideasContenido: [
      'Servir comida en comedor del DIF',
      'Cocinar y donar para 50+ personas',
      'Donación semanal de insumos a un comedor',
    ],
    plataformasSugeridas: ['DIF', 'Parroquias', 'ONGs locales'],
  },
  {
    id: 'distribucion_despensas', nombre: 'Distribución de despensas a personas vulnerables',
    puntos: 50, duracion: '4-8 horas', esfuerzo: 'medio-alto', categoria: 'filantropia',
    descripcion: 'Organizar o participar en una jornada de entrega de despensas, agua, ropa o medicamentos a familias en situación vulnerable. Documentar con foto + zona.',
    ideasContenido: [
      'Entrega de despensas en comunidad rural',
      'Brigada de agua y ropa en colonia afectada',
      'Reparto de kits invierno a familias',
    ],
    plataformasSugeridas: ['Comunidades rurales', 'Colonias vulnerables', 'Zonas afectadas'],
  },
  {
    id: 'albergue_personas', nombre: 'Voluntariado en albergue de personas',
    puntos: 60, duracion: '4-6 horas', esfuerzo: 'medio-alto', categoria: 'filantropia',
    descripcion: 'Apoyar en albergue de personas en situación de calle, casa hogar de niñas/os, asilo de adultos mayores o albergue de migrantes. Mín. medio día.',
    ideasContenido: [
      'Tarde con adultos mayores en asilo',
      'Apoyo en casa hogar de niñas y niños',
      'Voluntariado en albergue de migrantes',
    ],
    plataformasSugeridas: ['Casas hogar', 'Asilos', 'Albergues de migrantes'],
  },
  {
    id: 'limpieza_publica', nombre: 'Limpieza de espacio público / playa / parque',
    puntos: 30, duracion: '3-4 horas', esfuerzo: 'medio', categoria: 'filantropia',
    descripcion: 'Jornada de limpieza grupal en parque, playa, río o reserva natural. Mín. 3 horas y grupo de 5+ personas. Documentar con foto antes/después.',
    ideasContenido: [
      'Limpieza de playa en grupo',
      'Jornada de parque con vecinos',
      'Limpieza de río o cañada local',
    ],
    plataformasSugeridas: ['Parques municipales', 'Playas', 'Reservas naturales'],
  },
  {
    id: 'mentoria_emprendedor', nombre: 'Mentoría 1:1 a emprendedor de bajos recursos',
    puntos: 30, duracion: '1 hora', esfuerzo: 'bajo', categoria: 'filantropia',
    descripcion: 'Sesión 1:1 gratuita a un emprendedor de microempresa familiar o de comunidad vulnerable. Documentar con foto + descripción del caso.',
    ideasContenido: [
      'Asesorar a vendedora de mercado popular',
      'Mentorear a artesano que quiere vender online',
      'Coaching a emprendedora rural',
    ],
    plataformasSugeridas: ['Comunidades rurales', 'Mercados populares', 'Cooperativas'],
  },
  {
    id: 'conferencia_escuela', nombre: 'Conferencia gratuita en escuela pública',
    puntos: 50, duracion: '1-2 horas', esfuerzo: 'medio-alto', categoria: 'filantropia',
    descripcion: 'Charla gratuita en preparatoria pública, CECyT, CONALEP o universidad de zona vulnerable sobre emprendimiento o tecnología.',
    ideasContenido: [
      'Charla de emprendimiento en CONALEP',
      'Plática a estudiantes de prepa pública',
      'Conferencia en universidad rural',
    ],
    plataformasSugeridas: ['Escuelas públicas', 'CECyT', 'CONALEP', 'Universidades'],
  },
  {
    id: 'beca_patrocinio', nombre: 'Beca o patrocinio a una persona',
    puntos: 60, duracion: 'mensual', esfuerzo: 'alto', categoria: 'filantropia',
    descripcion: 'Patrocinar un curso, kit, herramienta o servicio para alguien que no podría costearlo. Cuenta una vez al mes mientras se mantenga el patrocinio.',
    ideasContenido: [
      'Beca de curso técnico a joven sin acceso',
      'Pagar kit escolar a una niña o niño',
      'Sponsoring de herramienta SaaS por 3 meses',
    ],
    plataformasSugeridas: ['Programas formales', 'Iniciativas verificadas'],
  },
];

// Asignar categoria a content types existentes (default 'contenido')
for (const c of CONTENT_TYPES) {
  if (!c.categoria) c.categoria = 'contenido';
}

// Agregar apoyo y filantropía al catálogo principal
CONTENT_TYPES.push(...APOYO_TYPES);
CONTENT_TYPES.push(...FILANTROPIA_TYPES);

// Mapeo id → ruta de imagen mockup (generadas con gpt-image-2)
const IMG_BY_ID: Record<string, string> = {
  // contenido
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
  // apoyo
  demo_evento_sector: '/images/content-examples/demo-evento-sector.webp',
  resena_publica: '/images/content-examples/resena-publica.webp',
  activacion_sucursal: '/images/content-examples/activacion-sucursal.webp',
  speaking_panel: '/images/content-examples/speaking-panel.webp',
  intro_calificada: '/images/content-examples/intro-calificada.webp',
  meetup_local: '/images/content-examples/meetup-local.webp',
  co_marketing: '/images/content-examples/co-marketing.webp',
  beta_feedback: '/images/content-examples/beta-feedback.webp',
  material_local: '/images/content-examples/material-local.webp',
  stand_feria: '/images/content-examples/stand-feria.webp',
  // filantropía
  voluntariado_animales: '/images/content-examples/voluntariado-animales.webp',
  jornada_adopcion: '/images/content-examples/jornada-adopcion.webp',
  banco_alimentos: '/images/content-examples/banco-alimentos.webp',
  comedor_comunitario: '/images/content-examples/comedor-comunitario.webp',
  distribucion_despensas: '/images/content-examples/distribucion-despensas.webp',
  albergue_personas: '/images/content-examples/albergue-personas.webp',
  limpieza_publica: '/images/content-examples/limpieza-publica.webp',
  mentoria_emprendedor: '/images/content-examples/mentoria-emprendedor.webp',
  conferencia_escuela: '/images/content-examples/conferencia-escuela.webp',
  beca_patrocinio: '/images/content-examples/beca-patrocinio.webp',
};
// Asignar ejemploImage automáticamente si no está seteado
for (const c of CONTENT_TYPES) {
  if (!c.ejemploImage && IMG_BY_ID[c.id]) c.ejemploImage = IMG_BY_ID[c.id];
}

export function getContentTypesByCategoria(categoria: 'contenido' | 'apoyo' | 'filantropia'): ContentType[] {
  return CONTENT_TYPES.filter(c => (c.categoria || 'contenido') === categoria);
}

export const META_PUNTOS_MES = 100;

// Helper para encontrar un tipo por id
export function getContentType(id: string): ContentType | undefined {
  return CONTENT_TYPES.find(c => c.id === id);
}

export function getPuntosByTipo(id: string): number {
  return getContentType(id)?.puntos || 0;
}
