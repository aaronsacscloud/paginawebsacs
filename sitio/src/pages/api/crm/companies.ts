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
      // Campos personalizados capturados en el alta (giro de negocio, etc.):
      // si no viajan aquí, el cliente nace sin clasificar y clasificarlo
      // después es justo lo que nadie hace.
      ...(body.propiedades && typeof body.propiedades === 'object' ? { propiedades: body.propiedades } : {}),
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

  // ── El ARR sale de las LICENCIAS, no de este formulario ──
  // Esta fórmula legacy (precio_por_sucursal × sucursales) corría con solo
  // tocar el número de sucursales, y `precio_por_sucursal` está vacío en 281 de
  // 284 clientes: corregir "1 sucursal → 3" en la ficha ponía el MRR en CERO y
  // borraba el ARR real que traen las suscripciones. Le pasaba a Elena Boutique
  // ($17,550/año) con un solo clic.
  //
  // Ahora solo aplica cuando hay un precio por sucursal DE VERDAD; si no, no se
  // toca nada y manda `recalcCompany` (que suma el MRR de las licencias activas).
  const precioSuc = Number(updates.precio_por_sucursal ?? 0);
  if (precioSuc > 0 && (updates.precio_por_sucursal !== undefined || updates.sucursales !== undefined)) {
    const suc = Number(updates.sucursales ?? 1) || 1;
    updates.mrr = precioSuc * suc;
    updates.arr = precioSuc * suc * 12;
  } else {
    // Nunca dejar que el formulario escriba estos dos campos por su cuenta.
    delete updates.mrr; delete updates.arr;
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
