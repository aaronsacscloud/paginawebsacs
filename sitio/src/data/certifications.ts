// Catálogo de certificaciones para partners.
// Precios en centavos MXN (Stripe usa centavos).
//
// Cada cert tiene:
// - precio: cuánto paga el partner UNA vez para certificarse
// - serviceCharge: rango de lo que el partner puede cobrar a sus clientes
// - serviceModel: 'one-time' (proyecto) o 'monthly' (recurrente)
// El partner se queda con el 100% de lo que cobre al cliente — SACS solo
// cobra la cuota única de la certificación.

export interface Certification {
  id: string;                          // string libre (compat con DB y Stripe)
  nombre: string;
  shortName: string;
  precio: number;                      // centavos MXN — costo de la cert
  precioMostrar: string;               // "$1,500"
  duracion: string;
  nivel: string;
  cover: string;
  descripcion: string;
  paraQuien: string;
  temario: string[];
  beneficios: string[];
  serviceChargeMin: number;            // MXN — mínimo que cobra al cliente
  serviceChargeMax: number;            // MXN — máximo que cobra al cliente
  serviceChargeMostrar: string;        // "$5,000 – $12,000" prefijo
  serviceModel: 'one-time' | 'monthly';// proyecto o recurrente
  serviceUnit: string;                 // "/ implementación" o "/ mes"
}

export const CERTIFICATIONS: Certification[] = [
  {
    id: 'impl_una_sucursal',
    nombre: 'Certificación · Implementación de una sucursal',
    shortName: 'Implementación · 1 sucursal',
    precio: 150000,
    precioMostrar: '$1,500',
    duracion: '4 horas en vivo + materiales',
    nivel: 'Principiante',
    cover: '/images/certificaciones/impl-una-sucursal.webp',
    descripcion: 'Domina el setup completo de SACS para un negocio de una sola sucursal: productos, inventario, POS, facturación electrónica y capacitación al equipo del cliente.',
    paraQuien: 'Partners que quieren empezar a cobrar implementaciones a pequeños negocios sin complejidad multi-sucursal.',
    temario: [
      'Configuración inicial de cuenta SACS y datos del negocio',
      'Alta de productos: variantes, categorías, precios e impuestos',
      'Configuración del POS, cajeros y métodos de pago',
      'Setup de facturación electrónica CFDI 4.0',
      'Importación masiva desde Excel',
      'Reportes esenciales y cierre de día',
      'Capacitación práctica al equipo del cliente',
    ],
    beneficios: [
      'Diploma digital descargable + badge "Implementación · 1 sucursal" en tu portal',
      'Plantilla de propuesta de servicios lista para enviar al cliente',
      'Acceso a comunidad privada de partners certificados',
    ],
    serviceChargeMin: 5000,
    serviceChargeMax: 12000,
    serviceChargeMostrar: '$5,000 – $12,000',
    serviceModel: 'one-time',
    serviceUnit: '/ implementación',
  },
  {
    id: 'impl_multisucursal',
    nombre: 'Certificación · Implementación multi-sucursal',
    shortName: 'Implementación · Multi-sucursal',
    precio: 400000,
    precioMostrar: '$4,000',
    duracion: '10 horas en vivo + casos prácticos + mentoría',
    nivel: 'Intermedio / Avanzado',
    cover: '/images/certificaciones/impl-multisucursal.webp',
    descripcion: 'Especialízate en negocios con varias sucursales: arquitectura, consolidación, transferencias entre tiendas, control de acceso por rol, reportes HQ y operación a escala.',
    paraQuien: 'Partners que quieren cerrar cadenas medianas de 3 a 50+ sucursales y cobrar implementaciones más grandes.',
    temario: [
      'Arquitectura multi-sucursal: consolidación vs autonomía por tienda',
      'Inventario distribuido y transferencias entre sucursales',
      'Control de acceso por rol: cajero, gerente, regional, HQ',
      'Reportes consolidados con drill-down por sucursal',
      'Pricing dinámico y promociones segmentadas por región',
      'Onboarding de cadenas: plan a 30/60/90 días',
      'Casos prácticos: Liveshow (1,500), Bella Pandita (43)',
    ],
    beneficios: [
      'Diploma + badge "Multi-sucursal" en tu portal',
      'Plantilla de propuesta para cadenas',
      'Acceso a leads enterprise pre-calificados de SACS',
      'Mentoría 1:1 de 60 min con un Solutions Architect',
    ],
    serviceChargeMin: 20000,
    serviceChargeMax: 60000,
    serviceChargeMostrar: '$20,000 – $60,000',
    serviceModel: 'one-time',
    serviceUnit: '/ implementación',
  },
  {
    id: 'migracion_datos',
    nombre: 'Certificación · Migración de datos a SACS',
    shortName: 'Migración de datos',
    precio: 250000,
    precioMostrar: '$2,500',
    duracion: '6 horas en vivo + plantillas + ejercicios',
    nivel: 'Especialización',
    cover: '/images/certificaciones/migracion-datos.webp',
    descripcion: 'Especialización en migrar la información del cliente a SACS — productos, inventario, clientes, ventas históricas y catálogos — desde Excel, Aspel, Microsip u otros sistemas, sin perder un solo registro.',
    paraQuien: 'Partners que quieren cobrar el servicio crítico de migración como un proyecto independiente del setup.',
    temario: [
      'Modelo de datos de SACS: cómo encajan productos, variantes y SKUs',
      'Auditoría del sistema origen del cliente (Aspel, Microsip, Excel, etc.)',
      'Plantillas de importación masiva con validación previa',
      'Migración de clientes, deudas, ventas históricas y stock',
      'Estrategia de corte: día D, doble registro, validación post-migración',
      'Reconciliación contable y reporte de migración',
      'Casos prácticos: migración de 10K SKUs y 50K clientes',
    ],
    beneficios: [
      'Diploma + badge "Migración de datos" en tu portal',
      'Set de plantillas Excel validadas para migración',
      'Checklist y SLA modelo para ofrecer al cliente',
    ],
    serviceChargeMin: 8000,
    serviceChargeMax: 25000,
    serviceChargeMostrar: '$8,000 – $25,000',
    serviceModel: 'one-time',
    serviceUnit: '/ migración',
  },
  {
    id: 'ia_automatizacion',
    nombre: 'Certificación · Automatización con IA en SACS',
    shortName: 'Automatización con IA',
    precio: 500000,
    precioMostrar: '$5,000',
    duracion: '12 horas en vivo + workshops + mentoría',
    nivel: 'Avanzado',
    cover: '/images/certificaciones/ia-automatizacion.webp',
    descripcion: 'Aprende a usar el módulo de IA de SACS (Axo Copiloto y orquestador de agentes) para automatizar procesos repetitivos del cliente: alta de productos, atención por WhatsApp, reposición de inventario, cobranza y reportes.',
    paraQuien: 'Partners que quieren ofrecer proyectos de automatización con IA — el servicio mejor pagado del catálogo.',
    temario: [
      'Identificar procesos automatizables en cada tipo de negocio',
      'Axo Copiloto IA: configuración por giro y por caso de uso',
      'Orquestador de agentes: flujos de varios pasos',
      'Automatización de WhatsApp: cotizar, agendar, cerrar venta',
      'Reposición inteligente de inventario por sucursal',
      'Cobranza y recordatorios automatizados',
      'Workshops: 4 automatizaciones reales construidas en clase',
    ],
    beneficios: [
      'Diploma + badge "Automatización con IA" en tu portal',
      'Plantillas de 8 automatizaciones listas para vender',
      'Mentoría 1:1 con el equipo de producto IA',
      'Acceso a Slack privado de partners certificados en IA',
    ],
    serviceChargeMin: 15000,
    serviceChargeMax: 45000,
    serviceChargeMostrar: '$15,000 – $45,000',
    serviceModel: 'one-time',
    serviceUnit: '/ proyecto',
  },
  {
    id: 'consultor_ia',
    nombre: 'Certificación · Consultor en IA y análisis de datos',
    shortName: 'Consultor en IA',
    precio: 600000,
    precioMostrar: '$6,000',
    duracion: '14 horas en vivo + casos reales + mentoría continua',
    nivel: 'Senior',
    cover: '/images/certificaciones/consultor-ia.webp',
    descripcion: 'Aprende a leer los datos del cliente con IA, interpretarlos junto con él y entregar un reporte ejecutivo cada 30 días. Es un servicio recurrente — un retainer mensual con el cliente.',
    paraQuien: 'Partners que quieren ingresos recurrentes mensuales analizando los datos de cada cliente y traduciéndolos en decisiones de negocio.',
    temario: [
      'Marco de análisis: ventas, inventario, clientes, márgenes, mix',
      'IA para detectar patrones, anomalías y oportunidades',
      'Cómo correr una sesión mensual de revisión con el cliente',
      'Plantilla de reporte ejecutivo de 30 días',
      'Recomendaciones accionables: qué cambiar y por qué',
      'Cómo cobrar y mantener un retainer mensual',
      'Casos reales: 6 cuentas analizadas en clase',
    ],
    beneficios: [
      'Diploma + badge "Consultor IA" en tu portal',
      'Plantilla de reporte ejecutivo mensual',
      'Modelo de contrato de consultoría mensual',
      'Mentoría continua del equipo de Customer Success',
    ],
    serviceChargeMin: 5000,
    serviceChargeMax: 15000,
    serviceChargeMostrar: '$5,000 – $15,000',
    serviceModel: 'monthly',
    serviceUnit: '/ mes recurrente',
  },
];

export function getCertById(id: string): Certification | undefined {
  return CERTIFICATIONS.find(c => c.id === id);
}
