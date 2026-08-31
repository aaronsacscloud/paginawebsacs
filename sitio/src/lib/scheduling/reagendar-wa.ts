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
  const cual = b
    ? `tu ${(b as any).event_types?.nombre || 'reunión'} del ${fmtFechaLarga(b.fecha as string)} a las ${fmtHora(String(b.hora_inicio))}`
    : 'tu reunión';

  const texto = [
    `Claro, movemos ${cual} sin problema.`,
    ``,
    `Escoge el horario que te acomode aquí:`,
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
