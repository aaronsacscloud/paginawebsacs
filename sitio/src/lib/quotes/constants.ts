export const PLANS = ['vende', 'controla', 'fideliza', 'automatiza'] as const;
export type PlanId = (typeof PLANS)[number];

export const PLAN_PRICES: Record<string, number> = {
  vende: 600,
  controla: 900,
  fideliza: 1400,
  automatiza: 5900,
};

export const IMPL_PRICES: Record<string, number> = {
  vende: 2000,
  controla: 4000,
  fideliza: 6000,
  automatiza: 9000,
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
