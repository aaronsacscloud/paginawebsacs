// DEMAND ENGINE · la puerta API de las herramientas públicas.
//
// Es la puerta de verdad: la web la llama desde el navegador y el MCP la va a
// llamar desde el servidor. Ninguna de las tres reimplementa el cálculo —todo
// pasa por `invocar`, que valida con el mismo esquema y mide el uso en el mismo
// lugar—. Si mañana la curva de tallas cambia de criterio, cambia para las tres
// a la vez, que es justo lo que hace que la respuesta de ChatGPT sea la misma
// que la del sitio.
//
// Es escritura anónima sin auth (mide en de_herramienta_usos), así que lleva
// tope por IP como el resto de endpoints públicos del repo.
import type { APIRoute } from 'astro';
import { invocar, herramientaDe } from '../../../lib/demanda/herramientas';

export const prerender = false;

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });

// Mismo patrón que /api/wa-intento: el mapa vive por instancia, así que frena
// la ráfaga de un origen, no un ataque distribuido. Aquí el tope es más bajo
// porque cada llamada hace cálculo real, no un insert.
const PORMINUTO_MAX = 20;
const golpes = new Map<string, { minuto: number; n: number }>();
function pasaTope(ip: string): boolean {
  const minuto = Math.floor(Date.now() / 60000);
  const b = golpes.get(ip);
  if (!b || b.minuto !== minuto) golpes.set(ip, { minuto, n: 1 });
  else if (b.n >= PORMINUTO_MAX) return false;
  else b.n++;
  if (golpes.size > 5000) {
    for (const [k, v] of golpes) if (v.minuto !== minuto) golpes.delete(k);
    if (golpes.size > 5000) golpes.clear();
  }
  return true;
}

/** GET describe la herramienta. No es adorno: es lo que permite que un agente
 *  descubra qué puede pedir sin que nadie le pase documentación aparte. */
export const GET: APIRoute = async ({ params }) => {
  const h = herramientaDe(params.slug || '');
  if (!h || !h.puertas.includes('api')) return json({ error: 'No existe esa herramienta.' }, 404);
  const { toJSONSchema } = await import('zod');
  return json({
    slug: h.slug,
    nombre: h.nombre,
    descripcion: h.descripcion,
    entrada: toJSONSchema(h.entrada as any),
    con_sacs: h.momento_sacs,
    licencia: 'Uso libre citando a Sacs (https://www.sacscloud.com).',
  });
};

export const POST: APIRoute = async ({ params, request, clientAddress, cookies }) => {
  const ip = clientAddress || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'sin-ip';
  if (!pasaTope(ip)) return json({ error: 'Demasiadas peticiones. Espera un minuto.' }, 429);

  let cuerpo: unknown;
  try { cuerpo = await request.json(); }
  catch { return json({ error: 'El cuerpo tiene que ser JSON.' }, 400); }

  // La puerta se declara desde el cliente solo para distinguir web de api en la
  // medición; no da permisos, porque `invocar` valida contra `puertas` de todos
  // modos y las tres están abiertas para las herramientas públicas.
  const puerta = (cuerpo as any)?.__puerta === 'web' ? 'web' : 'api';

  /* El visitante se lee de la COOKIE, aquí, y no de lo que mande el cliente.
     Las tres islas lo mandaban leyendo `localStorage.getItem('sacs_vid')` — y
     `sacs_vid` es una cookie, no una clave de localStorage. Siempre era null.
     Resultado: todos los usos de herramienta se guardaban sin visitante, y la
     cadena herramienta → lead → cliente que la etapa 5 necesita no tenía de
     dónde colgarse. Se veía perfecto: la tabla se llenaba de filas.

     El propio PageTracker ya lo advertía cuando escribe la cookie: «cualquier
     formulario que no se acuerde de mandar el visitorId a mano rompe el puente;
     en cookie el servidor lo lee SIEMPRE». Así que se lee aquí, donde nadie lo
     puede olvidar al escribir la siguiente herramienta. */
  const visitor = (cookies.get('sacs_vid')?.value || '').slice(0, 80) || null;

  if (cuerpo && typeof cuerpo === 'object') {
    delete (cuerpo as any).__puerta;
    delete (cuerpo as any).__visitor;
  }

  const r = await invocar(params.slug || '', cuerpo, { puerta, visitor_id: visitor });
  return json(r, r.ok ? 200 : 400);
};
