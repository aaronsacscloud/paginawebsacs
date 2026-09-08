// Reportes de trabajo de una cuenta.
//
// GET  ?company_id=            → los reportes ya generados, con sus aperturas
// POST { company_id, desde, hasta, narrativa? }  → genera y GUARDA uno
//
// El POST guarda una FOTO de los hechos. Es la diferencia con el reporte que se
// ve en el CRM, que se calcula cada vez: la liga que el cliente recibe tiene que
// decir en diciembre lo mismo que decía en septiembre, o no se puede defender en
// una junta.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { reunirHechos } from '../../../lib/crm/reporte-hechos';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const companyId = String(url.searchParams.get('company_id') || '');
  if (!UUID.test(companyId)) return json({ error: 'Falta la cuenta.' }, 400);

  const { data, error } = await supabase.from('reportes_trabajo')
    .select('id, folio, desde, hasta, estado, enviado_at, enviado_a, vistas, primera_vista_at, ultima_vista_at, reaccion, reaccion_at, created_at, creado_por')
    .eq('company_id', companyId).order('created_at', { ascending: false }).limit(30);
  if (error) return json({ error: error.message }, 500);
  return json({ reportes: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);

  const b = await request.json().catch(() => ({} as any));
  const companyId = String(b?.company_id || '');
  const desde = String(b?.desde || '').slice(0, 10);
  const hasta = String(b?.hasta || '').slice(0, 10);
  if (!UUID.test(companyId) || !desde || !hasta) return json({ error: 'Falta el cliente o el periodo.' }, 400);
  if (desde > hasta) return json({ error: 'El periodo está al revés.' }, 400);

  const hechos = await reunirHechos(companyId, desde, hasta);
  if (!hechos) return json({ error: 'Ese cliente ya no existe.' }, 404);

  const { data, error } = await supabase.from('reportes_trabajo').insert({
    company_id: companyId, desde, hasta,
    hechos, narrativa: b?.narrativa || null,
    creado_por: (user as any)?.email || (user as any)?.nombre || null,
  }).select('id, folio').single();
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, id: data.id, folio: data.folio, hechos });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const id = String(url.searchParams.get('id') || '');
  if (!UUID.test(id)) return json({ error: 'Falta el reporte.' }, 400);
  const { error } = await supabase.from('reportes_trabajo').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
