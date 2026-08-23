// WHATSAPP · Respuestas rápidas: el "/" del composer.
//
// GET → { respuestas } · POST {atajo, texto} crea/actualiza · DELETE {id}
// El atajo se guarda sin "/" y en minúsculas: "/gracias" y "/Gracias" son el mismo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async () => {
  const { data } = await supabase.from('wa_respuestas').select('*').order('atajo');
  return json({ respuestas: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  // Contador de uso (chip "Popular" del composer): fire-and-forget del front.
  if (b.uso) {
    const { data } = await supabase.from('wa_respuestas').select('usage_count').eq('id', b.uso).maybeSingle();
    await supabase.from('wa_respuestas').update({ usage_count: (data?.usage_count || 0) + 1 }).eq('id', b.uso);
    return json({ ok: true });
  }
  const atajo = String(b.atajo || '').trim().toLowerCase().replace(/^\//, '').replace(/[^a-z0-9_-]/g, '');
  const texto = String(b.texto || '').trim();
  if (!atajo || !texto) return json({ error: 'Faltan atajo y texto' }, 400);
  const { data, error } = await supabase.from('wa_respuestas')
    .upsert({ atajo, texto }, { onConflict: 'atajo' }).select('*').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, respuesta: data });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  await supabase.from('wa_respuestas').delete().eq('id', b.id);
  return json({ ok: true });
};
