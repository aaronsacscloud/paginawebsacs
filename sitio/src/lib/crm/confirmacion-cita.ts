// ══ La confirmación de una cita, por el mismo camino que el inbox ══════════
//
// Se agende por donde se agende —página pública, inbox, botón de WhatsApp—,
// al cliente le llega SIEMPRE un WhatsApp con todos los datos del evento, y
// ese mensaje queda ESPEJADO en la conversación: quien abra el chat ve lo que
// el cliente ve, sin adivinar.
//
// Por qué existe este archivo: `book.ts` mandaba la confirmación con
// `sendWhatsApp` de lib/kapso, que apunta a `api.kapso.ai/v1/messages/send`
// —otra API distinta de la que usa el inbox (`meta/whatsapp/v24.0`)—, no
// espeja nada y devuelve `{sent:false}` que nadie lee. O sea: si ese camino
// está muerto, la confirmación se pierde en silencio y nadie se entera.
// Aquí se usa el mismo `enviarTexto` + `registrarMensaje` que el inbox, que
// es el que se sabe vivo porque se usa todo el día.
import { supabase } from '../supabase';
import { enviarTexto, usarNumero } from '../whatsapp/kapso-api';
import { registrarMensaje } from '../whatsapp/espejo';
import { telefonoWhatsApp } from '../telefono';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function fechaLarga(fecha: string): string {
  const [y, m, d] = String(fecha).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${d} de ${MESES[m - 1]}`;
}

export function horaAmPm(hora: string): string {
  const [h, m] = String(hora).slice(0, 5).split(':').map(Number);
  const ap = h >= 12 ? 'p.m.' : 'a.m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

/** El texto que ve el cliente. Todo lo del evento: qué, cuándo, con quién y
 *  por dónde entra — más cómo cancelar sin tener que escribir. */
export function textoConfirmacion(o: {
  nombre?: string | null; evento: string; fecha: string; hora: string;
  duracion?: number | null; host?: string | null; meet?: string | null; tokenCancelar?: string | null;
}): string {
  const saludo = String(o.nombre || '').trim().split(/\s+/)[0];
  return [
    saludo ? `${saludo}, tu ${o.evento.toLowerCase()} quedó confirmada.` : `Tu ${o.evento.toLowerCase()} quedó confirmada.`,
    ``,
    `📅 ${fechaLarga(o.fecha)} a las ${horaAmPm(o.hora)} (hora de la Ciudad de México)`,
    o.duracion ? `⏱ ${o.duracion} minutos` : '',
    o.host ? `👤 Te atiende ${o.host}` : '',
    o.meet ? `📹 Entras por aquí: ${o.meet}` : '',
    ``,
    `La invitación de calendario también te llegó por correo.`,
    o.tokenCancelar ? `Si necesitas moverla o cancelarla: https://www.sacscloud.com/agendar/cancelar?token=${o.tokenCancelar}` : '',
  ].filter(Boolean).join('\n');
}

/** Manda la confirmación al cliente y la deja espejada en su conversación.
 *  No lanza: una cita agendada no se cae porque el aviso falle. */
export async function confirmarCitaPorWhatsApp(bookingId: string): Promise<{ ok: boolean; motivo?: string }> {
  try {
    const { data: b } = await supabase.from('bookings')
      .select('id, fecha, hora_inicio, invitee_nombre, invitee_whatsapp, contact_id, host_id, google_meet_link, token_cancelar, event_type_id')
      .eq('id', bookingId).maybeSingle();
    if (!b) return { ok: false, motivo: 'La cita no existe' };

    // El teléfono: el que dejó al agendar o el del contacto del CRM.
    let tel = b.invitee_whatsapp || null;
    if (!tel && b.contact_id) {
      const { data: c } = await supabase.from('contacts').select('whatsapp, telefono').eq('id', b.contact_id).maybeSingle();
      tel = (c as any)?.whatsapp || (c as any)?.telefono || null;
    }
    const destino = telefonoWhatsApp(tel || '');
    if (!destino) return { ok: false, motivo: 'Sin WhatsApp al cual avisar' };

    const [{ data: tipo }, { data: host }] = await Promise.all([
      supabase.from('event_types').select('nombre, duracion_minutos').eq('id', b.event_type_id).maybeSingle(),
      b.host_id ? supabase.from('team_members').select('nombre').eq('id', b.host_id).maybeSingle() : Promise.resolve({ data: null } as any),
    ]);

    const texto = textoConfirmacion({
      nombre: b.invitee_nombre, evento: (tipo as any)?.nombre || 'reunión',
      fecha: b.fecha as string, hora: String(b.hora_inicio),
      duracion: (tipo as any)?.duracion_minutos || null,
      host: (host as any)?.nombre || null, meet: b.google_meet_link || null,
      tokenCancelar: b.token_cancelar || null,
    });

    // Si ya existe conversación con ese número, se responde POR SU NÚMERO
    // (multi-número: contestar por otro abre un hilo paralelo del lado del
    // cliente y rompe la ventana de 24 h de la conversación real).
    const { data: conv } = await supabase.from('wa_conversaciones')
      .select('id, phone_number_id').eq('telefono', destino).maybeSingle();
    usarNumero((conv as any)?.phone_number_id || null);

    const r = await enviarTexto(destino, texto);
    const wamid = r?.messages?.[0]?.id;
    if (wamid) {
      await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino, direccion: 'saliente',
        tipo: 'text', cuerpo: texto, status: 'sent', autor: 'Agenda',
        metadata: { confirmacion_cita: bookingId },
      });
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, motivo: String(e?.message || e) };
  }
}
