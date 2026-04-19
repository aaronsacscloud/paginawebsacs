// Catálogo SACS: planes recurrentes + servicios únicos/recurrentes.
// Fuente de verdad para quote_drafter + service_recommender.
// No pricing viene del LLM — siempre de aquí.

export interface Plan {
  id: string;
  nombre: string;
  precio_mensual: number;        // MXN por sucursal
  precio_anual: number;          // MXN por sucursal (usualmente 10 meses)
  sucursales_min: number;
  descripcion: string;
  features: string[];
}

export interface Service {
  id: string;
  nombre: string;
  tipo: 'unico' | 'recurrente';
  precio_base: number;           // MXN
  descripcion: string;
  vertical_adjust?: Record<string, number>;  // multiplicador por vertical
  sucursales_multiplier?: number;             // +% por sucursal extra
  periodo_extra?: 'mensual' | 'anual';        // solo si tipo=recurrente
}

export const PLANS: Plan[] = [
  {
    id: 'controla',
    nombre: 'Controla',
    precio_mensual: 900,
    precio_anual: 9000,
    sucursales_min: 1,
    descripcion: 'Plan base: POS + inventario + reportes',
    features: ['POS multi-terminal', 'Inventario en tiempo real', 'Reportes de ventas', 'Multi-sucursal', 'WhatsApp tickets'],
  },
  {
    id: 'fideliza',
    nombre: 'Fideliza',
    precio_mensual: 2400,
    precio_anual: 24000,
    sucursales_min: 1,
    descripcion: 'Controla + CRM + programa de lealtad + e-commerce',
    features: ['Todo Controla', 'CRM integrado', 'Programa de lealtad', 'Tienda en línea', 'Social commerce', 'Email marketing', 'Promociones avanzadas'],
  },
  {
    id: 'automatiza',
    nombre: 'Automatiza',
    precio_mensual: 4500,
    precio_anual: 45000,
    sucursales_min: 1,
    descripcion: 'Fideliza + AXO IA + automatizaciones + integraciones ilimitadas',
    features: ['Todo Fideliza', 'AXO copiloto IA', 'Automatizaciones sin código', 'Integraciones ilimitadas', 'Workflows personalizados', 'Reportes predictivos', 'Soporte prioritario'],
  },
];

export const SERVICES: Service[] = [
  {
    id: 'implementacion_basica',
    nombre: 'Implementación básica',
    tipo: 'unico',
    precio_base: 8000,
    descripcion: 'Setup inicial: configuración del sistema, carga de catálogo base, capacitación inicial 2h al equipo.',
    vertical_adjust: { moda: 1.0, farmacia: 1.2, restaurantes: 1.3, ferreteria: 1.1, abarrotes: 1.0 },
    sucursales_multiplier: 0.3,    // +30% por cada sucursal extra
  },
  {
    id: 'migracion_datos',
    nombre: 'Migración de datos',
    tipo: 'unico',
    precio_base: 15000,
    descripcion: 'Extracción desde sistema actual (Alegra, Bind, Shopify POS, Excel), limpieza, carga completa a SACS.',
    vertical_adjust: { moda: 1.0, farmacia: 1.4, restaurantes: 1.2, ferreteria: 1.3 },
    sucursales_multiplier: 0.2,
  },
  {
    id: 'capacitacion_avanzada',
    nombre: 'Capacitación avanzada',
    tipo: 'unico',
    precio_base: 5000,
    descripcion: '3 sesiones de 2h con equipo del cliente (admin, cajeros, compras). Incluye material de referencia.',
  },
  {
    id: 'setup_tienda_online',
    nombre: 'Setup tienda en línea',
    tipo: 'unico',
    precio_base: 12000,
    descripcion: 'Configuración de e-commerce sincronizado con inventario. Dominio, templates, métodos de pago.',
  },
  {
    id: 'consultor_dedicado_mes',
    nombre: 'Consultor dedicado (mensual)',
    tipo: 'recurrente',
    periodo_extra: 'mensual',
    precio_base: 12000,
    descripcion: '10h/mes de consultor SACS dedicado: optimización continua, soporte VIP, reportes ad-hoc.',
  },
  {
    id: 'integracion_erp',
    nombre: 'Integración ERP / contabilidad',
    tipo: 'unico',
    precio_base: 18000,
    descripcion: 'Conexión bidireccional con ERP existente (SAP, Aspel, CONTPAQ, etc.). Requiere análisis técnico.',
  },
];

// Defaults "near-always-needed" por vertical
export const VERTICAL_SERVICE_DEFAULTS: Record<string, string[]> = {
  moda: ['implementacion_basica'],
  farmacia: ['implementacion_basica', 'migracion_datos'],       // reglas fiscales + catálogo grande
  restaurantes: ['implementacion_basica', 'capacitacion_avanzada'],
  ferreteria: ['implementacion_basica'],
  abarrotes: ['implementacion_basica'],
  electronica: ['implementacion_basica', 'migracion_datos'],
  belleza: ['implementacion_basica'],
  mayoreo: ['implementacion_basica', 'migracion_datos', 'capacitacion_avanzada'],
};

/** Compute adjusted price for a service given vertical + sucursales. */
export function computeServicePrice(service: Service, vertical?: string, sucursales: number = 1): number {
  let price = service.precio_base;
  if (vertical && service.vertical_adjust?.[vertical]) {
    price *= service.vertical_adjust[vertical];
  }
  if (sucursales > 1 && service.sucursales_multiplier) {
    price *= 1 + service.sucursales_multiplier * (sucursales - 1);
  }
  return Math.round(price);
}

export function getPlan(id: string): Plan | undefined {
  return PLANS.find(p => p.id === id);
}

export function getService(id: string): Service | undefined {
  return SERVICES.find(s => s.id === id);
}

export function getDefaultServicesForVertical(vertical: string): Service[] {
  const ids = VERTICAL_SERVICE_DEFAULTS[vertical] || [];
  return ids.map(id => getService(id)).filter(Boolean) as Service[];
}
