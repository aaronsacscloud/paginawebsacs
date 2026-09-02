// ══ El botón «Reagendar» de un recordatorio, cerrado ═══════════════════════
//
// Los botones de una plantilla de WhatsApp llegan como un mensaje de texto con
// el texto del botón y nada más. Sin esto, «Reagendar» caía en el inbox y ahí
// moría: el cliente creía haber pedido algo y del otro lado no pasaba nada
// hasta que alguien leyera el chat. Y quien toca ese botón está diciendo que
// SÍ quiere la reunión — es de las señales más fuertes que da un lead.
//
// Tocar el botón abre la ventana de 24 h de Meta (es un mensaje entrante), así
// que la respuesta SÍ puede ir en texto libre: es el único caso de este módulo
// donde no hace falta plantilla.
import { supabase } from '../supabase';
import { enviarTexto } from '../whatsapp/kapso-api';
import { registrarMensaje } from '../whatsapp/espejo';
import { fmtFechaLarga, fmtHora, inicioMs } from './recordatorios';

const BASE = 'https://www.sacscloud.com';

/**
 * La próxima reunión viva del contacto — la que TODAVÍA no empieza.
 *
 * Antes se pedía `fecha >= hoy` y se tomaba la primera: el día entero contaba,
 * la hora no. Natalia tocó «Reagendar» a las 21:13 sobre una reunión de las
 * 21:00 y el sistema le contestó «tu reunión sigue en pie» a una hora que ya
 * había pasado. Se traen unas cuantas y se escoge la primera que de verdad
 * esté por delante; si ninguna lo está, se devuelve la última con
 * `paso: true` para poder decirlo en vez de fingir que sigue en pie.
 */
async function proximaReunion(contactId: string, campos: string) {
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const { data } = await supabase.from('bookings')
    .select(campos)
    .eq('contact_id', contactId).in('estado', ['confirmada', 'agendada'])
    .gte('fecha', hoy).order('fecha', { ascending: true }).order('hora_inicio', { ascending: true })
    .limit(5);
  const lista = (data || []) as any[];
  if (!lista.length) return null;
  const ahora = Date.now();
  const viva = lista.find(x => inicioMs(String(x.fecha), String(x.hora_inicio)) > ahora);
  return viva ? { ...viva, paso: false } : { ...lista[lista.length - 1], paso: true };
}

export async function ligaParaReagendar(conversationId: string, telefono: string): Promise<{ ok: boolean; motivo?: string }> {
  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('contact_id').eq('id', conversationId).maybeSingle();
  if (!conv?.contact_id) return { ok: false, motivo: 'la conversación no está ligada a un contacto' };

  /* La reunión VIVA más próxima de ese contacto. Si tiene varias, la que
     sigue: es de la que acaba de recibir el recordatorio. */
  const b = await proximaReunion(conv.contact_id, 'id, fecha, hora_inicio, token_reagendar, event_types(nombre)');

  /* Sin reunión viva NO se inventa una liga: se le pasa la página de agenda,
     que es lo honesto — pudo tocar el botón de un recordatorio de una reunión
     que ya se canceló. */
  const liga = b?.token_reagendar ? `${BASE}/agendar/reagendar?token=${b.token_reagendar}` : `${BASE}/agendar/demo`;
  /* El texto tiene que dejar clarísimo que TODAVÍA NO se movió nada. El
     anterior decía «Claro, movemos tu Reunión del lunes 31 a las 8:00 p.m.»
     y se leía como si esa fuera la hora NUEVA y el cambio ya estuviera hecho
     — el cliente creía tener cita nueva y nadie había escogido horario. */
  /* Si la reunión YA PASÓ no se dice «sigue en pie»: se reconoce y se ofrece
     una nueva. Prometerle al cliente una hora que ya se fue es peor que no
     contestarle. */
  const texto = b?.paso
    ? [
        `Claro que sí. Tu ${(b as any).event_types?.nombre || 'reunión'} estaba para el ${fmtFechaLarga(b.fecha as string)} a las ${fmtHora(String(b.hora_inicio))} (hora del centro de México) y esa hora ya pasó.`,
        ``,
        `Escoge aquí el horario que te acomode y la dejamos agendada:`,
        liga,
      ].join('\n')
    : b
    ? [
        `Claro que sí. Tu ${(b as any).event_types?.nombre || 'reunión'} está ahora mismo para el ${fmtFechaLarga(b.fecha as string)} a las ${fmtHora(String(b.hora_inicio))} (hora del centro de México).`,
        ``,
        `Para moverla, escoge tu nuevo horario aquí:`,
        liga,
        ``,
        `Hasta que elijas uno, tu reunión sigue en pie a la hora de arriba.`,
      ].join('\n')
    : [
        `Claro que sí. Ahorita no encuentro una reunión próxima tuya, así que puedes escoger el horario que te acomode aquí:`,
        liga,
      ].join('\n');

  try {
    const r = await enviarTexto(telefono, texto);
    await registrarMensaje({
      kapsoMessageId: r?.messages?.[0]?.id || null, telefono, direccion: 'saliente',
      tipo: 'text', cuerpo: texto, status: 'sent', autor: 'Agenda',
      metadata: { reagendar_auto: b?.id || null },
    }).catch(() => { /* el espejo no tumba un envío que ya salió */ });

    if (b?.id) {
      await supabase.from('activities').insert({
        contact_id: conv.contact_id, tipo: 'sistema', automatico: true,
        titulo: 'Pidió reagendar desde el recordatorio: se le mandó la liga',
        metadata: { booking_id: b.id },
      });
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, motivo: String(e?.message || e) };
  }
}

/**
 * El cliente tocó «Ahí estaré». Se le contesta y queda registrado.
 *
 * Antes ese toque caía en el inbox y ahí moría: el cliente confirmaba y del
 * otro lado no pasaba nada, ni siquiera quedaba anotado que había confirmado
 * — que es justo la señal que separa al que va a llegar del que no.
 */
export async function confirmoAsistencia(conversationId: string, telefono: string): Promise<boolean> {
  /* Devuelve SI de verdad contestó. Antes era void y el webhook daba por
     atendido el mensaje aun cuando esta función salía en silencio (sin
     contacto o sin reunión futura): el cliente se quedaba sin la confirmación
     Y sin la bienvenida automática — un mensaje entrante sin ninguna
     respuesta, que es peor que las dos voces que se querían evitar. */
  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('contact_id').eq('id', conversationId).maybeSingle();
  if (!conv?.contact_id) return false;

  const b = await proximaReunion(conv.contact_id, 'id, fecha, hora_inicio, google_meet_link, event_types(nombre)');
  if (!b) return false;

  /* Confirmar asistencia a algo que ya empezó no es «te esperamos»: es «ya
     estamos ahí, éntrale». */
  if (b.paso) {
    const yaTexto = [
      `¡Perfecto! Tu ${(b as any).event_types?.nombre || 'reunión'} era el ${fmtFechaLarga(b.fecha as string)} a las ${fmtHora(String(b.hora_inicio))} y ya empezó.`,
      b.google_meet_link ? `` : '',
      b.google_meet_link ? `Éntrale aquí: ${b.google_meet_link}` : `Respóndenos por aquí y la movemos.`,
    ].filter(l => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    try {
      const r = await enviarTexto(telefono, yaTexto);
      await registrarMensaje({
        kapsoMessageId: r?.messages?.[0]?.id || null, telefono, direccion: 'saliente',
        tipo: 'text', cuerpo: yaTexto, status: 'sent', autor: 'Agenda',
        metadata: { confirmo_asistencia: b.id },
      }).catch(() => {});
      return true;
    } catch { return false; }
  }

  const texto = [
    `¡Perfecto! Te esperamos el ${fmtFechaLarga(b.fecha as string)} a las ${fmtHora(String(b.hora_inicio))} (hora del centro de México).`,
    b.google_meet_link ? `` : '',
    b.google_meet_link ? `Aquí te conectas: ${b.google_meet_link}` : '',
  ].filter(l => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  try {
    const r = await enviarTexto(telefono, texto);
    await registrarMensaje({
      kapsoMessageId: r?.messages?.[0]?.id || null, telefono, direccion: 'saliente',
      tipo: 'text', cuerpo: texto, status: 'sent', autor: 'Agenda',
      metadata: { confirmo_asistencia: b.id },
    }).catch(() => { /* el espejo no tumba un envío que ya salió */ });
    await supabase.from('activities').insert({
      contact_id: conv.contact_id, tipo: 'sistema', automatico: true,
      titulo: 'Confirmó asistencia desde el recordatorio',
      metadata: { booking_id: b.id },
    });
    return true;
  } catch { return false; }
}
