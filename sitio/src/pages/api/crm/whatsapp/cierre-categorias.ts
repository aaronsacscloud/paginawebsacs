// WHATSAPP · Categorías de cierre (modal al resolver). GET → { categorias }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
export const prerender = false;
export const GET: APIRoute = async () => {
  const { data } = await supabase.from('wa_cierre_categorias').select('id, nombre').eq('activo', true).order('orden');
  return new Response(JSON.stringify({ categorias: data || [] }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
