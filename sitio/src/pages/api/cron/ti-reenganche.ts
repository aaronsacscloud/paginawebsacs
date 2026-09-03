// Cron horario: enrola al ciclo del agente las conversaciones donde escribimos al último y el lead calló ≥ 48 h.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { enrolarReenganche } from '../../../lib/crm/ti/reenganche';
export const prerender = false;
export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorizedCron(request)) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  const r = await enrolarReenganche({ limite: Number(url.searchParams.get('limite')) || 500 });
  return new Response(JSON.stringify({ ok: true, ...r }), { headers: { 'Content-Type': 'application/json' } });
};
