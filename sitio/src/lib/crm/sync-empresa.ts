// Sincroniza UNA empresa contra SACS trayendo TODAS sus cuentas y guardando el
// agregado en `companies.actividad`. Lo comparten el botón "Sincronizar ahora"
// y el alta/baja de cuentas, para que no haya dos versiones de la misma lógica.
import { supabase } from '../supabase';
import { healthScoreV2 } from './health';
import { cuentasDe, agregarActividad, guardarPorCuenta, type Actividad } from './sacs-cuentas';

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();

export async function traerActividad(cuentas: string[]): Promise<Record<string, Actividad>> {
  if (!cuentas.length) return {};
  const res = await fetch(SACS_API + '/interno/crm/actividad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
    body: JSON.stringify({ accounts: cuentas }),
  });
  if (!res.ok) throw new Error('La API de SACS respondió ' + res.status);
  const j = await res.json();
  return (j.data || {}) as Record<string, Actividad>;
}

export async function sincronizarEmpresa(companyId: string): Promise<any> {
  const { data: co } = await supabase.from('companies')
    .select('id, sacs_account, uso_sacs').eq('id', companyId).maybeSingle();
  if (!co) return { error: 'empresa no encontrada' };

  const cuentas = await cuentasDe(companyId, co.sacs_account);
  if (!cuentas.length) {
    await supabase.from('companies').update({ actividad: null, ultima_venta_at: null, dias_sin_venta: null }).eq('id', companyId);
    return { ok: true, cuentas: [], sin_cuentas: true };
  }

  let porCuenta: Record<string, Actividad>;
  try { porCuenta = await traerActividad(cuentas); }
  catch (e: any) { return { error: e?.message || String(e) }; }

  await guardarPorCuenta(companyId, porCuenta);
  const act = agregarActividad(porCuenta);
  if (!act) return { ok: true, cuentas, sin_datos: true };

  const dias = act.ultima_venta
    ? Math.max(0, Math.floor((Date.now() - new Date(act.ultima_venta + 'T12:00:00Z').getTime()) / 86400000))
    : null;
  const { score, factors } = healthScoreV2(act as any, (co as any).uso_sacs);
  const ahora = new Date().toISOString();

  const { error } = await supabase.from('companies').update({
    actividad: act, ultima_venta_at: act.ultima_venta || null, dias_sin_venta: dias,
    actividad_sync_at: ahora, health_score: score, health_factors: factors, health_computed_at: ahora,
  }).eq('id', companyId);
  if (error) return { error: error.message };

  return { ok: true, cuentas, actividad: act, dias_sin_venta: dias, health_score: score };
}
