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
import { etiquetaTipo } from './parse';
import { explicarError } from './errores';
import { sincronizarContactoKapso } from './kapso-sync';
import { supabase } from '../supabase';
import { marcarRespondio, marcarContactado } from '../crm/estatus-live';
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
    // ── Sin filtrar por estado, A PROPÓSITO ──
    // Antes esto pedía .eq('estado','active') y ahí estaba el bug: cuando la
    // ventana de 24 h se cierra, la conversación pasa a 'ended'. Al mandar una
    // plantilla —que es EXACTAMENTE para ese caso— ya no la encontraba y se iba
    // al insert de abajo, creando un hilo nuevo con el mismo teléfono. El
    // historial quedaba partido en dos y en la bandeja parecía que se habían
    // borrado los mensajes anteriores. Caso real: Sugar store, +52 917 116 6173,
    // dos conversaciones el 29 y el 30 de agosto de 2026.
    // Ahora se toma la más reciente sea cual sea su estado y, si estaba cerrada,
    // se reabre: escribirle a alguien ES reabrir la conversación.
    const { data } = await supabase.from('wa_conversaciones')
      .select('id, contact_id, company_id, kapso_conversation_id, estado')
      .eq('telefono', e164)
      .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false })
      .limit(1).maybeSingle();
    conv = data;
    if (conv && conv.estado !== 'active' && (!o.estado || o.estado === 'active')) {
      await supabase.from('wa_conversaciones').update({ estado: 'active' }).eq('id', conv.id);
    }
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
  phoneNumberId?: string | null;     // multi-número: por cuál número entró/salió
  kapsoConversationId?: string | null;
  telefono: string;                   // el del CLIENTE, venga de from o to
  direccion: 'entrante' | 'saliente';
  tipo?: string | null;
  cuerpo?: string | null;
  transcript?: string | null;
  mediaUrl?: string | null;
  status?: string | null;
  timestamp?: string | null;          // del payload de Kapso
  metadata?: any;                     // reacciones: { reacciona_a: wamid }, citas: { cita:{wamid} }
  mediaId?: string | null;
  mime?: string | null;
  filename?: string | null;
  autorId?: string | null;            // quién lo mandó (salientes desde el CRM)
  autor?: string | null;
  nombrePerfil?: string | null;       // nombre del perfil de WhatsApp (payload contact.name)
  silencioso?: boolean;               // backfill de historial: solo inserta
}): Promise<{ inserted: boolean; conversationId?: string }> {
  const conv = await upsertConversacion({
    kapsoConversationId: o.kapsoConversationId, telefono: o.telefono,
  });
  if (!conv) return { inserted: false };
  if (o.phoneNumberId) await supabase.from('wa_conversaciones').update({ phone_number_id: o.phoneNumberId }).eq('id', conv.id).is('phone_number_id', null);
  // LEAD NUEVO POR WHATSAPP (4-sep): si escribe un número desconocido, se crea el contacto ahí mismo. Antes la
  // conversación quedaba huérfana y el agente —que trabaja sobre contactos— ni la veía: se perdieron leads que
  // venían de la web pidiendo prueba o demo. Ver lead-entrante.ts.
  if (o.direccion === 'entrante' && !conv.contactId && !o.silencioso) {
    try {
      const { asegurarContactoDeConversacion } = await import('./lead-entrante');
      const r = await asegurarContactoDeConversacion({ conversationId: conv.id, telefono: o.telefono, texto: o.cuerpo || o.transcript || null, nombrePerfil: o.nombrePerfil });
      if (r.contactId) conv.contactId = r.contactId;
    } catch { /* que no tumbe el espejo del mensaje */ }
  }

  const texto = o.cuerpo || o.transcript || (o.tipo && o.tipo !== 'text' ? `[${etiquetaTipo(o.tipo)}]` : '') || '';
  // Hora REAL del mensaje (replays y entregas fuera de orden no deben mandar
  // la conversación al tope con hora inventada).
  const enviadoAt = o.timestamp ? new Date(Number(o.timestamp) * 1000 || o.timestamp).toISOString() : null;

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
      media_id: o.mediaId || null,
      mime: o.mime || null,
      filename: o.filename || null,
      autor_id: o.autorId || null,
      autor: o.autor || null,
      status: o.status || (o.direccion === 'entrante' ? 'received' : 'sent'),
      metadata: o.metadata || null,
      enviado_at: enviadoAt,
      // created_at = cuándo PASÓ (no cuándo lo espejamos): el hilo pagina por
      // created_at y un backfill que entra de nuevo→viejo lo dejaría al revés.
      ...(enviadoAt ? { created_at: enviadoAt } : {}),
    }, { onConflict: 'kapso_message_id', ignoreDuplicates: true })
    .select('id');
  if (error) console.error('[wa-espejo] insert mensaje:', error.message);
  const inserted = !!ins?.length;
  if (!inserted) return { inserted: false, conversationId: conv.id };
  if (o.tipo === 'reaction') return { inserted: true, conversationId: conv.id };   // ni preview, ni no-leídos, ni activity

  // Solo avanza el "último mensaje" si este es más nuevo que el que ya hay.
  const { data: prev } = await supabase.from('wa_conversaciones').select('ultimo_mensaje_at, ultimo_entrante_at, ultimo_saliente_at, ultimo_mensaje_texto').eq('id', conv.id).maybeSingle();
  const cuando = enviadoAt || new Date().toISOString();
  /* ⚠️ `ultimo_mensaje_at` tiene DEFAULT now() en la base: al crear la
     conversación Postgres la estampa con el instante del INSERT, que cae
     ~1 segundo DESPUÉS de la marca de tiempo que manda Meta (que viene en
     segundos enteros). Resultado: el primer mensaje de toda conversación
     nueva se veía «más viejo» que la conversación recién creada, la guarda de
     abajo lo descartaba y el resumen quedaba en null — la lista enseñaba «—»
     justo en el momento más importante, cuando un lead escribe por primera
     vez. Medido: 3 conversaciones, las 3 con `ultimo_mensaje_at` idéntico a su
     `created_at`.

     Una conversación que todavía no tiene resumen NO puede ser más nueva que
     el mensaje que la estrena. */
  const estrena = !prev?.ultimo_mensaje_texto;
  const esViejo = !estrena && !!(prev?.ultimo_mensaje_at && new Date(prev.ultimo_mensaje_at) > new Date(cuando));
  // Los relojes por dirección avanzan SIEMPRE que este mensaje sea más nuevo
  // que el último de su dirección (aunque no sea el último del hilo).
  const campoDir = o.direccion === 'entrante' ? 'ultimo_entrante_at' : 'ultimo_saliente_at';
  const prevDir = (prev as any)?.[campoDir];
  if (!prevDir || new Date(prevDir) < new Date(cuando)) await supabase.from('wa_conversaciones').update({ [campoDir]: cuando }).eq('id', conv.id);
  if (o.silencioso) return { inserted: true, conversationId: conv.id };   // backfill: ni campana ni no-leídos

  // Leads EN VIVO: la conversación mueve el estatus del contacto al momento
  // (el cron nocturno llega a la misma conclusión). Aquí solo entran mensajes
  // NUEVOS y no-backfill; la automatización (sin autorId) no cuenta como toque.
  {
    const { data: cvv } = await supabase.from('wa_conversaciones').select('contact_id').eq('id', conv.id).maybeSingle();
    if (cvv?.contact_id) {
      if (o.direccion === 'entrante') {
        await marcarRespondio(cvv.contact_id).catch(() => {});
        // Contacto CONOCIDO que escribe: marcarRespondio no alcanza — solo mueve
        // a quien está en 'nuevo'/'contactado'/'sin_respuesta', así que alguien
        // en 'cotizado' no cambiaba nada y nadie se enteraba. Si el texto viene
        // de uno de nuestros CTA, se etiqueta y se avisa CON contexto.
        const { registrarIntencionEntrante } = await import('../crm/wa-intencion');
        await registrarIntencionEntrante({
          contactId: cvv.contact_id, conversationId: conv.id,
          texto: o.cuerpo || o.transcript || null, mensajeId: o.kapsoMessageId || null,
        }).catch(e => console.warn('[wa-intencion]', e?.message || e));
      }
      else if (o.autorId) await marcarContactado(cvv.contact_id).catch(() => {});
    } else {
      // LA PUERTA (Leads v2): número sin contacto → alta automática con
      // triaje (entrante) o alta directa (saliente humano). Ver alta-wa.ts.
      const { altaDesdeWhatsApp } = await import('../crm/alta-wa');
      await altaDesdeWhatsApp(conv.id, o.telefono, {
        direccion: o.direccion, autorId: o.autorId || null,
        texto: o.cuerpo || o.transcript || null, nombrePerfil: o.nombrePerfil || null,
      }).catch(e => console.warn('[alta-wa]', e?.message || e));
    }
  }
  if (!esViejo) await supabase.from('wa_conversaciones').update({
    /* El nombre del perfil de WhatsApp, que Meta manda en CADA entrante.
       Sin esto, un número que nos escribe y todavía no es contacto del CRM
       se veía como «+52 95 8103 7485» y no había forma de saber quién es —
       aunque WhatsApp nos estaba diciendo su nombre en cada mensaje.
       Solo de los ENTRANTES: en un saliente el «perfil» sería el nuestro. */
    ...(o.direccion === 'entrante' && o.nombrePerfil ? { nombre_perfil: String(o.nombrePerfil).slice(0, 120) } : {}),
    ultimo_mensaje_at: cuando,
    ultimo_mensaje_texto: texto.slice(0, 200) || null,
    ultima_direccion: o.direccion,
    estado: 'active',
    ...(o.direccion === 'entrante' ? { alerta: null } : {}),
    // El contador GLOBAL = entrantes desde nuestra última respuesta: se
    // reinicia al contestar (no al abrir). El no-leído personal vive en wa_lecturas.
    ...(o.direccion === 'saliente' && !o.silencioso ? { no_leidos: 0 } : {}),
  }).eq('id', conv.id);

  if (o.direccion === 'entrante') {
    // No-leídos con RPC-less increment: leer+escribir es carrera aceptable
    // aquí (el peor caso es un contador ±1 que se corrige al abrir el hilo).
    // Un mensaje del cliente REABRE lo resuelto y despierta lo pospuesto:
    // nada de contestar a una conversación que el rail ya no enseña.
    const { data: c } = await supabase.from('wa_conversaciones')
      .select('no_leidos, telefono').eq('id', conv.id).maybeSingle();
    await supabase.from('wa_conversaciones')
      .update({ no_leidos: (c?.no_leidos ?? 0) + 1, estado_crm: 'abierta', snooze_until: null }).eq('id', conv.id);
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
  return { inserted: true, conversationId: conv.id };
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
  // 11) Número no alcanzable: Meta lo dice por código; la conversación queda
  // con una alerta visible hasta que el cliente vuelva a escribir.
  if (status === 'failed' && error) {
    const x = explicarError(error);
    // Solo los fallos que hablan del CLIENTE o de su permiso quedan como alerta
    // de la conversación (un error de plantilla o de red no es culpa del número).
    if (['numero', 'permiso', 'limite'].includes(x.tipo)) {
      const { data: m } = await supabase.from('wa_mensajes').select('conversation_id').eq('id', msj.id).maybeSingle();
      if (m?.conversation_id) await supabase.from('wa_conversaciones').update({ alerta: `${x.titulo}: ${x.que_hacer}` }).eq('id', m.conversation_id);
    }
  }
}
