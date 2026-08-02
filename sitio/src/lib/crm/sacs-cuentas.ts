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

/* ── Uso profundo (companies.uso_sacs) ──
 * Estructura anidada y heterogénea (números, banderas, fechas, `modulos` como
 * arreglo de objetos), así que la unión es recursiva y por tipo. */

// Claves que NO se suman: son constantes de la consulta, no medidas del cliente.
const NO_SUMABLES = new Set(['ventana_dias']);

function unirArrays(clave: string, a: any[], b: any[]): any[] {
  // `modulos` viene como [{modulo, familia, usa, total, docs_7d, docs_30d, ultimo}]:
  // se une POR MÓDULO (si lo usa en cualquiera de sus cuentas, lo usa).
  if (clave === 'modulos') {
    const porNombre = new Map<string, any>();
    for (const it of [...a, ...b]) {
      const k = it?.modulo;
      if (!k) continue;
      porNombre.set(k, porNombre.has(k) ? unirObjetos(porNombre.get(k), it) : { ...it });
    }
    return [...porNombre.values()];
  }
  return [...a, ...b].slice(0, 12); // listas de ejemplo (promos activas, últimas transferencias)
}

function unirObjetos(a: any, b: any): any {
  // {fecha, ...}: no se mezcla campo por campo — gana el registro más reciente,
  // si no saldría la fecha de un conteo con el status de otro.
  if (a && b && typeof a.fecha === 'string' && typeof b.fecha === 'string') {
    return a.fecha >= b.fecha ? a : b;
  }
  const out: any = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = unirValor(k, out[k], v);
  return out;
}

function unirValor(clave: string, a: any, b: any): any {
  if (a === undefined || a === null) return b;
  if (b === undefined || b === null) return a;
  if (typeof a === 'boolean' || typeof b === 'boolean') return !!a || !!b;   // lo usa en alguna cuenta
  if (typeof a === 'number' && typeof b === 'number') return NO_SUMABLES.has(clave) ? Math.max(a, b) : a + b;
  if (Array.isArray(a) && Array.isArray(b)) return unirArrays(clave, a, b);
  if (typeof a === 'object' && typeof b === 'object') return unirObjetos(a, b);
  if (typeof a === 'string' && typeof b === 'string') return a >= b ? a : b; // fechas ISO: la más reciente
  return a;
}

/** Une el uso profundo de N cuentas en una sola foto del cliente. */
export function agregarUso(porCuenta: Record<string, any>): any | null {
  const cuentas = Object.keys(porCuenta).filter(c => porCuenta[c]);
  if (!cuentas.length) return null;
  if (cuentas.length === 1) return { ...porCuenta[cuentas[0]], cuentas };
  let acc: any = porCuenta[cuentas[0]];
  for (const c of cuentas.slice(1)) acc = unirObjetos(acc, porCuenta[c]);
  return { ...acc, cuentas };
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

/** Igual, para el uso profundo. */
export async function guardarUsoPorCuenta(companyId: string, porCuenta: Record<string, any>) {
  const ahora = new Date().toISOString();
  for (const [cuenta, uso] of Object.entries(porCuenta)) {
    if (!uso) continue;
    try {
      await supabase.from('company_sacs_accounts')
        .update({ uso_sacs: uso, uso_sync_at: ahora })
        .eq('company_id', companyId).eq('cuenta', cuenta);
    } catch { /* el desglose nunca bloquea el sync principal */ }
  }
}
