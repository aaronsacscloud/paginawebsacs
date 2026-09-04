// POR DESCALIFICAR · la cola con su contexto. GET. Las decisiones se aplican por /api/crm/ti/tarea (mismo
// camino que la Torre: rampa de descalificación y veredicto en un solo lugar).
import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { colaDescalificar, panelDescalificar } from '../../../../lib/crm/ti/descalificar';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const [cola, panel] = await Promise.all([colaDescalificar(40), panelDescalificar()]);
  return json({ cola, panel });
};
