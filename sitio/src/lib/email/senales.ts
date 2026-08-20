// SEÑALES DE COMPORTAMIENTO — qué hace cada persona, en un solo lugar.
//
// El sistema medía "abrió" y "clicó" y ahí se detenía. Pero una apertura, con
// Apple Mail abriendo todo por su cuenta, no dice nada; y un clic solo dice
// que el link funcionó. Lo que vale es lo que pasa DESPUÉS: si entró, cuánto
// se quedó y qué páginas vio. Eso es intención de compra y es lo que decide a
// quién llamar hoy.
//
// Este módulo une las cinco fuentes que ya existían por separado (actividades,
// correos, reuniones, pagos, tratos) más la nueva de visitas.
import { supabase } from '../supabase';

/* ── Registro de visitas ──────────────────────────────────────────────── */

export interface Visita {
  contactId?: string | null;
  visitorId?: string | null;
  email?: string | null;
  ruta: string;
  titulo?: string | null;
  referrer?: string | null;
  sendId?: string | null;
  campaignId?: string | null;
  segundos?: number | null;
}

/**
 * Guarda una visita y, si se puede, la liga a una persona.
 *
 * El `visitor_id` es anónimo hasta que alguien deja su correo; por eso, al
 * identificarse, se hace una pasada hacia atrás (`ligarVisitasPrevias`) que
 * recupera todo lo que ya había navegado. Sin eso se perdería justo el
 * recorrido más interesante: el de antes de convertirse en lead.
 */
export async function registrarVisita(v: Visita): Promise<void> {
  const email = v.email ? String(v.email).trim().toLowerCase() : null;
  let contactId = v.contactId || null;

  if (!contactId && email) {
    const { data } = await supabase.from('contacts').select('id').eq('email', email).limit(1).maybeSingle();
    contactId = data?.id || null;
  }
  if (!contactId && v.visitorId) {
    const { data } = await supabase.from('contacts').select('id').eq('visitor_id', v.visitorId).limit(1).maybeSingle();
    contactId = data?.id || null;
  }

  await supabase.from('contact_visits').insert({
    contact_id: contactId,
    visitor_id: v.visitorId || null,
    email,
    ruta: String(v.ruta || '/').slice(0, 500),
    titulo: v.titulo?.slice(0, 200) || null,
    referrer: v.referrer?.slice(0, 500) || null,
    origen: v.sendId ? 'email' : (v.referrer && /utm_|gclid|ttclid/.test(v.referrer) ? 'anuncio' : 'directo'),
    send_id: v.sendId || null,
    campaign_id: v.campaignId || null,
    segundos: v.segundos ?? null,
  });
}

/** Al identificarse, recupera lo que ese visitante ya había navegado. */
export async function ligarVisitasPrevias(visitorId: string, contactId: string): Promise<number> {
  if (!visitorId || !contactId) return 0;
  const { data } = await supabase.from('contact_visits')
    .update({ contact_id: contactId }).eq('visitor_id', visitorId).is('contact_id', null).select('id');
  return (data || []).length;
}

/* ── Puntaje de intención ─────────────────────────────────────────────── */

/**
 * Cuánto suma cada señal. La escala no es arbitraria:
 *
 * Las señales de ACCIÓN pesan mucho más que las de exposición. Abrir un correo
 * vale 2 puntos porque el cliente de correo pudo abrirlo solo; ver una
 * cotización vale 25 porque nadie abre una propuesta por accidente. La página
 * de precios pesa más que cualquier otra visita por la misma razón.
 *
 * Y todo decae: alguien muy activo hace tres meses no es un prospecto caliente
 * hoy, es un pendiente viejo. Sin decaimiento, el puntaje solo sube y la lista
 * se llena de gente que ya se enfrió.
 */
export const PESOS = {
  visita_precios: 18,
  visita_producto: 8,
  visita_cualquiera: 3,
  clic_correo: 12,
  abrio_correo: 2,          // señal sucia: Apple Mail abre solo
  cotizacion_vista: 25,
  reunion_agendada: 30,
  reunion_completada: 20,
  respondio_correo: 22,
  pago: 15,
} as const;

const TOPE = 100;
const VENTANA_DIAS = 90;

/** Media vida de 30 días: a los 30 pesa la mitad, a los 60 un cuarto. */
function decaimiento(fecha: string | Date): number {
  const dias = (Date.now() - new Date(fecha).getTime()) / 86400000;
  if (dias < 0) return 1;
  return Math.pow(0.5, dias / 30);
}

const esPrecios = (r: string) => /precio|planes|pricing|cotiza/i.test(r);
const esProducto = (r: string) => /producto|funcion|modulo|caracteristica|giros?\//i.test(r);

export interface Intencion { puntaje: number; motivos: Array<{ senal: string; cuando: string; puntos: number }> }

/**
 * Calcula el puntaje de UNA persona con todo lo que ya está guardado.
 * No inventa datos: solo lee las señales que el sistema ya venía registrando
 * y les pone precio y caducidad.
 */
export async function calcularIntencion(contactId: string): Promise<Intencion> {
  const desde = new Date(Date.now() - VENTANA_DIAS * 86400000).toISOString();
  const motivos: Intencion['motivos'] = [];
  const suma = (senal: string, cuando: string, base: number) => {
    const puntos = Math.round(base * decaimiento(cuando));
    if (puntos > 0) motivos.push({ senal, cuando, puntos });
  };

  const [visitas, correos, reuniones, actividades] = await Promise.all([
    supabase.from('contact_visits').select('ruta, created_at').eq('contact_id', contactId).gte('created_at', desde).limit(300),
    supabase.from('email_sends').select('clicked_at, first_opened_at').eq('contact_id', contactId).gte('created_at', desde).limit(200),
    supabase.from('bookings').select('created_at, estado').eq('contact_id', contactId).gte('created_at', desde).limit(50),
    supabase.from('activities').select('tipo, created_at').eq('contact_id', contactId).gte('created_at', desde).limit(300),
  ]);

  for (const v of visitas.data || []) {
    const r = String(v.ruta || '');
    suma(esPrecios(r) ? 'Vio precios' : esProducto(r) ? 'Vio producto' : 'Visitó el sitio', v.created_at,
      esPrecios(r) ? PESOS.visita_precios : esProducto(r) ? PESOS.visita_producto : PESOS.visita_cualquiera);
  }
  for (const c of correos.data || []) {
    if (c.clicked_at) suma('Hizo clic en un correo', c.clicked_at, PESOS.clic_correo);
    else if (c.first_opened_at) suma('Abrió un correo', c.first_opened_at, PESOS.abrio_correo);
  }
  for (const r of reuniones.data || []) {
    suma(r.estado === 'completada' ? 'Tuvo la reunión' : 'Agendó reunión', r.created_at,
      r.estado === 'completada' ? PESOS.reunion_completada : PESOS.reunion_agendada);
  }
  for (const a of actividades.data || []) {
    if (a.tipo === 'cotizacion_vista') suma('Abrió una cotización', a.created_at, PESOS.cotizacion_vista);
    else if (a.tipo === 'email_respuesta') suma('Respondió un correo', a.created_at, PESOS.respondio_correo);
    else if (a.tipo === 'pago_recibido') suma('Pagó', a.created_at, PESOS.pago);
  }

  motivos.sort((a, b) => b.puntos - a.puntos);
  const puntaje = Math.min(TOPE, motivos.reduce((s, m) => s + m.puntos, 0));
  return { puntaje, motivos: motivos.slice(0, 8) };
}

/** Recalcula en lote (lo usa el cron). Devuelve cuántos cambiaron. */
export async function recalcularIntenciones(limite = 500): Promise<number> {
  // Solo quien tiene alguna señal reciente: recalcular a los inactivos es
  // gastar consultas para escribir el mismo cero.
  const desde = new Date(Date.now() - VENTANA_DIAS * 86400000).toISOString();
  const ids = new Set<string>();
  for (const t of ['contact_visits', 'email_sends'] as const) {
    const { data } = await supabase.from(t).select('contact_id').gte('created_at', desde).not('contact_id', 'is', null).limit(5000);
    for (const r of data || []) if (r.contact_id) ids.add(r.contact_id);
  }
  const { data: act } = await supabase.from('activities').select('contact_id')
    .in('tipo', ['cotizacion_vista', 'email_respuesta', 'demo_agendada', 'pago_recibido'])
    .gte('created_at', desde).not('contact_id', 'is', null).limit(5000);
  for (const r of act || []) if (r.contact_id) ids.add(r.contact_id);

  let cambiados = 0;
  for (const id of Array.from(ids).slice(0, limite)) {
    const { puntaje, motivos } = await calcularIntencion(id);
    const { data: prev } = await supabase.from('contacts').select('intencion').eq('id', id).maybeSingle();
    if ((prev?.intencion ?? 0) === puntaje) continue;
    await supabase.from('contacts').update({
      intencion: puntaje, intencion_at: new Date().toISOString(), intencion_motivos: motivos,
    }).eq('id', id);
    cambiados++;
  }
  return cambiados;
}

/* ── Timeline unificado ───────────────────────────────────────────────── */

export interface Evento { cuando: string; tipo: string; titulo: string; detalle?: string | null; icono: string }

/**
 * Todo lo que hizo una persona, de las cinco fuentes, en una sola línea de
 * tiempo. Es lo que se lee antes de una llamada: hoy hay que abrir cinco
 * pestañas para armar la misma historia.
 */
export async function timeline(contactId: string, limite = 60): Promise<Evento[]> {
  const ev: Evento[] = [];
  const [visitas, correos, reuniones, actividades, mensajes] = await Promise.all([
    supabase.from('contact_visits').select('ruta, titulo, created_at, origen').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(30),
    supabase.from('email_sends').select('id, email_to, estado, created_at, sent_at, first_opened_at, clicked_at, categoria').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(30),
    supabase.from('bookings').select('fecha, hora_inicio, estado, created_at, asunto').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(20),
    supabase.from('activities').select('tipo, titulo, descripcion, created_at').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(40),
    supabase.from('email_messages').select('direccion, cuerpo_texto, created_at, conversation_id').order('created_at', { ascending: false }).limit(20),
  ]);

  for (const v of visitas.data || []) {
    ev.push({ cuando: v.created_at, tipo: 'visita', icono: '◆',
      titulo: `Visitó ${v.titulo || v.ruta}`,
      detalle: v.origen === 'email' ? 'llegó desde un correo' : v.origen === 'anuncio' ? 'llegó de un anuncio' : null });
  }
  for (const c of correos.data || []) {
    if (c.clicked_at) ev.push({ cuando: c.clicked_at, tipo: 'clic', icono: '➔', titulo: 'Hizo clic en un correo' });
    if (c.first_opened_at) ev.push({ cuando: c.first_opened_at, tipo: 'apertura', icono: '○', titulo: 'Abrió un correo', detalle: 'señal poco fiable' });
    if (c.sent_at) ev.push({ cuando: c.sent_at, tipo: 'correo', icono: '✉', titulo: `Le enviamos un correo`, detalle: c.categoria });
  }
  for (const r of reuniones.data || []) {
    ev.push({ cuando: r.created_at, tipo: 'reunion', icono: '◉',
      titulo: r.estado === 'cancelada' ? 'Canceló la reunión' : 'Agendó una reunión',
      detalle: `${r.fecha} ${String(r.hora_inicio || '').slice(0, 5)}` });
  }
  const YA = new Set(['email_opened', 'email_clicked', 'page_visit']);   // ya vienen de su fuente
  for (const a of actividades.data || []) {
    if (YA.has(a.tipo)) continue;
    ev.push({ cuando: a.created_at, tipo: a.tipo, icono: a.tipo === 'pago_recibido' ? '$' : '·',
      titulo: a.titulo || a.tipo, detalle: a.descripcion });
  }
  const { data: convs } = await supabase.from('email_conversations').select('id').eq('contact_id', contactId).limit(20);
  const idsConv = new Set((convs || []).map((c: any) => c.id));
  for (const m of mensajes.data || []) {
    if (!idsConv.has(m.conversation_id)) continue;
    ev.push({ cuando: m.created_at, tipo: 'conversacion', icono: m.direccion === 'entrante' ? '↩' : '↪',
      titulo: m.direccion === 'entrante' ? 'Nos respondió' : 'Le respondimos',
      detalle: String(m.cuerpo_texto || '').slice(0, 110) });
  }

  return ev.sort((a, b) => Date.parse(b.cuando) - Date.parse(a.cuando)).slice(0, limite);
}
