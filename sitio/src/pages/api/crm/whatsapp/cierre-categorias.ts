// WHATSAPP · Categorías de cierre (modal al resolver + Configuración WhatsApp).
//
// GET → { categorias } (activas; ?todas=1 incluye archivadas, para el admin)
// POST { nombre } crea · PUT { id, nombre?, orden?, activo? } edita/archiva/restaura
// DELETE { id } — solo archiva (activo=false): los cierres viejos siguen apuntando a ella.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const todas = url.searchParams.get('todas') === '1';
  let q = supabase.from('wa_cierre_categorias').select('id, nombre, orden, activo').order('orden');
  if (!todas) q = q.eq('activo', true);
  const { data } = await q;
  return json({ categorias: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const nombre = String(b.nombre || '').trim().slice(0, 80);
  if (!nombre) return json({ error: 'Falta el nombre del motivo' }, 400);
  const { data: max } = await supabase.from('wa_cierre_categorias').select('orden').order('orden', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from('wa_cierre_categorias')
    .upsert({ nombre, orden: (max?.orden || 0) + 1, activo: true }, { onConflict: 'nombre' })
    .select('*').single();
  if (error) return json({ error: error.message }, 500);
  return json({ categoria: data });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  const cambios: any = {};
  if ('nombre' in b) { const n = String(b.nombre || '').trim().slice(0, 80); if (!n) return json({ error: 'El nombre no puede quedar vacío' }, 400); cambios.nombre = n; }
  if ('orden' in b) cambios.orden = Number(b.orden) || 0;
  if ('activo' in b) cambios.activo = !!b.activo;
  const { error } = await supabase.from('wa_cierre_categorias').update(cambios).eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  const { error } = await supabase.from('wa_cierre_categorias').update({ activo: false }).eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
