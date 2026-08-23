// WHATSAPP · El equipo asignable del inbox.
//
// GET → { equipo: [{id, nombre, foto_url}] }
//
// Existe porque /api/crm/usuarios es founder-only y el selector "Asignar a"
// lo necesita también un CS. Aquí solo se exponen datos de cara interna
// (nombre y foto), nada de permisos ni correos.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data } = await supabase.from('team_members')
    .select('id, nombre, email, foto_url, rol')
    .eq('activo', true).in('rol', ['founder', 'cs'])
    .order('nombre');
  const equipo = (data || []).map(m => ({
    id: m.id, nombre: m.nombre || m.email?.split('@')[0] || 'Sin nombre', foto_url: m.foto_url || null,
  }));
  return new Response(JSON.stringify({ equipo }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
