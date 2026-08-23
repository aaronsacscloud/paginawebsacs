// GET /api/cron/wa-snooze — cada 15 min (Vercel cron).
//
// Despierta las conversaciones pospuestas cuyo snooze venció: limpia
// snooze_until, las marca no leídas (para que griten en el rail) y avisa por
// la campana. El filtro del inbox ya las re-enseña por query-time aunque el
// cron se retrase; esto es el empujón visible.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { isAuthorizedCron } from '../../../lib/auth/cron';
import { notificar } from '../../../lib/crm/notificaciones';
import { telefonoLegible } from '../../../lib/telefono';
import { enviarTexto, enviarMediaLink, listarMensajesKapso, KapsoError } from '../../../lib/whatsapp/kapso-api';
import { registrarMensaje } from '../../../lib/whatsapp/espejo';
import { parsearMensaje } from '../../../lib/whatsapp/parse';
import { explicarError } from '../../../lib/whatsapp/errores';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorizedCron(request)) return new Response('No', { status: 401 });

  const { data: vencidas } = await supabase.from('wa_conversaciones')
    .select('id, telefono, no_leidos, contacts(nombre, apellido)')
    .not('snooze_until', 'is', null)
    .lte('snooze_until', new Date().toISOString())
    .limit(100);

  for (const c of vencidas || []) {
    await supabase.from('wa_conversaciones')
      .update({ snooze_until: null, no_leidos: (c.no_leidos || 0) + 1, estado_crm: 'abierta' })
      .eq('id', c.id);
    const nombre = (c as any).contacts
      ? `${(c as any).contacts.nombre || ''} ${(c as any).contacts.apellido || ''}`.trim()
      : telefonoLegible(c.telefono);
    await notificar({
      clave: `wa_snooze_${c.id}_${new Date().toISOString().slice(0, 13)}`,
      tipo: 'wa_snooze',
      titulo: `Seguimiento: la conversación con ${nombre} despertó`,
      destino: 'whatsapp',
      metadata: { conversation_id: c.id },
    });
  }

  // ── 3/4) Programados vencidos ──
  const { data: prog } = await supabase.from('wa_programados').select('*, wa_conversaciones(telefono, ultimo_entrante_at, contacts(nombre, apellido))')
    .eq('estado', 'pendiente').lte('ejecutar_at', new Date().toISOString()).limit(50);
  let enviados = 0, recordados = 0;
  for (const p of prog || []) {
    const conv: any = p.wa_conversaciones;
    try {
      if (p.tipo === 'envio') {
        let r: any;
        if (p.payload?.texto) r = await enviarTexto(conv.telefono, p.payload.texto, p.payload.cita || null);
        else r = await enviarMediaLink(conv.telefono, p.payload.clase || 'document', p.payload.media_url, p.payload.nombre, p.payload.caption || undefined);
        const wamid = r?.messages?.[0]?.id;
        if (wamid) await registrarMensaje({
          kapsoMessageId: wamid, telefono: conv.telefono, direccion: 'saliente', autorId: p.autor_id, autor: p.autor,
          tipo: p.payload?.texto ? 'text' : (p.payload.clase || 'document'), cuerpo: p.payload?.texto || p.payload?.caption || p.payload?.nombre || null,
          mediaUrl: p.payload?.media_url || null, status: 'sent',
        });
        await supabase.from('wa_programados').update({ estado: 'hecho', ejecutado_at: new Date().toISOString(), resultado: wamid || null }).eq('id', p.id);
        enviados++;
      } else {
        // Recordatorio: solo si el cliente NO escribió desde que se creó.
        const contesto = conv.ultimo_entrante_at && p.payload?.desde && conv.ultimo_entrante_at > p.payload.desde;
        if (contesto) { await supabase.from('wa_programados').update({ estado: 'cancelado', resultado: 'El cliente contestó' }).eq('id', p.id); continue; }
        const nombre = conv.contacts ? `${conv.contacts.nombre || ''} ${conv.contacts.apellido || ''}`.trim() : telefonoLegible(conv.telefono);
        await supabase.from('wa_conversaciones').update({ no_leidos: 1, estado_crm: 'abierta' }).eq('id', p.conversation_id);
        await supabase.from('wa_eventos').insert({ conversation_id: p.conversation_id, tipo: 'recordatorio', detalle: `Sin respuesta del cliente: ${p.payload?.nota || ''}`.trim(), autor: null });
        await notificar({
          clave: `wa_recordatorio_${p.id}`, tipo: 'wa_snooze', destino: 'whatsapp',
          titulo: `${nombre} no ha contestado: ${p.payload?.nota || 'dale seguimiento'}`,
          metadata: { conversation_id: p.conversation_id, para: p.autor_id },
        });
        await supabase.from('wa_programados').update({ estado: 'hecho', ejecutado_at: new Date().toISOString() }).eq('id', p.id);
        recordados++;
      }
    } catch (e: any) {
      const x = explicarError(e instanceof KapsoError ? e.detalle : e, e instanceof KapsoError ? e.status : undefined);
      await supabase.from('wa_programados').update({ estado: 'fallido', resultado: `${x.titulo} · ${x.crudo}`.slice(0, 300), ejecutado_at: new Date().toISOString() }).eq('id', p.id);
      await supabase.from('wa_eventos').insert({ conversation_id: p.conversation_id, tipo: 'programado', detalle: `El mensaje programado NO se envió: ${x.titulo}. ${x.que_hacer}`, autor: null });
      await notificar({ clave: `wa_prog_fallo_${p.id}`, tipo: 'wa_snooze', destino: 'whatsapp', titulo: `Falló un mensaje programado: ${x.titulo}`, metadata: { conversation_id: p.conversation_id, para: p.autor_id } });
    }
  }

  // ── 29) Re-sync contra Kapso: lo que el webhook haya perdido ──
  let resync = 0;
  try {
    const { data: pag } = await listarMensajesKapso(null, 100);
    for (const msj of pag) {
      const kapso = msj.kapso || {};
      const entrante = kapso.direction !== 'outbound';
      const telefono = String(kapso.phone_number || (entrante ? msj.from : msj.to) || '');
      if (!msj.id || !telefono) continue;
      const p = parsearMensaje(msj);
      const r = await registrarMensaje({
        kapsoMessageId: String(msj.id), kapsoConversationId: kapso.whatsapp_conversation_id ? String(kapso.whatsapp_conversation_id) : null,
        telefono, direccion: entrante ? 'entrante' : 'saliente', tipo: p.tipo, cuerpo: p.cuerpo, transcript: kapso.transcript || null,
        mediaUrl: p.mediaUrl, mediaId: p.mediaId, mime: p.mime, filename: p.filename,
        timestamp: msj.timestamp ? String(msj.timestamp) : null, metadata: p.metadata,
        status: entrante ? 'received' : (kapso.status || 'sent'),
      });
      if (r.inserted) resync++;   // NO silencioso: si el webhook lo perdió, debe sonar
    }
    await supabase.from('wa_config').update({ resync_at: new Date().toISOString() }).eq('id', 1);
  } catch (e) { console.warn('[wa-resync]', e); }

  // ── Etapa B: estado/calidad de plantillas (aprobada, rechazada, pausada) → campana ──
  let plantillas = 0;
  try { const { sincronizarPlantillas } = await import('../crm/whatsapp/plantillas'); plantillas = (await sincronizarPlantillas()).cambios.length; } catch (e) { console.warn('[wa-tpl-sync]', e); }

  return new Response(JSON.stringify({ despertadas: (vencidas || []).length, enviados, recordados, resync, plantillas }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
