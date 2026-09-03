// TRABAJO INTELIGENTE · «Calificación»: el índice de vida de cada lead, las sugerencias del día con sus
// fundamentos, los descalificados (con la plática real y lo que se intentó) y la rampa de autonomía.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { leerConfig } from '../../../../lib/crm/ti/motor';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function ultimosMensajes(contactId: string, n = 6) {
  const { data: convs } = await supabase.from('wa_conversaciones').select('id').eq('contact_id', contactId).order('ultimo_mensaje_at', { ascending: false }).limit(1);
  if (!convs?.length) return [];
  const { data } = await supabase.from('wa_mensajes').select('direccion, cuerpo, transcript, tipo, created_at, autor').eq('conversation_id', convs[0].id).is('borrado_at', null).order('created_at', { ascending: false }).limit(n);
  return (data || []).reverse().map(m => ({ de: m.direccion === 'entrante' ? 'lead' : (m.autor || 'nosotros'), texto: String(m.transcript || m.cuerpo || `[${m.tipo}]`).slice(0, 220), at: m.created_at }));
}

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const cfg: any = await leerConfig();
  const [{ data: tareas }, { data: perfiles }, { data: desc }] = await Promise.all([
    supabase.from('ti_tareas').select('id, contact_id, payload, created_at').eq('estado', 'pendiente').eq('tipo', 'veredicto').filter('payload->>reloj', 'eq', 'silencio_agente').order('created_at', { ascending: false }).limit(40),
    supabase.from('ti_perfil').select('contact_id, indice_vida, indice_estado, indice_detalle, indice_at, agente_estado').not('indice_vida', 'is', null).order('indice_vida', { ascending: true }).limit(300),
    supabase.from('contacts').select('id, nombre, giro, lifecycle_stage, estatus_lead, descarte_categoria, updated_at, propiedades').or('lifecycle_stage.eq.descalificado,estatus_lead.eq.descartado').is('archived_at', null).order('updated_at', { ascending: false }).limit(40),
  ]);
  const ids = [...new Set([...(tareas || []).map((t: any) => t.contact_id), ...(perfiles || []).map((p: any) => p.contact_id)].filter(Boolean))];
  const { data: cs } = ids.length ? await supabase.from('contacts').select('id, nombre, giro, lifecycle_stage, sucursales_interes, fuente').in('id', ids) : { data: [] as any[] };
  const por: Record<string, any> = {}; for (const c of cs || []) por[c.id] = c;
  const sugerencias = [];
  for (const t of tareas || []) sugerencias.push({ ...t, contacto: por[t.contact_id] || null, mensajes: await ultimosMensajes(t.contact_id) });
  const descalificados = [];
  for (const c of (desc || []).slice(0, 25)) {
    const { data: pf } = await supabase.from('ti_perfil').select('agente_estado, indice_vida, indice_detalle').eq('contact_id', c.id).maybeSingle();
    const st: any = (pf?.agente_estado as any) || {};
    descalificados.push({ ...c, indice: pf?.indice_vida ?? null, detalle: pf?.indice_detalle || null, intentos: Array.isArray(st.intentos) ? st.intentos : [], angulos: st.angulos || [], cerrado: st.cerrado || null, cerrado_at: st.cerrado_at || null, motivo: st.motivo || (c.propiedades as any)?.no_era_lead?.motivo || c.descarte_categoria || null, mensajes: await ultimosMensajes(c.id, 6) });
  }
  const leads = (perfiles || []).filter((p: any) => por[p.contact_id] && ['lead', 'lead_calificado', 'oportunidad'].includes(por[p.contact_id].lifecycle_stage)).map((p: any) => ({ contact_id: p.contact_id, contacto: por[p.contact_id], indice: p.indice_vida, estado: p.indice_estado, detalle: p.indice_detalle, at: p.indice_at, intentos: Array.isArray(p.agente_estado?.intentos) ? p.agente_estado.intentos.filter((i: any) => i.valido).length : 0 }));
  // PUNTUALIDAD DEL CONSULTOR (decisión 2026-09-03): cuánto tarda en capturar resultado, minuta e interés/cotización.
  // Es el dato que permite exigir la fecha de liberación; sale de las mismas tareas de la cadena.
  const PLAZO_H: Record<string, number> = { reunion_resultado: 24, reunion_minuta: 24, reunion_interes: 48, cotizacion_estado: 168, cotizacion_cobro: 168 };
  const [{ data: tareasC }, { data: tms }] = await Promise.all([
    supabase.from('ti_tareas').select('owner_id, estado, created_at, hecho_at, payload').eq('tipo', 'dato').eq('lote_tipo', 'comercial').gte('created_at', new Date(Date.now() - 60 * 86400e3).toISOString()).limit(1000),
    supabase.from('team_members').select('id, nombre'),
  ]);
  const nombreTm = new Map((tms || []).map(t => [t.id, t.nombre]));
  const porC: Record<string, any> = {};
  for (const t of tareasC || []) {
    const clave = (t.payload as any)?.campo_clave; if (!PLAZO_H[clave]) continue;
    const k = (t.owner_id && nombreTm.get(t.owner_id)) || 'Sin dueño';
    const c = porC[k] || (porC[k] = { consultor: k, total: 0, hechas: 0, a_tiempo: 0, vencidas_abiertas: 0, horas: [] as number[], por_campo: {} as Record<string, { n: number; horas: number[] }> });
    c.total++;
    const pc = c.por_campo[clave] || (c.por_campo[clave] = { n: 0, horas: [] }); pc.n++;
    if (t.estado === 'hecha' && t.hecho_at) { const h = (Date.parse(t.hecho_at) - Date.parse(t.created_at)) / 3600e3; c.hechas++; c.horas.push(h); pc.horas.push(h); if (h <= PLAZO_H[clave]) c.a_tiempo++; }
    else if (t.estado === 'pendiente' && Date.now() - Date.parse(t.created_at) > PLAZO_H[clave] * 3600e3) c.vencidas_abiertas++;
  }
  const consultores = Object.values(porC).map((c: any) => ({ consultor: c.consultor, total: c.total, hechas: c.hechas, pct_a_tiempo: c.hechas ? Math.round(c.a_tiempo / c.hechas * 100) : null, horas_promedio: c.horas.length ? Math.round(c.horas.reduce((a: number, b: number) => a + b, 0) / c.horas.length) : null, vencidas_abiertas: c.vencidas_abiertas, por_campo: Object.fromEntries(Object.entries(c.por_campo).map(([k, v]: any) => [k, { n: v.n, horas: v.horas.length ? Math.round(v.horas.reduce((a: number, b: number) => a + b, 0) / v.horas.length) : null }])) })).sort((a, b) => b.total - a.total);
  return json({ sugerencias, leads, descalificados, consultores, rampa: cfg.rampa_descalificar || { coincidencias: 0, automatico: false }, marca: cfg.calificacion_marca || null });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (b.accion === 'recalcular') {
    const { calificarLeads } = await import('../../../../lib/crm/ti/agente');
    const r = await calificarLeads();
    return json({ ok: true, ...r });
  }
  if (b.accion === 'rampa') {
    const cfg: any = await leerConfig();
    const r = { ...(cfg.rampa_descalificar || { coincidencias: 0 }), automatico: !!b.automatico, cambiado_por: user.id, cambiado_at: new Date().toISOString() };
    await supabase.from('ti_config').update({ valor: { ...cfg, rampa_descalificar: r } }).eq('id', 1);
    return json({ ok: true, rampa: r });
  }
  if (b.accion === 'revivir' && b.contact_id) {
    const ahora = new Date().toISOString();
    await supabase.from('contacts').update({ lifecycle_stage: 'lead', estatus_lead: 'contactado', estatus_lead_at: ahora, descarte_categoria: null, updated_at: ahora }).eq('id', b.contact_id);
    const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', b.contact_id).maybeSingle();
    await supabase.from('ti_perfil').upsert({ contact_id: b.contact_id, silenciar_ia: false, agente_estado: { ...((pf?.agente_estado as any) || {}), ciclo: ((pf?.agente_estado as any)?.ciclo || 1) + 1, toque: 0, intentos: [], cerrado: null, cerrado_at: null, llamada_at: null, tarjeta_id: null, base_at: ahora, revivido_at: ahora }, updated_at: ahora }, { onConflict: 'contact_id' });
    await supabase.from('ia_log').insert({ accion: 'lead_revivido', contact_id: b.contact_id, razon: String(b.motivo || 'revivido por el dueño').slice(0, 200), detalle: { por: user.id } });
    return json({ ok: true });
  }
  return json({ error: 'Acción desconocida' }, 400);
};
