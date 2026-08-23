// WHATSAPP · Backfill del historial que Kapso ya tenía ANTES del webhook.
// POST { after?: cursor } → { importados, vistos, next }
// Recorre /whatsapp/messages por cursor, página por página (una llamada por
// página para no pasarse del tiempo de la función). El espejo va en modo
// SILENCIOSO: ni campana, ni no-leídos, ni automatizaciones — es historia.
// El dedup por kapso_message_id hace que repetirlo sea inofensivo.
import type { APIRoute } from 'astro';
import { listarMensajesKapso, KapsoError } from '../../../../lib/whatsapp/kapso-api';
import { parsearMensaje } from '../../../../lib/whatsapp/parse';
import { registrarMensaje } from '../../../../lib/whatsapp/espejo';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  try {
    const { data, next } = await listarMensajesKapso(b.after || null, 100);
    let importados = 0;
    const convsTocadas = new Set<string>();
    for (const msj of data) {
      const kapso = msj.kapso || {};
      const entrante = kapso.direction !== 'outbound';
      const telefono = String(kapso.phone_number || (entrante ? msj.from : msj.to) || '');
      if (!msj.id || !telefono) continue;
      const p = parsearMensaje(msj);
      const r = await registrarMensaje({
        kapsoMessageId: String(msj.id),
        kapsoConversationId: kapso.whatsapp_conversation_id ? String(kapso.whatsapp_conversation_id) : null,
        telefono, direccion: entrante ? 'entrante' : 'saliente',
        tipo: p.tipo, cuerpo: p.cuerpo, transcript: kapso.transcript || null,
        mediaUrl: p.mediaUrl, mediaId: p.mediaId, mime: p.mime, filename: p.filename,
        timestamp: msj.timestamp ? String(msj.timestamp) : null, metadata: p.metadata,
        status: entrante ? 'received' : (kapso.status || 'sent'),
        autor: entrante ? null : 'Historial', silencioso: true,
      });
      if (r.inserted) importados++;
      if (r.conversationId) convsTocadas.add(r.conversationId);
    }
    // El "último mensaje" de cada conversación tocada se recalcula desde los datos.
    for (const id of convsTocadas) {
      const { data: u } = await supabase.from('wa_mensajes')
        .select('cuerpo, transcript, tipo, direccion, enviado_at, created_at')
        .eq('conversation_id', id).neq('tipo', 'reaction')
        .order('enviado_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      if (u) await supabase.from('wa_conversaciones').update({
        ultimo_mensaje_at: u.enviado_at || u.created_at,
        ultimo_mensaje_texto: (u.cuerpo || u.transcript || `[${u.tipo}]`).slice(0, 200),
        ultima_direccion: u.direccion,
      }).eq('id', id);   // el mensaje más nuevo en BD ES la verdad (incluye los que lleguen durante la importación)
    }
    return json({ importados, vistos: data.length, next });
  } catch (e: any) {
    return json({ error: e instanceof KapsoError ? e.message : String(e) }, 502);
  }
};
