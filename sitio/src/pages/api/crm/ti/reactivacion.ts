import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { leerConfig } from '../../../../lib/crm/ti/motor';
import { SEGMENTOS, generarLoteReactivacion, aprobarReactivacion, rechazarReactivacion, sincronizarReactivaciones, panelReactivacion } from '../../../../lib/crm/ti/reactivacion';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  await sincronizarReactivaciones().catch(() => {});
  const [cfg, { data: filas }, { data: cand }] = await Promise.all([
    leerConfig() as Promise<any>,
    supabase.from('ti_reactivacion').select('*, contacts(nombre, email, lifecycle_stage, company_id, companies(nombre_comercial, nombre))').order('created_at', { ascending: false }).limit(300),
    supabase.from('v_ti_reactivacion_candidatos').select('segmento'),
  ]);
  const pendientes: Record<string, number> = {}; for (const c of cand || []) pendientes[c.segmento] = (pendientes[c.segmento] || 0) + 1;
  const panel = await panelReactivacion().catch(() => null);
  return json({ filas: filas || [], candidatos: pendientes, candidatos_total: (cand || []).length, segmentos: SEGMENTOS, rampa: cfg.rampa_reactivacion || { sin_editar: 0, automatico: false }, activa: cfg.reactivacion_activa !== false, panel });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const uid = (user as any).id;
  if (b.accion === 'generar') return json(await generarLoteReactivacion(Math.min(Number(b.n) || 5, 8)));
  if (b.accion === 'aprobar') return json(await aprobarReactivacion(String(b.id), { mensaje: b.mensaje, userId: uid, familia: b.familia, criterio: b.criterio }));
  if (b.accion === 'config') {
    const cfg: any = await leerConfig(); const v: any = { ...cfg };
    if (b.familia) v.reactivacion_familia = String(b.familia);
    if (Array.isArray(b.horas)) v.reactivacion_horas = b.horas.map(Number).filter((h: number) => h >= 7 && h <= 20).sort((a: number, c: number) => a - c);
    if (b.max_dia) v.reactivacion_max_dia = Math.max(1, Math.min(60, Number(b.max_dia)));
    await supabase.from('ti_config').update({ valor: v }).eq('id', 1); return json({ ok: true });
  }
  if (b.accion === 'rechazar') return json(await rechazarReactivacion(String(b.id), String(b.motivo || ''), uid));
  if (b.accion === 'rampa') {
    const cfg: any = await leerConfig(); const r: any = cfg.rampa_reactivacion || {};
    await supabase.from('ti_config').update({ valor: { ...cfg, rampa_reactivacion: { ...r, automatico: !!b.automatico, sin_editar: b.automatico ? r.sin_editar : 0 }, reactivacion_activa: b.activa !== false } }).eq('id', 1);
    return json({ ok: true });
  }
  return json({ error: 'Acción desconocida' }, 400);
};
