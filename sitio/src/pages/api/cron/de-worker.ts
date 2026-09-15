// GET /api/cron/de-worker — el latido de la cola del motor de demanda.
//
// Cada 5 minutos: toma trabajo, lo ejecuta y se detiene antes de que Vercel lo
// corte. Lo que no alcanzó vuelve a la cola; nada se pierde por un despliegue.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { correrWorker } from '../../../lib/demanda/worker';
import '../../../lib/demanda/handlers';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const limite = Math.min(Number(url.searchParams.get('ms')) || 230_000, 280_000);
  const lote = Math.min(Number(url.searchParams.get('lote')) || 4, 20);
  try {
    const r = await correrWorker(limite, lote);
    return json({ ok: true, ...r });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
};
