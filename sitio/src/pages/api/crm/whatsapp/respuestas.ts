// WHATSAPP · Respuestas rápidas: el "/" del composer.
//
// GET → { respuestas } · POST {atajo, texto, pasos?} crea/actualiza · DELETE {id}
// pasos = secuencia de varios mensajes con un clic (ver migration-2026-10-21-snippets-secuencia.sql).
// El atajo se guarda sin "/" y en minúsculas: "/gracias" y "/Gracias" son el mismo.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** Un paso de la secuencia, limpio, o null si le falta lo indispensable. */
function sanearPaso(p: any): any | null {
  const t = (v: any, max: number) => String(v ?? '').trim().slice(0, max);
  const url = (v: any) => { const u = t(v, 1024); return /^https:\/\//.test(u) ? u : ''; };
  switch (p?.tipo) {
    case 'texto': { const texto = t(p.texto, 4096); return texto ? { tipo: 'texto', texto } : null; }
    case 'documento': { const u = url(p.url); return u ? { tipo: 'documento', url: u, nombre: t(p.nombre, 120) || u.split('/').pop(), caption: t(p.caption, 1024) || undefined } : null; }
    case 'imagen': { const u = url(p.url); return u ? { tipo: 'imagen', url: u, caption: t(p.caption, 1024) || undefined } : null; }
    case 'acceso_prueba': {
      const texto = t(p.texto, 4096);
      return texto ? { tipo: 'acceso_prueba', dias: Math.max(1, Math.min(60, Number(p.dias) || 7)), texto } : null;
    }
    default: return null;
  }
}

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
  const fila: any = { atajo, texto };
  for (const k of ['titulo', 'categoria', 'header', 'footer', 'media_url', 'media_tipo']) if (k in b) fila[k] = b[k] ? String(b[k]).slice(0, 1024) : null;
  if ('botones' in b) fila.botones = Array.isArray(b.botones) ? b.botones.slice(0, 3) : null;
  // Secuencia (21-oct-2026): varios mensajes con un clic. Se guarda solo lo
  // que el composer sabe mandar; un paso a medias se descarta aquí y no a la
  // hora de enviar, con el cliente esperando.
  if ('pasos' in b) {
    if (!Array.isArray(b.pasos) || !b.pasos.length) fila.pasos = null;
    else {
      const pasos: any[] = b.pasos.slice(0, 15).map(sanearPaso);
      const malo = pasos.findIndex((p: any) => !p);
      if (malo >= 0) return json({ error: `El paso ${malo + 1} de la secuencia está incompleto` }, 400);
      if (pasos.filter((p: any) => p.tipo === 'acceso_prueba').length > 1) return json({ error: 'Solo puede haber un paso de acceso a la prueba' }, 400);
      fila.pasos = pasos;
    }
  }
  const { data, error } = await supabase.from('wa_respuestas')
    .upsert(fila, { onConflict: 'atajo' }).select('*').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, respuesta: data });
};

export const DELETE: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta id' }, 400);
  await supabase.from('wa_respuestas').delete().eq('id', b.id);
  return json({ ok: true });
};
