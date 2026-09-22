// De dónde salen las horas que se ofrecen, y qué reuniones ya las ocupan.
//
// Vivía copiado en tres lugares —los huecos que ve el cliente, la reserva y el
// reagendado— y por eso los tres tenían que cambiar juntos o se contradecían:
// la página ofrecía una hora y la reserva la rechazaba.
import { supabase } from '../supabase';

/* Los estados que OCUPAN la agenda. Hasta el 22-sep-2026 sólo contaba
   'confirmada', pero lo que se agenda desde el CRM nace 'agendada' (9 de las 11
   futuras ese día): el agendador público las ignoraba y sólo lo salvaba que
   Google también las tuviera. 'asistio' entra porque una junta marcada por
   adelantado sigue ocupando su hora. */
export const ESTADOS_OCUPAN = ['confirmada', 'agendada', 'asistio'];

/* El horario con el que se calcula un tipo de reunión para un anfitrión.
   Si el tipo trae su PROPIO horario (event_types.schedule_id) —la consultoría
   se atiende en otras horas que las demos— y ese horario es de este anfitrión,
   se usa ése. Si no, el default del anfitrión, como siempre. */
export async function horarioDelTipo(eventType: any, hostId: string): Promise<any | null> {
  if (eventType?.schedule_id) {
    const { data } = await supabase.from('availability_schedules')
      .select('*').eq('id', eventType.schedule_id).eq('team_member_id', hostId).eq('activo', true)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase.from('availability_schedules')
    .select('*').eq('team_member_id', hostId).eq('activo', true)
    .order('es_default', { ascending: false }).limit(1);
  return data?.[0] || null;
}
