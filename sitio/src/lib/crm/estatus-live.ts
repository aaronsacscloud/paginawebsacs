// LEADS · Disparadores EN VIVO del estatus (los dos campos del modelo:
// lifecycle_stage = quién es · estatus_lead = el contacto/engagement).
//
// El cron nocturno recalcula todo desde los hechos (idempotente); estos dos
// empujones existen para que la pestaña cambie EN EL MOMENTO: mandar el
// primer mensaje mueve nuevo→contactado, y una respuesta del cliente mueve
// a respondio. Solo avanzan (nunca retroceden) y el cron llega después a la
// misma conclusión.
import { supabase } from '../supabase';

/** El cliente respondió (WhatsApp entrante): nuevo/contactado/sin_respuesta → respondio. */
export async function marcarRespondio(contactId?: string | null) {
  if (!contactId) return;
  const ahora = new Date().toISOString();
  await supabase.from('contacts').update({ estatus_lead: 'respondio', estatus_lead_at: ahora })
    .eq('id', contactId).in('estatus_lead', ['nuevo', 'contactado', 'sin_respuesta']).then(() => {});
  await supabase.from('contacts').update({ respondio_at: ahora }).eq('id', contactId).is('respondio_at', null).then(() => {});
}

/** Le escribimos o llamamos (toque saliente humano): nuevo → contactado. */
export async function marcarContactado(contactId?: string | null) {
  if (!contactId) return;
  const ahora = new Date().toISOString();
  await supabase.from('contacts').update({ estatus_lead: 'contactado', estatus_lead_at: ahora })
    .eq('id', contactId).eq('estatus_lead', 'nuevo').then(() => {});
  await supabase.from('contacts').update({ last_contact_at: ahora }).eq('id', contactId).then(() => {});
}

/** Agendó reunión: cualquier estatus previo al hito → agendado (solo avanza). */
export async function marcarAgendado(contactId?: string | null) {
  if (!contactId) return;
  await supabase.from('contacts').update({ estatus_lead: 'agendado', estatus_lead_at: new Date().toISOString() })
    .eq('id', contactId).in('estatus_lead', ['nuevo', 'contactado', 'sin_respuesta', 'respondio', 'descubrimiento']).then(() => {});
}

/** Asistió a la reunión: → demo_hecha (solo avanza). */
export async function marcarDemoHecha(contactId?: string | null) {
  if (!contactId) return;
  await supabase.from('contacts').update({ estatus_lead: 'demo_hecha', estatus_lead_at: new Date().toISOString() })
    .eq('id', contactId).in('estatus_lead', ['nuevo', 'contactado', 'sin_respuesta', 'respondio', 'descubrimiento', 'agendado']).then(() => {});
}
