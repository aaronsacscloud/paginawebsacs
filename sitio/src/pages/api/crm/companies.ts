import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const search = url.searchParams.get('search') || '';
  const estado = url.searchParams.get('estado_cuenta');

  let query = supabase
    .from('companies')
    .select('*, contacts(id, nombre, email, whatsapp, tipo, lifecycle_stage)', { count: 'exact' })
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (estado) query = query.eq('estado_cuenta', estado);
  if (search) query = query.or(`nombre.ilike.%${search}%,rfc.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ companies: data, total: count }));
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  const { data, error } = await supabase
    .from('companies')
    .insert({
      nombre: body.nombre,
      rfc: body.rfc || null,
      razon_social: body.razon_social || null,
      giro: body.giro || null,
      sitio_web: body.sitio_web || null,
      ciudad: body.ciudad || null,
      estado_geo: body.estado_geo || null,
      plan: body.plan || null,
      billing_period: body.billing_period || null,
      sucursales: body.sucursales || 1,
      precio_por_sucursal: body.precio_por_sucursal || null,
      mrr: body.mrr || 0,
      arr: body.arr || 0,
      metodo_pago: body.metodo_pago || null,
      fecha_inicio: body.fecha_inicio || null,
      fecha_renovacion: body.fecha_renovacion || null,
      estado_cuenta: body.estado_cuenta || 'prospecto',
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

  // Recalculate MRR/ARR if pricing fields change
  if (updates.precio_por_sucursal !== undefined || updates.sucursales !== undefined) {
    const precio = updates.precio_por_sucursal ?? 0;
    const suc = updates.sucursales ?? 1;
    updates.mrr = precio * suc;
    updates.arr = precio * suc * 12;
  }

  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data));
};
