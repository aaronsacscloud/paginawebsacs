// /api/crm/arr/goals — GET metas · POST upsert meta {tipo, anio, mes?, monto}.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data, error } = await supabase.from('crm_goals').select('*').order('anio').order('mes', { nullsFirst: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const tipo = body?.tipo === 'new_arr_mensual' ? 'new_arr_mensual' : 'arr';
  const anio = Number(body?.anio);
  const mes = body?.mes != null ? Number(body.mes) : null;
  const monto = Number(body?.monto);
  if (!anio || !isFinite(monto) || monto < 0) return new Response(JSON.stringify({ error: 'anio y monto requeridos' }), { status: 400 });

  let q = supabase.from('crm_goals').select('id').eq('tipo', tipo).eq('anio', anio);
  q = mes == null ? q.is('mes', null) : q.eq('mes', mes);
  const { data: exist } = await q.maybeSingle();
  const res = exist
    ? await supabase.from('crm_goals').update({ monto }).eq('id', exist.id).select().single()
    : await supabase.from('crm_goals').insert({ tipo, anio, mes, monto }).select().single();
  if (res.error) return new Response(JSON.stringify({ error: res.error.message }), { status: 500 });
  return new Response(JSON.stringify({ data: res.data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
