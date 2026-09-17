// LA LLAMADA SUELTA ENTRA AL MISMO RIEL QUE LAS DE LA LISTA.
//
// PEDIDO DEL DUEÑO (17-sep-2026): «cuando reciba una llamada, tienes que
// aplicar exactamente el mismo proceso».
//
// EL PROBLEMA, EN UNA LÍNEA: todo lo bueno de Llamadas inteligentes —la
// transcripción en vivo, las acciones que pide el cliente, el cierre con IA,
// los envíos con PDF, los compromisos con Google Calendar— cuelga de un
// `tel_sesion_items`. Una entrante no tiene item: nace en Twilio, no en una
// lista. Por eso una entrante enseñaba un recuadro negro y una de la lista
// enseñaba la ficha entera.
//
// LA SALIDA MÁS BARATA Y LA MÁS HONESTA: darle un item. Cada usuario tiene UNA
// sesión fantasma («Llamadas sueltas», `origen.suelta = true`, ya terminada
// para que ningún motor la mire) y cada llamada normal —entrante o saliente
// marcada a mano— cuelga de ella un item. A partir de ahí no hay dos caminos
// que mantener: hay uno.
//
// Lo que NO hace la sesión fantasma: marcar. Está `terminada` desde que nace,
// el cron del latido sólo toca las de modo `ia`, y `reprogramar` la salta.
import { supabase } from '../supabase';
import { ladaDe } from './zonas';

const ahora = () => new Date().toISOString();

/** ¿Es una sesión fantasma (llamadas sueltas)? Lo mira `reprogramar`. */
export const esSuelta = (s: any) => !!(s?.origen as any)?.suelta;

/** La sesión fantasma de este usuario. Se crea la primera vez y se reusa. */
async function sesionSuelta(userId: string | null, nombreUsuario?: string | null): Promise<string | null> {
  const q = supabase.from('tel_sesiones').select('id').contains('origen', { suelta: true }).limit(1);
  const { data: ya } = await (userId ? q.eq('owner_id', userId) : q.is('owner_id', null)).maybeSingle();
  if (ya) return ya.id;
  const { data } = await supabase.from('tel_sesiones').insert({
    owner_id: userId, nombre: 'Llamadas sueltas', origen: { suelta: true },
    // Nace terminada: nada que recorra sesiones vivas debe encontrarla.
    estado: 'terminada', modo: 'manual', terminada_at: ahora(),
    presentacion_nombre: nombreUsuario || null,
  }).select('id').maybeSingle();
  return data?.id || null;
}

export type ItemSuelto = { id: string; sesion_id: string; contact_id: string | null; conversation_id: string | null; telefono: string; nombre: string | null; nuevo: boolean };

/**
 * El item de una llamada normal. Idempotente: quien llegue primero lo crea
 * —el webhook de la transcripción o la sala en el navegador— y el resto lo
 * encuentra. Devuelve null si la llamada no existe en el espejo todavía.
 *
 * Si la llamada es de una sesión de verdad (el marcador), devuelve ESE item:
 * no se duplica nada, es el mismo riel.
 */
export async function itemDeLlamada(callSid: string, o: { userId?: string | null; nombreUsuario?: string | null; telefono?: string | null } = {}): Promise<ItemSuelto | null> {
  if (!callSid) return null;
  const { data: ya } = await supabase.from('tel_sesion_items')
    .select('id, sesion_id, contact_id, conversation_id, telefono, nombre, tel_sesiones(owner_id, origen)')
    .eq('call_sid', callSid).limit(1).maybeSingle();
  if (ya) {
    /* La primera vez puede que no hubiera dueño (el webhook llega antes de que
       el navegador diga quién contestó). En cuanto se sabe, se le pone: el
       dueño es quien va a recibir la reunión en SU Google Calendar. */
    const ses: any = (ya as any).tel_sesiones;
    if (o.userId && ses && !ses.owner_id && ses.origen?.suelta) {
      const destino = await sesionSuelta(o.userId, o.nombreUsuario);
      if (destino && destino !== ya.sesion_id) await supabase.from('tel_sesion_items').update({ sesion_id: destino, updated_at: ahora() }).eq('id', ya.id);
    }
    return { id: ya.id, sesion_id: ya.sesion_id, contact_id: ya.contact_id, conversation_id: ya.conversation_id, telefono: ya.telefono, nombre: ya.nombre, nuevo: false };
  }

  // De dónde salen los datos: del espejo de la llamada, que lo escribe el
  // TwiML en cuanto Twilio la crea (entrante o saliente, siempre existe).
  const { data: ll } = await supabase.from('wa_llamadas')
    .select('call_id, telefono, direccion, conversation_id, atendida_por').eq('call_id', callSid).maybeSingle();
  const telefono = ll?.telefono || o.telefono || null;
  if (!telefono || telefono === 'desconocido') return null;

  let conversationId = ll?.conversation_id || null;
  let contactId: string | null = null, companyId: string | null = null, nombre: string | null = null, empresa: string | null = null;
  if (conversationId) {
    const { data: conv } = await supabase.from('wa_conversaciones')
      .select('contact_id, contacts(nombre, apellido, company_id, companies(nombre, nombre_comercial))').eq('id', conversationId).maybeSingle();
    contactId = (conv as any)?.contact_id || null;
    const c: any = (conv as any)?.contacts;
    nombre = c ? [c.nombre, c.apellido].filter(Boolean).join(' ') || null : null;
    companyId = c?.company_id || null;
    empresa = c?.companies?.nombre_comercial || c?.companies?.nombre || null;
  }

  const userId = o.userId || ll?.atendida_por || null;
  const sesionId = await sesionSuelta(userId, o.nombreUsuario);
  if (!sesionId) return null;

  const { data: nuevo } = await supabase.from('tel_sesion_items').insert({
    sesion_id: sesionId, contact_id: contactId, company_id: companyId, conversation_id: conversationId,
    nombre, empresa, telefono, lada: ladaDe(telefono), call_sid: callSid,
    // `en_linea` porque a esto se llega cuando ya hay alguien hablando: no hay
    // veredicto que dar (para eso está el marcador), hay conversación que oír.
    estado: 'en_linea', intentos: 1, orden: 0,
    marcado_at: ahora(), contestado_at: ahora(), en_linea_at: ahora(),
    veredicto: 'persona', veredicto_fuente: 'suelta', oido: [],
  }).select('id, sesion_id, contact_id, conversation_id, telefono, nombre').maybeSingle();
  if (!nuevo) {
    // Carrera: otro lo insertó entre la consulta y ahora. Se vuelve a buscar.
    const { data: otra } = await supabase.from('tel_sesion_items').select('id, sesion_id, contact_id, conversation_id, telefono, nombre').eq('call_sid', callSid).limit(1).maybeSingle();
    return otra ? { ...(otra as any), nuevo: false } : null;
  }
  return { ...(nuevo as any), nuevo: true };
}

/** Al colgar una llamada suelta: se cierra el item y arranca el cierre con IA
 *  (el MISMO que usan las llamadas de la lista). Nunca lanza. */
export async function cerrarLlamadaSuelta(callSid: string, o: { userId?: string | null; resultado?: string | null; nota?: string | null; soloSiExiste?: boolean } = {}): Promise<{ ok: boolean; itemId: string | null }> {
  try {
    /* `soloSiExiste` es para quien llama sin saber si esta llamada es suelta —el
       webhook del final del <Dial>, que recibe TODAS—: si no hay item, no se
       crea uno nuevo para cerrarlo en el mismo suspiro. */
    const it = o.soloSiExiste
      ? await (async () => {
          const { data } = await supabase.from('tel_sesion_items').select('id, sesion_id, contact_id, conversation_id, telefono, nombre').eq('call_sid', callSid).limit(1).maybeSingle();
          return data ? { ...(data as any), nuevo: false } as ItemSuelto : null;
        })()
      : await itemDeLlamada(callSid, { userId: o.userId });
    if (!it) return { ok: false, itemId: null };
    /* ══ NUNCA UN ITEM DE LA CABINA ════════════════════════════════════════
       `call_sid` también identifica a las llamadas de Llamadas inteligentes, y
       ésas las cierra la cabina con su propio flujo (resultado, nota, siguiente
       de la lista). Cerrarlas desde aquí sería adelantarse a la sesión y dejar
       al vendedor sin su pantalla de cierre. */
    const { data: ses } = await supabase.from('tel_sesiones').select('origen').eq('id', it.sesion_id).maybeSingle();
    if (!esSuelta(ses)) return { ok: false, itemId: null };
    const { data: fila } = await supabase.from('tel_sesion_items').select('estado, contestado_at, oido, cierre_estado').eq('id', it.id).maybeSingle();
    if (!fila || fila.estado === 'hecho') return { ok: true, itemId: it.id };
    const seg = fila.contestado_at ? Math.max(0, Math.round((Date.now() - new Date(fila.contestado_at).getTime()) / 1000)) : 0;
    await supabase.from('tel_sesion_items').update({
      estado: 'hecho', terminado_at: ahora(), duracion_seg: seg, updated_at: ahora(),
      ...(o.resultado ? { resultado: o.resultado } : {}),
      ...(o.nota ? { nota: o.nota } : {}),
    }).eq('id', it.id);
    return { ok: true, itemId: it.id };
  } catch { return { ok: false, itemId: null }; }
}
