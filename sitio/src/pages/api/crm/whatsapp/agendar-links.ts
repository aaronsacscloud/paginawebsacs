// WHATSAPP · Tipos de reunión activos para mandar el link de agenda desde el chat.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
export const prerender = false;
export const GET: APIRoute = async () => {
  const { data } = await supabase.from('event_types').select('slug, nombre, duracion_minutos, owner_id').eq('activo', true).order('nombre');
  const ids = [...new Set((data || []).map((t: any) => t.owner_id).filter(Boolean))];
  const { data: hosts } = ids.length ? await supabase.from('team_members').select('id, nombre').in('id', ids) : { data: [] as any[] };
  const tipos = (data || []).map((t: any) => ({ slug: t.slug, nombre: t.nombre, duracion: t.duracion_minutos || null, host: (hosts || []).find((h: any) => h.id === t.owner_id)?.nombre || null }));
  return new Response(JSON.stringify({ tipos }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
