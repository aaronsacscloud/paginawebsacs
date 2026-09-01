// TRABAJO INTELIGENTE · El replanificador de la mañana (8:45 CDMX, L-V).
//
// Corre las TRANSFORMACIONES (nada muere en silencio: lo vencido se desliza,
// las promesas rotas se vuelven reparación + falta, las pausas vencidas
// despiertan) y materializa las tareas de las cadencias que vencen hoy.
// Idempotente: el índice único de paso-pendiente hace inofensivo repetirlo.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { generarPlan } from '../../../lib/crm/ti/motor';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  try {
    const res = await generarPlan();
    console.log('[ti-plan]', JSON.stringify(res));
    return json({ ok: true, ...res });
  } catch (e: any) {
    console.error('[ti-plan] ERROR', e?.message || e);
    return json({ error: String(e?.message || e) }, 500);
  }
};
