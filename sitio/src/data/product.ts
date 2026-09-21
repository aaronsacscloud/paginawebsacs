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
        title: 'Punto de Venta para Tiendas de Ropa — Sacs',
        description: 'Cobra con tarjeta, efectivo o transferencia desde cualquier dispositivo. El punto de venta omnicanal de Sacs.',
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
        title: 'Tienda en Línea para Marcas de Moda — Sacs',
        description: 'Tu ecommerce conectado al mismo inventario y clientes de tu tienda física: lo que vendes en línea baja del mismo stock que el piso, sin duplicar captura.',
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
        title: 'Promociones para tu Tienda de Moda — Sacs',
        description: 'Crea promociones avanzadas para tu tienda de moda: 3x2, descuentos por volumen, fin de temporada y remates, en el piso y en línea al mismo tiempo.',
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
        title: 'Apartados y Pedidos para tu Boutique — Sacs',
        description: 'El apartado baja del inventario en el momento, con su anticipo y su fecha. Nadie vuelve a vender dos veces la misma prenda por no ver la libreta.',
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
        title: 'WhatsApp y Redes Sociales para Vender Moda — Sacs',
        description: 'Vende ropa, calzado y accesorios en TikTok, Instagram, Facebook y WhatsApp con el mismo inventario sincronizado que tu tienda física.',
        hero: {
          eyebrow: 'Vende',
          headline: 'Vende donde están tus clientes',
          subtitle: 'TikTok, Instagram, Facebook y WhatsApp conectados a tu inventario en tiempo real.',
        },
        status: 'live',
      },
      {
        slug: 'agentic-commerce',
        pillarId: 'vende',
        label: 'Agentic Commerce',
        title: 'Agente de IA por WhatsApp para tu Boutique — Sacs',
        description: 'Un agente de IA que atiende, cotiza, cobra y entrega por WhatsApp con el catálogo real de tu tienda de moda: tallas, colores y existencia al día.',
        hero: {
          eyebrow: 'Vende',
          headline: 'Un agente que vende como si conociera tu tienda',
          subtitle: 'Porque la conoce. WhatsApp 24/7 con stock real, precios y promos de Sacs.',
        },
        status: 'live',
      },
      {
        slug: 'facturacion-electronica',
        pillarId: 'vende',
        label: 'Facturación electrónica',
        title: 'Facturación Electrónica para tu Tienda de Ropa — Sacs',
        description: 'CFDI desde la misma caja, factura global del día, autofacturación para el cliente y complementos de pago. Sin salir del punto de venta.',
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
        title: 'Inventario por Talla y Color — Sacs',
        description: 'Una sola existencia por talla y color para el piso, la tienda en línea y las redes. Lo que se vende en un canal desaparece en todos al instante.',
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
        title: 'Conteo Físico por Talla para tu Tienda — Sacs',
        description: 'Cuenta con el celular, talla por talla, sin cerrar la tienda. El faltante aparece el día que ocurre y no en el inventario de fin de año.',
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
        title: 'Nivelación de Tallas entre Sucursales — Sacs',
        description: 'Mueve las tallas que sobran en una tienda a la que las está pidiendo, antes de que se rompa la corrida. Sacs te dice qué mover y a dónde.',
        hero: {
          eyebrow: 'Controla',
          headline: 'El producto correcto, en la sucursal correcta',
          subtitle: 'Sacs nivela tu inventario automáticamente según la demanda de cada punto de venta.',
        },
        status: 'live',
      },
      {
        slug: 'ordenes-de-compra',
        pillarId: 'controla',
        label: 'Órdenes de compra',
        title: 'Órdenes de Compra por Talla y Color — Sacs',
        description: 'Arma la orden con la curva de tallas que tu propia venta pide, recibe contra orden y controla lo que cada proveedor te quedó a deber.',
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
        title: 'Control de Gastos para tu Cadena de Tiendas — Sacs',
        description: 'Registra y clasifica lo que gasta cada tienda: renta, nómina, servicios y proveedores. Para saber cuál sucursal deja dinero y cuál solo vende.',
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
        title: 'Cuentas por Pagar a Proveedores de Moda — Sacs',
        description: 'Lo que le debes a cada proveedor, con sus complementos de pago y notas de crédito. Sabes cuánto sale este mes antes de que llegue la fecha.',
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
        title: 'Reportes y Analítica para Retail de Moda — Sacs',
        description: 'Sell-through, ABC, rotación por talla y margen por modelo. Más de 50 reportes que contestan qué comprar, qué rebajar y qué dejar de traer.',
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
        title: 'CRM de Clientes para tu Tienda de Ropa — Sacs',
        description: 'La ficha de cada cliente con sus tallas, lo que compró y por dónde te escribe. La conversación es de la tienda, no del teléfono del vendedor.',
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
        title: 'Programa de Lealtad para tu Boutique — Sacs',
        description: 'Monedero, puntos y niveles que se aplican desde la caja sin apps ni tarjetas. El cliente lo usa en su siguiente compra, en cualquier sucursal.',
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
        title: 'Portal de Clientes para tu Marca de Moda — Sacs',
        description: 'Portal con tu marca para que tu cliente consulte puntos y saldo, autofacture su ticket y compre otra vez sin escribirle a nadie.',
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
        title: 'Tarjetas de Regalo para tu Tienda de Moda — Sacs',
        description: 'Tarjetas de regalo físicas y digitales canjeables en cualquier sucursal de tu tienda de moda, con saldo que se descuenta solo en la caja.',
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
        title: 'Email Marketing para Marcas de Moda — Sacs',
        description: 'Campañas segmentadas por lo que cada cliente compró y por su talla. El correo del restock le llega a quien preguntó por esa prenda, no a la lista entera.',
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
        title: 'Marketing por WhatsApp para tu Boutique — Sacs',
        description: 'Avisa por WhatsApp cuando llega la talla que alguien pidió o cuando vuelve un modelo agotado. Sale del inventario real, no de un calendario.',
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
        title: 'Membresías para Marcas y Tiendas de Moda — Sacs',
        description: 'Planes con cobro recurrente y beneficios por nivel: acceso anticipado al drop, envío incluido o descuento permanente. Ingreso que no depende de la temporada.',
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
        title: 'Especialista IA para tu Negocio de Moda — Sacs',
        description: 'Una persona real que se sienta contigo a montar tus automatizaciones y te acompaña mientras aprendes a moverlas. No es un chat: es alguien.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Tu especialista en IA, dedicado a tu negocio',
          subtitle: 'Una persona real que diseña workflows, optimiza procesos y automatiza tu operación contigo.',
        },
        status: 'live',
      },
      {
        slug: 'axo-copiloto-ia',
        pillarId: 'automatiza',
        label: 'AXO · Copiloto IA',
        title: 'AXO: Copiloto IA para tu Tienda de Ropa — Sacs',
        description: 'Pregúntale en español qué modelo se está muriendo, qué talla falta en qué tienda o cuánto vendiste ayer. Contesta con tus datos, no con generalidades.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'AXO: el copiloto que entiende tu negocio',
          subtitle: 'Pregúntale lo que quieras, detecta problemas y aprende de tu operación cada día.',
        },
        status: 'live',
      },
      {
        slug: 'workflows',
        pillarId: 'automatiza',
        label: 'Workflows',
        title: 'Automatizaciones para tu Tienda de Moda — Sacs',
        description: 'Reglas que corren solas: si una talla baja de tres piezas, pide reabasto; si un cliente cumple años, avísale. Se arman sin programar nada.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Automatiza lo que se repite',
          subtitle: 'Reglas trigger → acción: stock bajo genera orden, nueva venta notifica y factura.',
        },
        status: 'live',
      },
      {
        slug: 'alertas-inteligentes',
        pillarId: 'automatiza',
        label: 'Alertas inteligentes',
        title: 'Alertas de Inventario para tu Boutique — Sacs',
        description: 'Te avisa cuando una talla del centro se está agotando, cuando un modelo dejó de venderse y cuando una tienda lleva días sin mover algo. Antes, no después.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Alertas antes de que sea problema',
          subtitle: 'Anomalías de venta, productos estancados, riesgo de quiebre. Por WhatsApp o email.',
        },
        status: 'live',
      },
      {
        slug: 'reportes-predictivos',
        pillarId: 'automatiza',
        label: 'Reportes predictivos',
        title: 'Reportes Predictivos de Venta de Moda — Sacs',
        description: 'Qué se va a vender y qué se va a quedar, calculado con tu propio histórico por talla. Para comprar con un número y no con una corazonada.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Reportes que predicen, no solo miden',
          subtitle: 'Forecast de demanda, resumen ejecutivo semanal y análisis de rentabilidad con IA.',
        },
        status: 'live',
      },
      {
        slug: 'orquestador-de-agentes',
        pillarId: 'automatiza',
        label: 'Orquestador de agentes',
        title: 'Orquestador de IA para tu Negocio de Moda — Sacs',
        description: 'Conecta Claude, GPT y Gemini para ejecutar tareas complejas en cadena: reabasto, pricing y campañas de tu tienda de moda, sin armarlas a mano.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Múltiples IAs trabajando para ti',
          subtitle: 'Claude, GPT y Gemini orquestados para reabasto, pricing y campañas en cadena.',
        },
        status: 'live',
      },
      {
        slug: 'api-e-integraciones',
        pillarId: 'automatiza',
        label: 'API e integraciones',
        title: 'API e Integraciones para tu Tienda de Moda — Sacs',
        description: 'Conecta Sacs con más de 600 aplicaciones: contabilidad, logística, marketplaces y marketing. Y una API abierta para lo que no esté en la lista.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Conecta Sacs con todo tu stack',
          subtitle: '+600 apps: ERP, contabilidad, logística, marketing. API abierta para integraciones a la medida.',
        },
        status: 'live',
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
