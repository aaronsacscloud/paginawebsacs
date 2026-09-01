// TRABAJO INTELIGENTE · F2 — el cron del OBSERVADOR (cada 2 min, horario
// laboral). Respuestas de WhatsApp y vistas de cotización → P1 al frente;
// la cadencia del que respondió se retira sola. También corre al abrir el
// plan — este cron cubre cuando nadie tiene el panel abierto.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { observar } from '../../../lib/crm/ti/observador';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  try {
    const res = await observar();
    if (res.respuestas || res.vistas_cotizacion) console.log('[ti-observador]', JSON.stringify(res));
    return json({ ok: true, ...res });
  } catch (e: any) {
    console.error('[ti-observador] ERROR', e?.message || e);
    return json({ error: String(e?.message || e) }, 500);
  }
};
