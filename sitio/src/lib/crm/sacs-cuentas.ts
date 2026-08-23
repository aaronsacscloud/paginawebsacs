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
  ventas_7d?: number; total_7d?: number; ventas_30d?: number; total_30d?: number;
  ventas_30d_prev?: number; total_30d_prev?: number; tendencia_pct?: number | null;
  // La semana contra la semana anterior: la tendencia del periodo de 7 días.
  ventas_7d_prev?: number; total_7d_prev?: number; tendencia_7d_pct?: number | null;
  modulos?: string[];
  usuarios?: number; usuarios_operando?: number; ultimo_usuario_at?: string | null;
  sucursales?: number;                   // las que OPERAN (venta en 30d)
  sucursales_totales?: number;           // las registradas en el catálogo
  sucursales_permitidas?: number;        // asignadas a un superadmin activo
  sucursales_detalle?: any[];            // desglose: cuál vendió cuánto
  cuenta_desde?: string | null;          // primer rastro en SACS (venta o sucursal)
  cuenta_desde_origen?: string | null;   // de cuál de los dos salió la fecha
  primera_venta?: string | null;
  sucursal_primera?: string | null;
  sucursal_reciente?: { nombre?: string; creada?: string; fid?: string } | null;
  cuentas?: string[];                    // qué cuentas entraron en el agregado
  por_cuenta?: Record<string, Actividad>; // desglose, para pintarlo en el CRM
};

export const normCuenta = (s: any) => String(s || '').trim().toLowerCase();

/**
 * Traduce los errores del puente con SACS a algo accionable.
 *
 * "La API de SACS respondió 403" no le dice a nadie qué hacer, y los dos códigos
 * que salen aquí tienen UNA sola causa cada uno — vale la pena nombrarla:
 *   · 403 → el handler de sacs_api comparó `x-crm-sync-secret` y no cuadró.
 *   · 401 → ni siquiera llegó al handler: el candado JWT de sacs_api lo frenó
 *           antes (la ruta se salió de middleware/rutas-publicas.js).
 */
export function errorSacs(status: number): string {
  if (status === 403) return 'SACS rechazó la petición (403): el secreto CRM_SYNC_SECRET del CRM no coincide con el de sacs_api. Revísalo en las variables de entorno de Vercel — si está vacío, el CRM manda un secreto en blanco.';
  if (status === 401) return 'SACS pidió sesión (401): las rutas /interno/crm/* se salieron de la lista de rutas públicas de sacs_api (middleware/rutas-publicas.js).';
  return 'La API de SACS respondió ' + status + '.';
}

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
/** Dirección inversa: una cuenta SACS → su company_id (o null). El índice
 *  único uq_csa_cuenta garantiza que una cuenta pertenece a un solo cliente.
 *  Fallback a companies.sacs_account por si la tabla nueva aún no la tiene. */
export async function companyIdDeCuenta(cuenta: string): Promise<string | null> {
  const c = normCuenta(cuenta);
  if (!c) return null;
  try {
    const { data } = await supabase.from('company_sacs_accounts').select('company_id').eq('cuenta', c).maybeSingle();
    if (data?.company_id) return data.company_id;
  } catch { /* tabla ausente → fallback */ }
  try {
    const { data } = await supabase.from('companies').select('id').eq('sacs_account', c).maybeSingle();
    return data?.id || null;
  } catch { return null; }
}

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
// La antigüedad va al revés que el resto: con dos cuentas, el cliente lleva en
// SACS desde que abrió la PRIMERA, no la última.
const minFecha = (partes: Actividad[], k: 'cuenta_desde' | 'primera_venta' | 'sucursal_primera'): string | null => {
  const vals = partes.map(p => p?.[k]).filter(Boolean) as string[];
  return vals.length ? vals.sort()[0] : null;
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
  const total7 = suma(partes, 'total_7d');
  const prev7 = suma(partes, 'total_7d_prev');
  const modulos = Array.from(new Set(partes.flatMap(p => p.modulos || []))).sort();

  return {
    ultima_venta: maxFecha(partes, 'ultima_venta'),
    ventas_7d: suma(partes, 'ventas_7d'),
    total_7d: total7,
    ventas_7d_prev: suma(partes, 'ventas_7d_prev'),
    total_7d_prev: prev7,
    // La tendencia se recalcula sobre los MONTOS sumados, no se promedian los
    // porcentajes de cada cuenta (un 200% sobre $500 no pesa lo mismo que un
    // −5% sobre $400,000).
    tendencia_7d_pct: (prev7 != null && prev7 > 0 && total7 != null)
      ? Math.round(((total7 - prev7) / prev7) * 1000) / 10
      : null,
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
    sucursales_totales: suma(partes, 'sucursales_totales'),
    sucursales_permitidas: suma(partes, 'sucursales_permitidas'),
    // El desglose se CONCATENA (cada sucursal pertenece a una sola cuenta) y se
    // reordena por facturación. Sin esto, un cliente con 2 cuentas de SACS perdía
    // el detalle: `agregarActividad` arma un objeto con campos nombrados y este
    // se quedaba fuera.
    sucursales_detalle: partes
      .flatMap((p, i) => (p.sucursales_detalle || []).map(d => ({ ...d, cuenta: cuentas[i] })))
      .sort((a: any, b: any) => (b.total_30d || 0) - (a.total_30d || 0)),
    // Antigüedad y última apertura, cruzando cuentas: la más vieja para saber
    // desde cuándo opera y la más nueva para saber si sigue creciendo. Un campo
    // nuevo que no se nombre aquí se pierde en cuanto el cliente tiene dos
    // cuentas —le pasó a sucursales_detalle— y el bug es invisible: la ficha
    // simplemente no muestra el dato.
    cuenta_desde: minFecha(partes, 'cuenta_desde'),
    cuenta_desde_origen: partes.find(p => p.cuenta_desde && p.cuenta_desde === minFecha(partes, 'cuenta_desde'))?.cuenta_desde_origen || null,
    primera_venta: minFecha(partes, 'primera_venta'),
    sucursal_primera: minFecha(partes, 'sucursal_primera'),
    sucursal_reciente: partes.map(p => p.sucursal_reciente).filter(x => x && x.creada)
      .sort((a: any, b: any) => String(b.creada).localeCompare(String(a.creada)))[0] || null,
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
