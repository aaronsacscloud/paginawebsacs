// POST /api/whatsapp/webhook-meta — payload CRUDO de Meta reenviado por Kapso (kind: meta).
//
// Lo usamos SOLO para lo que los eventos "kapso" no traen: las LLAMADAS
// (value.calls[] y statuses type=call). Los mensajes siguen entrando por
// /api/whatsapp/webhook (ya deduplicados allí); aquí se ignoran.
// Mismos candados: ?k= + HMAC del cuerpo crudo, siempre 200, falla cerrado.
import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabase } from '../../../lib/supabase';
import { marcarRespondio } from '../../../lib/crm/estatus-live';
import { upsertConversacion } from '../../../lib/whatsapp/espejo';
import { notificar } from '../../../lib/crm/notificaciones';
import { telefonoLegible } from '../../../lib/telefono';

export const prerender = false;
const ok = () => new Response('OK', { status: 200 });

function firmaValida(raw: string, header: string | null, secreto: string): boolean {
  if (!header) return true;
  const dicho = header.replace(/^sha256=/, '').trim();
  const esperado = createHmac('sha256', secreto).update(raw, 'utf8').digest('hex');
  const a = Buffer.from(dicho, 'utf8'), b = Buffer.from(esperado, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

const ESTADO: Record<string, string> = { RINGING: 'timbrando', ACCEPTED: 'aceptada', REJECTED: 'rechazada', COMPLETED: 'terminada', FAILED: 'fallida', MISSED: 'perdida', TERMINATED: 'terminada' };

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const secreto = (import.meta.env.KAPSO_WEBHOOK_SECRET || '').trim();
    if (!secreto || url.searchParams.get('k') !== secreto) return ok();
    const raw = await request.text();
    if (!firmaValida(raw, request.headers.get('x-webhook-signature') || request.headers.get('x-kapso-signature'), secreto)) return ok();
    let payload: any; try { payload = JSON.parse(raw); } catch { return ok(); }

    const entradas: any[] = payload?.entry || (payload?.object ? [payload] : [payload]);
    for (const entry of entradas) {
      for (const ch of entry?.changes || [entry]) {
        const v = ch?.value || ch;
        const calls: any[] = v?.calls || [];
        const nuestro = String(v?.metadata?.display_phone_number || v?.metadata?.phone_number_id || '').replace(/\D/g, '');
        const statuses: any[] = (v?.statuses || []).filter((s: any) => s?.type === 'call' || String(s?.id || '').startsWith('wacid.'));
        for (const c of calls) {
          const callId = String(c.id || ''); if (!callId) continue;
          const entrante = String(c.direction || 'USER_INITIATED').toUpperCase() !== 'BUSINESS_INITIATED';
          // El teléfono del CLIENTE es el que NO es nuestro número (en terminate,
          // from/to se invierten según quién colgó y creaba conversaciones fantasma).
          const dig = (x: any) => String(x || '').replace(/\D/g, '');
          const candidatos = [c.from, c.to].filter(Boolean);
          const tel = String(candidatos.find(x => nuestro && dig(x) !== nuestro && !nuestro.endsWith(dig(x))) || (entrante ? c.from : c.to) || '');
          const conv = tel ? await upsertConversacion({ telefono: tel }) : null;
          const evento = String(c.event || '').toLowerCase();
          const sdp = c.session?.sdp_type === 'offer' ? c.session.sdp : c.session?.sdp_type === 'answer' ? null : null;
          const { data: prev } = await supabase.from('wa_llamadas').select('id, estado, started_at, sdp_offer').eq('call_id', callId).maybeSingle();
          if (evento === 'connect') {
            await supabase.from('wa_llamadas').upsert({
              call_id: callId, conversation_id: conv?.id || null, telefono: tel, direccion: entrante ? 'entrante' : 'saliente',
              estado: prev?.estado || 'timbrando', sdp_offer: sdp || prev?.sdp_offer || null, ...(c.session?.sdp_type === 'answer' ? { sdp_answer: c.session.sdp } : {}),
              started_at: c.timestamp ? new Date(Number(c.timestamp) * 1000).toISOString() : new Date().toISOString(), payload: c, updated_at: new Date().toISOString(),
            }, { onConflict: 'call_id' });
            if (!prev && entrante) await notificar({
              clave: `wa_call_${callId}`, tipo: 'wa_llamada', destino: 'whatsapp',
              titulo: `Llamada de WhatsApp entrante de ${telefonoLegible(tel)}`, company_id: conv?.companyId || null,
              metadata: { conversation_id: conv?.id || null, call_id: callId },
            });
          } else if (evento === 'terminate') {
            const st = String(c.status || '').toUpperCase();
            const fin = new Date().toISOString();
            const estado = ESTADO[st] || (prev?.estado === 'aceptada' ? 'terminada' : 'perdida');
            await supabase.from('wa_llamadas').update({
              estado: estado === 'timbrando' ? 'perdida' : estado, ended_at: fin,
              duracion_seg: c.duration != null ? Number(c.duration) : (prev?.started_at ? Math.max(0, Math.round((Date.now() - new Date(prev.started_at).getTime()) / 1000)) : null),
              motivo: st || null, updated_at: fin,
            }).eq('call_id', callId);
            // Leads en vivo: llamada CONTESTADA (con duración) = conversación
            // real → respondió. Una perdida no mueve nada.
            if (conv?.id && (estado === 'terminada' || estado === 'aceptada') && Number(c.duration || 0) > 0) {
              const { data: cvx } = await supabase.from('wa_conversaciones').select('contact_id').eq('id', conv.id).maybeSingle();
              if (cvx?.contact_id) await marcarRespondio(cvx.contact_id).catch(() => {});
            }
            if (conv?.id) await supabase.from('wa_eventos').insert({ conversation_id: conv.id, tipo: 'llamada', autor: null,
              detalle: estado === 'terminada' || estado === 'aceptada' ? `Llamada de WhatsApp ${entrante ? 'recibida' : 'realizada'}${c.duration ? ` · ${Math.floor(Number(c.duration) / 60)} min ${Number(c.duration) % 60} s` : ''}` : `Llamada ${entrante ? 'entrante' : 'saliente'} ${estado === 'perdida' ? 'perdida' : estado}` });
          }
        }
        for (const s of statuses) {
          const callId = String(s.id || ''); const st = String(s.status || '').toUpperCase();
          if (!callId || !st) continue;
          const estado = ESTADO[st]; if (!estado) continue;
          await supabase.from('wa_llamadas').update({ estado, ...(estado === 'aceptada' ? { answered_at: new Date().toISOString() } : {}), ...(['rechazada', 'fallida', 'terminada', 'perdida'].includes(estado) ? { ended_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() }).eq('call_id', callId);
        }
      }
    }
    return ok();
  } catch (e) { console.error('[wa-webhook-meta]', e); return ok(); }
};
