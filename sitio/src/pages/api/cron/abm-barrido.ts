// ══ CRON · El barrido de Google Maps, esta vez completo ══════════════════════
//
// POR QUÉ SE REHACE
// El barrido anterior buscó por ciudad y se quedó con LA PRIMERA PÁGINA de cada
// búsqueda. Google devuelve 20 por página y ofrece más con `nextPageToken`, que
// nunca se pidió. El resultado medido:
//
//   Guadalajara → 24 zapaterías, 9 casas de novia
//   CDMX        → 8 casas de novia
//
// Hay cientos. Y tampoco cubrió los municipios conurbados: para Google,
// Zapopan y Tlaquepaque no son Guadalajara, ni Ecatepec es CDMX. Un barrido que
// busca "Guadalajara" deja fuera la mitad del área metropolitana.
//
// QUÉ HACE ESTE
//   giro × ciudad × TODAS las páginas (hasta 3, que es el tope de Places)
//
// Y aplica la premisa (§0) al entrar, no después: solo se da de alta lo que
// tiene 3.7 estrellas o más. No queremos una base grande, queremos una buena.
//
// DEDUPE POR place_id, NO POR NOMBRE
// Es la razón por la que ahora se guarda. "Fantasías Miguel" y "Fantasias
// Miguel" son la misma tienda y el nombre no lo delata; el place_id sí. Sin
// esto, cada corrida volvería a cargar lo mismo con otra grafía.
//
// GET /api/cron/abm-barrido?giro=&ciudades=10&paginas=3&dry=1
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { quien, limpiar, calcularPuntaje } from '../../../lib/crm/abm.lib';
import { PAISES } from '../../../lib/crm/abm-paises';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const env = (n: string) => String((import.meta.env as any)[n] || (process.env as any)[n] || '').trim();

const CAMPOS = [
  'places.id', 'places.displayName', 'places.rating', 'places.userRatingCount',
  'places.websiteUri', 'places.internationalPhoneNumber', 'places.businessStatus',
  'places.primaryType', 'places.shortFormattedAddress',
  'nextPageToken',
].join(',');

/** El término con el que se le pregunta a Google por cada giro. No es el nombre
 *  interno: es cómo lo buscaría una persona. "mayoristas" no encuentra nada;
 *  "ropa por mayoreo" sí. */
const TERMINO: Record<string, string> = {
  novias: 'vestidos de novia',
  zapaterias: 'zapatería',
  boutiques: 'boutique de ropa',
  joyeria: 'joyería',
  renta: 'renta de vestidos y trajes',
  western: 'botas vaqueras',
  telas: 'telas y mercería',
  tallas: 'ropa de bebé y maternidad',
  deportiva: 'ropa deportiva',
  scrubs: 'uniformes médicos',
  disfraces: 'disfraces',
  sublimado: 'playeras personalizadas sublimación',
  vintage: 'ropa de segunda mano',
  jeans: 'jeans y mezclilla',
  trajesbano: 'trajes de baño',
  charro: 'trajes de charro y danza',
  relojerias: 'relojería',
  outlets: 'outlet de ropa',
  distribuidores: 'distribuidor de ropa',
  fabricantes: 'fábrica de ropa',
  mayoristas: 'ropa por mayoreo',
  calzado: 'fábrica de calzado',
  cadenas: 'tienda departamental de ropa',
  canal: 'plaza de ropa mayoreo',
};

/** ── LOS ALIADOS (15-sep-2026) ───────────────────────────────────────────────
 *
 * Un aliado no se busca por giro: se busca por lo que HACE. El taller de
 * confección y el despacho contable no son «moda», pero los dos viven de
 * nuestros clientes, y a los dos los encuentra Maps como a cualquier negocio
 * con domicilio.
 *
 * Aquí SOLO están los tipos que Maps de verdad encuentra. Un creador de TikTok
 * o una pasarela de pagos no tienen ficha de local, y meterlos con un término
 * inventado llenaría la base de ruido: esos van por otra vía y por eso no
 * aparecen en esta tabla. La lista completa de tipos vive en
 * `lib/crm/abm-aliados.ts`; esta es la parte que este barrido puede cubrir.
 *
 * El término es cómo lo buscaría una persona, no el nombre interno.
 */
const TERMINO_ALIADO: Record<string, string> = {
  /* Los términos están MEDIDOS contra Maps en seco, no supuestos. Lo que se
     probó y por qué quedó así:
       · «taller de costura y confección» → cursos de costura y modistas. El
         que surte a las marcas se busca por la fábrica, no por el oficio.
       · «fotografía de producto» a secas → estudios de bodas y retrato.
         Agregar «para ecommerce» los separa.
       · «despacho contable» sale limpio de una: 19 de 40 nuevos, todos
         despachos. No hace falta afinarlo. */
  taller: 'fábrica de ropa maquila textil',
  contador: 'despacho contable',
  insumos_tienda: 'ganchos y etiquetas para ropa',
  fotografia: 'fotografía de producto para ecommerce',
  escuela_moda: 'escuela de diseño de modas',
  /* Del corredor: al locatario de Villa Hidalgo o Moroleón le bordan el logo y
     le estampan la playera ahí mismo. Es de los pocos proveedores que ve la
     temporada entera de sus clientes. */
  bordado: 'bordados y serigrafía para ropa',
};

/* LOS QUE NO ESTÁN, Y POR QUÉ — medido el 15-sep-2026, para que nadie los
   vuelva a intentar por aquí:
     · consultora_retail / consultora_moda — 13 resultados en dos ciudades, y
       de esos una agencia de marketing, una comercializadora de calzado y un
       despacho fiscal. Una consultora no se anuncia como local con reseñas.
     · patronista — devuelve academias de corte y confección; es el mismo
       resultado que `escuela_moda` con otro nombre.
     · hardware — devuelve tiendas de computadoras de barrio. Quien vende
       lectores y etiquetadoras al retail es un distribuidor nacional.
   Esos tres van por búsqueda en la web y por lista curada, no por Maps. */

/** La premisa, aplicada al entrar: 3.7 estrellas y reseñas suficientes para que
 *  la calificación signifique algo. Un 5.0 con dos reseñas es ruido. */
const ESTRELLAS_MIN = 3.7;
const RESENAS_MIN = 5;

export const GET: APIRoute = async ({ request, url }) => {
  const auth = request.headers.get('authorization') || '';
  const secret = env('CRON_SECRET');
  if (!(secret && auth === `Bearer ${secret}`)) {
    const yo = await quien(request);
    if (!yo) return json({ error: 'no autorizado' }, 401);
  }
  const key = env('GOOGLE_PLACES_API_KEY');
  if (!key) return json({ error: 'falta GOOGLE_PLACES_API_KEY' }, 409);

  const dry = url.searchParams.get('dry') === '1';
  const giro = url.searchParams.get('giro') || '';
  const aliado = url.searchParams.get('aliado') || '';
  const nCiudades = Math.min(40, Number(url.searchParams.get('ciudades') || 8));
  const maxPag = Math.min(3, Number(url.searchParams.get('paginas') || 3));
  if (aliado && !TERMINO_ALIADO[aliado]) return json({ error: 'ese tipo de aliado no se busca en Maps', aliados: Object.keys(TERMINO_ALIADO) }, 400);
  if (!aliado && (!giro || !TERMINO[giro])) return json({ error: 'falta giro o aliado válido', giros: Object.keys(TERMINO), aliados: Object.keys(TERMINO_ALIADO) }, 400);

  /* Qué se busca y dónde se guarda. Un aliado entra al giro `aliados` con su
     tipo en `subgiro`; el giro normal entra como siempre. */
  /* `?termino=` PRUEBA UN TÉRMINO SIN DESPLEGAR. El primer intento con
     «taller de costura y confección» trajo cursos de costura y modistas, no la
     maquila que surte a las marcas —la trampa del giro del manual, §3—. Afinar
     eso a ciegas cuesta un despliegue por intento; con esto se prueba en seco,
     se mira la muestra y solo entonces se escribe el término bueno en la tabla
     de arriba. Pide sesión de una persona (el cron no manda términos sueltos)
     y se anota en la fuente para que quede el rastro de con qué se levantó. */
  const aMano = (url.searchParams.get('termino') || '').trim().slice(0, 120);
  const termino = aMano || (aliado ? TERMINO_ALIADO[aliado] : TERMINO[giro]);
  const giroDestino = aliado ? 'aliados' : giro;
  const subgiro = aliado || null;
  /* La marca de «esta ciudad ya se barrió» es por BÚSQUEDA, no por giro: si
     `aliados` fuera la llave, barrer talleres en Guadalajara dejaría a los
     contadores de Guadalajara marcados como hechos sin haberlos buscado. */
  const llaveBarrido = aliado ? `aliados:${aliado}` : giro;

  /* `?ciudad=` BARRE UNA CIUDAD A MANO, y hacía falta: las ciudades salen
     ordenadas por cuántas cuentas ya tenemos ahí, así que el barrido siempre
     va a Guadalajara y a Monterrey y NUNCA le toca Villa Hidalgo (237
     cuentas), Zapotlanejo (16) ni Moroleón (25). Y justo ahí están los
     aliados que pidió el dueño: la persona local que ya le vende a los
     locatarios del corredor. El estado se toma de las cuentas que ya viven en
     esa ciudad —no se adivina— y si no hay ninguna se puede pasar con
     `?estado=`. */
  const ciudadAMano = (url.searchParams.get('ciudad') || '').trim().slice(0, 80);
  let ciudades: any[] | null = null;
  let e1: any = null;
  if (ciudadAMano) {
    const { data: ya } = await supabase.from('abm_cuentas').select('estado_geo')
      .ilike('ciudad', ciudadAMano).not('estado_geo', 'is', null).limit(1);
    const estado = (url.searchParams.get('estado') || '').trim() || (ya || [])[0]?.estado_geo || null;
    ciudades = [{ ciudad: ciudadAMano, estado_geo: estado }];
  } else {
    // Las ciudades pendientes para ESTA búsqueda, las más grandes primero.
    const r0 = await supabase.rpc('abm_ciudades_pendientes', { p_giro: llaveBarrido, p_limite: nCiudades });
    ciudades = r0.data as any[]; e1 = r0.error;
  }
  if (e1) return json({ error: e1.message, pista: 'falta la función abm_ciudades_pendientes' }, 500);
  if (!ciudades?.length) return json({ giro: giroDestino, aliado: aliado || undefined, nuevas: 0, nota: 'no quedan ciudades pendientes para esta búsqueda' });

  const r = { giro: giroDestino, aliado: aliado || undefined, termino, ciudades: 0, vistos: 0, nuevas: 0, ya_estaban: 0, bajo_umbral: 0, cerrados: 0, otra_ciudad: 0, paginas: 0 };
  const muestra: any[] = [];

  for (const ci of ciudades as any[]) {
    r.ciudades++;
    let token: string | undefined;
    for (let pag = 0; pag < maxPag; pag++) {
      const cuerpo: any = token
        ? { pageToken: token }
        : { textQuery: `${termino} en ${ci.ciudad}, ${ci.estado_geo || 'México'}`, languageCode: 'es', regionCode: 'MX', maxResultCount: 20 };
      const res: any = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': CAMPOS },
        body: JSON.stringify(cuerpo),
      }).then((x) => x.json());
      r.paginas++;

      for (const p of res?.places || []) {
        r.vistos++;
        if (p.businessStatus === 'CLOSED_PERMANENTLY') { r.cerrados++; continue; }
        /* FUERA LO QUE NO ESTÁ EN MÉXICO.
           La búsqueda es «término en ciudad, estado», y cuando Google no
           encuentra suficiente en esa ciudad devuelve el negocio que mejor
           empata AUNQUE ESTÉ EN OTRO PAÍS. Así entraron 1,447 cuentas de
           Bogotá, Medellín, Barranquilla, Santiago y Temuco.
           No es un detalle: todo el guion dice «el mapa de las mejores X de
           México». Escribirle a una casa de novias de Bogotá con ese texto es
           quedar mal, y además no le sirve a nadie.
           Se compara contra la ciudad que se pidió: si la dirección que
           devuelve Google no la menciona ni menciona el estado, no es de ahí. */
        const dir = String(p.shortFormattedAddress || '').toLowerCase();
        const pedida = String(ci.ciudad || '').toLowerCase();
        const edo = String(ci.estado_geo || '').toLowerCase();
        const pelar = (x: string) => x.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
        if (dir && pedida && !pelar(dir).includes(pelar(pedida)) && (!edo || !pelar(dir).includes(pelar(edo)))) {
          r.otra_ciudad++;
          continue;
        }
        if (!(Number(p.rating) >= ESTRELLAS_MIN) || !(Number(p.userRatingCount) >= RESENAS_MIN)) { r.bajo_umbral++; continue; }

        const { data: ya } = await supabase.from('abm_cuentas').select('id').eq('place_id', p.id).maybeSingle();
        if (ya) { r.ya_estaban++; continue; }

        r.nuevas++;
        if (dry) { if (muestra.length < 12) muestra.push({ nombre: p.displayName?.text, ciudad: ci.ciudad, estrellas: p.rating, resenas: p.userRatingCount, sitio: p.websiteUri, tipo: p.primaryType }); continue; }

        /* El país va con el NOMBRE, no con el iso: el goteo selecciona con
           `.eq('pais', paisDe(f.pais).nombre)`. Escribir 'MX' dejó 7,394
           cuentas del barrido invisibles para todas las cadencias de México
           —con correo y todo— hasta que se midió (16-sep-2026). */
        const { data: nueva } = await supabase.from('abm_cuentas').insert({
          nombre: limpiar(p.displayName?.text || '', 160),
          giro: giroDestino, subgiro, ciudad: ci.ciudad, estado_geo: ci.estado_geo, pais: PAISES.mx.nombre,
          place_id: p.id, abierto: p.businessStatus || null, tipo_maps: p.primaryType || null,
          google_rating: p.rating || null, google_resenas: p.userRatingCount || null,
          sitio: p.websiteUri || null, maps_at: new Date().toISOString(),
          /* SE CALIFICA AL ENTRAR. La columna `puntaje` es NOT NULL DEFAULT 0 y
             el barrido no la escribía, así que las 7,105 cuentas que trajo
             quedaron en cero — cuando el mínimo posible del cálculo es 12.
             Cero no quería decir «mala», quería decir «nadie la miró», pero
             todo lo que ordena por puntaje (el goteo y el WhatsApp en frío)
             las mandaba al último. Lo más fresco de la base era lo último en
             la fila (16-sep-2026).
             Se usa `calcularPuntaje` y no `repuntuar` porque aquí todavía no
             hay señales ni personas que consultar: son tres viajes a la base
             por cuenta para leer tablas vacías. El vigilante la vuelve a
             calificar cuando ya tenga con qué. */
          ...(() => {
            const { encaje, dolor, accesibilidad, puntaje } = calcularPuntaje({
              sucursales: null, google_resenas: p.userRatingCount || null,
              google_rating: p.rating || null, sitio_carrito: null,
            });
            return { encaje, dolor, accesibilidad, puntaje };
          })(),
        }).select('id').maybeSingle();
        if (!nueva) continue;

        await supabase.from('abm_fuentes').insert({
          cuenta_id: nueva.id, campo: 'alta', valor: `${p.displayName?.text} · ${p.rating}★ (${p.userRatingCount})`,
          metodo: 'google_maps', confianza: 'alta', agente: aliado ? `barrido-aliados:${aliado}` : 'barrido-v2',
        });
        // El teléfono solo si Google confirma que es mexicano: diez dígitos no
        // implican lada de México.
        const crudo = String(p.internationalPhoneNumber || '').trim();
        if (crudo.startsWith('+52')) {
          const tel = crudo.replace(/\D/g, '');
          if (tel.length === 12) {
            await supabase.from('abm_canales').insert({
              cuenta_id: nueva.id, tipo: 'telefono', valor: tel, confianza: 'alta',
              es_de_la_tienda: true, estado: 'sin_probar',
            });
          }
        }
      }
      token = res?.nextPageToken;
      if (!token) break;
      // Places pide un momento antes de aceptar el token de la página siguiente.
      await new Promise((s) => setTimeout(s, 1200));
    }
    if (!dry && !aMano) {
      await supabase.from('abm_barrido').upsert(
        { giro: llaveBarrido, ciudad: ci.ciudad, barrido_at: new Date().toISOString() },
        { onConflict: 'giro,ciudad' },
      );
    }
  }

  return json({ ...r, dry, muestra: dry ? muestra : undefined });
};
