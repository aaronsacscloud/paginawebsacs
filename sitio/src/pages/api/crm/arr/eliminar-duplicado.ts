// POST /api/crm/arr/eliminar-duplicado — elimina una empresa DUPLICADA sin
// generar churn: borra sus suscripciones y dependientes (pagos, add-ons,
// descuentos, movimientos MRR, comisiones) y archiva la empresa. Pensado para
// registros fantasma (sin datos reales); NO cancela (no registra churn_event),
// así el ARR se corrige sin ensuciar las métricas de retención.
// Body: { company_id, dry_run? }.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
function json(o: any, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }
// Borra best-effort (ignora si la tabla/columna no existe).
async function tryDel(tabla: string, col: string, valores: string[] | string) {
  try {
    const q = supabase.from(tabla).delete();
    const r = await (Array.isArray(valores) ? q.in(col, valores) : q.eq(col, valores)).select('id');
    return (r.data || []).length;
  } catch { return 0; }
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const companyId = body?.company_id;
  if (!companyId) return json({ error: 'company_id requerido' }, 400);
  try {
    const { data: company } = await supabase.from('companies').select('id, nombre, sacs_account').eq('id', companyId).maybeSingle();
    if (!company) return json({ error: 'empresa no encontrada' }, 404);

    const { data: subs } = await supabase.from('subscriptions').select('id').eq('company_id', companyId);
    const subIds = (subs || []).map((s: any) => s.id);

    const rep: any = { empresa: company.sacs_account || company.nombre, subs: subIds.length, pagos: 0, comisiones: 0 };

    if (subIds.length) {
      await tryDel('subscription_addons', 'subscription_id', subIds);
      await tryDel('discounts', 'subscription_id', subIds);
      await tryDel('mrr_movements', 'subscription_id', subIds);
      rep.comisiones += await tryDel('partner_commissions', 'subscription_id', subIds);
      rep.pagos += await tryDel('payments', 'subscription_id', subIds);
    }
    // Dependientes ligados solo por empresa
    rep.pagos += await tryDel('payments', 'company_id', companyId);
    rep.comisiones += await tryDel('partner_commissions', 'company_id', companyId);
    await tryDel('mrr_movements', 'company_id', companyId);
    await tryDel('churn_events', 'company_id', companyId);

    // Borrar las suscripciones (sin churn) y archivar la empresa
    let subErr: string | null = null;
    if (subIds.length) {
      const r = await supabase.from('subscriptions').delete().in('id', subIds);
      if (r.error) subErr = r.error.message;
    }
    if (subErr) return json({ error: 'No se pudieron borrar las suscripciones (¿FK pendiente?): ' + subErr, parcial: rep }, 500);

    await supabase.from('companies').update({ archived_at: new Date().toISOString() }).eq('id', companyId);
    return json({ ok: true, ...rep });
  } catch (e: any) { return json({ error: e?.message || String(e) }, 500); }
};
