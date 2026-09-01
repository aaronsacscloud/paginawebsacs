// TRABAJO INTELIGENTE · El plan del día del consultor.
// GET → { tareas: [...], resumen } — pendientes de HOY ordenadas como las
// sirve el panel: prioridad, atrasadas primero dentro de ella, y hora.
//
// La cola es POR CONSULTOR (owner). Las tareas sin owner (leads sin asignar)
// las ve el founder — hoy todo cae ahí por la decisión «todos al dueño».
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { observar } from '../../../../lib/crm/ti/observador';

/* El observador también corre al PEDIR el plan (además del cron): con el
   panel abierto, un lead que responde aparece en segundos, no en minutos.
   Acelerador en memoria para no barrer en cada tecla. */
let ultimaObservada = 0;

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  if (Date.now() - ultimaObservada > 25_000) {
    ultimaObservada = Date.now();
    try { await observar(); } catch { /* el plan se sirve aunque el barrido falle */ }
  }

  const finHoy = new Date(); finHoy.setUTCHours(29, 59, 59, 0); // 23:59 CDMX (UTC-6)
  let q = supabase.from('ti_tareas')
    .select('id, contact_id, company_id, owner_id, familia, tipo, paso, prioridad, vence_at, atrasada, payload, origen, lote_tipo, created_at')
    .eq('estado', 'pendiente').lte('vence_at', finHoy.toISOString())
    .order('prioridad', { ascending: true }).order('atrasada', { ascending: false }).order('vence_at', { ascending: true })
    .limit(200);
  // El founder ve su cola + lo sin dueño; un cs solo lo suyo.
  q = user.role === 'founder'
    ? q.or(`owner_id.eq.${user.id},owner_id.is.null`)
    : q.eq('owner_id', user.id);
  const { data: tareas, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const inicioHoy = new Date(); inicioHoy.setUTCHours(6, 0, 0, 0); // 00:00 CDMX
  const { count: hechasHoy } = await supabase.from('ti_tareas')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'hecha').gte('hecho_at', inicioHoy.toISOString());

  return json({
    tareas: tareas || [],
    resumen: {
      pendientes: (tareas || []).length,
      hechas_hoy: hechasHoy || 0,
      atrasadas: (tareas || []).filter((t: any) => t.atrasada).length,
    },
  });
};
