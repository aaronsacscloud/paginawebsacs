// GET /api/cron/senales — mantiene vivos los puntajes de intención.
//
// Corre cada hora. Sin esto el puntaje solo se actualiza cuando alguien abre
// la ficha, y entonces las listas ordenadas por intención mienten justo cuando
// se usan para decidir a quién llamar.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { recalcularIntenciones } from '../../../lib/email/senales';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const inicio = Date.now();
  const cambiados = await recalcularIntenciones(500);
  return json({ ok: true, cambiados, ms: Date.now() - inicio });
};
