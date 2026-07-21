// /api/crm/arr/addons — líneas extra de una suscripción (sucursal extra,
// soporte premium, plugin VIP…). GET ?subscription_id · POST agrega · DELETE ?id.
// Cada add-on suma al MRR de la company (recalcCompany ya los prorratea).
// Tolerante: si SQL-5 no está aplicado, responde vacío / mensaje claro.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { recalcMontoProximo } from '../../../../lib/crm/effective-price';

export const prerender = false;

const sinTabla = (msg: string) => /relation .* does not exist|could not find|schema cache/i.test(msg || '');

export const GET: APIRoute = async ({ url }) => {
  const subId = url.searchParams.get('subscription_id');
  if (!subId) return new Response(JSON.stringify({ error: 'subscription_id requerido' }), { status: 400 });
  const { data, error } = await supabase.from('subscription_addons')
    .select('*').eq('subscription_id', subId).eq('activo', true).order('created_at', { ascending: true });
  if (error) return new Response(JSON.stringify({ data: [], sin_tabla: sinTabla(error.message) }), { status: 200 });
  return new Response(JSON.stringify({ data: data || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => null);
  if (!b?.subscription_id || !b?.nombre || !(Number(b.precio) >= 0)) {
    return new Response(JSON.stringify({ error: 'subscription_id, nombre y precio requeridos' }), { status: 400 });
  }
  const { data: sub } = await supabase.from('subscriptions').select('company_id').eq('id', b.subscription_id).maybeSingle();
  const { data, error } = await supabase.from('subscription_addons').insert({
    subscription_id: b.subscription_id, company_id: sub?.company_id || null,
    nombre: String(b.nombre).slice(0, 120), precio: Number(b.precio), cantidad: Number(b.cantidad) || 1,
  }).select().single();
  if (error) return new Response(JSON.stringify({ error: sinTabla(error.message) ? 'Falta aplicar SQL-5 (tabla subscription_addons)' : error.message }), { status: 500 });
  const monto_proximo = await recalcMontoProximo(b.subscription_id);
  return new Response(JSON.stringify({ data, monto_proximo }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id requerido' }), { status: 400 });
  const { data: prev } = await supabase.from('subscription_addons').select('subscription_id').eq('id', id).maybeSingle();
  const { error } = await supabase.from('subscription_addons').update({ activo: false }).eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const monto_proximo = prev?.subscription_id ? await recalcMontoProximo(prev.subscription_id) : null;
  return new Response(JSON.stringify({ ok: true, monto_proximo }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
