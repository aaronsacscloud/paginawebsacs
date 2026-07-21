// POST /api/crm/arr/retencion — el "save" antes de perder un cliente: aplica un
// descuento temporal (default 20% × 3 meses) a la suscripción y registra que se
// RETUVO (para medir el save-rate por razón). Funciona igual para subs manuales
// y Stripe (usa nuestro modelo de descuentos, no el cupón de Stripe).
// Body: { subscription_id, reason, pct?=20, meses?=3, motivo? }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { recalcMontoProximo } from '../../../../lib/crm/effective-price';

export const prerender = false;

const sinTabla = (m: string) => /relation .* does not exist|could not find|schema cache/i.test(m || '');

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => null);
  if (!b?.subscription_id) return new Response(JSON.stringify({ error: 'subscription_id requerido' }), { status: 400 });
  const pct = Number(b.pct) > 0 ? Number(b.pct) : 20;
  const meses = Number(b.meses) > 0 ? Number(b.meses) : 3;

  const { data: sub } = await supabase.from('subscriptions').select('id, company_id, contact_id, nombre_plan').eq('id', b.subscription_id).maybeSingle();
  if (!sub) return new Response(JSON.stringify({ error: 'suscripción no encontrada' }), { status: 404 });

  const hasta = (() => { const d = new Date(); d.setMonth(d.getMonth() + meses); return d.toISOString().slice(0, 10); })();

  // 1 · aplicar el descuento de retención
  const { error: dErr } = await supabase.from('discounts').insert({
    subscription_id: sub.id, company_id: sub.company_id,
    tipo: 'porcentaje', valor: pct, motivo: b.motivo || `retención (${b.reason || 'sin razón'})`, vigente_hasta: hasta,
  });
  if (dErr) return new Response(JSON.stringify({ error: sinTabla(dErr.message) ? 'Falta aplicar SQL-5 (tabla discounts)' : dErr.message }), { status: 500 });
  const monto_proximo = await recalcMontoProximo(sub.id);

  // 2 · registrar el "save" (para el save-rate del tablero de Inteligencia)
  await supabase.from('activities').insert({
    tipo: 'sistema', company_id: sub.company_id, contact_id: sub.contact_id, automatico: false,
    titulo: `💚 Cliente retenido: ${pct}% off ${meses} meses — ${sub.nombre_plan}` + (b.reason ? ` (iba a irse por: ${b.reason})` : ''),
    metadata: { retencion: 'aceptada', reason: b.reason || null, pct, meses, subscription_id: sub.id },
  }).select().maybeSingle();

  return new Response(JSON.stringify({ ok: true, monto_proximo, vigente_hasta: hasta }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
