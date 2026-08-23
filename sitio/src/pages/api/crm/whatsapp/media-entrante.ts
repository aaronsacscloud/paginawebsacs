// WHATSAPP · Proxy de media ENTRANTE.
// GET ?id=<media_id de Meta> → el binario (imagen, audio, PDF…).
// El id solo se puede canjear con la API key de Kapso y la URL resultante
// también la exige: el navegador no puede abrirla. Este endpoint la baja en el
// servidor y la sirve; `?dl=1` fuerza descarga con el nombre original.
// Protegido por el middleware del CRM (cookie) como todo /api/crm/whatsapp/*.
import type { APIRoute } from 'astro';
import { descargarMedia, KapsoError } from '../../../../lib/whatsapp/kapso-api';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const id = (url.searchParams.get('id') || '').trim();
  if (!/^[\w.-]{3,120}$/.test(id)) return new Response('id inválido', { status: 400 });
  try {
    const m = await descargarMedia(id);
    if (!m) return new Response('Media no disponible (Meta la borra a los 30 días)', { status: 404 });
    const headers: Record<string, string> = {
      'Content-Type': m.mime,
      'Cache-Control': 'private, max-age=3600',
    };
    if (url.searchParams.get('dl')) {
      const { data } = await supabase.from('wa_mensajes').select('filename').eq('media_id', id).maybeSingle();
      headers['Content-Disposition'] = `attachment; filename="${(data?.filename || 'archivo').replace(/"/g, '')}"`;
    }
    return new Response(m.bytes, { status: 200, headers });
  } catch (e: any) {
    const st = e instanceof KapsoError ? (e.status || 502) : 502;
    return new Response(`No se pudo obtener la media: ${e?.message || e}`, { status: st === 0 ? 503 : st });
  }
};
