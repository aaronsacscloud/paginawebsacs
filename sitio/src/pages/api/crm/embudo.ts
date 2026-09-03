// Embudo por ciclo de vida (decisión 2026-09-03): canal → contacto real → demo → cotización → venta, con la
// inversión capturada a mano. Lee la vista v_embudo_contacto (agregados por contacto) y devuelve TODAS las filas
// del rango: el desglose por métrica se hace en el cliente (≤ unos cientos de leads por rango).
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const CANALES: Record<string, { l: string; test: (r: any) => boolean; gasto: string[] }> = {
  todos: { l: 'Todos', test: () => true, gasto: [] },
  tiktok: { l: 'TikTok', test: r => !!r.es_tiktok, gasto: ['tiktok'] },
  web: { l: 'Sitio web', test: r => ['website-form', 'booking-page', 'cotizacion'].includes(r.fuente) || /google|meta|facebook|instagram/i.test(r.utm_source || ''), gasto: ['web', 'google', 'meta', 'facebook', 'instagram'] },
  respond: { l: 'WhatsApp directo', test: r => /^respond/i.test(r.fuente || '') || r.fuente === 'captura_manual' || !r.fuente, gasto: ['whatsapp'] },
};

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const hasta = url.searchParams.get('hasta') || new Date().toISOString().slice(0, 10);
  const desde = url.searchParams.get('desde') || new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
  const canal = url.searchParams.get('canal') || 'todos';
  const [{ data: filas, error }, { data: gastos }] = await Promise.all([
    supabase.from('v_embudo_contacto').select('*').gte('created_at', `${desde}T00:00:00-06:00`).lte('created_at', `${hasta}T23:59:59-06:00`).order('created_at', { ascending: false }).limit(2000),
    supabase.from('marketing_gastos').select('*').lte('periodo_inicio', hasta).gte('periodo_fin', desde).order('periodo_inicio', { ascending: false }),
  ]);
  if (error) return json({ error: error.message }, 500);
  const test = (CANALES[canal] || CANALES.todos).test;
  const rows = (filas || []).filter(test);
  const gastosCanal = (gastos || []).filter(g => canal === 'todos' || (CANALES[canal]?.gasto || []).some(c => String(g.canal || '').toLowerCase().includes(c)));
  // Inversión prorrateada al rango: un gasto de un mes que cae parcialmente en el rango cuenta la parte que cae.
  const d0 = Date.parse(desde), d1 = Date.parse(hasta) + 86400e3;
  const inversion = gastosCanal.reduce((s, g) => { const a = Math.max(d0, Date.parse(g.periodo_inicio)), b = Math.min(d1, Date.parse(g.periodo_fin) + 86400e3); const total = Date.parse(g.periodo_fin) + 86400e3 - Date.parse(g.periodo_inicio); return s + (b > a && total > 0 ? Number(g.monto) * (b - a) / total : 0); }, 0);
  const n = (f: (r: any) => boolean) => rows.filter(f).length;
  const resumen = {
    leads: rows.length,
    contactados: n(r => r.msgs_out > 0 || r.llamada_max_seg > 0),
    conversacion_real: n(r => r.conversacion_real),
    respondio_algo: n(r => !r.conversacion_real && r.msgs_in > 0),
    nunca_contesto: n(r => r.nunca_contesto && r.msgs_out > 0),
    sin_contactar: n(r => r.msgs_out === 0 && r.llamada_max_seg === 0 && r.msgs_in === 0),
    descalificados: n(r => r.descalificado), descalificados_hablados: n(r => r.descalificado && r.conversacion_real), descalificados_sin_hablar: n(r => r.descalificado && !r.conversacion_real),
    agendaron: n(r => r.citas_total > 0), completadas: n(r => r.citas_asistio > 0), no_asistio: n(r => r.citas_no_asistio > 0 && r.citas_asistio === 0), vigentes: n(r => r.citas_vigentes > 0), sin_resultado: n(r => r.citas_sin_resultado > 0), cancelo_lead: n(r => r.citas_cancelo_lead > 0),
    cotizacion: n(r => r.cot_total > 0), vendidos: n(r => r.pagado > 0 || r.cot_pagadas > 0 || r.suscripciones > 0),
    monto_vendido: rows.reduce((s, r) => s + Number(r.pagado || 0), 0), mrr_activo: rows.reduce((s, r) => s + Number(r.mrr_activo || 0), 0),
    cot_abierto_monto: rows.reduce((s, r) => s + Number(r.cot_abierto_monto || 0), 0),
    inversion: Math.round(inversion),
  };
  const fuentes: Record<string, number> = {}; for (const r of filas || []) { const k = r.fuente || '(sin fuente)'; fuentes[k] = (fuentes[k] || 0) + 1; }
  return json({ desde, hasta, canal, resumen, filas: rows, gastos: gastosCanal, fuentes, canales: Object.fromEntries(Object.entries(CANALES).map(([k, v]) => [k, v.l])) });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (b.accion === 'gasto') {
    if (!b.canal || !b.monto || !b.periodo_inicio || !b.periodo_fin) return json({ error: 'Faltan canal, monto o periodo' }, 400);
    const { data, error } = await supabase.from('marketing_gastos').insert({ canal: String(b.canal).toLowerCase(), campana: b.campana || null, monto: Number(b.monto), moneda: 'MXN', periodo_inicio: b.periodo_inicio, periodo_fin: b.periodo_fin, nota: b.nota || null }).select('*').maybeSingle();
    return error ? json({ error: error.message }, 500) : json({ ok: true, gasto: data });
  }
  if (b.accion === 'borrar_gasto' && b.id) { await supabase.from('marketing_gastos').delete().eq('id', b.id); return json({ ok: true }); }
  return json({ error: 'Acción desconocida' }, 400);
};
