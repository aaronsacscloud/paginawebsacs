// TRABAJO INTELIGENTE · el SIMULADOR del agente: ¿qué haría con este lead
// ahora mismo? Lee, decide y devuelve el JSON — NO envía ni guarda envíos.
// Sirve para probar el guion sobre un caso real sin riesgo, y para el panel de
// «Reglas y lógica» (A1) cuando exista.
//   GET /api/cron/ti-agente-prueba?contact_id=<uuid>      (Authorization: Bearer CRON_SECRET)
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { decidirTurno } from '../../../lib/crm/ti/agente';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o, null, 1), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const id = new URL(request.url).searchParams.get('contact_id');
  if (!id) return json({ error: 'Falta contact_id' }, 400);
  try {
    const t0 = Date.now();
    const r = await decidirTurno(id);
    return json({ ok: !!r.salida, ms: Date.now() - t0, ...r });
  } catch (e: any) { return json({ error: String(e?.message || e) }, 500); }
};
