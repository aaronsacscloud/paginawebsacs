// POST /api/crm/arr/backfill-plan-ids — liga las suscripciones SIN plan_id al
// catálogo (matcheando su nombre_plan de texto libre al slug del plan). No pisa
// precio ni nombre_plan (respeta lo pactado); solo setea plan_id y, si faltaba,
// precio_lista. Idempotente. Reporta lo que no pudo matchear para revisión.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getPlans, matchPlan, precioLista } from '../../../../lib/crm/plan-catalog';

export const prerender = false;
function json(o: any, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async () => {
  try {
    const catalogo = await getPlans();
    if (!catalogo.length) return json({ error: 'Catálogo de planes vacío (¿existe la tabla plans?).' }, 500);

    const { data: subs, error } = await supabase.from('subscriptions')
      .select('id, nombre_plan, ciclo, plan_id, precio_lista').is('plan_id', null).limit(2000);
    if (error) throw error;

    let ligados = 0;
    const por_plan: Record<string, number> = {};
    const sin_match: string[] = [];
    for (const s of subs || []) {
      const plan = matchPlan(catalogo, s.nombre_plan);
      if (!plan) { sin_match.push(s.nombre_plan || '(vacío)'); continue; }
      const upd: any = { plan_id: plan.id };
      const pl = precioLista(plan, s.ciclo);
      if (pl != null && s.precio_lista == null) upd.precio_lista = pl;
      const { error: e2 } = await supabase.from('subscriptions').update(upd).eq('id', s.id);
      if (!e2) { ligados++; por_plan[plan.slug] = (por_plan[plan.slug] || 0) + 1; }
    }
    return json({ ok: true, total_sin_plan: (subs || []).length, ligados, sin_match_n: sin_match.length, por_plan, sin_match: [...new Set(sin_match)] });
  } catch (e: any) { return json({ error: e?.message || String(e) }, 500); }
};
