// WHATSAPP · LA LÍNEA (número) por la que sale cada mensaje. Un solo resolutor para TODO el sistema.
//
// Hasta el 10-sep cada punto de envío decidía por su cuenta (7 lo hacían a mano, 12 no decidían: salían por
// la default aunque el cliente hubiera escrito al otro número). Ahora el orden es siempre el mismo:
//   1. la línea fijada para esta petición (usarNumero / el selector del composer)
//   2. la línea de la CONVERSACIÓN con ese teléfono (si sigue activa)
//   3. las reglas de ruteo por contexto/origen (wa_reglas_linea: "leads de TikTok → +52 415")
//   4. la línea default (wa_numeros.es_default) → la primera activa → KAPSO_PHONE_NUMBER_ID
// Una línea PAUSADA (disyuntor de calidad) no recibe masivos, cadencias ni prospección; sí contesta
// conversaciones que ya viven en ella.
import { supabase } from '../supabase';

const ENV: any = (import.meta as any).env || process.env || {};
export const LINEA_ENV = () => (ENV.KAPSO_PHONE_NUMBER_ID || '').trim();

export type ContextoLinea = 'inbox' | 'agente' | 'lead' | 'cliente' | 'cita' | 'sistema' | 'masivo' | 'prospeccion' | 'evento' | 'interno';
/** Los contextos que se pueden rutear por regla; el orden es el de la pantalla. */
export const CONTEXTOS: { id: ContextoLinea; label: string; ayuda: string }[] = [
  { id: 'lead', label: 'Leads nuevos', ayuda: 'Bienvenida, cadencia y primer contacto de un lead (web, TikTok, feria).' },
  { id: 'agente', label: 'Agente IA', ayuda: 'Lo que el agente propone y manda por su cuenta.' },
  { id: 'cliente', label: 'Clientes', ayuda: 'Avisos de cuenta, renovaciones, pagos, onboarding.' },
  { id: 'cita', label: 'Citas y reuniones', ayuda: 'Confirmaciones, recordatorios y reagendados.' },
  { id: 'masivo', label: 'Masivos', ayuda: 'Broadcasts y campañas de plantilla.' },
  { id: 'prospeccion', label: 'Prospección (ABM)', ayuda: 'Cuentas objetivo en frío.' },
  { id: 'evento', label: 'Ferias y eventos', ayuda: 'Invitaciones al stand y seguimiento de la feria.' },
  { id: 'sistema', label: 'Sistema', ayuda: 'Todo lo demás que manda el sistema sin conversación previa.' },
];
const BLOQUEA_PAUSADA: ContextoLinea[] = ['masivo', 'lead', 'prospeccion', 'evento'];

export interface Linea {
  id: string; numero: string; nombre: string; es_default: boolean; activo: boolean; pausada: boolean;
  pausada_motivo: string | null; tope_diario: number | null; firma: string | null; agente_nombre: string | null;
  redirigir_a: string | null; redirigir_texto: string | null; calidad: string | null; tier: string | null; webhook_id: string | null;
}
export interface ReglaLinea { id: string; orden: number; contexto: string; origen: string | null; phone_number_id: string; activa: boolean; nota: string | null }

// Caché corta por instancia: los crons mandan cientos de mensajes y no hay por qué leer wa_numeros cada vez.
let cache: { at: number; lineas: Linea[]; reglas: ReglaLinea[] } | null = null;
const TTL = 30_000;
export const olvidarCacheLineas = () => { cache = null; };

async function cargar() {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const [{ data: nums }, { data: regs }] = await Promise.all([
    supabase.from('wa_numeros').select('*').order('es_default', { ascending: false }).order('created_at'),
    supabase.from('wa_reglas_linea').select('*').eq('activa', true).order('orden').order('created_at'),
  ]);
  const lineas: Linea[] = (nums || []).map((n: any) => ({
    id: n.phone_number_id, numero: n.display_phone_number || n.phone_number_id, nombre: n.nombre || '',
    es_default: !!n.es_default, activo: !!n.activo, pausada: !!n.pausada, pausada_motivo: n.pausada_motivo || null,
    tope_diario: n.tope_diario ?? null, firma: n.firma || null, agente_nombre: n.agente_nombre || null,
    redirigir_a: n.redirigir_a || null, redirigir_texto: n.redirigir_texto || null, calidad: n.calidad || null, tier: n.tier || null, webhook_id: n.webhook_id || null,
  }));
  // Sin filas todavía (instalación nueva): la del entorno es la única.
  if (!lineas.length && LINEA_ENV()) lineas.push({ id: LINEA_ENV(), numero: 'Línea principal', nombre: '', es_default: true, activo: true, pausada: false, pausada_motivo: null, tope_diario: null, firma: null, agente_nombre: null, redirigir_a: null, redirigir_texto: null, calidad: null, tier: null, webhook_id: null });
  cache = { at: Date.now(), lineas, reglas: (regs || []) as ReglaLinea[] };
  return cache;
}

/** Todas las líneas conocidas (activas e inactivas). */
export async function todasLasLineas(): Promise<Linea[]> { return (await cargar()).lineas; }
/** Las líneas por las que se puede mandar hoy (el selector del composer). */
export async function lineasActivas(): Promise<Linea[]> { return (await cargar()).lineas.filter(l => l.activo); }
export async function lineaDefault(): Promise<string> {
  const ls = await lineasActivas();
  return (ls.find(l => l.es_default && !l.pausada) || ls.find(l => !l.pausada) || ls.find(l => l.es_default) || ls[0])?.id || LINEA_ENV();
}
export async function infoLinea(pn?: string | null): Promise<Linea | null> {
  if (!pn) return null;
  return (await cargar()).lineas.find(l => l.id === pn) || null;
}

/** La línea que toca para este envío. Devuelve null solo si no hay ninguna configurada. */
export async function lineaPara(o: {
  telefono?: string | null; conversationId?: string | null;
  contexto?: ContextoLinea | string | null; origen?: string | null;
  /** true = si la conversación vivía en una línea ya retirada, se muda a la elegida (default). */
  fijar?: boolean;
} = {}): Promise<string | null> {
  const { lineas, reglas } = await cargar();
  const activas = lineas.filter(l => l.activo);
  if (!activas.length) return LINEA_ENV() || null;
  const ctx = String(o.contexto || 'sistema');
  const sirve = (id: string | null | undefined) => {
    const l = id ? activas.find(x => x.id === id) : null;
    return l && !(l.pausada && BLOQUEA_PAUSADA.includes(ctx as ContextoLinea)) ? l.id : null;
  };

  // 2. La conversación manda: se le contesta por donde habla.
  let convId: string | null = null, convLinea: string | null = null;
  if (o.conversationId || o.telefono) {
    const q = supabase.from('wa_conversaciones').select('id, phone_number_id');
    const { data } = await (o.conversationId ? q.eq('id', o.conversationId) : q.eq('telefono', o.telefono!)).maybeSingle();
    convId = data?.id || null; convLinea = data?.phone_number_id || null;
    if (convLinea && activas.some(l => l.id === convLinea)) return convLinea;   // aunque esté pausada: el chat vive ahí
  }
  // 3. Reglas por contexto y origen (la más específica primero: con origen antes que sin origen, luego por orden).
  const candidatas = reglas
    .filter(r => (r.contexto === ctx || r.contexto === '*') && (!r.origen || (o.origen && r.origen.toLowerCase() === String(o.origen).toLowerCase())))
    .sort((a, b) => (a.origen ? 0 : 1) - (b.origen ? 0 : 1) || (a.contexto === '*' ? 1 : 0) - (b.contexto === '*' ? 1 : 0) || a.orden - b.orden);
  let elegida: string | null = null;
  for (const r of candidatas) { elegida = sirve(r.phone_number_id); if (elegida) break; }
  // 4. Default.
  if (!elegida) elegida = sirve((activas.find(l => l.es_default) || activas[0]).id) || activas.find(l => !l.pausada)?.id || activas[0].id;
  // La conversación vivía en una línea retirada: se muda para que las respuestas del cliente caigan aquí.
  if (convId && convLinea && convLinea !== elegida && o.fijar !== false) {
    await supabase.from('wa_conversaciones').update({ phone_number_id: elegida }).eq('id', convId).then(() => {}, () => {});
  }
  return elegida;
}

/** Cupo del día en una línea: cuántos salientes van hoy contra su tope (null = sin tope propio). */
export async function cupoLinea(pn: string): Promise<{ tope: number | null; usados: number; libres: number | null; pausada: boolean }> {
  const l = await infoLinea(pn);
  const hoy = new Date(); hoy.setUTCHours(hoy.getUTCHours() - 6); hoy.setUTCHours(6, 0, 0, 0);   // el día en hora de México (UTC-6)
  const { count } = await supabase.from('wa_mensajes').select('id, wa_conversaciones!inner(phone_number_id)', { count: 'exact', head: true })
    .eq('direccion', 'saliente').gte('created_at', hoy.toISOString()).eq('wa_conversaciones.phone_number_id', pn);
  const usados = count || 0;
  const tope = l?.tope_diario ?? null;
  return { tope, usados, libres: tope == null ? null : Math.max(0, tope - usados), pausada: !!l?.pausada };
}

/** ¿La ventana de 24 h está abierta EN ESTA LÍNEA? Lee wa_conversaciones.ventanas (por línea) y cae al reloj global si aún no hay mapa. */
export function ventanaEnLinea(conv: { ventanas?: any; ultimo_entrante_at?: string | null; phone_number_id?: string | null } | null | undefined, pn: string | null | undefined): { abierta: boolean; expira_at: string | null } {
  if (!conv) return { abierta: false, expira_at: null };
  const mapa = (conv.ventanas && typeof conv.ventanas === 'object') ? conv.ventanas as Record<string, string> : {};
  const tieneMapa = Object.keys(mapa).length > 0;
  let base = 0;
  if (pn && mapa[pn]) base = new Date(mapa[pn]).getTime();
  else if (!tieneMapa && conv.ultimo_entrante_at && (!pn || !conv.phone_number_id || conv.phone_number_id === pn)) base = new Date(conv.ultimo_entrante_at).getTime();
  const expira = base + 24 * 3600e3;
  return { abierta: base > 0 && Date.now() < expira, expira_at: base ? new Date(expira).toISOString() : null };
}
