// TRABAJO INTELIGENTE · EL DIGEST DEL DÍA para el dueño (ángulo 16 de la 6ª
// ronda): qué hizo el agente, qué vetaste, qué aprendió, qué quedó pendiente.
// Cae en las notificaciones del CRM (crm_notificaciones, nivel info) con
// destino a Trabajo Inteligente; cuando haya número de WhatsApp del dueño
// configurado, el mismo texto sale también por ahí.
// Cron: 00:30 UTC L-V (= 18:30 CDMX). También se puede disparar a mano.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { notificar } from '../../../lib/crm/notificaciones';
import { leerConfig } from '../../../lib/crm/ti/motor';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const cfg: any = await leerConfig();
  const ahora = new Date();
  const inicio = new Date(ahora); inicio.setUTCHours(6, 0, 0, 0); // 00:00 CDMX
  if (inicio > ahora) inicio.setUTCDate(inicio.getUTCDate() - 1);
  const desde = inicio.toISOString();
  const dia = inicio.toISOString().slice(0, 10);

  const cnt = async (tabla: string, f: (q: any) => any) => { const { count } = await f(supabase.from(tabla).select('id', { count: 'exact', head: true })); return count || 0; };
  const [propuestos, enviados, vetados, editados, escalados, ejemplosNuevos, dudosos, hechas, faltas, leadsNuevos, respuestas] = await Promise.all([
    cnt('ti_envios', q => q.gte('created_at', desde)),
    cnt('ti_envios', q => q.eq('estado', 'enviado').gte('enviado_at', desde)),
    cnt('ti_envios', q => q.eq('estado', 'vetado').gte('updated_at', desde)),
    cnt('ti_envios', q => q.not('editado_por', 'is', null).gte('updated_at', desde)),
    cnt('ia_log', q => q.eq('accion', 'agente_calla').ilike('razon', 'escalado%').gte('created_at', desde)),
    cnt('ia_ejemplos', q => q.eq('estado_rev', 'aprobado').gte('revisado_at', desde)),
    cnt('ia_ejemplos', q => q.eq('estado_rev', 'dudoso')),
    cnt('ti_tareas', q => q.eq('estado', 'hecha').gte('hecho_at', desde)),
    cnt('ti_faltas', q => q.gte('created_at', desde)),
    cnt('ti_eventos', q => q.eq('tipo', 'lead_entro').gte('ocurrio_at', desde)),
    cnt('ti_eventos', q => q.eq('tipo', 'wa_entrante').gte('ocurrio_at', desde)),
  ]);
  const { data: costo } = await supabase.from('ia_log').select('costo_usd').gte('created_at', desde).not('costo_usd', 'is', null).limit(2000);
  const usd = (costo || []).reduce((a: number, r: any) => a + (Number(r.costo_usd) || 0), 0);

  const lineas = [
    `Agente ${cfg.agente_activo ? 'encendido' : 'apagado'} · ${respuestas} mensajes de leads · ${leadsNuevos} leads nuevos`,
    `Agente: ${propuestos} respuestas propuestas, ${enviados} enviadas, ${vetados} detenidas, ${editados} editadas, ${escalados} pasadas a humano`,
    `Equipo: ${hechas} tareas hechas · ${faltas} faltas`,
    `Aprendizaje: ${ejemplosNuevos} ejemplos aprobados hoy · ${dudosos} dudosos esperando tu decisión`,
    `IA: $${usd.toFixed(2)} USD hoy`,
  ];
  const titulo = `Trabajo Inteligente · ${dia}: ${enviados} envíos del agente, ${hechas} tareas, ${faltas} faltas`;
  const nueva = await notificar({ clave: `ti_digest:${dia}`, tipo: 'ti_digest', nivel: faltas > 0 || vetados > 2 ? 'alerta' : 'info', titulo, detalle: lineas.join('\n'), destino: 'trabajo', metadata: { propuestos, enviados, vetados, editados, escalados, ejemplosNuevos, dudosos, hechas, faltas, leadsNuevos, respuestas, usd } });
  return json({ ok: true, nueva, titulo, lineas });
};
