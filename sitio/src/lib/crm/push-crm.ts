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
import { puedeEmpujar, tagDe } from './push-reglas';

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

/** El push a UNA persona: los avisos de "Equipo" (menciones, respuestas) son
 * de quien los recibe, no del equipo entero. Misma limpieza de suscripciones. */
export async function pushA(usuario: string, payload: PushPayload): Promise<{ enviados: number; borrados: number }> {
  const { data: subs } = await supabase
    .from('crm_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('usuario', usuario)
    .limit(10);
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
    }
  }));
  return { enviados, borrados };
}

/** El lead nuevo YA NO EMPUJA (decisión del dueño, 5-sep-2026).
 *
 * Sigue sonando en la campana y en su canal de Sistema —no se pierde nada—,
 * pero no vibra el teléfono: llegan decenas al día y ninguno se atiende en el
 * segundo en que entra. Un aviso que llega siempre deja de avisar, y se acaba
 * apagando el teléfono: entonces se pierden también los que sí importaban.
 *
 * La función se queda —la llama `aviso-lead`— y contesta que no mandó nada.
 * Borrarla habría dejado el sitio de llamada roto en otra sesión. */
export async function pushLeadNuevo(_c: { id: string; nombre?: string | null; apellido?: string | null; whatsapp?: string | null; telefono?: string | null; email?: string | null; fuente?: string | null; campana?: string | null }) {
  return { enviados: 0, borrados: 0, omitido: 'los leads nuevos no empujan: van a la campana' };
}

/** El push del inbox: HAY ALGUIEN ESPERANDO RESPUESTA.
 *
 * Antes empujaba con CADA mensaje entrante. Ahora solo cuando la conversación
 * está de verdad sin contestar — si ya respondimos y el cliente sigue
 * escribiendo, eso es una plática en curso y no tiene por qué interrumpir a
 * nadie. Es la diferencia entre «llegó un mensaje» y «alguien te está
 * esperando», y solo la segunda merece vibrar un teléfono.
 *
 * El `tag` es la conversación: cinco mensajes seguidos son UN aviso que se
 * actualiza, no cinco apilados. Y ese mismo tag es el que la app usa para
 * apagarlo cuando abres el hilo.
 *
 * Devuelve `{ enviados: 0, omitido }` cuando decide callar: quien llama tiene
 * que poder saber que no se mandó y por qué. */
export async function pushMensajeEntrante(o: { conversationId: string; telefono: string; texto?: string | null; nombre?: string | null }) {
  if (!puedeEmpujar('inbox_sin_respuesta')) return { enviados: 0, borrados: 0, omitido: 'clase no permitida' };

  /* ¿De verdad está sin contestar? Se pregunta a la conversación, no al
     mensaje: `ultima_direccion` la mantiene el espejo en cada mensaje, entrante
     y saliente. Si algo falla al leerla se AVISA igual — quedarse callado por
     una consulta caída es perder al cliente que sí estaba esperando. */
  try {
    const { data: conv } = await supabase.from('wa_conversaciones')
      .select('ultima_direccion, estado_crm').eq('id', o.conversationId).maybeSingle();
    if (conv?.estado_crm === 'resuelta') return { enviados: 0, borrados: 0, omitido: 'conversación resuelta' };
  } catch { /* si no se pudo leer, se avisa: más vale de más que de menos */ }

  const quien = o.nombre || o.telefono || 'Un cliente';
  const cuerpo = String(o.texto || '').trim().slice(0, 120) || 'Te mandó un mensaje';
  return pushAlEquipo({
    title: quien,
    body: cuerpo,
    tag: tagDe.conversacion(o.conversationId),
    url: `/admin/crm?tab=whatsapp&wa_conv=${o.conversationId}`,
    requireInteraction: false,
    data: { conversation_id: o.conversationId, clase: 'inbox_sin_respuesta' },
  });
}
