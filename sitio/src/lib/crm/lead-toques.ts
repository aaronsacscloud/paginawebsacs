/**
 * Cómo se registra un toque a un lead: canal, resultado y qué cuenta.
 *
 * Antes esto era un formulario de tres piezas —una pastilla de tipo, una caja
 * de texto y un botón— y no guardaba lo único que importa de una llamada: si
 * contestaron. Marcarle cuatro veces y que siempre mande a buzón se veía igual
 * que hablar cuatro veces con el dueño, porque las dos cosas eran "llamada" con
 * una nota escrita a mano.
 *
 * Y traía un error silencioso: la ficha guardaba el tipo `whatsapp` y `email`,
 * pero los toques se cuentan con `whatsapp_enviado` y `email_enviado` (ver
 * lead-etapa.ts). Registrar un WhatsApp NO movía la etapa ni subía el contador
 * de esfuerzo; solo la llamada, que era la única que coincidía por accidente.
 * `tipoActividad` es ahora la única traducción y vive aquí.
 */

export type Canal = 'llamada' | 'whatsapp' | 'correo';

export type Resultado = {
  v: string;
  l: string;
  /** ¿Hubo persona del otro lado? Un buzón es esfuerzo, no conversación. */
  hablamos: boolean;
  /** El número o el correo no sirven: el lead está muerto por datos, no por
   *  desinterés, y eso se arregla distinto. */
  malDato?: boolean;
};

export const CANALES: { v: Canal; l: string; tipo: string; verbo: string }[] = [
  { v: 'llamada', l: 'Llamada', tipo: 'llamada', verbo: 'Le marcaste' },
  { v: 'whatsapp', l: 'WhatsApp', tipo: 'whatsapp_enviado', verbo: 'Le escribiste' },
  { v: 'correo', l: 'Correo', tipo: 'email_enviado', verbo: 'Le mandaste correo' },
];

/** El tipo con el que se guarda en `activities`. Es el que cuenta como toque. */
export const tipoActividad = (canal: Canal) =>
  CANALES.find(c => c.v === canal)?.tipo || 'llamada';

export const RESULTADOS: Record<Canal, Resultado[]> = {
  llamada: [
    { v: 'no_contesto', l: 'No contestó', hablamos: false },
    { v: 'buzon', l: 'Mandó a buzón', hablamos: false },
    { v: 'numero_malo', l: 'Número equivocado o no existe', hablamos: false, malDato: true },
    { v: 'contactado', l: 'Contestó', hablamos: true },
  ],
  whatsapp: [
    { v: 'sin_respuesta', l: 'Sin respuesta', hablamos: false },
    { v: 'numero_malo', l: 'El número no tiene WhatsApp', hablamos: false, malDato: true },
    { v: 'contesto', l: 'Contestó', hablamos: true },
  ],
  correo: [
    { v: 'sin_respuesta', l: 'Sin respuesta', hablamos: false },
    { v: 'reboto', l: 'Rebotó', hablamos: false, malDato: true },
    { v: 'contesto', l: 'Contestó', hablamos: true },
  ],
};

export const resultadoDe = (canal: Canal, v?: string | null) =>
  RESULTADOS[canal]?.find(r => r.v === v) || null;

/** El título que se guarda: se lee solo en el historial, sin abrir la nota. */
export function tituloToque(canal: Canal, resultado?: string | null): string {
  const c = CANALES.find(x => x.v === canal);
  const r = resultadoDe(canal, resultado);
  if (!r) return c?.l || 'Toque';
  return `${c?.l}: ${r.l.toLowerCase()}`;
}

/* ── Lo que se habló FUERA del CRM ─────────────────────────────────────────
 * El celular de alguien, un grupo de WhatsApp, un número que no está conectado.
 * Pasa todo el tiempo y hasta hoy no quedaba en ningún lado: se perdía en el
 * teléfono de quien lo atendió, y seis semanas después nadie podía reconstruir
 * por qué el lead dijo que sí o que no.
 *
 * Se guarda como una actividad MÁS —la misma tabla y el mismo `tipo` del canal,
 * así que cuenta como toque para la etapa y para el esfuerzo—, con
 * `metadata.fuera_crm` y el medio por el que pasó. No es una gestión paralela:
 * es la misma gestión, hecha por otro teléfono. */
export const MEDIOS_FUERA: { v: string; l: string; tipo: string; corto: string }[] = [
  { v: 'wa_otro',    l: 'WhatsApp desde otro número', tipo: 'whatsapp_enviado', corto: 'otro número' },
  { v: 'wa_grupo',   l: 'Grupo de WhatsApp',          tipo: 'whatsapp_enviado', corto: 'grupo' },
  { v: 'llamada',    l: 'Llamada',                    tipo: 'llamada',          corto: 'llamada' },
  { v: 'presencial', l: 'Presencial',                 tipo: 'nota',             corto: 'presencial' },
  { v: 'correo',     l: 'Correo personal',            tipo: 'email_enviado',    corto: 'correo' },
  { v: 'otro',       l: 'Otro',                       tipo: 'nota',             corto: 'otro' },
];

export const medioFuera = (v?: string | null) => MEDIOS_FUERA.find(m => m.v === v) || MEDIOS_FUERA[5];

/** ¿Esta actividad se registró como conversación de fuera del CRM? */
export const esFueraCrm = (a: any) => !!a?.metadata?.fuera_crm;

/* ── La línea de tiempo ───────────────────────────────────────────────────
 * Dos historias del mismo lead que vivían en pestañas distintas: la que
 * escribe una persona (Actividad) y la que se escribe sola (Señales). Juntas
 * contestan lo único que se pregunta antes de llamar: quién movió la última
 * ficha. Por eso cada evento se marca TÚ o ÉL. */

/** Lo que hizo ÉL solo. Todo lo demás lo hizo alguien de este lado. */
const DE_EL = new Set([
  'page_visit', 'cotizacion_vista', 'email_opened', 'email_click',
  'whatsapp_recibido', 'lead_created', 'form_submit', 'pago_recibido',
  'ticket_abierto', 'reunion_agendada_por_el',
]);

export const quienLoHizo = (a: any): 'el' | 'tu' =>
  DE_EL.has(String(a?.tipo)) ? 'el' : 'tu';

/** Los tipos de puro ruido interno que no cuentan como historia del lead. */
const RUIDO = new Set(['sistema', 'stage_change']);
export const esRuido = (a: any) => RUIDO.has(String(a?.tipo));
