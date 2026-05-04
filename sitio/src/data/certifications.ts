// Catálogo de certificaciones para partners.
// Precios en centavos MXN (Stripe usa centavos).
// Cada cert tiene temario público (visible aunque esté bloqueada) para que el
// partner sepa qué va a aprender antes de comprar.

export interface Certification {
  id: 'basica' | 'avanzada' | 'multisucursal';
  nombre: string;
  shortName: string;
  precio: number;          // centavos MXN
  precioMostrar: string;   // "$1,500"
  duracion: string;
  nivel: string;
  cover: string;
  descripcion: string;
  paraQuien: string;
  temario: string[];
  beneficios: string[];
}

export const CERTIFICATIONS: Certification[] = [
  {
    id: 'basica',
    nombre: 'Certificación en Implementación Básica',
    shortName: 'Implementación Básica',
    precio: 150000,
    precioMostrar: '$1,500',
    duracion: '4 horas en vivo + materiales',
    nivel: 'Principiante',
    cover: '/images/certificaciones/basica.webp',
    descripcion: 'Domina el setup inicial de SACS para una sola sucursal. Aprende a configurar productos, inventario, POS y facturación electrónica desde cero.',
    paraQuien: 'Partners que apenas empiezan a recomendar SACS y necesitan entender el producto a fondo para hacer demos sólidas.',
    temario: [
      'Configuración inicial de la cuenta SACS y datos del negocio',
      'Alta de productos: variantes, categorías, precios, impuestos',
      'Configuración del POS: terminal, cajeros, métodos de pago',
      'Setup básico de facturación electrónica CFDI 4.0',
      'Importación masiva de productos desde Excel',
      'Gestión de inventario: entradas, salidas, ajustes',
      'Reportes esenciales: ventas del día, productos más vendidos',
      'Caso práctico: setup completo de una boutique de ropa',
    ],
    beneficios: [
      'Certificado digital descargable al aprobar examen',
      'Badge oficial "Implementación Básica" en tu portal',
      'Acceso a comunidad privada de partners certificados',
      'Material de referencia descargable para tus prospectos',
    ],
  },
  {
    id: 'avanzada',
    nombre: 'Certificación en Implementación Avanzada',
    shortName: 'Implementación Avanzada',
    precio: 350000,
    precioMostrar: '$3,500',
    duracion: '8 horas en vivo + workshops + materiales',
    nivel: 'Intermedio',
    cover: '/images/certificaciones/avanzada.webp',
    descripcion: 'Lleva tu dominio al siguiente nivel: integraciones, automatizaciones, e-commerce, programa de lealtad y módulos avanzados.',
    paraQuien: 'Partners que quieren cerrar clientes complejos y ofrecer implementaciones diferenciadas con setup avanzado.',
    temario: [
      'E-commerce: configuración de tienda online con tema custom',
      'Sincronización omnicanal entre POS y e-commerce',
      'CRM avanzado: segmentación, pipelines, automatizaciones',
      'Programa de lealtad: puntos, niveles VIP, portal del cliente',
      'Marketing por email y WhatsApp: campañas y secuencias',
      'Integraciones con Stripe, Mercado Pago, Conekta, Rappi',
      'API y webhooks: cómo conectar herramientas externas',
      'Reportes avanzados y dashboards personalizados',
      'Axo Copiloto IA: configuración y casos de uso prácticos',
      'Caso práctico: e-commerce + tienda física integradas',
    ],
    beneficios: [
      'Todo lo de la Básica + capacidades técnicas avanzadas',
      'Badge oficial "Implementación Avanzada" en tu portal',
      'Posibilidad de cobrar fee de implementación a tus clientes',
      'Sesión 1:1 de Q&A con Customer Success de SACS',
      'Acceso al Slack privado de partners certificados Avanzados',
    ],
  },
  {
    id: 'multisucursal',
    nombre: 'Certificación en Implementación Multisucursal',
    shortName: 'Multisucursal · Enterprise',
    precio: 600000,
    precioMostrar: '$6,000',
    duracion: '12 horas en vivo + casos enterprise + mentoría',
    nivel: 'Avanzado / Enterprise',
    cover: '/images/certificaciones/multisucursal.webp',
    descripcion: 'Especialízate en cuentas enterprise: arquitectura multisucursal, consolidación, transferencias entre tiendas, control de acceso por rol y operaciones a escala.',
    paraQuien: 'Partners enfocados en cadenas medianas y grandes. Te habilita para cerrar deals de $50K-$500K MXN/año.',
    temario: [
      'Arquitectura multi-sucursal: consolidación vs autonomía',
      'Inventario distribuido y transferencias entre tiendas',
      'Conteo cíclico y nocturno sin cerrar operación',
      'Control de acceso por rol: cajero, gerente, regional, HQ',
      'Reportes consolidados HQ y por tienda con drill-down',
      'Pricing dinámico por región y promociones segmentadas',
      'Sincronización offline-first con resolución de conflictos',
      'Migración de datos desde sistemas legacy (Aspel, Microsip, etc.)',
      'Onboarding de cadenas: plan a 30/60/90 días',
      'SLA, soporte enterprise y escalación con SACS',
      'Casos enterprise reales: Liveshow (1,500 sucursales), Bella Pandita (43)',
      'Mentoría 1:1 de 60 min con un Solutions Architect',
    ],
    beneficios: [
      'Todo lo de Básica + Avanzada + capacidades enterprise',
      'Badge "Enterprise · Multisucursal" — el más alto del programa',
      'Comisión hasta 60% en cuentas enterprise (vs 50% estándar)',
      'Acceso a leads enterprise pre-calificados de SACS',
      'Co-selling con el equipo de SACS en deals grandes',
      'Mentoría continua del Solutions Architect del equipo',
      'Slack directo con el founder para deals estratégicos',
    ],
  },
];

export function getCertById(id: string): Certification | undefined {
  return CERTIFICATIONS.find(c => c.id === id);
}
