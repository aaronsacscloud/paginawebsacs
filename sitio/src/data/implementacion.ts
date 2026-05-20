// Proceso de implementación SACS — contenido compartido entre la cotización
// (variant condensed) y la ruta dedicada /cotizacion/[id]/implementacion (variant full).
// Adaptado de https://sacscloudplugins.vercel.app/implementacion/

export interface ImplMetric {
  value: string;
  label: string;
}

export interface ImplStep {
  id: string;
  dayBadge: string;
  emoji: string;
  title: string;
  description: string;
  bullets: string[];
  durationBadge: { text: string; color: string };
  color: string;
}

export interface ImplItem {
  emoji: string;
  title: string;
  description: string;
  badge?: string;
}

export interface ImplOutcome {
  emoji: string;
  title: string;
  description: string;
  bullets: string[];
}

export interface ImplSummaryStep {
  emoji: string;
  title: string;
  description: string;
  timing: string;
}

export const IMPL_METRICS: ImplMetric[] = [
  { value: '2–3 días', label: 'Migración completa de tu información' },
  { value: '1–2', label: 'Sesiones de capacitación incluidas' },
  { value: '< 7 días', label: 'Para agregar otra sucursal por tu cuenta' },
];

export const IMPL_STEPS: ImplStep[] = [
  {
    id: 'envio',
    dayBadge: 'Día 1 — Inicio',
    emoji: '📤',
    title: 'Envías tu base de datos',
    description: 'Lo primero es lo primero: nos mandas la información de tu negocio. No importa en qué formato la tengas — nosotros la procesamos.',
    bullets: [
      'Excel, CSV o exportación de tu sistema actual — aceptamos cualquier formato',
      'Productos, precios, inventario, proveedores, clientes — todo lo que tengas',
      'No necesitas limpiar ni organizar la información, nosotros nos encargamos',
    ],
    durationBadge: { text: '⏱ Envío inmediato — tú solo mandas los archivos', color: '#4B7BE5' },
    color: '#4B7BE5',
  },
  {
    id: 'migracion',
    dayBadge: 'Día 1–3 — En paralelo',
    emoji: '🔄',
    title: 'Migramos tu información a SACS',
    description: 'Mientras tú sigues operando con tu sistema actual, nuestro equipo trabaja en migrar toda tu información a SACS. Este proceso toma de 2 a 3 días hábiles.',
    bullets: [
      'Limpieza y normalización de tu catálogo de productos',
      'Migración de clientes, proveedores e inventario completo',
      'Configuración de precios, impuestos y reglas de negocio',
      'Validación de datos antes de la puesta en marcha',
    ],
    durationBadge: { text: '⏱ 2–3 días hábiles', color: '#6C5CE7' },
    color: '#6C5CE7',
  },
  {
    id: 'capacitacion',
    dayBadge: 'Día 1–3 — En paralelo',
    emoji: '🎓',
    title: 'Capacitación del punto de venta',
    description: 'Mientras migramos tu información, hacemos sesiones de capacitación para que tú y tu equipo dominen el punto de venta desde el primer día.',
    bullets: [
      '1 a 2 sesiones de capacitación del módulo de punto de venta',
      'Cómo hacer ventas, cobrar, aplicar descuentos y gestionar turnos',
      'Manejo de efectivo, tarjeta y otros métodos de pago',
      'Tu equipo llega listo para operar el día que se active el sistema',
    ],
    durationBadge: { text: '🎯 En paralelo con la migración', color: '#E8A838' },
    color: '#E8A838',
  },
  {
    id: 'arranque',
    dayBadge: 'Día 4 — Puesta en marcha',
    emoji: '🚀',
    title: 'Empiezas a operar con SACS',
    description: 'Una vez que tu información está migrada y tu equipo capacitado, al día siguiente comienzas a operar tu negocio con SACS. Así de rápido.',
    bullets: [
      'Tu tienda física operando con tu primer punto de venta',
      'Todo tu catálogo, clientes e inventario ya cargados en el sistema',
      'Tu equipo capacitado y listo para vender',
      'Soporte inmediato para cualquier duda del primer día',
    ],
    durationBadge: { text: '✅ Operando desde el día 1', color: '#2AB5A0' },
    color: '#2AB5A0',
  },
  {
    id: 'curso',
    dayBadge: 'Día 5+ — Continuo',
    emoji: '📚',
    title: 'Curso paso a paso + implementación avanzada',
    description: 'Ya estás operando. Ahora te enviamos un curso completo paso a paso para que implementes todo lo demás que SACS tiene para tu negocio, a tu ritmo.',
    bullets: [
      'Curso completo paso a paso de todos los módulos del sistema',
      'Reportes, inventario avanzado, compras, proveedores y más',
      'Cada lección pensada para que la apliques directamente en tu negocio',
      'Avanza a tu propio ritmo — sin presión ni fechas límite',
    ],
    durationBadge: { text: '📖 A tu ritmo — sin límite de tiempo', color: '#4B7BE5' },
    color: '#4B7BE5',
  },
  {
    id: 'canales',
    dayBadge: 'Semana 2+ — Expansión',
    emoji: '🌐',
    title: 'Conecta tu tienda en línea y todos tus canales',
    description: 'Con tu tienda física operando, el siguiente paso es conectar tu presencia digital. Te ayudamos a configurar tu tienda en línea y conectar todos tus canales de venta.',
    bullets: [
      'Tu tienda en línea con diseño profesional y conectada a SACS',
      'Conexión con Meta (Facebook e Instagram Shopping)',
      'Conexión con TikTok para venta social',
      'Conexión con Google Merchant Center para aparecer en Google Shopping',
      'Todos tus canales sincronizados: inventario, precios y pedidos en un solo lugar',
    ],
    durationBadge: { text: '🔗 Todos tus canales conectados', color: '#1a1a1a' },
    color: '#1a1a1a',
  },
];

export const INCLUIDO_ITEMS: ImplItem[] = [
  { emoji: '👨‍💼', title: '2 sesiones con consultor', description: 'Dos sesiones personalizadas con un consultor experto para resolver dudas específicas de tu negocio, optimizar tu operación o planear la siguiente etapa de crecimiento.' },
  { emoji: '🎓', title: 'Academia SACS', description: 'Dentro del sistema tienes acceso a la Academia: un programa paso a paso que te guía por todo el proceso de implementación para medir, analizar y mejorar tu negocio.' },
  { emoji: '📅', title: 'Workshops semanales', description: 'Sesiones en vivo cada semana donde puedes aprender funciones nuevas del sistema, ver mejores prácticas y hacer preguntas directamente al equipo de SACS.' },
  { emoji: '💬', title: 'Chat y WhatsApp', description: 'Para cualquier duda rápida o tema menor del sistema, tienes acceso a soporte por chat de SACS y WhatsApp de 9 AM a 5 PM. Siempre hay alguien para ayudarte.' },
  { emoji: '📚', title: 'Curso paso a paso', description: 'Un curso completo que te lleva de la mano por todos los módulos del sistema. Desde lo básico hasta lo avanzado, con ejemplos prácticos para tu tipo de negocio.' },
  { emoji: '🔄', title: 'Migración completa', description: 'No empiezas de cero. Migramos toda tu información de tu sistema anterior o Excel: productos, precios, clientes, proveedores e inventario. Nosotros hacemos todo el trabajo.' },
];

export const SOPORTE_ITEMS: ImplItem[] = [
  { emoji: '👨‍💼', title: 'Consultor 1-a-1', description: 'Dos sesiones personalizadas incluidas para temas complejos de tu negocio.', badge: '2 sesiones incluidas' },
  { emoji: '📅', title: 'Workshops en vivo', description: 'Sesiones semanales para aprender funciones avanzadas y mejores prácticas.', badge: 'Cada semana' },
  { emoji: '🎓', title: 'Academia SACS', description: 'Programa paso a paso dentro del sistema para aprender a tu propio ritmo.', badge: 'Siempre disponible' },
  { emoji: '💬', title: 'Chat y WhatsApp', description: 'Soporte inmediato para cualquier duda rápida o tema menor del sistema.', badge: '9 AM–5 PM · chat SACS y WhatsApp' },
];

export const OUTCOMES: ImplOutcome[] = [
  {
    emoji: '🏪',
    title: 'Tienda física operando',
    description: 'Tu primer punto de venta funcionando al 100% con toda tu información migrada.',
    bullets: [
      'Punto de venta con tu catálogo completo',
      'Inventario, clientes y precios cargados',
      'Equipo capacitado para operar',
      'Reportes desde el primer día de operación',
    ],
  },
  {
    emoji: '🌐',
    title: 'Tienda en línea',
    description: 'Tu tienda digital con diseño profesional, conectada y sincronizada con tu inventario.',
    bullets: [
      'Diseño profesional de tu tienda en línea',
      'Catálogo sincronizado con tu tienda física',
      'Pedidos en línea directo al sistema',
      'Inventario unificado en todos los canales',
    ],
  },
  {
    emoji: '📱',
    title: 'Todos tus canales',
    description: 'Meta, TikTok y Google Merchant Center conectados para vender en todos los frentes.',
    bullets: [
      'Facebook e Instagram Shopping activos',
      'TikTok para venta social',
      'Google Merchant Center para Google Shopping',
      'Todo sincronizado: precios, inventario y pedidos',
    ],
  },
];

export const CRECIMIENTO_STATS: ImplMetric[] = [
  { value: '< 7 días', label: 'Para agregar otra sucursal por tu cuenta' },
  { value: 'Sin depender', label: 'De nuestro equipo' },
  { value: '0 migración', label: 'Tu info ya está en el sistema' },
  { value: 'Mismo plan', label: 'No necesitas pagar más' },
];

export const SUMMARY_STEPS: ImplSummaryStep[] = [
  { emoji: '📤', title: 'Envías tu info', description: 'Base de datos de tu sistema actual o Excel', timing: 'Día 1' },
  { emoji: '🔄', title: 'Migramos + Capacitamos', description: 'En paralelo: migración de datos y capacitación POS', timing: 'Día 1–3' },
  { emoji: '🚀', title: 'Empiezas a operar', description: 'Tu tienda física funcionando con SACS', timing: 'Día 4' },
  { emoji: '🌐', title: 'Conectas canales', description: 'Tienda en línea + Meta + TikTok + Google', timing: 'Semana 2+' },
  { emoji: '📈', title: 'Creces', description: 'Más sucursales en menos de 7 días por tu cuenta', timing: 'Cuando quieras' },
];
