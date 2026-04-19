import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, applyPartnerScope } from '../../../lib/auth/scope';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  const search = url.searchParams.get('search') || '';
  const tipo = url.searchParams.get('tipo');
  const lifecycle = url.searchParams.get('lifecycle_stage');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('contacts')
    .select('*, companies(id, nombre, plan, sucursales, estado_cuenta, mrr)', { count: 'exact' })
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tipo) query = query.eq('tipo', tipo);
  if (lifecycle) query = query.eq('lifecycle_stage', lifecycle);
  if (search) {
    query = query.or(`nombre.ilike.%${search}%,email.ilike.%${search}%,whatsapp.ilike.%${search}%`);
  }

  // Partner scope: only show contacts owned by the user (founder sees all)
  query = applyPartnerScope(query, user, 'owner_id');

  const { data, error, count } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ contacts: data, total: count }));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  // Create or find company if empresa provided
  let company_id = body.company_id || null;
  if (!company_id && body.empresa) {
    // Check if company exists
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('nombre', body.empresa)
      .limit(1)
      .single();

    if (existing) {
      company_id = existing.id;
    } else {
      const { data: newCo, error: coErr } = await supabase
        .from('companies')
        .insert({
          nombre: body.empresa,
          giro: body.giro || null,
          sucursales: body.sucursales_interes || 1,
        })
        .select('id')
        .single();
      if (coErr) return new Response(JSON.stringify({ error: coErr.message }), { status: 500 });
      company_id = newCo.id;
    }
  }

  // Determine lifecycle stage
  let lifecycle_stage = body.lifecycle_stage || 'lead';
  if (body.lead_score >= 40) lifecycle_stage = 'lead_calificado';

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      nombre: body.nombre,
      apellido: body.apellido || null,
      email: body.email || null,
      whatsapp: body.whatsapp || null,
      telefono: body.telefono || null,
      tipo: body.tipo || 'lead',
      lifecycle_stage,
      fuente: body.fuente || null,
      fuente_detalle: body.fuente_detalle || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      lead_score: body.lead_score || 0,
      total_time_on_site: body.total_time_on_site || 0,
      pages_visited: body.pages_visited || null,
      page_count: body.page_count || 0,
      visitor_id: body.visitor_id || null,
      company_id,
      puesto: body.puesto || null,
      plan_interes: body.plan_interes || null,
      giro: body.giro || null,
      sucursales_interes: body.sucursales_interes || null,
      stripe_customer_id: body.stripe_customer_id || null,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Log activity
  await supabase.from('activities').insert({
    contact_id: data.id,
    company_id,
    tipo: 'lead_created',
    titulo: `Nuevo contacto: ${body.nombre}`,
    metadata: { fuente: body.fuente, score: body.lead_score },
    automatico: true,
  });

  return new Response(JSON.stringify(data), { status: 201 });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data));
};
