// TRABAJO INTELIGENTE · EL PLANIFICADOR NOCTURNO (22:00 CDMX = 04:00 UTC). Revisa las conversaciones sin respuesta,
// decide el paso de la escalera y deja el mensaje programado para las 09:00 del día siguiente (lunes a sábado).
// ?contact_id= para un solo lead (pruebas). Ver lib/crm/ti/planificador.ts y sitio/FLUJO-FERNANDA.md.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { planificarNocturno } from '../../../lib/crm/ti/planificador';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  try {
    const r = await planificarNocturno({ max: Number(url.searchParams.get('max')) || 60, soloContactId: url.searchParams.get('contact_id') || undefined });
    console.log('[ti-planificador]', JSON.stringify(r));
    return json({ ok: true, ...r });
  } catch (e: any) {
    console.error('[ti-planificador] ERROR', e?.message || e);
    return json({ error: String(e?.message || e) }, 500);
  }
};
