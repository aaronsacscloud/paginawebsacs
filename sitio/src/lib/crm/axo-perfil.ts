// ══ Perfil del negocio para AXO (plan «AXO Gratis: conversión», REQ-03, Aaron 26-oct-2026) ══
//
// El CRM conoce de cada cliente su giro, cómo vende, cuántas sucursales tiene, su plan y su etapa.
// Ese perfil se manda a sacs_api (`POST /interno/crm/perfil-negocio`), que lo guarda dentro de la cuenta
// en sacs3 y en sacs5 para que AXO decida con él: qué ofrecer, cómo acompañar el arranque y a quién darle
// seguimiento. El seguimiento lo hace AXO desde su chat y su WhatsApp, no el CRM.
// Aquí solo la parte pura (con pruebas). El envío vive en /api/cron/axo-perfil.

export type Etapa = 'prueba' | 'cliente_nuevo' | 'adopcion' | 'estable' | 'en_riesgo' | 'baja';

export interface EmpresaPerfil {
  giro?: string | null;
  sucursales?: number | null;
  plan?: string | null;
  estado_cuenta?: string | null;
  fecha_inicio?: string | null;
  fecha_renovacion?: string | null;
  dias_sin_venta?: number | null;
  soporte_abiertos?: number | null;
  soporte_estancado?: boolean | null;
  propiedades?: Record<string, any> | null;
}

const DIA_MS = 86_400_000;

function diasDesde(f: string | null | undefined, ahora: number): number | null {
  if (!f) return null;
  const t = Date.parse(f.length === 10 ? `${f}T12:00:00Z` : f);
  return Number.isFinite(t) ? Math.floor((ahora - t) / DIA_MS) : null;
}

/** La etapa del cliente con SACS. */
export function etapaDe(e: EmpresaPerfil, ahora: number): Etapa {
  const est = (e.estado_cuenta || '').toLowerCase();
  const vitalicia = (e.propiedades?.plan_modalidad || '') === 'vitalicio';
  if (est === 'cancelado' || est === 'pausado' || (est === 'vencido' && !vitalicia)) return 'baja';
  if (est === 'trial') return 'prueba';
  const d = diasDesde(e.fecha_inicio, ahora);
  if (d !== null && d >= 0 && d < 30) return 'cliente_nuevo';
  if ((e.dias_sin_venta || 0) >= 21) return 'en_riesgo';
  if (d !== null && d >= 0 && d < 90) return 'adopcion';
  return 'estable';
}

const fecha = (f: string | null | undefined) => (f && /^\d{4}-\d{2}-\d{2}/.test(f) ? f.slice(0, 10) : undefined);

/** El perfil que viaja a sacs3/sacs5 (lista blanca en sacs_api). */
export function perfilDe(e: EmpresaPerfil, ahora: number): Record<string, string | number | boolean> {
  const p = e.propiedades || {};
  const out: Record<string, string | number | boolean | undefined> = {
    industria: p.industria || undefined,
    giro: e.giro || p.subgiro || undefined,
    canal_venta: p.canal_venta || undefined,
    listas_precios: typeof p.listas_precios === 'number' ? p.listas_precios : undefined,
    sucursales: Number(p.sucursales_sacs || e.sucursales) || undefined,
    plan: e.plan || undefined,
    plan_modalidad: p.plan_modalidad || undefined,
    estado_cuenta: e.estado_cuenta || undefined,
    etapa: etapaDe(e, ahora),
    fecha_inicio: fecha(e.fecha_inicio),
    fecha_renovacion: fecha(e.fecha_renovacion),
    dias_sin_venta: typeof e.dias_sin_venta === 'number' ? e.dias_sin_venta : undefined,
    soporte_estancado: (e.soporte_abiertos || 0) > 0 && !!e.soporte_estancado,
  };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out as Record<string, string | number | boolean>;
}
