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
      {
        slug: 'marketplaces',
        pillarId: 'fideliza',
        label: 'Marketplaces',
        title: 'Marketplaces para Marcas de Moda — Sacs',
        description: 'Conecta tu marca a Mercado Libre, Amazon, Liverpool y más marketplaces desde un solo inventario: publicaciones, precios, stock y pedidos orquestados sin doble captura.',
        hero: {
          eyebrow: 'Fideliza',
          headline: 'Todos tus marketplaces, un solo inventario',
          subtitle: 'Publica, sincroniza stock y surte pedidos de cada marketplace desde Sacs.',
        },
        status: 'coming-soon',
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
        slug: 'axo-copiloto-ia',
        pillarId: 'automatiza',
        label: 'AXO · Copiloto IA',
        title: 'AXO: copiloto de IA para tu tienda de moda — Sacs',
        description: 'Pregúntale a tu tienda en tus palabras o con tu voz: AXO consulta tus ventas, inventario y clientas reales, y prepara apartados o traspasos que solo pasan con tu visto bueno.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Pregúntale a tu tienda',
          subtitle: 'Consulta tus datos reales y hace el trabajo contigo, siempre con tu visto bueno.',
        },
        status: 'live',
      },
      {
        slug: 'workflows',
        pillarId: 'automatiza',
        label: 'Rutinas y automatizaciones',
        title: 'Rutinas y automatizaciones para tu tienda de moda — Sacs',
        description: 'Reportes que llegan solos, tareas que se persiguen solas, recordatorios a tus clientas y procesos que corren de noche. Se lo pides a AXO en una frase.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Lo que se repite, se hace solo',
          subtitle: 'Rutinas, tareas con seguimiento y automatizaciones que ya vienen por módulo.',
        },
        status: 'live',
      },
      {
        slug: 'alertas-inteligentes',
        pillarId: 'automatiza',
        label: 'Alertas de quiebre y estancados',
        title: 'Alertas de quiebre de talla y mercancía estancada — Sacs',
        description: 'Le dices a AXO qué vigilar y lo revisa cada hora; cada mañana el Tablero de moda te dice dónde está la curva rota, qué básico se acaba y qué mercancía está parada.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Te avisa antes de que se rompa la talla',
          subtitle: 'Radares que pides en una frase y el Tablero de moda cada mañana.',
        },
        status: 'live',
      },
      {
        slug: 'reportes-predictivos',
        pillarId: 'automatiza',
        label: 'Forecast de demanda',
        title: 'Forecast de demanda por talla y tienda para moda — Sacs',
        description: 'Demand Planning pronostica cada modelo con tus temporadas reales y la curva de tallas de cada zona; AXO te explica cada número.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Cuánto vas a vender, por talla y por tienda',
          subtitle: 'Pronóstico alineado por evento, modelos nuevos por sus parecidos y rango probable.',
        },
        status: 'live',
      },
      {
        slug: 'orquestador-de-agentes',
        pillarId: 'automatiza',
        label: 'Orquestador de agentes',
        title: 'Agentes de IA en los canales de tu tienda — Sacs',
        description: 'AXO trabaja en cada canal de tu equipo con su propio enfoque, recuerda lo acordado, hace análisis largos en segundo plano y usa el modelo de IA que mejor hace cada tarea.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Un equipo de agentes en los canales de tu tienda',
          subtitle: 'Un agente por canal, memoria del equipo y la IA que mejor hace cada tarea.',
        },
        status: 'live',
      },
      {
        slug: 'api-e-integraciones',
        pillarId: 'automatiza',
        label: 'Integraciones',
        title: 'Integraciones con Shopify, Mercado Pago y más — Sacs',
        description: 'Shopify, WooCommerce, Tienda Nube y TikTok Shop sincronizan con tu inventario; Stripe y Mercado Pago cobran; Envia.com envía; y tu catálogo sale por feed a Meta y TikTok.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Conectado con lo que ya usas',
          subtitle: 'Tienda en línea, cobros, envíos y redes sobre el mismo inventario.',
        },
        status: 'live',
      },
      {
        slug: 'especialista-ia',
        pillarId: 'automatiza',
        label: 'Especialista IA dedicado',
        title: 'Especialista en IA para tu tienda de moda — Sacs',
        description: 'Con el plan Automatiza, una persona de Sacs configura las rutinas, radares y permisos de AXO, entrena a tu equipo y se sienta contigo cada mes.',
        hero: {
          eyebrow: 'Automatiza',
          headline: 'Una persona que pone a AXO a trabajar contigo',
          subtitle: 'Configura AXO, entrena a tu equipo y cada mes busca la siguiente automatización.',
        },
        status: 'live',
      },
    ],
  },
];

// ─── Secciones propias ───

/** Lo que tiene página y pestaña propias en el header, FUERA de los pilares: no sale en el submenú ni en el
 *  mega-menú de ningún pilar, y [slug].astro no le genera página. 2-oct-2026: «Planeación de demanda» salió de
 *  Automatiza a pedido del dueño («si aparece en el header, llévalo a una sección normal fuera de eso»); vive en
 *  src/pages/planeacion-de-demanda.astro y la ruta vieja /producto/… redirige con 301. */
export interface SeccionPropia {
  slug: string;
  label: string;
  href: string;
  title: string;
  description: string;
}

export const seccionesPropias: SeccionPropia[] = [
  {
    slug: 'planeacion-de-demanda',
    label: 'Planeación de demanda',
    href: '/planeacion-de-demanda',
    title: 'Planeación de demanda para moda: pronóstico y resurtido',
    description: 'Pronóstico de ventas para tiendas de ropa por temporada, modelo y tienda, con la curva de tallas de cada región. Sacs calcula el corte de pedido de cada proveedor y resurte desde el CEDIS, con candados.',
  },
];

// ─── Helpers ───

/** A dónde lleva y cómo se llama el enlace a una función (o a una sección propia) desde giros y casos. */
export function enlaceFuncion(slug: string): { href: string; label: string } {
  const seccion = seccionesPropias.find((s) => s.slug === slug);
  if (seccion) return { href: seccion.href, label: seccion.label };
  return { href: `/producto/${slug}`, label: getFeatureBySlug(slug)?.label || slug };
}

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
