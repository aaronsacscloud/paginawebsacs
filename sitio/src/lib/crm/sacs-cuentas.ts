// Multi-cuenta de SACS: un cliente puede operar VARIAS cuentas (p.ej. el dueño
// de `boomfitness` también es dueño de `urban`). Antes el CRM leía una sola y
// enseñaba la mitad de su operación: boomfitness solo son $87k/30d, pero el
// cliente real factura $639k contando urban. Sobre eso se decidía retención.
//
// La regla de diseño: `companies.actividad` guarda el AGREGADO de todas sus
// cuentas, así que TODO lo que ya lo lee (lista de clientes, KPIs, health score,
// señales, dashboards) queda correcto sin tocarse. El detalle por cuenta vive en
// `company_sacs_accounts`, y `companies.sacs_account` sigue siendo la principal.
import { supabase } from '../supabase';

export type Actividad = {
  ultima_venta?: string | null;
  ventas_7d?: number; ventas_30d?: number; total_30d?: number;
  ventas_30d_prev?: number; total_30d_prev?: number; tendencia_pct?: number | null;
  modulos?: string[];
  usuarios?: number; usuarios_operando?: number; ultimo_usuario_at?: string | null;
  sucursales?: number;
  cuentas?: string[];                    // qué cuentas entraron en el agregado
  por_cuenta?: Record<string, Actividad>; // desglose, para pintarlo en el CRM
};

export const normCuenta = (s: any) => String(s || '').trim().toLowerCase();

/** Cuentas SACS de una empresa. Cae a companies.sacs_account si la tabla nueva
 *  todavía no existe (migración sin correr) o si la empresa no tiene filas. */
export async function cuentasDe(companyId: string, principal?: string | null): Promise<string[]> {
  try {
    const { data, error } = await supabase.from('company_sacs_accounts')
      .select('cuenta, es_principal').eq('company_id', companyId)
      .order('es_principal', { ascending: false }).order('created_at');
    if (!error && data && data.length) {
      return Array.from(new Set(data.map((r: any) => normCuenta(r.cuenta)).filter(Boolean)));
    }
  } catch { /* tabla ausente → fallback */ }
  const p = normCuenta(principal);
  return p ? [p] : [];
}

/** Mapa company_id → cuentas, para los crons (una sola query, no N). */
export async function cuentasPorEmpresa(companyIds: string[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  if (!companyIds.length) return out;
  try {
    const { data, error } = await supabase.from('company_sacs_accounts')
      .select('company_id, cuenta, es_principal').in('company_id', companyIds)
      .order('es_principal', { ascending: false });
    if (error) return out;
    for (const r of data || []) {
      const c = normCuenta(r.cuenta);
      if (!c) continue;
      (out[r.company_id] = out[r.company_id] || []).push(c);
    }
  } catch { /* tabla ausente → el llamador usa companies.sacs_account */ }
  return out;
}

const suma = (partes: Actividad[], k: keyof Actividad): number | undefined => {
  const vals = partes.map(p => Number(p?.[k as keyof Actividad] ?? NaN)).filter(n => Number.isFinite(n));
  return vals.length ? vals.reduce((a, b) => a + b, 0) : undefined;
};
const maxFecha = (partes: Actividad[], k: 'ultima_venta' | 'ultimo_usuario_at'): string | null => {
  const vals = partes.map(p => p?.[k]).filter(Boolean) as string[];
  return vals.length ? vals.sort().slice(-1)[0] : null;
};

/**
 * Une la actividad de N cuentas en una sola foto del CLIENTE.
 *
 * Los conteos y montos se suman; las fechas toman la más reciente (el cliente
 * "vendió hoy" si CUALQUIERA de sus cuentas vendió hoy) y los módulos se unen.
 *
 * `tendencia_pct` se RECALCULA sobre los totales sumados — promediar los
 * porcentajes de cada cuenta daría un número que no corresponde a ningún dinero
 * real (una cuenta chica cayendo 90% pesaría igual que la grande subiendo 5%).
 */
export function agregarActividad(porCuenta: Record<string, Actividad | null | undefined>): Actividad | null {
  const cuentas = Object.keys(porCuenta).filter(c => porCuenta[c]);
  if (!cuentas.length) return null;
  const partes = cuentas.map(c => porCuenta[c] as Actividad);
  if (cuentas.length === 1) return { ...partes[0], cuentas, por_cuenta: { [cuentas[0]]: partes[0] } };

  const total30 = suma(partes, 'total_30d');
  const prev30 = suma(partes, 'total_30d_prev');
  const modulos = Array.from(new Set(partes.flatMap(p => p.modulos || []))).sort();

  return {
    ultima_venta: maxFecha(partes, 'ultima_venta'),
    ventas_7d: suma(partes, 'ventas_7d'),
    ventas_30d: suma(partes, 'ventas_30d'),
    total_30d: total30,
    ventas_30d_prev: suma(partes, 'ventas_30d_prev'),
    total_30d_prev: prev30,
    tendencia_pct: (prev30 != null && prev30 > 0 && total30 != null)
      ? Math.round(((total30 - prev30) / prev30) * 1000) / 10
      : null,
    modulos,
    usuarios: suma(partes, 'usuarios'),
    usuarios_operando: suma(partes, 'usuarios_operando'),
    ultimo_usuario_at: maxFecha(partes, 'ultimo_usuario_at'),
    sucursales: suma(partes, 'sucursales'),
    cuentas,
    por_cuenta: Object.fromEntries(cuentas.map(c => [c, porCuenta[c] as Actividad])),
  };
}

/** Guarda la actividad individual de cada cuenta (para el desglose del CRM). */
export async function guardarPorCuenta(companyId: string, porCuenta: Record<string, Actividad | null | undefined>) {
  const ahora = new Date().toISOString();
  for (const [cuenta, act] of Object.entries(porCuenta)) {
    if (!act) continue;
    try {
      await supabase.from('company_sacs_accounts')
        .update({ actividad: act, sync_at: ahora })
        .eq('company_id', companyId).eq('cuenta', cuenta);
    } catch { /* el desglose nunca bloquea el sync principal */ }
  }
}
