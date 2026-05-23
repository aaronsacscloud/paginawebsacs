// Lista mínima de partners (id + nombre) para mostrar autoría de cotizaciones
// en el admin CRM (RevenueHub).

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data, error } = await supabase
    .from('team_members')
    .select('id, nombre, email')
    .eq('rol', 'partner')
    .order('nombre');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data || []), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
