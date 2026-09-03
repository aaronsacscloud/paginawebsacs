import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { colaTorre } from '../../../../lib/crm/ti/torre';
export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  try { return json(await colaTorre()); } catch (e: any) { return json({ error: e?.message || String(e) }, 500); }
};
