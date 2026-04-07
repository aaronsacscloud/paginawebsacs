// ─── Interfaces ───

export interface PlanPrice {
  mxn: number;
  usd: number;
  eur: number;
  brl: number;
  cop: number;
  ars: number;
  clp: number;
  pen: number;
  gbp: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  monthly: PlanPrice;
  annual: PlanPrice;
  annualTotal: PlanPrice;
  badge?: string;
  highlighted: boolean;
  inheritsFrom?: string;
  cta: { label: string; href: string; variant: 'primary' | 'secondary' };
  features: (string | { category: string; items: string[] })[];
  services: string[];
}

export interface ComparisonFeature {
  name: string;
  vende: boolean | string;
  controla: boolean | string;
  fideliza: boolean | string;
  automatiza: boolean | string;
}

export interface ComparisonCategory {
  name: string;
  features: ComparisonFeature[];
}

export interface FAQ {
  question: string;
  answer: string;
}

// ─── Plans ───

export const plans: Plan[] = [
  {
    id: 'vende',
    name: 'Vende',
    description: 'Para marcas que arrancan su primera tienda.',
    monthly: { mxn: 600, usd: 30, eur: 28, brl: 155, cop: 125000, ars: 27000, clp: 28500, pen: 114, gbp: 24 },
    annual: { mxn: 500, usd: 25, eur: 23, brl: 130, cop: 105000, ars: 22500, clp: 23750, pen: 95, gbp: 20 },
    annualTotal: { mxn: 6000, usd: 300, eur: 276, brl: 1560, cop: 1260000, ars: 270000, clp: 285000, pen: 1140, gbp: 240 },
    highlighted: false,
    cta: { label: 'Inicia ahora', href: '/registro?plan=vende', variant: 'secondary' },
    features: [
      { category: 'Venta en tienda física', items: ['Punto de venta online y offline', 'Guarda ventas y recupéralas después', 'Cambios, devoluciones y cancelaciones', 'Cortes de caja y arqueos', 'Tickets por WhatsApp', 'Cotizaciones', 'Pedidos y apartados', 'Ventas a crédito', 'Listas de precios', 'Precios por volumen'] },
      { category: 'Venta en línea', items: ['Tienda en línea integrada al inventario físico', 'Facebook, Instagram y WhatsApp', 'TikTok Shop', 'Productos visibles en ChatGPT'] },
      { category: 'Productos', items: ['Productos simples', 'Productos con variantes', 'Kits y productos compuestos', 'Control básico de inventario', 'Etiquetas con código de barras'] },
      { category: 'Facturación', items: ['20 folios incluidos'] },
    ],
    services: [
      '1 sucursal',
      'Soporte 9 AM–5 PM (<30 min)',
    ],
  },
  {
    id: 'controla',
    name: 'Controla',
    description: 'Para marcas con varias sucursales que necesitan orden.',
    monthly: { mxn: 900, usd: 45, eur: 42, brl: 234, cop: 189000, ars: 40500, clp: 42750, pen: 171, gbp: 36 },
    annual: { mxn: 750, usd: 38, eur: 35, brl: 197, cop: 159600, ars: 34200, clp: 36100, pen: 144, gbp: 30 },
    annualTotal: { mxn: 9000, usd: 450, eur: 414, brl: 2340, cop: 1890000, ars: 405000, clp: 427500, pen: 1710, gbp: 360 },
    highlighted: false,
    inheritsFrom: 'Vende',
    cta: { label: 'Inicia ahora', href: '/registro?plan=controla', variant: 'secondary' },
    features: [
      { category: 'Inventario avanzado', items: ['Multi-sucursal en tiempo real', 'Gestión de CEDIS', 'Traspasos entre sucursales', 'Reabasto sugerido', 'Alertas de stock bajo o exceso'] },
      { category: 'Conteos y trazabilidad', items: ['Conteo físico desde el celular', 'Conteos cíclicos programados', 'Kardex y trazabilidad', 'Control de mermas y pérdidas en tienda'] },
      { category: 'Compras y gastos', items: ['Órdenes de compra y cuentas por pagar', 'Recepción contra orden de compra', 'Control de gastos', 'Complementos de pago y notas de crédito'] },
      { category: 'Clientes y equipo', items: ['CRM e historial de clientes', 'Metas y comisiones por vendedor', 'Permisos por usuario y sucursal'] },
      { category: 'Reportes y auditoría', items: ['+50 reportes de ventas, inventario y finanzas', '20+ KPIs para medir tu operación', 'ABC, sell-through y rotación', 'Costeo y utilidad por producto', 'Auditoría de movimientos'] },
    ],
    services: [
      'Multi-sucursal',
      'Reunión de introducción',
      'Soporte 9 AM–5 PM (<30 min)',
      'Migración gratis (3 días)',
    ],
  },
  {
    id: 'fideliza',
    name: 'Fideliza',
    description: 'Para marcas que quieren clientes que regresan.',
    monthly: { mxn: 1400, usd: 70, eur: 65, brl: 364, cop: 294000, ars: 63000, clp: 66500, pen: 266, gbp: 56 },
    annual: { mxn: 1167, usd: 58, eur: 54, brl: 302, cop: 243600, ars: 52200, clp: 55100, pen: 220, gbp: 46 },
    annualTotal: { mxn: 14000, usd: 700, eur: 644, brl: 3640, cop: 2940000, ars: 630000, clp: 665000, pen: 2660, gbp: 560 },
    badge: 'Más popular',
    highlighted: true,
    inheritsFrom: 'Controla',
    cta: { label: 'Inicia ahora', href: '/registro?plan=fideliza', variant: 'primary' },
    features: [
      { category: 'Lealtad', items: ['Monedero electrónico y programa de lealtad', 'Niveles y recompensas personalizadas', 'Redención de puntos en tu tienda en línea'] },
      { category: 'Ventas y promociones', items: ['Notificaciones automáticas por WhatsApp', 'Ventas de impulso y venta cruzada', 'Promociones avanzadas'] },
      { category: 'Portales con tu marca', items: ['Portal de clientes personalizado', 'Portal de autofacturación', 'eCommerce avanzado para recompra y fidelización'] },
    ],
    services: [
      'Multi-sucursal',
      'Ejecutivo de cuenta',
      'Reunión mensual',
      'Soporte 24/7 (<2 min)',
      'Migración gratis (1 día)',
    ],
  },
  {
    id: 'automatiza',
    name: 'Automatiza',
    description: 'Tu operación en piloto automático con IA.',
    monthly: { mxn: 2900, usd: 145, eur: 134, brl: 754, cop: 609000, ars: 130500, clp: 137750, pen: 551, gbp: 115 },
    annual: { mxn: 2417, usd: 121, eur: 111, brl: 629, cop: 508200, ars: 108900, clp: 114950, pen: 460, gbp: 96 },
    annualTotal: { mxn: 29000, usd: 1450, eur: 1334, brl: 7540, cop: 6090000, ars: 1305000, clp: 1377500, pen: 5510, gbp: 1150 },
    highlighted: false,
    inheritsFrom: 'Fideliza',
    cta: { label: 'Inicia ahora', href: '/registro?plan=automatiza', variant: 'secondary' },
    features: [
      { category: 'Automatización por área', items: ['Inventario: nivelación, reabasto y traspasos automáticos con IA', 'Operaciones: workflows personalizados que eliminan tareas repetitivas', 'Administración: reportes automáticos a tu medida, sin configurar nada'] },
      { category: 'AXO — Tu copiloto IA', items: ['Pregúntale lo que quieras de tu negocio y actúa al instante', 'Detecta problemas antes de que pasen y te sugiere qué hacer', 'Aprende de tu operación y se vuelve más inteligente cada día'] },
      { category: 'Especialista + apps', items: ['Trabajas con un especialista en IA para automatizar tu operación completa', 'Conecta con +600 apps: ERP, contabilidad, logística, marketing', 'Workflows a la medida para tu flujo específico de negocio'] },
      { category: 'Reportes e inteligencia', items: ['Reportes automáticos por WhatsApp o email a la hora que elijas', 'Dashboards personalizados por rol (dueño, gerente, vendedor)', 'Predicción de demanda y tendencias con IA'] },
      { category: 'Tokens de IA', items: ['Incluye tokens mensuales para automatizaciones y consultas IA', 'Consumo transparente: ves exactamente cuántos tokens usas', 'Escala según necesites — compra paquetes adicionales cuando quieras'] },
    ],
    services: [
      'Multi-sucursal',
      'Especialista IA dedicado',
      'Onboarding de automatización (diseño de workflows)',
      'Sesión mensual de optimización IA',
      'Soporte 24/7 (<2 min)',
      'Migración gratis',
      'Acceso anticipado a nuevas funciones IA',
    ],
  },
];

// ─── Universal Features (all plans) ───

export const universalFeatures: string[] = [
  'Soporte 24/7 por chat y WhatsApp',
  'Dispositivos ilimitados',
  'Usuarios ilimitados',
  'Hasta 10,000 productos',
  '3 cajas para cobrar',
  'Espacio ilimitado',
  'Actualizaciones mensuales',
  'Sin contratos de permanencia',
];

// ─── Comparison Table ───

export const comparisonCategories: ComparisonCategory[] = [
  {
    name: 'Punto de venta',
    features: [
      { name: 'Punto de venta online y offline', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Ventas sin internet', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Impresión rápida de tickets', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Ticket por WhatsApp', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Diversos métodos de pago', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Arqueos de caja', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Cortes de caja', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Ticket personalizado', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Ventas pausadas', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Precios por tipo de cliente', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Múltiples cajeros por turno', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Cobro en múltiples divisas', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Pantalla principal automatizada', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Corte de caja ciego antifraude', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Bloqueo seguro de pantalla', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Permisos avanzados en POS', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
  {
    name: 'Cambios y devoluciones',
    features: [
      { name: 'Gestión de cambios y devoluciones', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Cambios y devoluciones multi-sucursal', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Cambios exprés de talla o color', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Notas de crédito automáticas', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Reembolsos al método original', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Etiquetas QR en tickets', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Reportes de devoluciones', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Bonificación en monedero electrónico', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Sugerencias inteligentes en cambios', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Cambios sin ticket físico', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Validación automática de políticas', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Permisos avanzados en cambios', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
  {
    name: 'Apartados y pedidos',
    features: [
      { name: 'Cotizaciones y pedidos', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Apartado con anticipo', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Listas de precios automáticas', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Validación de existencias en tiempo real', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Pagos parciales', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Descuentos en pedidos', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Precios por volumen en pedidos', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Recordatorios automáticos de pago', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Facturación automática al concluir', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Puntos de lealtad al concluir', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Recuperación de pedidos cancelados', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Cross-selling inteligente', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
  {
    name: 'Inventario y stock',
    features: [
      { name: 'Gestión de productos con variantes', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Códigos de barras y QR', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Importación masiva de productos', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Conteo físico sin cerrar tienda', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Conteo masivo con escáner', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Conteo desde el celular', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Transferencias entre sucursales', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Distribución desde CEDIS', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Existencias multi-sucursal en tiempo real', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Historial de movimientos por producto', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Conteo sorpresa automático', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Auditorías parciales por categoría', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Nivelación automática con IA', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Reabastecimiento automático', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
  {
    name: 'CRM y clientes',
    features: [
      { name: 'Registro de clientes', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Historial de compras por cliente', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Notas y seguimientos', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Resumen de ventas por cliente', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Perfil 360° del cliente', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Actividad omnicanal', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Sugerencias automáticas de productos', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Segmentación por comportamiento', vende: false, controla: false, fideliza: true, automatiza: true },
    ],
  },
  {
    name: 'Lealtad y promociones',
    features: [
      { name: 'Descuentos por artículo', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Descuentos por volumen', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Promociones combinadas', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Avisos de promociones en POS', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Promociones multi-sucursal', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Tarjetas de regalo', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Monedero electrónico', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Puntos de lealtad por compra', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Niveles de lealtad configurables', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Promoción 3x2 automática', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Promociones progresivas', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Programación por fecha y hora', vende: false, controla: false, fideliza: true, automatiza: true },
    ],
  },
  {
    name: 'E-commerce y omnicanal',
    features: [
      { name: 'Tienda en línea básica', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Sincronización con inventario físico', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Tienda en línea avanzada', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Envíos locales y nacionales', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Chat integrado con WhatsApp', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Checkout por WhatsApp y Web', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Sync con Meta, TikTok y Google', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Generación omnicanal de puntos', vende: false, controla: false, fideliza: true, automatiza: true },
    ],
  },
  {
    name: 'Reportes y analítica',
    features: [
      { name: 'Reporte de ventas por producto', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Reporte por método de pago', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Comparativa de ventas', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Margen de utilidad por producto', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Reporte Kardex', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Ventas por vendedor y producto', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Sell Through', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Reabastecimiento inteligente', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'KPIs multitienda', vende: false, controla: false, fideliza: false, automatiza: true },
      { name: 'Envío automático de reportes', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
  {
    name: 'Facturación electrónica',
    features: [
      { name: 'Factura manual CFDI', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Factura desde punto de venta', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Factura global a público en general', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Cancelación de facturas', vende: true, controla: true, fideliza: true, automatiza: true },
      { name: 'Facturación automática', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Kiosko de autofacturación', vende: false, controla: false, fideliza: true, automatiza: true },
    ],
  },
  {
    name: 'Compras y recepción',
    features: [
      { name: 'Órdenes de compra por variante', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Recepción con validación', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Recepción sin orden previa', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Devolución a proveedores', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Catálogos por proveedor', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Historial de costos por variante', vende: false, controla: true, fideliza: true, automatiza: true },
      { name: 'Alertas de reposición', vende: false, controla: false, fideliza: true, automatiza: true },
      { name: 'Planificador inteligente por tallas', vende: false, controla: false, fideliza: false, automatiza: true },
    ],
  },
];

// ─── Add-ons ───

export interface Addon {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge?: string;
}

export const addons: Addon[] = [
  {
    id: 'shopify',
    name: 'Integración con Shopify',
    description: 'Sincroniza inventario, pedidos y clientes entre tus tiendas físicas y tu tienda en Shopify en tiempo real.',
    icon: 'shopify',
  },
  {
    id: 'woocommerce',
    name: 'Integración con WooCommerce',
    description: 'Conecta tu tienda en WordPress con Sacs. Stock, precios y pedidos sincronizados automáticamente.',
    icon: 'woocommerce',
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Gestión de empleados, horarios, cambios de turno y control de asistencia desde tu punto de venta.',
    icon: 'staff',
  },
  {
    id: 'marketing',
    name: 'Marketing Suite',
    description: 'Campañas por correo y WhatsApp, segmentación de clientes y automatización de marketing para retail.',
    icon: 'marketing',
  },
];

// ─── Pricing FAQ ───

export const pricingFaqs: FAQ[] = [
  {
    question: '¿Puedo cambiar de plan en cualquier momento?',
    answer: 'Sí. Puedes subir o bajar de plan cuando quieras, sin penalización. El cambio se refleja en tu siguiente periodo de facturación.',
  },
  {
    question: '¿Qué pasa con mis datos si cancelo?',
    answer: 'Tus datos se mantienen accesibles durante 90 días después de cancelar. Puedes exportar todo en cualquier momento. No hay cargos por cancelación.',
  },
  {
    question: '¿La migración desde otro sistema tiene costo?',
    answer: 'No. La migración de productos está incluida en todos los planes de pago. En Controla y superiores, nuestro equipo la hace por ti en 1 a 3 días.',
  },
  {
    question: '¿Qué métodos de pago aceptan?',
    answer: 'Tarjeta de crédito y débito, transferencia bancaria (SPEI) y pago en OXXO. Facturamos en pesos mexicanos con CFDI.',
  },
  {
    question: '¿Cuánto toma implementar SACS en mi tienda?',
    answer: 'El setup básico toma 15 minutos. Con migración completa de catálogo y capacitación, entre 1 y 3 semanas dependiendo del volumen.',
  },
  {
    question: '¿El soporte tiene costo adicional?',
    answer: 'No. Todos los planes incluyen soporte 24/7 por chat y WhatsApp. Los planes Controla, Fideliza y Automatiza incluyen ejecutivo de cuenta dedicado.',
  },
];
