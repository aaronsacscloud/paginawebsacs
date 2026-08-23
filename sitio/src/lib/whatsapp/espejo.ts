// El espejo del Inbox de WhatsApp: lo que el webhook de Kapso escribe en
// Supabase para que la ficha 360 y el timeline vean la conversación sin
// depender del iframe.
//
// Reglas:
//  - Dedup por wa_mensajes.kapso_message_id (UNIQUE): Kapso entrega
//    at-least-once y reintenta 10s/40s/90s si no le contestas 200.
//  - La activity se escribe SOLO cuando el mensaje es nuevo, nunca en un
//    replay ni en un cambio de status.
//  - Número sin contacto: se espeja igual (contact_id null), sin activity y
//    sin tocar last_contact_at — no se inventan contactos.
import { supabase } from '../supabase';
import { telefonoWhatsApp, telefonoLegible } from '../telefono';
import { notificar } from '../crm/notificaciones';

/** El contacto (y su empresa) dueño de un teléfono, o nulls. */
export async function ligarContacto(telefono: string): Promise<{ contactId: string | null; companyId: string | null }> {
  const e164 = telefonoWhatsApp(telefono);
  if (!e164) return { contactId: null, companyId: null };
  const { data } = await supabase.from('contacts')
    .select('id, company_id').eq('whatsapp', e164).limit(1).maybeSingle();
  return { contactId: data?.id || null, companyId: data?.company_id || null };
}

/**
 * La conversación espejo, creándola si no existe. El vínculo con
 * contacto/empresa se CONGELA al crearla (patrón email_conversations): si el
 * contacto cambia de empresa después, el historial no se reescribe.
 */
export async function upsertConversacion(o: {
  kapsoConversationId?: string | null;
  telefono: string;
  estado?: string;
}): Promise<{ id: string; contactId: string | null; companyId: string | null } | null> {
  const e164 = telefonoWhatsApp(o.telefono) || String(o.telefono || '').trim();
  if (!e164) return null;

  // Primero por id de Kapso (la llave fuerte), luego por teléfono+active
  // (mensajes que llegan antes que el evento conversation.created).
  let conv: any = null;
  if (o.kapsoConversationId) {
    const { data } = await supabase.from('wa_conversaciones')
      .select('id, contact_id, company_id').eq('kapso_conversation_id', o.kapsoConversationId).maybeSingle();
    conv = data;
  }
  if (!conv) {
    const { data } = await supabase.from('wa_conversaciones')
      .select('id, contact_id, company_id, kapso_conversation_id')
      .eq('telefono', e164).eq('estado', 'active')
      .order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();
    conv = data;
    // Si la encontramos por teléfono y ahora sí sabemos el id de Kapso, se ata.
    if (conv && o.kapsoConversationId && !conv.kapso_conversation_id) {
      await supabase.from('wa_conversaciones')
        .update({ kapso_conversation_id: o.kapsoConversationId }).eq('id', conv.id);
    }
  }
  if (conv) {
    if (o.estado && o.estado !== 'active') {
      await supabase.from('wa_conversaciones').update({ estado: o.estado }).eq('id', conv.id);
    }
    return { id: conv.id, contactId: conv.contact_id, companyId: conv.company_id };
  }

  const { contactId, companyId } = await ligarContacto(e164);
  const { data: nueva } = await supabase.from('wa_conversaciones').insert({
    kapso_conversation_id: o.kapsoConversationId || null,
    telefono: e164, contact_id: contactId, company_id: companyId,
    estado: o.estado || 'active',
  }).select('id').single();
  return nueva ? { id: nueva.id, contactId, companyId } : null;
}

/**
 * Espeja UN mensaje (entrante o saliente). Devuelve si de verdad insertó.
 * Solo un insert real escribe activity y (entrante) last_contact_at.
 */
export async function registrarMensaje(o: {
  kapsoMessageId: string;
  kapsoConversationId?: string | null;
  telefono: string;                   // el del CLIENTE, venga de from o to
  direccion: 'entrante' | 'saliente';
  tipo?: string | null;
  cuerpo?: string | null;
  transcript?: string | null;
  mediaUrl?: string | null;
  status?: string | null;
  timestamp?: string | null;          // del payload de Kapso
}): Promise<{ inserted: boolean }> {
  const conv = await upsertConversacion({
    kapsoConversationId: o.kapsoConversationId, telefono: o.telefono,
  });
  if (!conv) return { inserted: false };

  const texto = o.cuerpo || o.transcript || (o.tipo && o.tipo !== 'text' ? `[${o.tipo}]` : '') || '';

  // onConflict-ignore sobre la UNIQUE: el replay de Kapso no duplica ni
  // dispara activity.
  const { data: ins, error } = await supabase.from('wa_mensajes')
    .upsert({
      conversation_id: conv.id,
      kapso_message_id: o.kapsoMessageId,
      direccion: o.direccion,
      tipo: o.tipo || 'text',
      cuerpo: o.cuerpo || null,
      transcript: o.transcript || null,
      media_url: o.mediaUrl || null,
      status: o.status || (o.direccion === 'entrante' ? 'received' : 'sent'),
      enviado_at: o.timestamp ? new Date(Number(o.timestamp) * 1000 || o.timestamp).toISOString() : null,
    }, { onConflict: 'kapso_message_id', ignoreDuplicates: true })
    .select('id');
  if (error) console.error('[wa-espejo] insert mensaje:', error.message);
  const inserted = !!ins?.length;
  if (!inserted) return { inserted: false };

  await supabase.from('wa_conversaciones').update({
    ultimo_mensaje_at: new Date().toISOString(),
    ultimo_mensaje_texto: texto.slice(0, 200) || null,
    ultima_direccion: o.direccion,
    estado: 'active',
  }).eq('id', conv.id);

  if (o.direccion === 'entrante') {
    // No-leídos con RPC-less increment: leer+escribir es carrera aceptable
    // aquí (el peor caso es un contador ±1 que se corrige al abrir el hilo).
    const { data: c } = await supabase.from('wa_conversaciones')
      .select('no_leidos, telefono').eq('id', conv.id).maybeSingle();
    await supabase.from('wa_conversaciones')
      .update({ no_leidos: (c?.no_leidos ?? 0) + 1 }).eq('id', conv.id);
    // Campana del CRM. Idempotente por clave = wamid: el replay no re-suena.
    await notificar({
      clave: `wa_${o.kapsoMessageId}`,
      tipo: 'wa_mensaje',
      titulo: `WhatsApp de ${telefonoLegible(c?.telefono || o.telefono)}: ${(texto || '').slice(0, 80)}`,
      company_id: conv.companyId || null,
      destino: 'whatsapp',
      metadata: { conversation_id: conv.id },
    });
  }

  // El hilo también vive en la ficha del contacto — pero solo si HAY contacto.
  if (conv.contactId) {
    const snippet = (texto || '').slice(0, 90);
    await supabase.from('activities').insert({
      contact_id: conv.contactId, company_id: conv.companyId, automatico: true,
      tipo: o.direccion === 'entrante' ? 'whatsapp_recibido' : 'whatsapp_enviado',
      titulo: o.direccion === 'entrante'
        ? `WhatsApp recibido: ${snippet}` : `WhatsApp enviado: ${snippet}`,
      metadata: { wa_conversation_id: conv.id, kapso_message_id: o.kapsoMessageId },
    });
    if (o.direccion === 'entrante') {
      await supabase.from('contacts')
        .update({ last_contact_at: new Date().toISOString() }).eq('id', conv.contactId);
    }
  }
  return { inserted: true };
}

/**
 * Cambia el status de un mensaje ya espejado. Monótono: un `read` no puede
 * regresar a `delivered` porque los webhooks llegan en cualquier orden.
 * `failed` es terminal. Nunca escribe activity.
 */
const RANGO: Record<string, number> = { received: 0, sent: 1, delivered: 2, read: 3, failed: 9 };
export async function actualizarStatus(kapsoMessageId: string, status: string, error?: string | null) {
  const { data: msj } = await supabase.from('wa_mensajes')
    .select('id, status').eq('kapso_message_id', kapsoMessageId).maybeSingle();
  if (!msj) return;
  if ((RANGO[status] ?? -1) <= (RANGO[msj.status] ?? -1)) return;
  await supabase.from('wa_mensajes')
    .update({ status, ...(error ? { error } : {}) }).eq('id', msj.id);
}
