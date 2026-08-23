// GET /api/cron/leads-conocidos — saca de la lista de leads a quien ya es
// cliente o ya lo fue. Corre en la madrugada, después del análisis de cuentas.
//
// El alta de un lead ya lo resuelve al vuelo; esto es la red por si un lead
// entró ANTES de que su empresa se volviera cliente, que es exactamente como se
// colaron los tres que llevaban meses ahí.
//
// `?dry_run=1` para ver qué haría sin tocar nada.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { resolverLeadsConocidos } from '../../../lib/crm/resolver-conocidos';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url, request }) => {
  if (!isAuthorizedCron(request)) return new Response('Forbidden', { status: 403 });
  const inicio = Date.now();
  try {
    const r = await resolverLeadsConocidos({ dryRun: url.searchParams.get('dry_run') === '1' });
    return json({ ok: true, ...r, ms: Date.now() - inicio });
  } catch (e: any) {
    return json({ error: e?.message || 'falló el barrido' }, 500);
  }
};
