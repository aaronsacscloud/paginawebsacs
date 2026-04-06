import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const clientId = url.searchParams.get('client_id') || '';

  let query = supabase.from('payments').select('*, clients(empresa, contacto)').order('fecha', { ascending: false });

  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  // Insert payment
  const { data, error } = await supabase.from('payments').insert({
    client_id: body.client_id,
    fecha: body.fecha,
    monto: body.monto,
    metodo: body.metodo,
    referencia: body.referencia,
  }).select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Update client's next renewal date
  if (body.client_id) {
    const { data: client } = await supabase.from('clients').select('fecha_renovacion, precio_mensual').eq('id', body.client_id).single();
    if (client) {
      const currentDate = new Date(body.fecha);
      // If annual payment (monto >= 10x monthly), add 12 months. Otherwise add 1 month.
      const isAnnual = body.monto >= (client.precio_mensual || 0) * 10;
      const months = isAnnual ? 12 : 1;
      currentDate.setMonth(currentDate.getMonth() + months);
      await supabase.from('clients').update({
        fecha_renovacion: currentDate.toISOString().slice(0, 10),
        estado: 'activo',
      }).eq('id', body.client_id);
    }
  }

  return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } });
};
