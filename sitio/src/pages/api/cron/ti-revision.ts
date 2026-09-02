// Cron: Revisión diaria del agente (08:00 CDMX = 14:00 UTC). También a mano con el secreto (?horas=48 para reponer).
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { revisionDiaria } from '../../../lib/crm/ti/revision';
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const horas = Number(url.searchParams.get('horas')) || 26;
  const r = await revisionDiaria({ horas });
  return json({ ok: true, ...r });
};
