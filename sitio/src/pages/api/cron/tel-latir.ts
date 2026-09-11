// FERNANDA AL TELÉFONO · el latido de las sesiones que marcan solas.
// En modo manual el navegador del vendedor late cada segundo; con Fernanda
// sola no hay navegador, así que este cron (cada 2 min) y la central de voz
// (al terminar cada llamada) empujan la sesión: cierre con IA → siguiente.
// También es el freno de gasto: si lo de hoy pasó el tope, se pausa todo.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { latir, pausarSesion } from '../../../lib/telefonia/marcador';
import { configVoz, gastoHoyVoz, vozConfigurada } from '../../../lib/telefonia/voz';
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  if (!vozConfigurada()) return json({ ok: true, motivo: 'sin central' });
  const { data } = await supabase.from('tel_sesiones').select('id, estado, pausa_motivo, modo').eq('modo', 'ia').in('estado', ['activa', 'pausada']).limit(20);
  const vivas = (data || []).filter(s => s.estado === 'activa' || s.pausa_motivo === 'horario');
  if (!vivas.length) return json({ ok: true, sesiones: 0 });
  const cfg = await configVoz();
  const gasto = await gastoHoyVoz();
  const res: any[] = [];
  for (const s of vivas) {
    if (s.estado === 'activa' && gasto >= cfg.tope_dia_usd) {
      await pausarSesion(s.id, `Fernanda llegó al tope de gasto del día (${gasto.toFixed(2)} de ${cfg.tope_dia_usd} USD). Se reanuda mañana o si subes el tope.`, 'disyuntor');
      res.push({ id: s.id, pausada: 'tope' }); continue;
    }
    try { const e = await latir(s.id); res.push({ id: s.id, estado: e?.sesion?.estado || null, item: e?.actual?.estado || null }); }
    catch (e: any) { res.push({ id: s.id, error: String(e?.message || e) }); }
  }
  return json({ ok: true, gasto_hoy_usd: gasto, tope: cfg.tope_dia_usd, sesiones: res });
};
