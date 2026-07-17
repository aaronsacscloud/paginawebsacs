// ═══════════════════════════════════════════════════════════════════
//  Especialidades de nicho para invitaciones de partner
//
//  Una invitación puede ser GENÉRICA (SACS completo, cualquier giro) o de
//  ESPECIALISTA: el partner se enfoca en un giro concreto y la invitación
//  entera se re-enfoca a ese mercado — mismas reglas de comisión, distinto
//  posicionamiento. La selección vive en `tabulador.especialidad` (jsonb),
//  igual que el modo `escalonado` — sin columna nueva en la DB.
//
//  Usada por:
//   - src/components/admin/crm/PartnersTab.tsx  (selector del form admin)
//   - src/pages/partners/invitacion/[id].astro  (render de la invitación)
// ═══════════════════════════════════════════════════════════════════

export interface EspecialidadIncluye {
  title: string;
  detail: string;
}

export interface Especialidad {
  /** id estable — se guarda en tabulador.especialidad.giro */
  giro: string;
  label: string;          // "Papelerías y oficina"
  badge: string;          // "Partner Especialista en Papelerías"
  color: string;          // acento del nicho en la invitación
  /** título del hero enfocado al giro */
  heroTitulo: string;
  /** pitch de 2-3 líneas: por qué especializarse en este giro con SACS */
  heroPitch: string;
  /** a quién le va a vender el partner (se listan en la invitación) */
  mercado: string[];
  /** el stack de especialidad: qué trae SACS específico para el giro */
  incluye: EspecialidadIncluye[];
  /** argumento de negocio del nicho (sección "por qué un nicho") */
  argumento: string;
  /** iconId del sector correspondiente en src/data/navigation.ts (businessSectors) —
   *  la invitación usa su imagen y sus módulos reales como evidencia del giro */
  sectorIconId?: string;
}

export const ESPECIALIDADES: Record<string, Especialidad> = {
  papeleria: {
    giro: 'papeleria',
    label: 'Papelerías y oficina',
    badge: 'Partner Especialista en Papelerías',
    color: '#22C55E',
    sectorIconId: 'stationery',
    heroTitulo: 'Conviértete en EL especialista en sistemas para papelerías de tu zona',
    heroPitch:
      'No vas a vender "un sistema para cualquier negocio": vas a llegar a cada papelería con una solución armada específicamente para su operación — catálogo de oficina precargado, listas escolares digitales y la operación completa de mostrador. El que domina un nicho cierra más rápido, cobra mejor y lo recomiendan entre colegas del mismo giro.',
    mercado: [
      'Papelerías de barrio y cadenas locales',
      'Papelerías escolares y de temporada',
      'Librerías con venta de útiles',
      'Centros de copiado e impresión',
      'Distribuidores de artículos de oficina',
      'Mercerías y bazares con línea escolar',
    ],
    incluye: [
      {
        title: 'Suite de Oficina',
        detail:
          'Catálogo maestro de artículos de oficina y papelería listo para importar: claves, presentaciones (pieza/caja/paquete), variantes y precios sugeridos. El cliente abre su tienda con el inventario armado en horas, no en semanas.',
      },
      {
        title: 'Suite de Listas Escolares',
        detail:
          'La temporada más fuerte del giro, sistematizada: el cliente captura las listas de cada colegio y grado una vez, y SACS las convierte en cotizaciones, paquetes armados y venta en línea. Los papás compran la lista completa en un click y la papelería surte sin errores.',
      },
      {
        title: 'Operación completa de mostrador',
        detail:
          'POS rápido para tickets chicos y alto volumen, control de inventario multi-presentación (pieza, caja, millar), mínimos y reabastecimiento, ventas por copias e impresiones, apartados y clientes frecuentes.',
      },
      {
        title: 'Expertise y playbook del giro',
        detail:
          'Te certificamos en la operación real de una papelería: qué duele (mermas de temporada, inventario que no cuadra, listas a mano), qué demo mostrar, qué números enseñar y cómo cerrar. Guiones, materiales y casos del giro listos para usar.',
      },
      {
        title: 'E-commerce y WhatsApp del giro',
        detail:
          'Tienda en línea conectada al inventario físico y atención por WhatsApp — la papelería publica su catálogo y sus listas escolares y vende sin marketplace de por medio.',
      },
    ],
    argumento:
      'Un especialista no compite contra todos los sistemas — compite en SU cancha. Conoces los proveedores, las temporadas, los márgenes y el lenguaje del giro. Cada cliente cerrado te presenta al siguiente: las papelerías se conocen entre sí, van a las mismas expos y compran a los mismos mayoristas. Tu reputación en el nicho se vuelve tu mejor canal de venta.',
  },

  farmacia: {
    giro: 'farmacia',
    label: 'Farmacias',
    badge: 'Partner Especialista en Farmacias',
    color: '#2AB5A0',
    sectorIconId: 'pharmacy',
    heroTitulo: 'Conviértete en EL especialista en sistemas para farmacias de tu zona',
    heroPitch:
      'Llega a cada farmacia con una solución enfocada a su operación: catálogo con sustancias y presentaciones, caducidades, controlados y venta de mostrador de alto volumen. El especialista del giro cierra más rápido y lo recomiendan entre colegas.',
    mercado: ['Farmacias independientes', 'Mini-cadenas locales', 'Farmacias con consultorio', 'Distribuidores farmacéuticos'],
    incluye: [
      { title: 'Catálogo del giro', detail: 'Base de productos farmacéuticos con presentaciones y control de caducidades por lote.' },
      { title: 'Operación de mostrador', detail: 'POS de alto volumen, inventario multi-sucursal, mínimos y reabastecimiento automático.' },
      { title: 'Expertise del giro', detail: 'Playbook de venta, demos y materiales enfocados a la operación real de una farmacia.' },
    ],
    argumento:
      'Un especialista no compite contra todos los sistemas — compite en SU cancha. Cada cliente cerrado te presenta al siguiente dentro del mismo gremio.',
  },

  ferreteria: {
    giro: 'ferreteria',
    label: 'Ferreterías y materiales',
    badge: 'Partner Especialista en Ferreterías',
    color: '#6C5CE7',
    sectorIconId: 'hardware',
    heroTitulo: 'Conviértete en EL especialista en sistemas para ferreterías de tu zona',
    heroPitch:
      'Cada ferretería recibe una solución armada para su operación: catálogo con miles de SKUs, ventas por granel y medida, cotizaciones a obra y crédito a clientes. El especialista del giro cierra más rápido y lo recomiendan entre colegas.',
    mercado: ['Ferreterías de barrio', 'Materiales para construcción', 'Tlapalerías', 'Distribuidores industriales'],
    incluye: [
      { title: 'Catálogo del giro', detail: 'Manejo de miles de SKUs con presentaciones, granel y unidades de medida.' },
      { title: 'Cotizaciones y crédito', detail: 'Cotizaciones a obra, apartados, crédito a clientes frecuentes y facturación.' },
      { title: 'Expertise del giro', detail: 'Playbook de venta, demos y materiales enfocados a la operación real de una ferretería.' },
    ],
    argumento:
      'Un especialista no compite contra todos los sistemas — compite en SU cancha. Cada cliente cerrado te presenta al siguiente dentro del mismo gremio.',
  },

  boutique: {
    giro: 'boutique',
    label: 'Boutiques y moda',
    badge: 'Partner Especialista en Moda y Boutiques',
    color: '#E54B4B',
    sectorIconId: 'clothing',
    heroTitulo: 'Conviértete en EL especialista en sistemas para boutiques de tu zona',
    heroPitch:
      'Llega a cada boutique con la solución del giro: variantes de talla y color, colecciones y temporadas, apartados, e-commerce conectado al inventario físico y venta por WhatsApp e Instagram.',
    mercado: ['Boutiques de ropa y calzado', 'Tiendas de accesorios', 'Marcas propias con venta en línea', 'Showrooms'],
    incluye: [
      { title: 'Variantes y colecciones', detail: 'Talla/color/modelo, temporadas, transferencias entre sucursales y mermas.' },
      { title: 'Venta omnicanal', detail: 'E-commerce conectado al inventario físico, apartados y atención por WhatsApp.' },
      { title: 'Expertise del giro', detail: 'Playbook de venta, demos y materiales enfocados a la operación real de una boutique.' },
    ],
    argumento:
      'Un especialista no compite contra todos los sistemas — compite en SU cancha. Cada cliente cerrado te presenta al siguiente dentro del mismo gremio.',
  },
};

/** Lee la especialidad de una invitación (vive en tabulador.especialidad). */
export function especialidadDe(invitation: { tabulador?: any } | null | undefined): Especialidad | null {
  const esp = invitation?.tabulador?.especialidad;
  if (!esp || esp.enabled === false) return null;
  const base = ESPECIALIDADES[esp.giro];
  if (!base) return null;
  // Overrides opcionales guardados en la invitación (label/badge/pitch custom)
  return { ...base, ...(esp.overrides || {}) };
}
