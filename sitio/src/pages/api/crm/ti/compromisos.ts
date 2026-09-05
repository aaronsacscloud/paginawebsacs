// PROGRAMADOS · compromisos con fecha que pidió el prospecto. GET: próximos + historial. POST { id, accion: mover|cancelar|ahora|fijar_hora, fecha?, hora?, nota? }
import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { panelCompromisos, decidirCompromiso } from '../../../../lib/crm/ti/compromisos';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  return json(await panelCompromisos());
};
export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!b.id || !['mover', 'cancelar', 'ahora', 'fijar_hora'].includes(b.accion)) return json({ error: 'Falta id o acción' }, 400);
  const r = await decidirCompromiso(String(b.id), { accion: b.accion, fecha: b.fecha, hora: b.hora != null ? Number(b.hora) : undefined, nota: b.nota, userId: user.id });
  return json(r?.error ? r : { ...r, ...(await panelCompromisos()) }, r?.error ? 400 : 200);
};
