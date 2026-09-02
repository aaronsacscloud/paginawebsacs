// TRABAJO INTELIGENTE · LA AGENDA DEL AGENTE: horarios reales y la cita de verdad.
//
// El agente propone DOS horarios que existen en el calendario (available-slots
// del tipo «demo»), ordenados por la probabilidad de que la reunión ocurra
// (puntajes históricos de asistencia) y por la mejor hora del lead. Cuando el
// lead elige, la cita se crea por el MISMO camino que el agendador público
// (/api/scheduling/book): contacto, oportunidad, Google Calendar/Meet,
// confirmación por WhatsApp y correo, recordatorios. Nada paralelo.
import { supabase } from '../../supabase';
import { puntajesHistoricos, puntuar } from '../../scheduling/mejores-horarios';

const BASE = 'https://www.sacscloud.com';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export type Horario = { fecha: string; hora: string; etiqueta: string; puntaje: number };

const fmt = (fecha: string, hora: string) => {
  const d = new Date(fecha + 'T12:00:00');
  const [h, m] = hora.split(':').map(Number);
  const h12 = ((h + 11) % 12) + 1, ampm = h >= 12 ? 'pm' : 'am';
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} a las ${h12}${m ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`;
};

/** Los mejores horarios libres para una demo en los próximos días (hora CDMX). */
export async function horariosParaDemo(opts: { slug?: string; dias?: number; mejorHora?: number | null; max?: number } = {}): Promise<Horario[]> {
  const slug = opts.slug || 'demo', dias = opts.dias || 6, max = opts.max || 4;
  const hoy = new Date(Date.now() - 6 * 3600e3); // fecha CDMX
  const from = hoy.toISOString().slice(0, 10);
  const to = new Date(hoy.getTime() + dias * 86400e3).toISOString().slice(0, 10);
  let dates: Record<string, string[]> = {};
  try {
    const r = await fetch(`${BASE}/api/scheduling/available-slots?slug=${slug}&from=${from}&to=${to}&tz=America/Mexico_City`, { signal: AbortSignal.timeout(12000) });
    const j: any = await r.json();
    dates = j?.dates || {};
  } catch { return []; }
  const pts = await puntajesHistoricos().catch(() => null);
  const ahoraLocalMin = (Date.now() - 6 * 3600e3) % 86400e3 / 60000;
  const todos: Horario[] = [];
  for (const [fecha, horas] of Object.entries(dates)) {
    for (const hora of horas || []) {
      const [h, m] = hora.split(':').map(Number);
      // Hoy: solo lo que empieza en más de 2 horas. Horario comercial: 9–18.
      if (fecha === from && h * 60 + m < ahoraLocalMin + 120) continue;
      if (h < 9 || h >= 18) continue;
      let puntaje = pts ? puntuar(pts, fecha, hora) : 0.5;
      if (opts.mejorHora != null && Math.abs(h - opts.mejorHora) <= 1) puntaje += 0.25;   // la hora en que ESE lead contesta
      if (fecha === from) puntaje -= 0.1;                                                  // hoy mismo suele fallar
      todos.push({ fecha, hora: hora.slice(0, 5), etiqueta: fmt(fecha, hora), puntaje });
    }
  }
  // Dos opciones distintas entre sí: distinto día, o distinto bloque (mañana/tarde).
  todos.sort((a, b) => b.puntaje - a.puntaje);
  const elegidos: Horario[] = [];
  for (const h of todos) {
    if (elegidos.length >= max) break;
    const choca = elegidos.some(e => e.fecha === h.fecha && (Number(e.hora.slice(0, 2)) < 13) === (Number(h.hora.slice(0, 2)) < 13));
    if (!choca) elegidos.push(h);
  }
  return elegidos;
}

export const horariosTexto = (hs: Horario[]) => hs.length
  ? `HORARIOS REALES DISPONIBLES PARA LA DEMO (hora de CDMX; ofrece máximo dos, distintos entre sí): ${hs.map(h => `${h.etiqueta} [${h.fecha} ${h.hora}]`).join(' · ')}. Si el lead elige uno, devuelve accion.tipo="agendar" con esa fecha y hora exactas; si prefiere otro, pide día y bloque y en el siguiente turno se le ofrecen.`
  : 'No hay horarios de demo disponibles en los próximos días: si el lead quiere agendar, dile que el consultor le confirma un horario hoy mismo y escala.';

/** Crea la demo por el agendador real. Devuelve la reunión o el error legible. */
export async function agendarDemo(o: { nombre: string; email: string; whatsapp: string; fecha: string; hora: string; empresa?: string | null; giro?: string | null; sucursales?: number | null; notas?: string; slug?: string; partnerId?: string | null }): Promise<{ ok: boolean; booking?: any; error?: string; ocupado?: boolean }> {
  try {
    const r = await fetch(`${BASE}/api/scheduling/book`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        event_type_slug: o.slug || 'demo', fecha: o.fecha, hora_inicio: o.hora,
        nombre: o.nombre, email: o.email, whatsapp: o.whatsapp, empresa: o.empresa || undefined, giro: o.giro || undefined, sucursales: o.sucursales || undefined,
        notas: o.notas || 'Agendada por el agente SDR desde WhatsApp', timezone: 'America/Mexico_City',
        utm_source: 'agente_ia', utm_medium: 'whatsapp', utm_campaign: 'sdr', ref_partner_id: o.partnerId || undefined,
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j?.error) {
      const msg = String(j?.error || r.status);
      return { ok: false, error: msg, ocupado: /disponible|available|ocupad|taken|slot/i.test(msg) };
    }
    return { ok: true, booking: j?.booking || j };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

/** La próxima reunión futura del contacto (para confirmar, reagendar, no-show). */
export async function proximaCita(contactId: string) {
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const { data } = await supabase.from('bookings').select('id, fecha, hora_inicio, estado, google_meet_link, token_reagendar, token_cancelar, event_types(nombre)')
    .eq('contact_id', contactId).gte('fecha', hoy).in('estado', ['agendada', 'confirmada']).order('fecha').order('hora_inicio').limit(1).maybeSingle();
  return data || null;
}

export const citaTexto = (b: any) => b
  ? `CITA VIGENTE DEL LEAD: ${fmt(b.fecha, String(b.hora_inicio).slice(0, 5))} (${b.event_types?.nombre || 'reunión'}, estado ${b.estado})${b.google_meet_link ? `, liga de Meet: ${b.google_meet_link}` : ''}${b.token_reagendar ? `, liga para reagendar: ${BASE}/agendar/reagendar?token=${b.token_reagendar}` : ''}. Si pregunta por ella, dale TODA la información; si quiere moverla, mándale la liga de reagendar o pide día y bloque para ofrecerle horarios.`
  : '';
