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

/**
 * De dónde llegó esta visita.
 *
 * Los parámetros de campaña (utm_*, ttclid, gclid, fbclid) viajan en la URL de
 * la página, NO en el referrer — el referrer trae el dominio de quien te mandó.
 * Buscarlos solo en el referrer clasificaba TODO el tráfico pagado como
 * "directo": el reporte de retorno le acreditaba a nadie las visitas que se
 * pagaron, que es justo el número por el que existe.
 */
function clasificarOrigen(v: { sendId?: string | null; ruta?: string; referrer?: string | null }): string {
  if (v.sendId) return 'email';
  const marcas = /[?&](utm_|gclid|ttclid|fbclid|msclkid|li_fat_id)/i;
  if (marcas.test(String(v.ruta || ''))) return 'anuncio';
  if (marcas.test(String(v.referrer || ''))) return 'anuncio';
  const ref = String(v.referrer || '');
  if (!ref) return 'directo';
  if (/(google|bing|duckduckgo|yahoo)\./i.test(ref)) return 'buscador';
  if (/(facebook|instagram|tiktok|linkedin|x\.com|twitter|youtube|t\.co)\./i.test(ref)) return 'social';
  return 'referido';
}

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

  // La misma página se reporta DOS veces: al entrar (sin tiempo) y al salir
  // (con el tiempo real). Son un solo hecho: si se insertaran las dos, cada
  // visita contaría doble en el puntaje y en los disparadores por número de
  // visitas. La segunda ACTUALIZA a la primera.
  if (v.segundos && (v.visitorId || email)) {
    const hace = new Date(Date.now() - 2 * 3600000).toISOString();
    let q = supabase.from('contact_visits').select('id')
      .eq('ruta', String(v.ruta || '/').slice(0, 500)).is('segundos', null)
      .gte('created_at', hace).order('created_at', { ascending: false }).limit(1);
    q = v.visitorId ? q.eq('visitor_id', v.visitorId) : q.eq('email', email!);
    const { data: previa } = await q.maybeSingle();
    if (previa) {
      await supabase.from('contact_visits')
        .update({ segundos: v.segundos, contact_id: contactId || undefined })
        .eq('id', previa.id);
      return;
    }
  }

  await supabase.from('contact_visits').insert({
    contact_id: contactId,
    visitor_id: v.visitorId || null,
    email,
    ruta: String(v.ruta || '/').slice(0, 500),
    titulo: v.titulo?.slice(0, 200) || null,
    referrer: v.referrer?.slice(0, 500) || null,
    origen: clasificarOrigen(v),
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

  // UNA VEZ POR SEÑAL Y POR DÍA. Sin esto, recargar /planes seis veces sumaba
  // 108 puntos y el tope aplanaba a todos en 100: el que abrió una cotización
  // quedaba indistinguible del que solo refrescó. Se conserva la ocurrencia
  // más reciente, que es la que menos ha decaído.
  const vistos = new Map<string, { cuando: string; puntos: number; senal: string }>();
  const suma = (senal: string, cuando: string, base: number) => {
    const puntos = Math.round(base * decaimiento(cuando));
    if (puntos <= 0) return;
    const dia = String(cuando).slice(0, 10);
    const llave = `${senal}|${dia}`;
    const previo = vistos.get(llave);
    if (!previo || puntos > previo.puntos) vistos.set(llave, { senal, cuando, puntos });
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

  // El clic de un correo y la visita que ese mismo clic produjo son el MISMO
  // hecho contado dos veces (el redirector registra ambos). Se queda el de
  // más peso.
  const clave = (m: { senal: string; cuando: string }) => `${m.senal}|${m.cuando.slice(0, 13)}`;
  const porHora = new Map<string, typeof motivos[number]>();
  for (const m of vistos.values()) motivos.push(m);
  for (const m of motivos) {
    const esClicOVisita = /clic|Visitó|Vio precios|Vio producto/i.test(m.senal);
    const k = esClicOVisita ? `accion|${m.cuando.slice(0, 13)}` : clave(m);
    const p = porHora.get(k);
    if (!p || m.puntos > p.puntos) porHora.set(k, m);
  }

  const finales = Array.from(porHora.values()).sort((a, b) => b.puntos - a.puntos);
  const puntaje = Math.min(TOPE, finales.reduce((s, m) => s + m.puntos, 0));
  return { puntaje, motivos: finales.slice(0, 8) };
}

/** Recalcula en lote (lo usa el cron). Devuelve cuántos cambiaron. */
export async function recalcularIntenciones(limite = 500): Promise<number> {
  const desde = new Date(Date.now() - VENTANA_DIAS * 86400000).toISOString();
  const ids = new Set<string>();

  // LOS QUE SE ENFRIARON, PRIMERO. Antes la lista salía solo de quien tenía
  // señal reciente: a quien dejó de moverse nadie volvía a recalcularlo y su
  // puntaje quedaba congelado en 85 para siempre — apareciendo CALIENTE en la
  // lista de a quién llamar meses después. La UI promete "baja con el
  // silencio"; esto es lo que cumple esa promesa.
  const { data: frios } = await supabase.from('contacts')
    .select('id, intencion_at').gt('intencion', 0)
    .or(`intencion_at.is.null,intencion_at.lt.${new Date(Date.now() - 24 * 3600000).toISOString()}`)
    .order('intencion_at', { ascending: true, nullsFirst: true })
    .limit(200);
  for (const c of frios || []) ids.add(c.id);
  // Con orden explícito: sin `.order()` un `.limit()` devuelve filas
  // arbitrarias, así que al crecer la tabla se recalcularía siempre a los
  // mismos y el resto envejecería congelado.
  for (const t of ['contact_visits', 'email_sends'] as const) {
    const { data } = await supabase.from(t).select('contact_id, created_at')
      .gte('created_at', desde).not('contact_id', 'is', null)
      .order('created_at', { ascending: false }).limit(3000);
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
    // Los mensajes se piden POR CONVERSACIÓN de esta persona. Antes se traían
    // los 20 más recientes de TODO el sistema y luego se cruzaban: si en la
    // semana hubo 20 mensajes de otros, la respuesta de este contacto
    // desaparecía del timeline.
    supabase.from('email_conversations').select('id').eq('contact_id', contactId).limit(20),
  ]);

  const idsConv = (mensajes.data || []).map((c: any) => c.id);
  const { data: msgs } = idsConv.length
    ? await supabase.from('email_messages')
        .select('direccion, cuerpo_texto, created_at, conversation_id')
        .in('conversation_id', idsConv).order('created_at', { ascending: false }).limit(40)
    : { data: [] as any[] };

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
  for (const m of msgs || []) {
    ev.push({ cuando: m.created_at, tipo: 'conversacion', icono: m.direccion === 'entrante' ? '↩' : '↪',
      titulo: m.direccion === 'entrante' ? 'Nos respondió' : 'Le respondimos',
      detalle: String(m.cuerpo_texto || '').slice(0, 110) });
  }

  return ev.sort((a, b) => Date.parse(b.cuando) - Date.parse(a.cuando)).slice(0, limite);
}
