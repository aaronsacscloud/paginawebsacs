// GET /api/cron/email-embudos — el latido de los embudos (cada 5 min).
//
// Dos trabajos: inscribir a quien acaba de calificar (siempre desde el cursor,
// nunca hacia atrás) y avanzar a quien ya tiene un paso vencido.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { resolverTenant } from '../../../lib/email/tenant';
import { inscribirPendientes, procesarInscripciones } from '../../../lib/email/embudos';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const seco = url.searchParams.get('dry') === '1';

  const { data: activos } = await supabase.from('automations')
    .select('*').eq('estado', 'activo').is('archived_at', null).limit(50);

  const inscritos: any[] = [];
  for (const a of activos || []) {
    const t = await resolverTenant(a.tenant_id);
    if (!t) continue;
    if (seco) { inscritos.push({ embudo: a.nombre, seco: true }); continue; }
    const n = await inscribirPendientes(t, a);
    if (n) inscritos.push({ embudo: a.nombre, nuevos: n });
  }

  const avance = seco ? null : await procesarInscripciones(200_000);
  return json({ ok: true, embudos_activos: (activos || []).length, inscritos, avance });
};
