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
import { fmtFechaLarga, fmtHora } from './recordatorios';

const BASE = 'https://www.sacscloud.com';

export async function ligaParaReagendar(conversationId: string, telefono: string): Promise<{ ok: boolean; motivo?: string }> {
  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('contact_id').eq('id', conversationId).maybeSingle();
  if (!conv?.contact_id) return { ok: false, motivo: 'la conversación no está ligada a un contacto' };

  /* La reunión VIVA más próxima de ese contacto. Si tiene varias, la que
     sigue: es de la que acaba de recibir el recordatorio. */
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const { data: b } = await supabase.from('bookings')
    .select('id, fecha, hora_inicio, token_reagendar, event_types(nombre)')
    .eq('contact_id', conv.contact_id).in('estado', ['confirmada', 'agendada'])
    .gte('fecha', hoy).order('fecha', { ascending: true }).order('hora_inicio', { ascending: true })
    .limit(1).maybeSingle();

  /* Sin reunión viva NO se inventa una liga: se le pasa la página de agenda,
     que es lo honesto — pudo tocar el botón de un recordatorio de una reunión
     que ya se canceló. */
  const liga = b?.token_reagendar ? `${BASE}/agendar/reagendar?token=${b.token_reagendar}` : `${BASE}/agendar/demo`;
  /* El texto tiene que dejar clarísimo que TODAVÍA NO se movió nada. El
     anterior decía «Claro, movemos tu Reunión del lunes 31 a las 8:00 p.m.»
     y se leía como si esa fuera la hora NUEVA y el cambio ya estuviera hecho
     — el cliente creía tener cita nueva y nadie había escogido horario. */
  const texto = b
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

  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const { data: b } = await supabase.from('bookings')
    .select('id, fecha, hora_inicio, google_meet_link, event_types(nombre)')
    .eq('contact_id', conv.contact_id).in('estado', ['confirmada', 'agendada'])
    .gte('fecha', hoy).order('fecha', { ascending: true }).order('hora_inicio', { ascending: true })
    .limit(1).maybeSingle();
  if (!b) return false;

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
