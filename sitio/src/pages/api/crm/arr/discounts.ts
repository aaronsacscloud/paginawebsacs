// /api/crm/arr/discounts — cupones/descuentos con vigencia sobre una sub.
// GET ?subscription_id · POST agrega · DELETE ?id (desactiva).
// El descuento reduce lo que se COBRA (monto_proximo), no la ARR de lista —
// es una promo temporal, no un cambio de contrato. Tolerante a SQL-5.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { recalcMontoProximo } from '../../../../lib/crm/effective-price';

export const prerender = false;

const sinTabla = (msg: string) => /relation .* does not exist|could not find|schema cache/i.test(msg || '');

export const GET: APIRoute = async ({ url }) => {
  const subId = url.searchParams.get('subscription_id');
  if (!subId) return new Response(JSON.stringify({ error: 'subscription_id requerido' }), { status: 400 });
  const { data, error } = await supabase.from('discounts')
    .select('*').eq('subscription_id', subId).eq('activo', true).order('created_at', { ascending: true });
  if (error) return new Response(JSON.stringify({ data: [], sin_tabla: sinTabla(error.message) }), { status: 200 });
  return new Response(JSON.stringify({ data: data || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => null);
  const valor = Number(b?.valor);
  if (!b?.subscription_id || !(valor > 0)) return new Response(JSON.stringify({ error: 'subscription_id y valor > 0 requeridos' }), { status: 400 });
  const tipo = b.tipo === 'monto' ? 'monto' : 'porcentaje';
  const { data: sub } = await supabase.from('subscriptions').select('company_id').eq('id', b.subscription_id).maybeSingle();
  const { data, error } = await supabase.from('discounts').insert({
    subscription_id: b.subscription_id, company_id: sub?.company_id || null,
    tipo, valor, motivo: b.motivo || null, vigente_hasta: b.vigente_hasta || null,
  }).select().single();
  if (error) return new Response(JSON.stringify({ error: sinTabla(error.message) ? 'Falta aplicar SQL-5 (tabla discounts)' : error.message }), { status: 500 });
  const monto_proximo = await recalcMontoProximo(b.subscription_id);
  return new Response(JSON.stringify({ data, monto_proximo }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id requerido' }), { status: 400 });
  const { data: prev } = await supabase.from('discounts').select('subscription_id').eq('id', id).maybeSingle();
  const { error } = await supabase.from('discounts').update({ activo: false }).eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const monto_proximo = prev?.subscription_id ? await recalcMontoProximo(prev.subscription_id) : null;
  return new Response(JSON.stringify({ ok: true, monto_proximo }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
