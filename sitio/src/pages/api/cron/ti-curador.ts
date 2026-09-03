// TRABAJO INTELIGENTE · EL CURADOR (3-sep-2026): los pasos pesados del ciclo nocturno, cada uno medido y con su error
// aislado (ti_corridas). Cron: 08:25 UTC (02:25 CDMX), después de ti-aprender.
//   pares       → curador Opus decide agente vs humano en pares sin veredicto (máx. 20)
//   pendientes  → dudosos/propuestos con 7+ días sin revisión: el curador aprueba o rechaza con razón (máx. 20)
//   higiene     → duplicados y promos vencidas fuera de la biblioteca
//   reglas      → prueba (con/sin + juez) hasta 2 reglas propuestas que aún no tienen prueba
//   resultados  → ¿el lead contestó en 48 h? ¿agendó en 7 d? para calificaciones y envíos
//   calificacion→ índice de vida de los leads (F4) · presupuesto → aviso al 80 % (F5)
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { anthropic, MODELS, hasApiKey } from '../../../lib/ai/client';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const D = 86400e3;

async function pares() {
  const res = { revisados: 0, humano_mejor: 0, agente_mejor: 0 };
  if (!hasApiKey()) return { ...res, motivo: 'sin_api_key' };
  const ahora = new Date().toISOString();
  const { data: lista } = await supabase.from('ti_envios').select('id, contact_id, mensaje, humano_respuesta, salida, created_at').not('humano_respuesta', 'is', null).is('veredicto_par', null).lt('created_at', new Date(Date.now() - D).toISOString()).order('created_at', { ascending: false }).limit(20);
  for (const p of lista || []) {
    try {
      const r = await anthropic.messages.create({ model: MODELS.opus, max_tokens: 300, messages: [{ role: 'user', content: `Eres el curador del agente SDR de Sacscloud (retail de moda). Mismo turno, dos respuestas al lead. Lead dijo: «${String((p.salida as any)?.ultimo_mensaje || '').slice(0, 300)}». Estado del guion: ${(p.salida as any)?.estado || '?'}.\n\nA (agente): ${String(p.mensaje).slice(0, 600)}\n\nB (humano): ${String(p.humano_respuesta).slice(0, 600)}\n\n¿Cuál enseña mejor cómo contestar (corta, una pregunta, sin admiraciones, fondo correcto, siguiente paso natural)? Responde SOLO JSON: {"mejor":"A|B|empate","razon":"1 línea"}` }] });
      const t = (r.content.find(b => b.type === 'text') as any)?.text || '{}';
      const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      const v = j.mejor === 'B' ? 'humano_mejor' : j.mejor === 'A' ? 'agente_mejor' : 'empate';
      await supabase.from('ti_envios').update({ veredicto_par: `curador:${v}` }).eq('id', p.id);
      await supabase.from('ia_ejemplos').update({ estado_rev: v === 'humano_mejor' ? 'aprobado' : 'rechazado', revisado_at: ahora, por_que: `Par agente/humano · envio:${p.id} · Curador: ${j.razon || ''}` }).eq('fuente', 'humano_antes').ilike('por_que', `%envio:${p.id}%`);
      res.revisados++; if (v === 'humano_mejor') res.humano_mejor++; if (v === 'agente_mejor') res.agente_mejor++;
    } catch { /* siguiente par */ }
  }
  return res;
}

async function reglasSinPrueba() {
  const { evaluarRegla } = await import('../../../lib/crm/ti/guion-datos');
  const { data } = await supabase.from('ti_reglas').select('id').eq('clave', 'regla_guion').eq('estado', 'propuesta').not('texto', 'is', null).is('prueba', null).order('created_at', { ascending: true }).limit(2);
  const out: any[] = [];
  for (const r of data || []) { const e: any = await evaluarRegla(r.id); out.push({ id: r.id, n: e?.prueba?.n, con: e?.prueba?.con, sin: e?.prueba?.sin, error: e?.error }); }
  return out;
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const { correr } = await import('../../../lib/crm/ti/corridas');
  const { higieneBiblioteca, curarPendientes, medirResultados } = await import('../../../lib/crm/ti/biblioteca');
  const corrida = await correr('ti-curador', {
    pares,
    pendientes: () => curarPendientes(7, 20),
    higiene: higieneBiblioteca,
    reglas: reglasSinPrueba,
    resultados: medirResultados,
    calificacion: async () => { const { calificarLeads } = await import('../../../lib/crm/ti/agente'); return calificarLeads(); },
    presupuesto: async () => { const { revisarPresupuesto } = await import('../../../lib/crm/ti/consumo'); return revisarPresupuesto(); },
  });
  return json(corrida);
};
