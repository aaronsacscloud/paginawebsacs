import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { clients } = await request.json();

    if (!Array.isArray(clients) || clients.length === 0) {
      return new Response(JSON.stringify({ error: 'No clients to import' }), { status: 400 });
    }

    const rows = clients.map((c: any) => ({
      empresa: c.empresa || c.Empresa || '',
      contacto: c.contacto || c.Contacto || c.nombre || c.Nombre || '',
      email: c.email || c.Email || '',
      whatsapp: c.whatsapp || c.WhatsApp || c.telefono || c.Telefono || '',
      plan: c.plan || c.Plan || '',
      sucursales: parseInt(c.sucursales || c.Sucursales || '1') || 1,
      precio_mensual: parseFloat(c.precio_mensual || c.Precio || c.precio || '0') || 0,
      metodo_pago: c.metodo_pago || c.Metodo || 'transferencia',
      fecha_inicio: c.fecha_inicio || c.Inicio || null,
      fecha_renovacion: c.fecha_renovacion || c.Renovacion || c.renovacion || null,
      estado: c.estado || c.Estado || 'activo',
      notas: c.notas || c.Notas || '',
    }));

    const { data, error } = await supabase.from('clients').insert(rows).select();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    return new Response(JSON.stringify({ imported: data?.length || 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
