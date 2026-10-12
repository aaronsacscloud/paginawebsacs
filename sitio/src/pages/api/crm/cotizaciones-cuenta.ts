// Las cotizaciones de UNA cuenta, con lo abonado: para ligar «lo autorizado»
// de una minuta de consultoría a su cotización y saber si ya está pagada.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const companyId = String(url.searchParams.get('company_id') || '');
  if (!UUID.test(companyId)) return json({ error: 'Falta la cuenta.' }, 400);
  const { data: qs, error } = await supabase.from('quotes')
    .select('id, numero, total, estado, created_at').eq('company_id', companyId)
    .not('estado', 'in', '(rejected,archived)').order('created_at', { ascending: false }).limit(60);
  if (error) return json({ error: error.message }, 500);
  const ids = (qs || []).map(q => q.id);
  const abonado: Record<string, number> = {};
  if (ids.length) {
    const { data: ps } = await supabase.from('payments').select('quote_id, monto, estado').in('quote_id', ids);
    for (const p of ps || []) if (!['anulado', 'cancelado', 'duplicado', 'reembolsado'].includes(String(p.estado || '').toLowerCase()))
      abonado[p.quote_id] = (abonado[p.quote_id] || 0) + Number(p.monto || 0);
  }
  return json({ cotizaciones: (qs || []).map(q => ({ ...q, abonado: abonado[q.id] || 0 })) });
};
