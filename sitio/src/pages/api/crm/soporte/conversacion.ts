// SOPORTE · Hilo COMPLETO de una conversación de Intercom, dentro del CRM.
// Trae todos los mensajes (source + conversation_parts), autores, adjuntos e
// imágenes vía el Access Token. Founder-only por el middleware (/api/crm/).
import type { APIRoute } from 'astro';
import { responderConversacion } from '../../../../lib/soporte/intercom';
import { getSessionFromRequest } from '../../../../lib/auth/session';

export const prerender = false;
const TOKEN = (import.meta.env.INTERCOM_ACCESS_TOKEN || '').trim();
const API = 'https://api.intercom.io';
const IV = { 'Authorization': 'Bearer ' + TOKEN, 'Intercom-Version': '2.11' };
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** Saneo conservador del HTML del mensaje: fuera script/style/iframe/eventos y
 *  urls javascript:. Se conserva formato básico e <img> (imágenes del hilo). */
function sanear(html: string): string {
  if (!html) return '';
  return String(html)
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*(\2)/gi, '$1=$2#$2');
}

// part_type que son mensajes reales (lo demás son eventos de sistema).
const MENSAJE = new Set(['comment', 'note', 'message', 'assignment', 'open', 'close']);

export const GET: APIRoute = async ({ url }) => {
  if (!TOKEN) return json({ error: 'Intercom no configurado (falta INTERCOM_ACCESS_TOKEN)' }, 503);
  const id = url.searchParams.get('id') || '';
  if (!/^[0-9]+$/.test(id)) return json({ error: 'Conversación inválida' }, 400);

  try {
    const r = await fetch(`${API}/conversations/${id}`, { headers: IV });
    if (!r.ok) return json({ error: 'Intercom respondió ' + r.status }, 502);
    const c: any = await r.json();

    const adjuntosDe = (a: any[]) => (a || []).map(x => ({
      nombre: x.name || 'archivo', url: x.url, tipo: x.content_type || '',
      es_imagen: /^image\//.test(x.content_type || '') || /\.(png|jpe?g|gif|webp)$/i.test(x.name || ''),
      ancho: x.width || null, alto: x.height || null,
    })).filter((x: any) => x.url);

    const mensajes: any[] = [];
    // Primer mensaje (source).
    if (c.source?.body || (c.source?.attachments || []).length) {
      mensajes.push({
        autor_tipo: c.source?.author?.type || 'user',
        autor: c.source?.author?.name || (c.source?.author?.type === 'admin' ? 'Soporte' : 'Cliente'),
        body: sanear(c.source?.body || ''),
        adjuntos: adjuntosDe(c.source?.attachments),
        fecha: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
      });
    }
    // Resto del hilo.
    for (const p of (c.conversation_parts?.conversation_parts || [])) {
      const esMsg = MENSAJE.has(p.part_type) && (p.body || (p.attachments || []).length);
      if (!esMsg) continue;
      mensajes.push({
        autor_tipo: p.author?.type || 'admin',
        autor: p.author?.name || (p.author?.type === 'admin' ? 'Soporte' : p.author?.type === 'bot' ? 'Asistente' : 'Cliente'),
        body: sanear(p.body || ''),
        adjuntos: adjuntosDe(p.attachments),
        nota: p.part_type === 'note',
        fecha: p.created_at ? new Date(p.created_at * 1000).toISOString() : null,
      });
    }

    return json({
      conversation_id: id,
      asunto: c.title || c.source?.subject || null,
      estado: (c.state === 'closed' || c.open === false) ? 'resuelto' : (c.state === 'snoozed' ? 'pausado' : 'abierto'),
      intercom_url: 'https://app.intercom.com/a/apps/' + (import.meta.env.INTERCOM_APP_ID || 'zla430r8') + '/conversations/' + id,
      mensajes,
    });
  } catch (e: any) {
    return json({ error: e?.message || 'No se pudo cargar la conversación' }, 502);
  }
};

// Responder la conversación desde el CRM (comentario público de admin).
export const POST: APIRoute = async ({ request, url }) => {
  const id = url.searchParams.get('id') || '';
  if (!/^[0-9]+$/.test(id)) return json({ error: 'Conversación inválida' }, 400);
  let body: any = {};
  try { body = await request.json(); } catch { /* vacío */ }
  const texto = String(body?.texto || '').trim();
  if (!texto) return json({ error: 'Escribe un mensaje' }, 400);
  // Atribuir el reply a la persona logueada (por su correo → admin de Intercom).
  const user = await getSessionFromRequest(request);
  const res = await responderConversacion(id, texto, user?.email || null);
  if (!res.ok) return json({ error: res.error }, 502);
  return json({ ok: true });
};
