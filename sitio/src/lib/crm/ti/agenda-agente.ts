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

/** «jueves 3 de sep a las 10 am» — la misma etiqueta que usa el prompt. */
export const etiquetaHorario = (fecha: string, hora: string) => fmt(fecha, hora);
export const LIGA_AGENDA = `${BASE}/agendar/demo`;

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

/** Horarios reales para la LLAMADA DISCOVERY (15 min): desde las 11:00, próximos 4 días, dos opciones distintas. */
export async function horariosParaLlamada(opts: { mejorHora?: number | null } = {}): Promise<Horario[]> {
  // Regla del dueño: siempre con ≥ 2 h de anticipación y a partir de las 11:00 de HOY o de MAÑANA (no más lejos).
  const todos = await horariosParaDemo({ slug: 'llamada-discovery', dias: 1, max: 12, mejorHora: opts.mejorHora ?? null });
  const ahoraCdmx = Date.now() - 6 * 3600e3;
  const hoy = new Date(ahoraCdmx).toISOString().slice(0, 10);
  const minutosAhora = (ahoraCdmx % 86400e3) / 60000;
  const ok = todos.filter(h => {
    const [hh, mm] = h.hora.split(':').map(Number);
    if (hh < 11) return false;
    if (h.fecha === hoy && hh * 60 + mm < minutosAhora + 120) return false;   // ≥ 2 h de anticipación
    return true;
  });
  // Primero lo de hoy, luego lo de mañana; dos opciones distintas.
  ok.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const out: Horario[] = [];
  for (const h of ok) { if (out.length >= 2) break; if (!out.some(o => o.fecha === h.fecha && o.hora === h.hora)) out.push(h); }
  return out;
}
export const llamadaTexto = (hs: Horario[]) => hs.length
  ? `LLAMADA RÁPIDA (15 min, la hace el consultor; solo hoy o mañana, desde las 11:00 y con al menos 2 h de anticipación): horarios reales ${hs.map(h => `${h.etiqueta} [${h.fecha} ${h.hora}]`).join(' · ')}. Ofrécela cuando el lead no responde sobre el horario de la demo, cuando pide hablar con alguien, o como tercer ángulo del seguimiento. Si acepta uno, devuelve accion.tipo="agendar_llamada" con esa fecha y hora (necesita correo, igual que la demo).`
  : '';

/** Crea la demo por el agendador real. Devuelve la reunión o el error legible.
 *  Condiciones cubiertas (caso Prueba Aaron, 2026-09-01): el contacto del CRM sin correo
 *  se completa ANTES de llamar a /book (así /book lo encuentra por correo y no crea un
 *  duplicado ni tropieza con sus columnas); un 5xx/timeout se reintenta una vez; y el
 *  resultado dice si el horario estaba ocupado, si la cita quedó sin liga de Meet, o si falló. */
export async function agendarDemo(o: { nombre: string; email: string; whatsapp: string; fecha: string; hora: string; contactId?: string | null; empresa?: string | null; giro?: string | null; sucursales?: number | null; notas?: string; slug?: string; partnerId?: string | null }): Promise<{ ok: boolean; booking?: any; error?: string; ocupado?: boolean; sinMeet?: boolean; intentos?: number }> {
  const email = String(o.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'correo inválido: ' + o.email };
  // 0) Que /book encuentre a ESTE contacto (busca por correo). Si el correo ya es de otro contacto, no lo pisamos.
  if (o.contactId) {
    const { data: c } = await supabase.from('contacts').select('id, email').eq('id', o.contactId).maybeSingle();
    if (c && !c.email) {
      const { data: otro } = await supabase.from('contacts').select('id').eq('email', email).neq('id', o.contactId).limit(1).maybeSingle();
      if (!otro) await supabase.from('contacts').update({ email, updated_at: new Date().toISOString() }).eq('id', o.contactId);
    }
  }
  let ultimo = '';
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const r = await fetch(`${BASE}/api/scheduling/book`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          event_type_slug: o.slug || 'demo', fecha: o.fecha, hora_inicio: o.hora,
          nombre: o.nombre, email, whatsapp: o.whatsapp, empresa: o.empresa || undefined, giro: o.giro || undefined, sucursales: o.sucursales ? Number(o.sucursales) : undefined,
          notas: o.notas || 'Agendada por el agente SDR desde WhatsApp', timezone: 'America/Mexico_City',
          utm_source: 'agente_ia', utm_medium: 'whatsapp', utm_campaign: 'sdr', ref_partner_id: o.partnerId || undefined,
        }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (r.ok && !j?.error) {
        const booking = j?.booking || j;
        return { ok: true, booking, sinMeet: !booking?.google_meet_link, intentos: intento };
      }
      ultimo = String(j?.error || r.status);
      const ocupado = /disponible|available|ocupad|taken|slot|anticipaci|pasad/i.test(ultimo);
      // 4xx = dato o regla (horario ocupado, correo, anticipación): no se reintenta. 5xx = se reintenta una vez.
      if (ocupado || (r.status >= 400 && r.status < 500)) return { ok: false, error: ultimo, ocupado, intentos: intento };
    } catch (e: any) { ultimo = String(e?.message || e); }
    if (intento === 1) await new Promise(res => setTimeout(res, 1500));
  }
  return { ok: false, error: ultimo, ocupado: false, intentos: 2 };
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
