// GET /api/email/track-click?sid=&url=&f= — redirector de clics.
//
// ⚠️ ESTE ARCHIVO ERA UN REDIRECTOR ABIERTO.
//
// Devolvía en `Location:` cualquier URL del query, sin validar. O sea:
// https://www.sacscloud.com/api/email/track-click?url=https://sitio-malo.com
// redirigía a donde fuera, con NUESTRO dominio de por medio. Mientras nadie lo
// usaba era un agujero dormido; al conectar el tracking, `envolverLinks()`
// empezó a sembrar ese patrón en TODOS los correos de marketing — es decir, se
// estaba entrenando a la cartera a confiar en un link que cualquiera podía
// apuntar a un sitio de phishing con la marca de SACS encima.
//
// Ahora la URL va FIRMADA con el mismo secreto HMAC de los links de baja: si
// la firma no cuadra, no hay redirección. Los links viejos (sin firma) se
// aceptan solo si apuntan a un dominio propio, para no romper los correos ya
// entregados.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { firmaDeUrl, esDominioPropio } from '../../../lib/email/tracking';

export const prerender = false;

export const GET: APIRoute = async ({ url: reqUrl }) => {
  const sid = reqUrl.searchParams.get('sid');
  const targetUrl = reqUrl.searchParams.get('url');
  const firma = reqUrl.searchParams.get('f');

  if (!targetUrl) {
    return new Response('Missing url', { status: 400 });
  }

  // Solo http(s): `javascript:` y `data:` no se redirigen jamás.
  if (!/^https?:\/\//i.test(targetUrl)) {
    return new Response('Destino no permitido', { status: 400 });
  }

  const firmada = !!firma && firma === firmaDeUrl(targetUrl, sid || '');
  if (!firmada && !esDominioPropio(targetUrl)) {
    // Ni firmada ni propia: es un intento de usar el dominio como trampolín.
    return new Response('Este enlace no es válido.', { status: 400 });
  }

  if (sid) {
    try {
      const now = new Date().toISOString();
      const { data: send } = await supabase
        .from('email_sends')
        .select('id, contact_id, click_count, clicked_links')
        .eq('id', sid)
        .single();

      if (send) {
        const links = Array.isArray(send.clicked_links) ? send.clicked_links : [];
        links.push({ url: targetUrl, clicked_at: now });

        await supabase.from('email_sends').update({
          estado: 'clicked',
          clicked_at: now,
          click_count: (send.click_count || 0) + 1,
          clicked_links: links,
        }).eq('id', sid);

        // Log activity on first click only
        if (send.click_count === 0) {
          await supabase.from('activities').insert({
            contact_id: send.contact_id,
            tipo: 'email_clicked',
            titulo: 'Click en email',
            metadata: { email_send_id: sid, url: targetUrl },
            automatico: true,
          });
        }
      }
    } catch {}
  }

  // 302 redirect to the original URL
  return new Response(null, {
    status: 302,
    headers: { 'Location': targetUrl },
  });
};
