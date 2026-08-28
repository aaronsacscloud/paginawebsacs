/**
 * Devolverle a TikTok qué pasó con sus leads.
 *
 * Sin esto, TikTok solo sabe cuántos formularios se llenaron, así que optimiza
 * por CANTIDAD: te trae los leads más baratos de conseguir, que casi nunca son
 * los que compran. Medido en esta cuenta: 74 leads de TikTok, 4 se volvieron
 * clientes, y TikTok no sabía de ninguno de los 4.
 *
 * ── Lo que exige TikTok ──────────────────────────────────────────────────
 *
 * El `lead_id` es OBLIGATORIO y su documentación es explícita en que no se
 * puede sustituir por correo ni por teléfono: es lo que ata el evento al
 * formulario original. Un lead sin él es un lead que no se puede reportar,
 * por más datos que tengamos.
 *
 * El nombre del evento ES el estatus del lead. TikTok no impone un catálogo:
 * uno manda los suyos y los mapea a las etapas del embudo en Events Manager.
 *
 * ── Lo que NO hay que hacer ──────────────────────────────────────────────
 *
 * Reportar "llenó el formulario". Eso TikTok ya lo sabe —lo generó él— y
 * mandarlo solo diluye la señal. Se reportan las etapas que cuestan trabajo
 * llegar, que son las que enseñan a distinguir un lead bueno de uno barato.
 */

const API = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

/**
 * De etapa del CRM al nombre que se le manda a TikTok.
 *
 * Solo tres, y a propósito: cada etapa que se reporta es una señal que compite
 * con las demás por la atención del algoritmo. Con demasiadas, ninguna pesa.
 */
export const ETAPAS_A_TIKTOK: Record<string, string> = {
  lead_calificado: 'Qualified',
  oportunidad: 'Opportunity',
  cliente: 'Converted',
  // La senal negativa. Sin ella el algoritmo solo aprende a quien buscar y
  // nunca a quien dejar de buscar, que con 81 leads y 6 que avanzan es la
  // mitad mas util.
  //
  // Los 81 se cuentan por `propiedades ? 'tiktok'`, NO por fuente: tres de los
  // cuatro clientes perdieron `fuente` en un rescate por pixel y filtrar por
  // ella los deja fuera — justo a los que mas pesan. (Y las 87 filas de la
  // hoja no son 87 contactos: son poblaciones distintas.)
  //
  // OJO: solo se marca lo que un humano reviso y descarto —
  // un lead sin trabajar NO es un descalificado, y un mal negativo hace mas
  // dano que un positivo faltante porque se usa para excluir.
  descalificado: 'Unqualified',
  // `rezagado` NO va aquí a propósito. Es un lead que dejamos enfriar: habla de
  // NUESTRO proceso, no de su calidad. Reportarlo le enseñaría a TikTok a evitar
  // gente buena a la que simplemente no llamamos a tiempo. Vive en el CRM para
  // poder filtrarlo y recuperarlo, y se queda ahí. Igual que `churned`.
};

/** El orden del embudo: sirve para no reportar hacia atrás. */
export const ORDEN_ETAPAS = ['lead', 'lead_calificado', 'oportunidad', 'cliente'];

export interface EventoCRM {
  leadId: string;
  evento: string;
  /** Cuándo ocurrió el cambio de etapa, no cuándo lo mandamos. */
  cuando: Date;
  /** Solo para la conversión: sin monto, TikTok optimiza por conteo. */
  valor?: number | null;
  moneda?: string;
}

export interface Resultado {
  ok: boolean;
  code?: number;
  mensaje?: string;
  sinPermiso?: boolean;
}

function token(): string {
  return String((import.meta.env as any).TIKTOK_ACCESS_TOKEN || '').trim();
}

function dataset(): string {
  return String((import.meta.env as any).TIKTOK_CRM_DATASET_ID || '').trim();
}

/** ¿Está todo lo necesario para poder reportar? */
export function configurado(): { listo: boolean; falta: string[] } {
  const falta: string[] = [];
  if (!token()) falta.push('TIKTOK_ACCESS_TOKEN');
  if (!dataset()) falta.push('TIKTOK_CRM_DATASET_ID');
  return { listo: falta.length === 0, falta };
}

/**
 * Manda UN evento de ciclo de vida.
 *
 * `sinPermiso` se distingue del resto de errores porque no es un fallo
 * transitorio: el token del píxel NO sirve para el dataset de CRM (verificado
 * contra la API: mismo token, el píxel responde OK y el dataset responde
 * 40001). Reintentarlo mil veces no lo va a arreglar, así que el llamador
 * tiene que poder parar en vez de machacar.
 */
export async function enviarEventoCRM(e: EventoCRM): Promise<Resultado> {
  const cfg = configurado();
  if (!cfg.listo) return { ok: false, mensaje: 'Falta ' + cfg.falta.join(' y ') };
  if (!e.leadId) return { ok: false, mensaje: 'Sin lead_id no se puede reportar a TikTok.' };

  const evento: Record<string, any> = {
    event: e.evento,
    // En SEGUNDOS. En milisegundos TikTok lo acepta y lo coloca en el año
    // 58 000: el evento existe y no aparece en ningún reporte.
    event_time: Math.floor(e.cuando.getTime() / 1000),
    lead: { lead_id: String(e.leadId) },
  };
  if (e.valor && e.valor > 0) {
    evento.properties = { value: Math.round(e.valor * 100) / 100, currency: e.moneda || 'MXN' };
  }

  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': token() },
      body: JSON.stringify({ event_source: 'crm', event_source_id: dataset(), data: [evento] }),
      signal: AbortSignal.timeout(15000),
    });
    const j: any = await r.json().catch(() => ({}));
    const code = Number(j?.code);
    if (code === 0) return { ok: true, code };
    return {
      ok: false,
      code,
      mensaje: String(j?.message || 'Respuesta inesperada de TikTok'),
      // 40001 sobre el event_source_id = el token no tiene ese activo asignado.
      sinPermiso: code === 40001 && /permission/i.test(String(j?.message || '')),
    };
  } catch (err: any) {
    return { ok: false, mensaje: String(err?.message || err) };
  }
}


// ── La vía del PÍXEL, para los leads sin lead_id ─────────────────────────
//
// La vía de CRM es mejor —alimenta la vista de embudo de TikTok— pero exige
// `lead_id`, y ese dato solo existe si venía en la entrega del lead. Los que
// entraron por la hoja no lo tienen y TikTok ya los borró de su lado (guarda
// los leads 90 días), así que para ellos no hay forma de recuperarlo.
//
// Por el píxel sí se puede: TikTok casa la conversión por correo y teléfono
// hasheados. No pinta el embudo, pero le enseña al algoritmo QUIÉN compró, que
// es lo que mueve la optimización. Y usa el permiso que la cuenta ya tiene.

/** TikTok solo acepta conversiones de los últimos 28 días. */
export const VENTANA_DIAS = 28;

export function dentroDeVentana(cuando: Date, ahora = new Date()): boolean {
  const dias = (ahora.getTime() - cuando.getTime()) / 86400000;
  return dias >= 0 && dias <= VENTANA_DIAS;
}

async function sha256(txt: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface ConversionPixel {
  email?: string | null;
  telefono?: string | null;
  /** Cuándo compró. Fuera de los 28 días TikTok lo descarta. */
  cuando: Date;
  /** Sin monto NO se manda `value`: un value en 0 le enseña que esa
   *  conversión no vale nada, que es peor que no mandar el dato. */
  valor?: number | null;
  moneda?: string;
  /** Estable por persona: si el cron reintenta, TikTok no cuenta dos. */
  eventId: string;
}

export async function enviarConversionPixel(c: ConversionPixel): Promise<Resultado> {
  const pixel = String((import.meta.env as any).TIKTOK_PIXEL_ID || '').trim();
  if (!token() || !pixel) return { ok: false, mensaje: 'Falta TIKTOK_ACCESS_TOKEN o TIKTOK_PIXEL_ID' };
  if (!c.email && !c.telefono) return { ok: false, mensaje: 'Sin correo ni teléfono no hay con qué casarlo.' };
  if (!dentroDeVentana(c.cuando)) {
    return { ok: false, mensaje: `Fuera de la ventana de ${VENTANA_DIAS} días de TikTok.` };
  }

  const user: Record<string, string> = {};
  if (c.email) user.email = await sha256(String(c.email).trim().toLowerCase());
  if (c.telefono) user.phone = await sha256(String(c.telefono).replace(/[^\d+]/g, ''));

  const evento: Record<string, any> = {
    event: 'CompletePayment',
    event_id: c.eventId,
    event_time: Math.floor(c.cuando.getTime() / 1000),
    context: { user },
  };
  if (c.valor && c.valor > 0) {
    evento.properties = { value: Math.round(c.valor * 100) / 100, currency: c.moneda || 'MXN' };
  }

  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': token() },
      body: JSON.stringify({ event_source: 'web', event_source_id: pixel, data: [evento] }),
      signal: AbortSignal.timeout(15000),
    });
    const j: any = await r.json().catch(() => ({}));
    if (Number(j?.code) === 0) return { ok: true, code: 0 };
    return { ok: false, code: Number(j?.code), mensaje: String(j?.message || 'Respuesta inesperada') };
  } catch (err: any) {
    return { ok: false, mensaje: String(err?.message || err) };
  }
}
