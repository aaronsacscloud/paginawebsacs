// ─── Types ───

export type PillarId = 'vende' | 'controla' | 'fideliza' | 'automatiza';

export interface ProductFeature {
  slug: string;
  pillarId: PillarId;
  label: string;
  title: string;
  description: string;
  hero: {
    eyebrow: string;
    headline: string;
    subtitle: string;
  };
  status: 'live' | 'coming-soon';
}

export interface Pillar {
  id: PillarId;
  num: number;
  verb: string;
  description: string;
  color: string;
  features: ProductFeature[];
}

// ─── Pillars & Features ───

export const pillars: Pillar[] = [
  {
    id: 'vende',
    num: 1,
    verb: 'Vende',
    description: 'Cobra en todos los canales',
    color: '#4B7BE5',
    features: [
      {
        slug: 'punto-de-venta',
        pillarId: 'vende',
        label: 'Punto de venta',
        title: 'Punto de Venta — SACS',
        description: 'Cobra con tarjeta, efectivo o transferencia desde cualquier dispositivo. El punto de venta omnicanal de SACS.',
        hero: {
          eyebrow: 'Vende',
          headline: 'Tu punto de venta, en cualquier dispositivo',
          subtitle: 'Cobra con tarjeta, efectivo o transferencia en segundos. Sin hardware especial.',
        },
        status: 'live',
      },
      {
        slug: 'tienda-en-linea',
        pillarId: 'vende',
        label: 'Tienda en línea',
        title: 'Tienda en Línea — SACS',
        description: 'Tu ecommerce conectado al mismo inventario y clientes de tu tienda física.',
        hero: {
          eyebrow: 'Vende',
          headline: 'Tu tienda en línea, siempre conectada',
          subtitle: 'eCommerce integrado al inventario físico. Vende 24/7 sin duplicar operación.',
        },
        status: 'live',
      },
      {
        slug: 'promociones',
        pillarId: 'vende',
        label: 'Promociones',
        title: 'Promociones — SACS',
        description: 'Crea promociones avanzadas: 3x2, descuentos por volumen, temporada y más.',
        hero: {
          eyebrow: 'Vende',
          headline: 'Promociones que mueven inventario',
          subtitle: 'Configura 3x2, descuentos por volumen, temporada y más. En tienda y en línea.',
        },
        status: 'live',
      },
      {
        slug: 'apartados-y-pedidos',
        pillarId: 'vende',
        label: 'Apartados y pedidos',
        title: 'Apartados y Pedidos — SACS',
        description: 'Gestiona apartados con anticipo, plazos y recordatorios automáticos.',
        hero: {
          eyebrow: 'Vende',
          headline: 'Apartados y pedidos sin complicaciones',
          subtitle: 'Anticipo, plazos, pagos parciales y recordatorios automáticos para tus clientes.',
        },
        status: 'live',
      },
      {
        slug: 'social-commerce',
        pillarId: 'vende',
        label: 'Social & WhatsApp Commerce',
        title: 'Social & WhatsApp Commerce — SACS',
        description: 'Vende en TikTok, Instagram, Facebook y WhatsApp con inventario sincronizado.',
        hero: {
          eyebrow: 'Vende',
          headline: 'Vende donde están tus clientes',
          subtitle: 'TikTok, Instagram, Facebook y WhatsApp conectados a tu inventario en tiempo real.',
        },
        status: 'coming-soon',
      },
      {
        slug: 'agentic-commerce',
        pillarId: 'vende',
        label: 'Agentic Commerce',
        title: 'Agentic Commerce — SACS',
        description: 'Un agente de IA que atiende, cotiza, cobra y entrega por WhatsApp — con tu catálogo real.',
        hero: {
          eyebrow: 'Vende',
          headline: 'Un agente que vende como si conociera tu tienda',
          subtitle: 'Porque la conoce. WhatsApp 24/7 con stock real, precios y promos de SACS.',
        },
        status: 'live',
      },
      {
        slug: 'facturacion-electronica',
        pillarId: 'vende',
        label: 'Facturación electrónica',
        title: 'Facturación Electrónica — SACS',
        description: 'CFDI, factura global, autofacturación y complementos de pago.',
        hero: {
          eyebrow: 'Vende',
          headline: 'Facturación electrónica sin fricción',
          subtitle: 'CFDI desde el punto de venta, autofacturación para clientes y factura global automática.',
        },
        status: 'live',
      },
    ],
  },
  {
    id: 'controla',
    num: 2,
    verb: 'Controla',
    description: 'Inventario, compras y finanzas',
    color: '#2AB5A0',
    features: [
      {
        slug: 'inventario-omnicanal',
        pillarId: 'controla',
        label: 'Inventario omnicanal',
        title: 'Inventario Omnicanal — SACS',
        description: 'Stock por sucursal, CEDIS y canal de venta en tiempo real.',
        hero: {
          eyebrow: 'Controla',
          headline: 'Todo tu inventario sincronizado',
          subtitle: 'Stock por sucursal, CEDIS y canal de venta. Siempre en tiempo real.',
        },
        status: 'live',
      },
      {
        slug: 'conteo-fisico',
        pillarId: 'controla',
        label: 'Conteo físico',
        title: 'Conteo Físico — SACS',
        description: 'Escanea con tu celular y actualiza el inventario en segundos.',
        hero: {
          eyebrow: 'Controla',
          headline: 'Conteo físico en segundos',
          subtitle: 'Escanea con tu celular, sin cerrar tienda. Conteos cíclicos programados.',
        },
        status: 'live',
      },
      {
        slug: 'nivelacion-de-inventario',
        pillarId: 'controla',
        label: 'Nivelación de inventario',
        title: 'Nivelación de Inventario — SACS',
        description: 'Distribuye stock automáticamente entre sucursales según demanda.',
        hero: {
          eyebrow: 'Controla',
          headline: 'El producto correcto, en la sucursal correcta',
          subtitle: 'SACS nivela tu inventario automáticamente según la demanda de cada punto de venta.',
        },
        status: 'live',
      },
      {
        slug: 'ordenes-de-compra',
        pillarId: 'controla',
        label: 'Órdenes de compra',
        title: 'Órdenes de Compra — SACS',
        description: 'Genera órdenes de compra, recibe contra orden y controla proveedores.',
        hero: {
          eyebrow: 'Controla',
          headline: 'Compras organizadas, proveedores controlados',
          subtitle: 'Órdenes de compra por variante, recepción con validación y catálogos por proveedor.',
        },
        status: 'live',
      },
      {
        slug: 'gastos',
        pillarId: 'controla',
        label: 'Gastos',
        title: 'Control de Gastos — SACS',
        description: 'Registra y categoriza gastos operativos por sucursal.',
        hero: {
          eyebrow: 'Controla',
          headline: 'Cada peso, registrado',
          subtitle: 'Control de gastos operativos por sucursal. Sin hojas de cálculo.',
        },
        status: 'live',
      },
      {
        slug: 'cuentas-por-pagar',
        pillarId: 'controla',
        label: 'Cuentas por pagar',
        title: 'Cuentas por Pagar — SACS',
        description: 'Complementos de pago, notas de crédito y saldos con proveedores.',
        hero: {
          eyebrow: 'Controla',
          headline: 'Cuentas por pagar, siempre al día',
          subtitle: 'Saldos con proveedores, complementos de pago y notas de crédito en un solo lugar.',
        },
        status: 'live',
      },
      {
        slug: 'reportes-y-analitica',
        pillarId: 'controla',
        label: 'Reportes y analítica',
        title: 'Reportes y Analítica — SACS',
        description: '50+ reportes de ventas, inventario y finanzas. KPIs en tiempo real.',
        hero: {
          eyebrow: 'Controla',
          headline: 'Reportes que sí entiendes',
          subtitle: '50+ reportes, 20+ KPIs. Ventas, inventario, finanzas y equipo en dashboards claros.',
        },
        status: 'live',
      },
    ],
  },
  {
    id: 'fideliza',
    num: 3,
    verb: 'Fideliza',
    description: 'Conquista y retén clientes',
    color: '#E8A838',
    features: [
      {
        slug: 'clientes-y-crm',
        pillarId: 'fideliza',
        label: 'Clientes y CRM',
        title: 'Clientes y CRM — SACS',
        description: 'Perfil 360° de cada cliente con historial omnicanal y segmentación.',
        hero: {
          eyebrow: 'Fideliza',
          headline: 'Conoce a cada cliente como si fuera el único',
          subtitle: 'Perfil 360° con historial de compras, preferencias y comportamiento omnicanal.',
        },
        status: 'live',
      },
      {
        slug: 'programa-de-lealtad',
        pillarId: 'fideliza',
        label: 'Programa de lealtad',
        title: 'Programa de Lealtad — SACS',
        description: 'Monedero electrónico, puntos y niveles integrados al punto de venta.',
        hero: {
          eyebrow: 'Fideliza',
          headline: 'Premia a tus mejores clientes',
          subtitle: 'Monedero electrónico, puntos por compra y niveles. Integrado al cobro, sin apps extra.',
        },
        status: 'live',
      },
      {
        slug: 'portal-de-clientes',
        pillarId: 'fideliza',
        label: 'Portal de clientes',
        title: 'Portal de Clientes — SACS',
        description: 'Portal personalizado con tu marca para consulta de puntos y autofacturación.',
        hero: {
          eyebrow: 'Fideliza',
          headline: 'Un portal con tu marca para tus clientes',
          subtitle: 'Consulta de puntos, historial de compras, autofacturación y recompra en un solo lugar.',
        },
        status: 'live',
      },
      {
        slug: 'tarjetas-de-regalo',
        pillarId: 'fideliza',
        label: 'Tarjetas de regalo',
        title: 'Tarjetas de Regalo — SACS',
        description: 'Tarjetas de regalo físicas y digitales canjeables en cualquier sucursal.',
        hero: {
          eyebrow: 'Fideliza',
          headline: 'Tarjetas de regalo que generan nuevos clientes',
          subtitle: 'Físicas y digitales, canjeables en cualquier sucursal y en tu tienda en línea.',
        },
        status: 'live',
      },
      {
        slug: 'marketing-por-correo',
        pillarId: 'fideliza',
        label: 'Marketing por correo',
        title: 'Marketing por Correo — SACS',
        description: 'Campañas de email segmentadas con plantillas profesionales.',
        hero: {
          eyebrow: 'Fideliza',
          headline: 'Emails que tus clientes sí abren',
          subtitle: 'Campañas segmentadas, plantillas profesionales y métricas de apertura y conversión.',
        },
        status: 'live',
      },
      {
        slug: 'marketing-por-whatsapp',
        pillarId: 'fideliza',
        label: 'Marketing por WhatsApp',
        title: 'Marketing por WhatsApp — SACS',
        description: 'Campañas y notificaciones automáticas por WhatsApp.',
        hero: {
          eyebrow: 'Fideliza',
          headline: 'Llega directo al WhatsApp de tus clientes',
          subtitle: 'Notificaciones automáticas, campañas y promociones donde tus clientes ya están.',
        },
        status: 'live',
      },
      {
        slug: 'membresias-y-suscripciones',
        pillarId: 'fideliza',
        label: 'Membresías y suscripciones',
        title: 'Membresías y Suscripciones — SACS',
        description: 'Planes recurrentes con cobro automático y beneficios exclusivos.',
        hero: {
          eyebrow: 'Fideliza',
          headline: 'Ingresos recurrentes para tu marca',
          subtitle: 'Planes de membresía con cobro automático, renovación y beneficios por nivel.',
        },
        status: 'live',
      },
    ],
  },
  {
    id: 'automatiza',
    num: 4,
    verb: 'Automatiza',
    description: 'Inteligencia que opera por ti',
    color: '#7C3AED',
    features: [
      {
        slug: 'especialista-ia',
        pillarId: 'automatiza',
        label: 'Especialista IA dedicado',
        title: 'Especialista IA Dedicado — SACS',
        description: 'Una persona real que diseña tus automatizaciones contigo.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Tu especialista en IA, dedicado a tu negocio',
          subtitle: 'Una persona real que diseña workflows, optimiza procesos y automatiza tu operación contigo.',
        },
        status: 'coming-soon',
      },
      {
        slug: 'axo-copiloto-ia',
        pillarId: 'automatiza',
        label: 'AXO · Copiloto IA',
        title: 'AXO · Copiloto IA — SACS',
        description: 'Tu asistente de IA que entiende tu negocio y actúa al instante.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'AXO: el copiloto que entiende tu negocio',
          subtitle: 'Pregúntale lo que quieras, detecta problemas y aprende de tu operación cada día.',
        },
        status: 'coming-soon',
      },
      {
        slug: 'workflows',
        pillarId: 'automatiza',
        label: 'Workflows',
        title: 'Workflows — SACS',
        description: 'Automatiza tareas repetitivas con reglas trigger → acción.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Automatiza lo que se repite',
          subtitle: 'Reglas trigger → acción: stock bajo genera orden, nueva venta notifica y factura.',
        },
        status: 'coming-soon',
      },
      {
        slug: 'alertas-inteligentes',
        pillarId: 'automatiza',
        label: 'Alertas inteligentes',
        title: 'Alertas Inteligentes — SACS',
        description: 'Avisos proactivos de anomalías, riesgos y oportunidades.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Alertas antes de que sea problema',
          subtitle: 'Anomalías de venta, productos estancados, riesgo de quiebre. Por WhatsApp o email.',
        },
        status: 'coming-soon',
      },
      {
        slug: 'reportes-predictivos',
        pillarId: 'automatiza',
        label: 'Reportes predictivos',
        title: 'Reportes Predictivos — SACS',
        description: 'Reportes generados por IA con predicción de demanda y tendencias.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Reportes que predicen, no solo miden',
          subtitle: 'Forecast de demanda, resumen ejecutivo semanal y análisis de rentabilidad con IA.',
        },
        status: 'coming-soon',
      },
      {
        slug: 'orquestador-de-agentes',
        pillarId: 'automatiza',
        label: 'Orquestador de agentes',
        title: 'Orquestador de Agentes — SACS',
        description: 'Conecta Claude, GPT y Gemini para ejecutar tareas complejas en cadena.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Múltiples IAs trabajando para ti',
          subtitle: 'Claude, GPT y Gemini orquestados para reabasto, pricing y campañas en cadena.',
        },
        status: 'coming-soon',
      },
      {
        slug: 'api-e-integraciones',
        pillarId: 'automatiza',
        label: 'API e integraciones',
        title: 'API e Integraciones — SACS',
        description: 'Conecta SACS con +600 apps: ERP, contabilidad, logística y marketing.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Conecta SACS con todo tu stack',
          subtitle: '+600 apps: ERP, contabilidad, logística, marketing. API abierta para integraciones a la medida.',
        },
        status: 'coming-soon',
      },
    ],
  },
];

// ─── Helpers ───

export function getAllSlugs(): string[] {
  return pillars.flatMap((p) => p.features.map((f) => f.slug));
}

export function getFeatureBySlug(slug: string): ProductFeature | undefined {
  for (const p of pillars) {
    const f = p.features.find((feat) => feat.slug === slug);
    if (f) return f;
  }
  return undefined;
}

export function getPillarById(id: PillarId): Pillar | undefined {
  return pillars.find((p) => p.id === id);
}

export function getPillarForFeature(slug: string): Pillar | undefined {
  return pillars.find((p) => p.features.some((f) => f.slug === slug));
}
