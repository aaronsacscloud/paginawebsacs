// HEALTH SCORE v2 — única fuente de verdad (antes duplicado en
// cron/sync-sacs-activity.ts y arr/sync-cuenta.ts, y con claves que NO
// coincidían con HealthScoreBadge → el desglose se veía en ceros).
//
// 0-100 con 6 factores; usa la actividad (ventas) y el USO PROFUNDO (uso_sacs):
//   recencia    (0-30)  días desde la última venta
//   tendencia   (0-20)  ventas 30d vs 30d previos
//   adopcion    (0-15)  módulos que usa (matriz uso.modulos, fallback actividad.modulos)
//   equipo      (0-10)  usuarios operando (cobraron en 30d)
//   programas   (0-15)  lealtad activa (7) + facturación configurada (5) + tarjetas (3)
//   crecimiento (0-10)  clientes nuevos 7d (6) + inscritos lealtad nuevos 7d (4)
//
// Las claves y máximos deben coincidir con HealthScoreBadge.FACTOR_MAX.

export const HEALTH_FACTOR_MAX: Record<string, number> = {
  recencia: 30, tendencia: 20, adopcion: 15, equipo: 10, programas: 15, crecimiento: 10,
  soporte: 0,   // sentinela: factor de PENALIZACIÓN (valor ≤ 0), el badge lo pinta como "−N".
};
export const HEALTH_FACTOR_LABELS: Record<string, string> = {
  recencia: 'Ventas recientes',
  tendencia: 'Tendencia 30d',
  adopcion: 'Adopción de módulos',
  equipo: 'Equipo operando',
  programas: 'Programas (lealtad/facturación)',
  crecimiento: 'Crecimiento de clientes',
  soporte: 'Soporte',
};

/** Rollup de soporte que penaliza la salud (viene de companies.soporte_*). */
export interface SoporteSalud {
  abiertos?: number;
  estancado?: boolean;               // algún ticket abierto rompió el SLA
  sentimiento?: string | null;       // 'urgente' | 'negativo' | ...
}

/** Penalización de salud por carga de soporte. Devuelve un número ≤ 0 (máx −20). */
export function penalizacionSoporte(s?: SoporteSalud | null): number {
  if (!s) return 0;
  let p = 0;
  const ab = Number(s.abiertos || 0);
  if (ab >= 4) p -= 10; else if (ab >= 2) p -= 6; else if (ab === 1) p -= 3;
  if (s.estancado) p -= 6;                       // SLA roto: pesa más que el conteo
  if (s.sentimiento === 'urgente') p -= 8;
  else if (s.sentimiento === 'negativo') p -= 4;
  return Math.max(-20, p);
}

export function healthScoreV2(a: any, uso?: any, soporte?: SoporteSalud | null): { score: number; factors: Record<string, number> } {
  a = a || {}; uso = uso || null;

  const dias = a.ultima_venta ? Math.max(0, Math.floor((Date.now() - new Date(a.ultima_venta + 'T12:00:00Z').getTime()) / 86400000)) : 99;
  const recencia = dias <= 1 ? 30 : dias <= 3 ? 24 : dias <= 7 ? 18 : dias <= 15 ? 9 : 0;

  const t = a.tendencia_pct;
  const tendencia = t == null ? 10 : t >= 0 ? 20 : t >= -25 ? 14 : t >= -50 ? 6 : 0;

  // Adopción: módulos EN USO de la matriz integral (uso.modulos con usa=true);
  // fallback al conteo de actividad 30d si el uso profundo aún no sincroniza.
  const enUso = Array.isArray(uso?.modulos) ? uso.modulos.filter((m: any) => m.usa).length : (a.modulos?.length || 0);
  const adopcion = Math.min(15, enUso * 2);

  const ops = a.usuarios_operando || 0;
  const equipo = ops >= 4 ? 10 : ops === 3 ? 8 : ops === 2 ? 5 : ops === 1 ? 3 : 0;

  let programas = 0;
  if (uso) {
    if (uso.lealtad?.activo) programas += 7;
    if (uso.facturacion?.configurada) programas += 5;
    if (uso.tarjetas_regalo?.usa) programas += 3;
  }

  let crecimiento = 0;
  if (uso) {
    const cn = Number(uso.clientes?.nuevos_7d || 0);
    crecimiento += cn >= 20 ? 6 : cn >= 5 ? 4 : cn >= 1 ? 2 : 0;
    const ln = Number(uso.lealtad?.nuevos_7d || 0);
    crecimiento += ln >= 10 ? 4 : ln >= 1 ? 2 : 0;
  }

  const soportePen = penalizacionSoporte(soporte);   // ≤ 0
  const factors = { recencia, tendencia, adopcion, equipo, programas, crecimiento, soporte: soportePen };
  const base = recencia + tendencia + adopcion + equipo + programas + crecimiento;   // 0-100
  const score = Math.max(0, Math.min(100, base + soportePen));
  return { score, factors };
}
