// ══ El cliente tocó un horario: se agenda solo ═════════════════════════════
//
// Llega desde el webhook cuando la respuesta interactiva trae un id nuestro
// (`ag:<oferta>:<n>`). Reserva con el MISMO `/api/scheduling/book` de la
// página pública: así corre entera la cadena que ya existe —correo con
// invitación, confirmación por WhatsApp, secuencia de «demo agendada»— en vez
// de abrir un camino paralelo que habría que mantener aparte.
//
// Las tres cosas que pueden salir mal, y qué se hace con cada una:
//  · el horario se ocupó entre que se mandó la lista y el cliente tocó
//    → se le dice y se le ofrecen horarios nuevos;
//  · la oferta ya venció o ya se usó → se le dice, sin agendar dos veces;
//  · la reserva falla por otra cosa → se avisa al equipo en el hilo, porque el
//    cliente ya hizo su parte y no puede quedarse esperando.
import { supabase } from '../supabase';
import { sendWhatsApp } from '../kapso';
import { permitido } from './permisos';

const RE_ID = /^ag:([0-9a-f]{8}):(\d{1,2})$/i;

export function esRespuestaDeAgenda(id?: string | null): boolean {
  return !!id && RE_ID.test(String(id));
}

export async function agendarDesdeRespuesta(o: {
  idRespuesta: string; telefono: string; conversationId?: string | null; base: string;
}): Promise<{ agendada: boolean; motivo?: string }> {
  /* La lista de horarios automática está pausada, así que ya no se generan
     ofertas nuevas — pero una lista VIEJA sigue en el chat del cliente, y
     tocarla dispararía todo esto: reserva y tres mensajes posibles. Pasa por
     el mismo permiso que la generó. */
  if (!(await permitido('agenda_horarios_auto'))) return { agendada: false, motivo: 'la agenda automática está pausada' };
  const m = RE_ID.exec(String(o.idRespuesta));
  if (!m) return { agendada: false, motivo: 'No es una respuesta de agenda' };
  const [, corto, nStr] = m;
  const n = Number(nStr);

  // La oferta se busca por teléfono + prefijo del id: el id de la fila solo
  // lleva los primeros 8 caracteres del uuid, y dos ofertas del MISMO cliente
  // con el mismo prefijo es un caso que no ocurre en la práctica.
  const { data: ofertas } = await supabase.from('wa_agenda_ofertas')
    .select('id, estado, opciones, telefono, event_type_slug, invitee_nombre, invitee_email, invitee_empresa, conversation_id, expira_at')
    .eq('telefono', o.telefono).order('created_at', { ascending: false }).limit(10);
  const oferta = (ofertas || []).find((x: any) => String(x.id).startsWith(corto));
  if (!oferta) return { agendada: false, motivo: 'No encontré la oferta' };

  if (oferta.estado === 'agendada') {
    await sendWhatsApp(o.telefono, 'Esa reunión ya está agendada — te llegó la confirmación por WhatsApp y por correo. Si necesitas moverla, dime y la cambiamos.', 'Agenda');
    return { agendada: false, motivo: 'La oferta ya se usó' };
  }
  if (new Date(oferta.expira_at as string) < new Date()) {
    await sendWhatsApp(o.telefono, 'Esos horarios ya vencieron. Dime qué día te queda bien y te mando opciones nuevas.', 'Agenda');
    await supabase.from('wa_agenda_ofertas').update({ estado: 'vencida' }).eq('id', oferta.id);
    return { agendada: false, motivo: 'La oferta venció' };
  }

  const elegido = ((oferta.opciones as any[]) || []).find((x: any) => Number(x.n) === n);
  if (!elegido) return { agendada: false, motivo: 'Esa opción no estaba en la oferta' };

  const r = await fetch(`${o.base}/api/scheduling/book`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type_slug: oferta.event_type_slug,
      fecha: elegido.fecha, hora_inicio: elegido.hora,
      nombre: oferta.invitee_nombre, email: oferta.invitee_email,
      whatsapp: oferta.telefono, empresa: oferta.invitee_empresa || undefined,
      notas: 'El cliente eligió su horario desde WhatsApp',
      timezone: 'America/Mexico_City', utm_source: 'whatsapp', utm_medium: 'inbox_agenda',
    }),
  }).then(x => x.json()).catch(e => ({ error: String(e) }));

  if (r?.error) {
    // Se ocupó mientras tanto: no es culpa del cliente y hay que darle salida.
    const ocupado = /disponible|available|ocupad|taken|slot/i.test(String(r.error));
    await sendWhatsApp(o.telefono, ocupado
      ? 'Ese horario se acaba de ocupar. Dime otro que te sirva y lo aparto, o te mando opciones nuevas.'
      : 'No pude apartar ese horario. Ya le avisé al equipo para que te confirme en un momento.', 'Agenda');
    if (oferta.conversation_id) {
      await supabase.from('wa_eventos').insert({
        conversation_id: oferta.conversation_id, tipo: 'agenda', autor: 'Agenda',
        detalle: `El cliente eligió ${elegido.fecha} ${elegido.hora} pero no se pudo agendar: ${String(r.error).slice(0, 120)}`,
      });
    }
    await supabase.from('wa_agenda_ofertas').update({ estado: ocupado ? 'ocupada' : 'fallida', elegido }).eq('id', oferta.id);
    return { agendada: false, motivo: String(r.error) };
  }

  await supabase.from('wa_agenda_ofertas')
    .update({ estado: 'agendada', booking_id: r?.booking?.id || r?.id || null, elegido })
    .eq('id', oferta.id);
  // La línea en el hilo: quien abra la conversación ve que se agendó sola.
  if (oferta.conversation_id) {
    await supabase.from('wa_eventos').insert({
      conversation_id: oferta.conversation_id, tipo: 'agenda', autor: 'Agenda',
      detalle: `El cliente eligió su horario y la reunión quedó agendada: ${elegido.fecha} ${String(elegido.hora).slice(0, 5)}`,
    });
  }
  return { agendada: true };
}
