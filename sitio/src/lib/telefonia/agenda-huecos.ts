/* LOS FLUJOS DE REUNIÓN QUE YA EXISTEN, Y SUS HUECOS DE VERDAD.
 *
 * PEDIDO DEL DUEÑO (19-sep-2026): «la cita que me debe sugerir debe estar
 * basada en las reuniones que tiene el usuario que le está llamando, para que
 * haga match con los flujos que ya se tienen —que en automático generan la
 * reunión, el mensaje y todo lo demás—. La IA debe elegir si es reunión demo o
 * llamada de seguimiento o cualquier CTA que haga match con la intención del
 * usuario, y validar los horarios en relación a ese flujo de trabajo».
 *
 * Qué pasaba hasta ahora, y por qué esto no es un lujo:
 *
 * 1. La IA elegía el tipo de reunión de una lista ESCRITA A MANO en el prompt:
 *    demo, seguimiento, cotización y discovery. En la base hay CATORCE tipos
 *    activos —capacitación, configuración, onboarding, consultoría, alianzas,
 *    crecimiento, dirección…— cada uno con su duración, su disponibilidad, su
 *    correo y sus recordatorios. Los otros diez no existían para las llamadas:
 *    el prospecto pedía una capacitación y se le agendaba una «demo».
 *
 * 2. La hora la inventaba la IA leyendo la transcripción («el jueves a las
 *    4»), sin mirar si a esa hora hay hueco. Si no lo había, la cita se creaba
 *    igual y encima de otra cosa — o fuera del horario de atención de ese
 *    tipo, que cada uno tiene el suyo.
 *
 * Aquí se traen las dos cosas —los tipos vivos y sus huecos reales— del MISMO
 * motor que usa la página pública de agenda: `/api/scheduling/available-slots`,
 * que ya respeta la disponibilidad semanal, las excepciones, lo que hay en
 * Google Calendar, los buffers, el aviso mínimo y el tope por día. No se copia
 * esa lógica: copiarla es garantizar que dentro de un mes la llamada ofrezca
 * horas que la agenda no acepta.
 */
import { supabase } from '../supabase';
/* La MISMA base que usa el resto de telefonía (los webhooks de Twilio la
   necesitan pública y fija). No se lee de `PUBLIC_SITE_URL` a propósito: en
   local vale `http://localhost:4321`, y entonces esto pediría los huecos a un
   servidor de desarrollo que casi nunca está levantado — que es exactamente lo
   que pasó al probarlo: cero huecos en los tres tipos, con la agenda llena. */
import { BASE } from './marcador';

export type TipoReunion = { slug: string; nombre: string; minutos: number };
export type Hueco = { fecha: string; hora: string };

/** Los tipos de reunión activos, tal como están configurados en Agenda. */
export async function tiposDeReunion(): Promise<TipoReunion[]> {
  const { data } = await supabase.from('event_types')
    .select('slug, nombre, duracion_minutos, activo')
    .eq('activo', true).order('duracion_minutos');
  return (data || []).map(t => ({ slug: String(t.slug), nombre: String(t.nombre), minutos: Number(t.duracion_minutos) || 30 }));
}

/**
 * Los próximos huecos de un tipo de reunión. `dias` es cuánto mirar hacia
 * delante; `tope` cuántos devolver.
 *
 * Devuelve [] —y no lanza— si el motor falla o el tipo no existe: una llamada
 * en curso no se puede quedar esperando a la agenda, y sin huecos la pantalla
 * enseña «no hay horarios» en vez de romperse.
 */
export async function huecosProximos(slug: string, dias = 10, tope = 12, tz = 'America/Mexico_City', host?: string | null): Promise<Hueco[]> {
  if (!slug) return [];
  const hoy = new Date();
  const fin = new Date(hoy.getTime() + dias * 86400e3);
  const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  try {
    /* `host`: de quién son los huecos. Sin él, los del dueño del tipo de
       evento (una demo la da quien la da). Con él, los de quien va a atender —
       el seguimiento de una llamada es de quien llamó, y ofrecer las horas
       libres de otra agenda para meter la cita en la propia es prometer un
       hueco que quizá no existe. */
    const r = await fetch(`${BASE}/api/scheduling/available-slots?slug=${encodeURIComponent(slug)}&from=${ymd(hoy)}&to=${ymd(fin)}&tz=${encodeURIComponent(tz)}${host ? `&host=${encodeURIComponent(host)}` : ''}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const j: any = await r.json();
    /* El motor contesta `{ dates: { "2026-09-22": ["09:00", "09:30", …] } }`.
       Se aplana EN ORDEN de fecha —las claves de un objeto no lo garantizan—
       y se corta: para decidir en una llamada sirven los ocho o diez primeros,
       no los doscientos de tres semanas. */
    const dias: Record<string, string[]> = j?.dates || {};
    const salida: Hueco[] = [];
    for (const fecha of Object.keys(dias).sort()) {
      for (const h of dias[fecha] || []) {
        salida.push({ fecha, hora: String(h).slice(0, 5) });
        if (salida.length >= tope) return salida;
      }
    }
    return salida;
  } catch { return []; }
}

/** «vie 26 · 16:00», que es como se dice por teléfono. */
export function huecoLegible(h: Hueco, tz = 'America/Mexico_City'): string {
  const d = new Date(`${h.fecha}T12:00:00`);
  const dia = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'short', day: 'numeric' }).format(d);
  return `${dia.replace('.', '')} · ${h.hora}`;
}

/**
 * ¿La hora que propuso la IA existe de verdad en la agenda de ese tipo?
 *
 * Si existe, se respeta tal cual. Si no, se devuelve el hueco REAL más cercano
 * —y quien llama se entera de que se movió—. La alternativa es lo de antes:
 * crear la cita a una hora que la agenda no acepta, que se ve bien en el CRM y
 * no le llega a nadie, o se encima con otra.
 */
export function ajustarAHueco(fecha: string, hora: string, huecos: Hueco[]): { fecha: string; hora: string; movido: boolean } | null {
  if (!huecos.length) return { fecha, hora, movido: false };   // sin datos de agenda no se corrige a ciegas
  const exacto = huecos.find(h => h.fecha === fecha && h.hora === hora);
  if (exacto) return { fecha, hora, movido: false };
  const pedido = new Date(`${fecha}T${hora}:00`).getTime();
  let mejor: Hueco | null = null, dist = Infinity;
  for (const h of huecos) {
    const d = Math.abs(new Date(`${h.fecha}T${h.hora}:00`).getTime() - pedido);
    if (d < dist) { dist = d; mejor = h; }
  }
  return mejor ? { fecha: mejor.fecha, hora: mejor.hora, movido: true } : null;
}
