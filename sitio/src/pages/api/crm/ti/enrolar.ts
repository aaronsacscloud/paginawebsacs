// TRABAJO INTELIGENTE · Enrolar un lead a la cadencia humana a mano.
// POST { contact_id } — lo usa el arranque (aprobación de lotes) y el QA.
// El enrolamiento AUTOMÁTICO de leads nuevos se enciende con el switch
// `arranque_desde` de ti_config; mientras sea null, solo se entra por aquí.
import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { enrolar, generarPlan } from '../../../../lib/crm/ti/motor';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!b.contact_id) return json({ error: 'Falta contact_id' }, 400);
  const r = await enrolar(String(b.contact_id), { paso: b.paso });
  if ((r as any).error) return json(r, 400);
  // Genera de una vez: así el lead recién enrolado aparece en el plan sin
  // esperar al cron de la mañana.
  const plan = b.generar === false ? null : await generarPlan();
  return json({ ok: true, plan });
};
