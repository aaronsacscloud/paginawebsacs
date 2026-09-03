// Lote diario de reactivación (9:30 CDMX, entre semana): redacta el primer contacto de hasta 15 leads viejos.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { generarLoteReactivacion, sincronizarReactivaciones } from '../../../lib/crm/ti/reactivacion';
export const prerender = false;
export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorizedCron(request)) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  await sincronizarReactivaciones().catch(() => {});
  const n = Math.min(Number(url.searchParams.get('n')) || 15, 15);
  const r = await generarLoteReactivacion(n);
  return new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json' } });
};
