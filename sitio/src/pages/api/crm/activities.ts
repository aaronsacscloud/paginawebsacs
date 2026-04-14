import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const contact_id = url.searchParams.get('contact_id');
  const company_id = url.searchParams.get('company_id');
  const deal_id = url.searchParams.get('deal_id');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let query = supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (contact_id) query = query.eq('contact_id', contact_id);
  if (company_id) query = query.eq('company_id', company_id);
  if (deal_id) query = query.eq('deal_id', deal_id);

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
