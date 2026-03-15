export interface ProductSection {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
}

export const productSections: ProductSection[] = [
  {
    id: 'pos',
    eyebrow: 'Punto de Venta',
    title: 'Cobra en segundos, sin complicaciones',
    description:
      'Un POS diseñado para velocidad. Múltiples métodos de pago, facturación CFDI automática y una interfaz que tu equipo domina en minutos.',
    features: [
      'Cobro con tarjeta, efectivo y transferencia',
      'Facturación CFDI en un clic',
      'Corte de caja automatizado',
      'Funciona offline',
    ],
  },
  {
    id: 'inventario',
    eyebrow: 'Inventario',
    title: 'Control total, cero excusas',
    description:
      'Gestiona stock en todas tus sucursales desde un solo panel. Transferencias, alertas de mínimos y trazabilidad completa de cada producto.',
    features: [
      'Multi-sucursal en tiempo real',
      'Transferencias entre tiendas',
      'Alertas de reabastecimiento',
      'Código de barras y SKU',
    ],
  },
  {
    id: 'crm',
    eyebrow: 'CRM',
    title: 'Conoce a tu cliente, no solo su ticket',
    description:
      'Cada compra construye un perfil. Segmenta, personaliza y crea relaciones que generan recompra.',
    features: [
      'Perfil 360° del cliente',
      'Segmentación inteligente',
      'Historial de compras completo',
      'Campañas personalizadas',
    ],
  },
  {
    id: 'reportes',
    eyebrow: 'Reportes',
    title: 'Datos que te dicen qué hacer',
    description:
      'Dashboards en tiempo real que transforman números en decisiones. Ventas, márgenes, tendencias — todo claro, todo accionable.',
    features: [
      'Dashboard en tiempo real',
      'Reportes por sucursal y vendedor',
      'Análisis de márgenes',
      'Exportación a Excel/PDF',
    ],
  },
  {
    id: 'axo',
    eyebrow: 'AXO — IA',
    title: 'Tu asistente inteligente para retail',
    description:
      'AXO aprende de tu negocio y te ayuda a anticiparte. Predicción de demanda, sugerencias de compra y análisis en lenguaje natural.',
    features: [
      'Predicción de demanda',
      'Sugerencias de reabastecimiento',
      'Análisis de tendencias',
      'Reportes en lenguaje natural',
    ],
  },
];
