// Mejoras e ideas de una cuenta.
//
// GET    ?company_id=…            → lista (ideas y entregadas juntas)
// POST   {company_id, titulo, …}  → crea
// PUT    {id, …}                  → actualiza
// DELETE {id}                     → archiva (no borra)
//
// Es UNA sola lista con estados, no dos tablas. La idea que salió en la junta
// de agosto es la mejora entregada de octubre: son el mismo renglón en dos
// momentos. Separarlas obligaría a copiar a mano al aprobarse y se perdería el
// hilo —de qué junta salió, en qué cotización se cobró, cuándo se entregó—, que
// es justo lo que se le enseña al cliente.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const ESTADOS_MEJORA = ['idea', 'cotizada', 'en_proceso', 'entregada', 'descartada'] as const;
const CATEGORIAS = ['personalizacion', 'ajuste', 'modulo', 'capacitacion', 'otro'];

// Campos que el cliente puede mandar. Lista blanca a propósito: un update con
// company_id o created_at colados movería el renglón de cuenta o falsearía su
// antigüedad.
function limpia(b: any) {
  const p: any = {};
  if (typeof b?.titulo === 'string') p.titulo = b.titulo.trim().slice(0, 200);
  if (typeof b?.descripcion === 'string') p.descripcion = b.descripcion.trim() || null;
  if (ESTADOS_MEJORA.includes(b?.estado)) p.estado = b.estado;
  if (CATEGORIAS.includes(b?.categoria)) p.categoria = b.categoria;
  if (b?.valor !== undefined) p.valor = Math.max(0, Number(b.valor) || 0);
  if (b?.cortesia !== undefined) p.cortesia = !!b.cortesia;
  if (b?.visible_cliente !== undefined) p.visible_cliente = !!b.visible_cliente;
  if ('booking_id' in b) p.booking_id = b.booking_id || null;
  if ('quote_id' in b) p.quote_id = b.quote_id || null;
  if ('deal_id' in b) p.deal_id = b.deal_id || null;
  if ('modulo' in b) p.modulo = String(b.modulo || '').trim() || null;
  if ('fecha_entrega' in b) p.fecha_entrega = b.fecha_entrega || null;
  if ('fecha_compromiso' in b) p.fecha_compromiso = b.fecha_compromiso || null;
  return p;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const companyId = url.searchParams.get('company_id') || '';
  if (!companyId) return json({ error: 'Falta el cliente.' }, 400);

  const { data, error } = await supabase.from('mejoras')
    .select('*, bookings(id, fecha, asunto, event_types(nombre, categoria)), quotes(id, numero, estado, total)')
    .eq('company_id', companyId).is('archived_at', null)
    .order('fecha_entrega', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ data: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const companyId = String(b?.company_id || '');
  const p = limpia(b);
  if (!companyId || !p.titulo) return json({ error: 'Falta el cliente o el título.' }, 400);

  // Entregada sin fecha no sirve para nada: el reporte por periodo se arma con
  // esa fecha y sin ella la mejora no aparece en ningún rango.
  if (p.estado === 'entregada' && !p.fecha_entrega) p.fecha_entrega = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.from('mejoras')
    .insert({ ...p, company_id: companyId, creado_por: user.nombre || user.email || 'CRM' })
    .select('*').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, data }, 201);
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  if (!id) return json({ error: 'Falta la mejora.' }, 400);
  const p = limpia(b);
  if (p.estado === 'entregada' && !p.fecha_entrega) {
    const { data: act } = await supabase.from('mejoras').select('fecha_entrega').eq('id', id).maybeSingle();
    if (!act?.fecha_entrega) p.fecha_entrega = new Date().toISOString().slice(0, 10);
  }
  p.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('mejoras').update(p).eq('id', id).select('*').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, data });
};

// Archiva, no borra: una mejora que ya se le presentó al cliente en un resumen
// no puede desaparecer del historial porque alguien se arrepintió.
export const DELETE: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  if (!id) return json({ error: 'Falta la mejora.' }, 400);
  const { error } = await supabase.from('mejoras').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
