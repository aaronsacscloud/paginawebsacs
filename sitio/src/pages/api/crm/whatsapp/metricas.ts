// WHATSAPP · Métricas del inbox.
//
// GET ?dias=7|30 → { rango, totales, por_dia, por_agente, primera_respuesta }
//
// Todo se calcula del espejo (wa_mensajes/wa_conversaciones) al momento:
// a esta escala (cientos de conversaciones) no amerita materializar nada.
// "Primera respuesta" = del primer ENTRANTE de la conversación al primer
// SALIENTE posterior, promediado sobre las conversaciones del rango.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const dias = Math.min(Number(url.searchParams.get('dias') || 7), 90);
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  const [{ data: msjs }, { data: convs }, { data: equipo }] = await Promise.all([
    supabase.from('wa_mensajes')
      .select('conversation_id, direccion, created_at')
      .gte('created_at', desde).order('created_at', { ascending: true }).limit(10000),
    supabase.from('wa_conversaciones')
      .select('id, created_at, estado_crm, asignado_a, no_leidos, cierre_categoria'),
    supabase.from('team_members').select('id, nombre').eq('activo', true),
  ]);

  const totales = {
    conversaciones_nuevas: (convs || []).filter(c => c.created_at >= desde).length,
    entrantes: (msjs || []).filter(m => m.direccion === 'entrante').length,
    salientes: (msjs || []).filter(m => m.direccion === 'saliente').length,
    abiertas: (convs || []).filter(c => c.estado_crm === 'abierta').length,
    pendientes: (convs || []).filter(c => c.estado_crm === 'pendiente').length,
    resueltas: (convs || []).filter(c => c.estado_crm === 'resuelta').length,
    sin_leer: (convs || []).filter(c => (c.no_leidos || 0) > 0).length,
  };

  // Mensajes por día (para la gráfica de barras).
  const porDia: Record<string, { entrantes: number; salientes: number }> = {};
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    porDia[d] = { entrantes: 0, salientes: 0 };
  }
  for (const m of msjs || []) {
    const d = String(m.created_at).slice(0, 10);
    if (porDia[d]) porDia[d][m.direccion === 'entrante' ? 'entrantes' : 'salientes']++;
  }

  // Primera respuesta por conversación (solo las que tuvieron ida y vuelta).
  const porConv: Record<string, { in?: string; out?: string }> = {};
  for (const m of msjs || []) {
    const c = porConv[m.conversation_id] = porConv[m.conversation_id] || {};
    if (m.direccion === 'entrante' && !c.in) c.in = m.created_at;
    if (m.direccion === 'saliente' && c.in && !c.out) c.out = m.created_at;
  }
  const tiempos = Object.values(porConv)
    .filter(c => c.in && c.out)
    .map(c => new Date(c.out!).getTime() - new Date(c.in!).getTime());
  const promMs = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;

  // Por agente: cuántas trae cada quien y cuántas ya resolvió.
  const porAgente = (equipo || []).map(m => ({
    id: m.id, nombre: m.nombre,
    asignadas: (convs || []).filter(c => c.asignado_a === m.id).length,
    resueltas: (convs || []).filter(c => c.asignado_a === m.id && c.estado_crm === 'resuelta').length,
  })).filter(a => a.asignadas > 0);

  // Motivos de cierre (nota de cierre categorizada al resolver).
  const cierres: Record<string, number> = {};
  for (const c of convs || []) if (c.estado_crm === 'resuelta') cierres[c.cierre_categoria || 'Sin categoría'] = (cierres[c.cierre_categoria || 'Sin categoría'] || 0) + 1;
  const porCierre = Object.entries(cierres).map(([categoria, n]) => ({ categoria, n })).sort((a, b) => b.n - a.n);

  return json({
    rango: { dias, desde },
    por_cierre: porCierre,
    totales,
    por_dia: Object.entries(porDia).map(([dia, v]) => ({ dia, ...v })),
    por_agente: porAgente,
    primera_respuesta: {
      promedio_min: promMs != null ? Math.round(promMs / 60000) : null,
      con_respuesta: tiempos.length,
    },
  });
};
