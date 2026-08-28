// ══ Mandar un push a los teléfonos del equipo ══════════════════════════════
//
// Se usa cuando entra un lead: el aviso por WhatsApp ya existía
// ([[aviso-lead]]), pero llega al teléfono como un mensaje más entre cientos.
// El push suena como lo que es —algo que atender ahora— y abre directo el
// lead en el CRM.
//
// Una suscripción muerta (el usuario desinstaló la PWA, borró datos) responde
// 404/410: se borra sola para no arrastrar basura.
import { supabase } from '../supabase';
import { sendPushTo, type PushPayload } from '../push/send';

export async function pushAlEquipo(payload: PushPayload): Promise<{ enviados: number; borrados: number }> {
  const { data: subs } = await supabase
    .from('crm_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .limit(50);
  if (!subs?.length) return { enviados: 0, borrados: 0 };

  let enviados = 0, borrados = 0;
  await Promise.all(subs.map(async (s: any) => {
    const r = await sendPushTo({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    if (r.ok) {
      enviados++;
      await supabase.from('crm_push_subscriptions').update({ ultima_ok_at: new Date().toISOString(), fallos: 0 }).eq('endpoint', s.endpoint);
    } else if (r.statusCode === 404 || r.statusCode === 410) {
      borrados++;
      await supabase.from('crm_push_subscriptions').delete().eq('endpoint', s.endpoint);
    } else {
      // Fallo temporal (red, 5xx del push service): se anota y se reintenta
      // en el siguiente aviso; a los 5 fallos la limpieza la puede purgar.
      try { await supabase.rpc('increment_fallos_push', { p_endpoint: s.endpoint }); } catch { /* el contador es informativo */ }
    }
  }));
  return { enviados, borrados };
}

/** El push de un lead nuevo: quién es, por dónde llegó y a un toque de abrirlo. */
export async function pushLeadNuevo(c: { id: string; nombre?: string | null; apellido?: string | null; whatsapp?: string | null; telefono?: string | null; email?: string | null; campana?: string | null; fuente?: string | null }) {
  const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ') || c.whatsapp || c.telefono || 'Sin nombre';
  const detalle = [c.campana || c.fuente, c.whatsapp || c.telefono || c.email].filter(Boolean).join(' · ');
  return pushAlEquipo({
    title: `Lead nuevo: ${nombre}`,
    body: detalle || 'Toca para atenderlo',
    tag: `lead-${c.id}`,
    url: `/admin/crm?tab=pipeline&lead=${c.id}`,
    requireInteraction: false,
    data: { contact_id: c.id },
  });
}

/** El push de un mensaje ENTRANTE de WhatsApp (E7).
 *
 * El `tag` es la conversación: si el cliente manda cinco mensajes seguidos, el
 * teléfono enseña UNO que se va actualizando, no cinco avisos apilados. */
export async function pushMensajeEntrante(o: { conversationId: string; telefono: string; texto?: string | null; nombre?: string | null }) {
  const quien = o.nombre || o.telefono || 'Un cliente';
  const cuerpo = String(o.texto || '').trim().slice(0, 120) || 'Te mandó un mensaje';
  return pushAlEquipo({
    title: quien,
    body: cuerpo,
    tag: `wa-${o.conversationId}`,
    url: `/admin/crm?tab=whatsapp&wa_conv=${o.conversationId}`,
    requireInteraction: false,
    data: { conversation_id: o.conversationId },
  });
}
