// 'personalizada' (licencia anual a la medida) y 'soporte_premium' (póliza de
// soporte como plan) se venden por cotización — su precio se define al cotizar.
export const PLANS = ['vende', 'controla', 'fideliza', 'automatiza', 'personalizada', 'soporte_premium'] as const;
export type PlanId = (typeof PLANS)[number];

export const PLAN_PRICES: Record<string, number> = {
  vende: 600,
  controla: 900,
  fideliza: 1400,
  automatiza: 5900,
  personalizada: 0,      // precio a la medida (se define en la cotización)
  soporte_premium: 0,    // póliza de soporte: precio según alcance
};

export const IMPL_PRICES: Record<string, number> = {
  vende: 2000,
  controla: 4000,
  fideliza: 6000,
  automatiza: 9000,
  personalizada: 0,
  soporte_premium: 0,
};

// ─── Comisiones del partner por CATEGORÍA de concepto ───────────────────────
// Tasas HARDCODE por pedido del dueño (2026-07-08); cuando existan por-partner
// o configurables, este mapa es el único lugar a tocar.
export const COMISION_CATEGORIAS = ['licencia', 'plugin', 'personalizacion', 'hardware'] as const;
export type CategoriaComision = (typeof COMISION_CATEGORIAS)[number];

export const COMISION_RATES: Record<CategoriaComision, number> = {
  licencia: 35,
  plugin: 25,
  personalizacion: 20,
  hardware: 5,
};

export const COMISION_LABELS: Record<CategoriaComision, string> = {
  licencia: 'Licencia',
  plugin: 'Plugin',
  personalizacion: 'Personalización',
  hardware: 'Hardware',
};

export const METODOS = ['transferencia', 'tarjeta', 'oxxo', 'otro'] as const;
export type MetodoPago = (typeof METODOS)[number];

export const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

export const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '—';
  const day = date.getDate();
  const month = date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
