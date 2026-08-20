// GET /api/cron/reglas-web — el latido de los disparadores por comportamiento.
//
// Cada 5 minutos revisa las visitas recientes contra las reglas activas. El
// correo no sale aquí: se inscribe a la persona en el embudo con su retraso, y
// el runner de embudos hace el resto.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { evaluar } from '../../../lib/email/reglas-web';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const inicio = Date.now();
  const av = await evaluar();
  return json({ ok: true, ...av, ms: Date.now() - inicio });
};
