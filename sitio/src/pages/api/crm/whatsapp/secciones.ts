// WHATSAPP · Secciones (grupos) de vistas del sidebar.
// GET → { secciones } · POST {id?, emoji, nombre, descripcion} · DELETE {id}
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async () => {
  const { data } = await supabase.from('wa_inbox_secciones').select('*').order('orden').order('created_at');
  return json({ secciones: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const nombre = String(b.nombre || '').trim();
  if (!nombre) return json({ error: 'Falta el nombre' }, 400);
  const fila = { emoji: String(b.emoji || '📁').slice(0, 8), nombre: nombre.slice(0, 60), descripcion: b.descripcion || null };
  const q = b.id
    ? supabase.from('wa_inbox_secciones').update(fila).eq('id', b.id).select('*').single()
    : supabase.from('wa_inbox_secciones').insert(fila).select('*').single();
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, seccion: data });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  await supabase.from('wa_inbox_secciones').delete().eq('id', b.id);
  return json({ ok: true });
};
