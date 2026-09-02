// TRABAJO INTELIGENTE · A0 — la bitácora: sincroniza eventos y recalcula
// perfiles. El observador ya lo hace incremental cada 2 min; este endpoint
// existe para el BACKFILL (?dias=90) y para reparar una fuente a mano
// (?fuentes=whatsapp,correo). También ?perfiles=todos rehace todos los
// perfiles de leads con eventos.
import type { APIRoute } from 'astro';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { supabase } from '../../../lib/supabase';
import { sincronizarEventos, desdeDias } from '../../../lib/crm/ti/eventos';
import { recalcularPerfiles } from '../../../lib/crm/ti/perfil';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  const u = new URL(request.url);
  const dias = Number(u.searchParams.get('dias')) || 0;
  const fuentes = (u.searchParams.get('fuentes') || '').split(',').map(s => s.trim()).filter(Boolean);
  try {
    const t0 = Date.now();
    const res = await sincronizarEventos({ desde: dias ? desdeDias(dias) : undefined, fuentes });
    let ids: string[] = res.tocados;
    if (u.searchParams.get('perfiles') === 'todos') {
      const { data } = await supabase.from('ti_eventos').select('contact_id').not('contact_id', 'is', null).limit(20000);
      ids = [...new Set((data || []).map((x: any) => x.contact_id as string))];
    }
    const per = await recalcularPerfiles(ids);
    const { tocados, ...resto } = res;
    console.log('[ti-eventos]', JSON.stringify({ ...resto, contactos: ids.length, ...per, ms: Date.now() - t0 }));
    return json({ ok: true, ...resto, contactos: ids.length, ...per, ms: Date.now() - t0 });
  } catch (e: any) {
    console.error('[ti-eventos] ERROR', e?.message || e);
    return json({ error: String(e?.message || e) }, 500);
  }
};
