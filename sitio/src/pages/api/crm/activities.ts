import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const contact_id = url.searchParams.get('contact_id');
  const company_id = url.searchParams.get('company_id');
  const deal_id = url.searchParams.get('deal_id');
  const tipo = url.searchParams.get('tipo');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let query = supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (contact_id) query = query.eq('contact_id', contact_id);
  if (company_id) query = query.eq('company_id', company_id);
  if (deal_id) query = query.eq('deal_id', deal_id);
  if (tipo) query = query.eq('tipo', tipo);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  const { data, error } = await supabase
    .from('activities')
    .insert({
      contact_id: body.contact_id || null,
      company_id: body.company_id || null,
      deal_id: body.deal_id || null,
      quote_id: body.quote_id || null,
      tipo: body.tipo,
      titulo: body.titulo || null,
      descripcion: body.descripcion || null,
      metadata: body.metadata || null,
      created_by: body.created_by || null,
      automatico: body.automatico || false,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Update last_contact_at on contact
  if (body.contact_id && ['nota', 'llamada', 'whatsapp_enviado', 'email_enviado'].includes(body.tipo)) {
    await supabase
      .from('contacts')
      .update({ last_contact_at: new Date().toISOString() })
      .eq('id', body.contact_id);
  }

  return new Response(JSON.stringify(data), { status: 201 });
};

// PUT { id, done } — palomear/despalomar una TAREA (metadata.done). Solo tipo 'tarea'.
export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const id = String(body.id || '').trim();
  if (!id) return new Response(JSON.stringify({ error: 'id requerido' }), { status: 400 });

  const { data: prev } = await supabase.from('activities').select('id, tipo, metadata').eq('id', id).maybeSingle();
  if (!prev) return new Response(JSON.stringify({ error: 'actividad no encontrada' }), { status: 404 });
  if (prev.tipo !== 'tarea') return new Response(JSON.stringify({ error: 'solo las tareas se pueden palomear' }), { status: 400 });

  const done = body.done === true;
  const metadata = { ...(prev.metadata || {}), done, done_at: done ? new Date().toISOString() : null };
  const { data, error } = await supabase.from('activities').update({ metadata }).eq('id', id).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};
