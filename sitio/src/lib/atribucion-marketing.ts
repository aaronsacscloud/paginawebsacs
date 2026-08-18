// De dónde venía el prospecto. FUENTE ÚNICA.
//
// OJO: `attribution.ts` (sin acento) es OTRA cosa — resuelve qué PARTNER
// refirió al prospecto. Este archivo resuelve el CANAL DE MARKETING: qué
// anuncio, qué campaña, qué página lo trajo.
//
// El dato lo captura el navegador (script en BaseLayout.astro) y lo deja en la
// cookie `sacs_attr`, que dura 90 días. Se eligió cookie y no sessionStorage
// por dos razones que se pagaban caro:
//   1. sessionStorage muere al cerrar la pestaña — quien ve el anuncio hoy y
//      agenda mañana llegaba al CRM como "tráfico directo".
//   2. la cookie viaja sola en cada request, así que el servidor puede
//      recuperar la atribución aunque el front olvide mandarla.
//
// Se guardan DOS toques, no uno:
//   primero (p) — cómo nos conoció. Es la respuesta a "¿qué canal me trae
//                 leads?" y por eso es el que va a las columnas utm_* del
//                 contacto, que es lo que lee el CRM para pintar el origen.
//   último  (u) — qué lo hizo volver y agendar. Sirve para el remarketing.
// Con un solo toque no se distingue "TikTok me lo trajo" de "TikTok me lo
// recordó", que son dos presupuestos distintos.

export const COOKIE_ATRIBUCION = 'sacs_attr';

/** Un toque: la visita en la que llegó por un canal identificable. */
export interface Toque {
  /** utm_source */   s?: string;
  /** utm_medium */   m?: string;
  /** utm_campaign */ c?: string;
  /** utm_content */  co?: string;
  /** utm_term */     t?: string;
  /** click ids: gclid / fbclid / ttclid / msclkid */
  cl?: Record<string, string>;
  /** landing page (path + query) */ lp?: string;
  /** referrer externo */            rf?: string;
  /** timestamp (ms) */              ts?: number;
}

export interface Atribucion {
  v?: number;
  /** primer toque */  p?: Toque;
  /** último toque */  u?: Toque;
  /** id anónimo de visitante */ vid?: string;
  /** páginas vistas acumuladas */ n?: number;
}

const LIMITE = 200;
const limpiar = (x: any): string | undefined => {
  if (x == null) return undefined;
  const s = String(x).trim().slice(0, LIMITE);
  return s || undefined;
};

function normalizarToque(t: any): Toque | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const out: Toque = {};
  for (const k of ['s', 'm', 'c', 'co', 't', 'lp', 'rf'] as const) {
    const v = limpiar(t[k]);
    if (v) (out as any)[k] = v;
  }
  if (t.cl && typeof t.cl === 'object') {
    const cl: Record<string, string> = {};
    for (const [k, v] of Object.entries(t.cl)) {
      const lk = limpiar(k);
      const lv = limpiar(v);
      if (lk && lv) cl[lk] = lv;
    }
    if (Object.keys(cl).length) out.cl = cl;
  }
  const ts = Number(t.ts);
  if (Number.isFinite(ts) && ts > 0) out.ts = ts;
  return Object.keys(out).length ? out : undefined;
}

export function normalizarAtribucion(raw: any): Atribucion | null {
  if (!raw || typeof raw !== 'object') return null;
  const a: Atribucion = { v: 1 };
  const p = normalizarToque(raw.p);
  const u = normalizarToque(raw.u);
  if (p) a.p = p;
  if (u) a.u = u;
  const vid = limpiar(raw.vid);
  if (vid) a.vid = vid;
  const n = Number(raw.n);
  if (Number.isFinite(n) && n > 0) a.n = Math.min(n, 9999);
  return (a.p || a.u || a.vid) ? a : null;
}

/** Lee la cookie sacs_attr del header de la request. */
export function atribucionDeCookie(request: Request): Atribucion | null {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_ATRIBUCION}=([^;]+)`));
  if (!m) return null;
  try {
    return normalizarAtribucion(JSON.parse(decodeURIComponent(m[1])));
  } catch { return null; }
}

/**
 * La atribución de esta request, en orden de confianza:
 *   1. lo que mandó el front (ya resolvió el caso del iframe),
 *   2. la cookie del navegador,
 *   3. los utm_* sueltos del body, si alguien los mandó a la antigua.
 * Nunca lanza: perder la atribución no puede tumbar una reserva.
 */
export function resolverAtribucion(
  request: Request,
  body?: { atribucion?: any; utm_source?: any; utm_medium?: any; utm_campaign?: any },
): Atribucion | null {
  try {
    const delFront = normalizarAtribucion(body?.atribucion);
    const deCookie = atribucionDeCookie(request);
    const base = delFront || deCookie;

    // utm_* sueltos: solo si no hay nada mejor.
    const sueltos = normalizarToque({
      s: body?.utm_source, m: body?.utm_medium, c: body?.utm_campaign,
    });
    if (!base) return sueltos ? { v: 1, p: sueltos, u: sueltos } : null;

    // Si el front trajo algo pero sin primer toque, se completa con la cookie.
    if (delFront && deCookie && !delFront.p && deCookie.p) delFront.p = deCookie.p;
    return base;
  } catch { return null; }
}

/** ¿Este toque dice algo de dónde venía, o fue una visita a secas? */
const identificable = (t?: Toque): boolean =>
  !!(t && (t.s || t.rf || (t.cl && Object.keys(t.cl).length > 0)));

/**
 * El toque que define de dónde SALIÓ el lead: el PRIMERO IDENTIFICABLE.
 *
 * No es simplemente `p`: si la primera visita fue directa (Google a veces no
 * manda referrer) y el anuncio de TikTok llegó después, `p` no tiene canal y
 * responder "directo" borraría la campaña que sí pagó el lead.
 */
export const toqueDeOrigen = (a?: Atribucion | null): Toque | undefined => {
  if (identificable(a?.p)) return a!.p;
  if (identificable(a?.u)) return a!.u;
  return a?.p || a?.u;
};

/**
 * Las tres columnas utm_* de contacts/bookings. Salen del PRIMER toque porque
 * la pregunta que responde el CRM es "de dónde salió este lead", no "qué clic
 * cerró la visita".
 */
export function columnasUtm(a?: Atribucion | null) {
  const t = toqueDeOrigen(a);
  return {
    utm_source: t?.s || null,
    utm_medium: t?.m || null,
    utm_campaign: t?.c || null,
  };
}

const NAVEGADORES: [RegExp, string][] = [
  [/Edg\//i, 'Edge'], [/OPR|Opera/i, 'Opera'], [/Chrome/i, 'Chrome'],
  [/Safari/i, 'Safari'], [/Firefox/i, 'Firefox'],
];

/** Dispositivo y navegador desde el User-Agent (mismo criterio que save-lead). */
export function dispositivoDeUA(ua: string): { dispositivo: string; navegador: string } {
  const s = ua || '';
  const dispositivo = /iPad|Tablet/i.test(s) ? 'Tablet'
    : /Mobile|Android|iPhone/i.test(s) ? 'Móvil'
    : 'Computadora';
  const navegador = NAVEGADORES.find(([re]) => re.test(s))?.[1] || 'Otro';
  return { dispositivo, navegador };
}

/**
 * El bloque que se guarda en `contacts.propiedades.atribucion` y en
 * `bookings.atribucion`. Plano y legible: quien abra la ficha en el CRM tiene
 * que entenderlo sin decodificar nada.
 */
export function bloqueAtribucion(a: Atribucion | null, request?: Request) {
  const p = a?.p, u = a?.u;
  const ua = request?.headers.get('user-agent') || '';
  const { dispositivo, navegador } = dispositivoDeUA(ua);
  const bloque: Record<string, any> = {
    primer_toque: p ? {
      fuente: p.s || null, medio: p.m || null, campana: p.c || null,
      contenido: p.co || null, termino: p.t || null,
      landing: p.lp || null, referrer: p.rf || null,
      click_ids: p.cl || null,
      cuando: p.ts ? new Date(p.ts).toISOString() : null,
    } : null,
    ultimo_toque: u ? {
      fuente: u.s || null, medio: u.m || null, campana: u.c || null,
      landing: u.lp || null, referrer: u.rf || null,
      cuando: u.ts ? new Date(u.ts).toISOString() : null,
    } : null,
    visitor_id: a?.vid || null,
    paginas_vistas: a?.n || null,
    dispositivo,
    navegador,
  };
  return bloque;
}

/** Frase corta para la campana y el detalle del lead: "TikTok · demo_agosto". */
export function resumenAtribucion(a?: Atribucion | null): string {
  const t = toqueDeOrigen(a);
  if (!t) return 'Tráfico directo';
  const partes = [t.s, t.c].filter(Boolean) as string[];
  if (!partes.length && t.rf) {
    try { return `Referido de ${new URL(t.rf).hostname.replace(/^www\./, '')}`; } catch { return 'Referido'; }
  }
  return partes.join(' · ') || 'Tráfico directo';
}
