// Registra un clic al WhatsApp comercial.
//
// Un clic NO es un lead: no deja nombre ni correo, y crear un contacto vacío
// por cada clic ensuciaría la lista de leads con fantasmas imposibles de
// contactar. Pero tampoco puede ser invisible: hoy alguien ve el anuncio de
// TikTok, entra a Ferreterías, pide demo por WhatsApp — y el CRM no se entera
// de nada hasta que la persona escribe, si es que escribe.
//
// Por eso se guarda aparte (tabla wa_intentos) y se avisa en la campana: el
// vendedor sabe que viene un mensaje y de qué giro, y cuando llegue puede
// cruzarlo. El CTA NO pasa por aquí: el link sigue yendo directo a wa.me y
// esto se manda por sendBeacon, para que un fallo de red nunca se coma la
// conversión.
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { resolverAtribucion, bloqueAtribucion, resumenAtribucion, toqueDeOrigen } from '../../lib/atribucion-marketing';
import { notificar } from '../../lib/crm/notificaciones';
import { origenDe, origenDeRegistro } from '../../lib/crm/origenes';

export const prerender = false;

const ok = () => new Response(null, { status: 204 });

// Tope por IP. Este endpoint es escritura ANÓNIMA sin auth: un `for` con curl
// metía miles de filas en wa_intentos y otras tantas campanadas en el CRM (la
// clave de dedupe solo colapsa claves IDÉNTICAS, y el `giro` lo manda el
// cliente, así que basta variarlo). En memoria alcanza para frenar la ráfaga de
// un origen; no pretende ser un WAF.
const PORMINUTO_MAX = 30;
const golpes = new Map<string, { minuto: number; n: number }>();
function pasaTope(ip: string): boolean {
  const minuto = Math.floor(Date.now() / 60000);
  const b = golpes.get(ip);
  if (!b || b.minuto !== minuto) { golpes.set(ip, { minuto, n: 1 }); }
  else if (b.n >= PORMINUTO_MAX) { return false; }
  else { b.n++; }
  if (golpes.size > 5000) for (const [k, v] of golpes) if (v.minuto !== minuto) golpes.delete(k);
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || request.headers.get('x-real-ip') || 'sin-ip';
    if (!pasaTope(ip)) return ok();   // 204 igual: es telemetría, no se le avisa al abusador

    const body = await request.json().catch(() => ({}));
    const giro = String(body?.giro || '').trim().slice(0, 120) || null;
    const contexto = String(body?.contexto || '').trim().slice(0, 60) || null;

    const atribucion = resolverAtribucion(request, body);
    const bloque = bloqueAtribucion(atribucion, request);

    await supabase.from('wa_intentos').insert({
      giro,
      contexto,
      visitor_id: atribucion?.vid || null,
      atribucion: bloque,
      user_agent: (request.headers.get('user-agent') || '').slice(0, 400),
    });

    // Una sola campanada por visitante, giro y día: quien duda y hace clic
    // tres veces es una persona, no tres oportunidades.
    const hoy = new Date().toISOString().slice(0, 10);
    const quien = atribucion?.vid || 'anon';
    // SIN `fuente`, a propósito. Con ella, `origenDeRegistro` siempre devolvía
    // algo ('sitio_web' por DESDE_FUENTE), así que `o.v` nunca era vacío y la
    // rama de `resumenAtribucion` era CÓDIGO MUERTO: un clic llegado por
    // `utm_source=bing` se anunciaba como "Sitio web" y el canal real se perdía.
    // Sin ella, `o.v` solo trae valor cuando el canal SÍ se reconoce
    // (tiktok/instagram/facebook/google/linkedin/youtube) y el resto cae al
    // resumen, que sí sabe decir "bing · ferreteros_ago" o "Referido de blog.x.com".
    // Y el toque sale de toqueDeOrigen(), no de `p.s || u.s`: es el mismo criterio
    // con el que se llenan las columnas utm_* del CRM.
    const o = origenDe(origenDeRegistro({ utm_source: toqueDeOrigen(atribucion)?.s }));

    await notificar({
      clave: `wa_intento:${quien}:${giro || 'general'}:${hoy}`,
      tipo: 'wa_intento',
      nivel: 'info',
      titulo: `Pidieron demo por WhatsApp${giro ? ` — ${giro}` : ''}`,
      // `o.l` ya es el canal en legible ("TikTok"); meter además el utm_source
      // crudo repetía la misma palabra dos veces en la campana.
      detalle: [o.v ? o.l : resumenAtribucion(atribucion), bloque.primer_toque?.campana, bloque.primer_toque?.landing]
        .filter(Boolean).join(' · '),
      metadata: { giro, contexto, atribucion: bloque },
    });
  } catch { /* nunca falla hacia el usuario: es telemetría */ }

  return ok();
};
