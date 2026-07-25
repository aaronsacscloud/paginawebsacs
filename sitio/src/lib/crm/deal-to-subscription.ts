// Al GANAR una oportunidad (deal), crear la SUSCRIPCIÓN — cierra la asimetría
// con el flujo de cotización aceptada (mark-accepted.ts): antes, ganar un deal
// solo actualizaba companies.mrr/arr pero NO creaba la sub.
//
// Idempotente: si la empresa ya tiene una sub viva (activa/programada/
// pendiente_pago/pausada) NO duplica. Nace 'programada' por defecto (aceptada,
// sin pagar); pasa a 'activa' al registrar el primer pago (register-payment).
// Best-effort — nunca debe romper el cierre del deal.
import { supabase } from '../supabase';
import { getPlans, matchPlan, precioLista, nombreCanonico } from './plan-catalog';

type DealLike = {
  company_id?: string | null;
  contact_id?: string | null;
  plan?: string | null;
  sucursales?: number | null;
  billing_period?: string | null;   // 'mensual' | 'anual' | 'unico'
  valor_mensual?: number | null;    // = MRR
  valor_total?: number | null;
  quote_id?: string | null;
  referrer_partner_id?: string | null;
};

export async function ensureSubscriptionFromDeal(
  deal: DealLike,
  opts: { estado?: 'programada' | 'activa' } = {},
): Promise<{ created: boolean; reason?: string; subscription_id?: string }> {
  const estado = opts.estado || 'programada';
  if (!deal?.company_id) return { created: false, reason: 'sin_company' };

  // Pago único → no genera suscripción recurrente.
  if (deal.billing_period === 'unico') return { created: false, reason: 'pago_unico' };

  // Ya hay sub viva → no duplicar.
  const { data: subViva } = await supabase.from('subscriptions').select('id')
    .eq('company_id', deal.company_id)
    .in('estado', ['activa', 'programada', 'pendiente_pago', 'pausada'])
    .limit(1).maybeSingle();
  if (subViva) return { created: false, reason: 'ya_tiene_sub', subscription_id: subViva.id };

  const ciclo = deal.billing_period === 'anual' ? 'anual' : 'mensual';
  const mrr = Number(deal.valor_mensual || 0);
  const precio = ciclo === 'anual' ? Math.round(Number(deal.valor_total || mrr * 12)) : Math.round(mrr);
  if (precio <= 0) return { created: false, reason: 'sin_precio' };

  // Match del plan del deal contra el catálogo (por slug/nombre).
  const catalogo = await getPlans().catch(() => []);
  const planCat = matchPlan(catalogo, deal.plan || undefined);
  const nombrePlan = (planCat ? nombreCanonico(planCat, ciclo) : String(deal.plan || 'Licencia SACS')).slice(0, 160);
  const hoy = new Date().toISOString().slice(0, 10);

  const nuevaSub: any = {
    company_id: deal.company_id, contact_id: deal.contact_id || null,
    nombre_plan: nombrePlan, ciclo, estado, precio,
    mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100,
    fecha_inicio: hoy, proxima_factura: hoy, monto_proximo: precio,
    ...(planCat ? { plan_id: planCat.id, precio_lista: precioLista(planCat, ciclo) } : {}),
    ...(deal.referrer_partner_id ? { partner_id: deal.referrer_partner_id } : {}),
    ...(deal.quote_id ? { quote_id: deal.quote_id } : {}),
  };

  // quote_id/plan_id/precio_lista pueden faltar si el SQL no aplicó aún.
  let ins = await supabase.from('subscriptions').insert(nuevaSub).select('id').maybeSingle();
  if (ins.error && /quote_id|plan_id|precio_lista|column|schema cache/i.test(ins.error.message || '')) {
    const { quote_id, plan_id, precio_lista, ...base } = nuevaSub;
    ins = await supabase.from('subscriptions').insert(base).select('id').maybeSingle();
  }
  if (ins.error) return { created: false, reason: ins.error.message };
  return { created: true, subscription_id: ins.data?.id };
}
