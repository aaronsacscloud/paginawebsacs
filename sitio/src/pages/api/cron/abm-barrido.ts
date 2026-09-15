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
import { quien, limpiar } from '../../../lib/crm/abm.lib';

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
  const nCiudades = Math.min(40, Number(url.searchParams.get('ciudades') || 8));
  const maxPag = Math.min(3, Number(url.searchParams.get('paginas') || 3));
  if (!giro || !TERMINO[giro]) return json({ error: 'falta giro válido', giros: Object.keys(TERMINO) }, 400);

  // Las ciudades pendientes para ESTE giro, las más grandes primero.
  const { data: ciudades, error: e1 } = await supabase.rpc('abm_ciudades_pendientes', {
    p_giro: giro, p_limite: nCiudades,
  });
  if (e1) return json({ error: e1.message, pista: 'falta la función abm_ciudades_pendientes' }, 500);
  if (!ciudades?.length) return json({ giro, nuevas: 0, nota: 'no quedan ciudades pendientes para este giro' });

  const r = { giro, ciudades: 0, vistos: 0, nuevas: 0, ya_estaban: 0, bajo_umbral: 0, cerrados: 0, paginas: 0 };
  const muestra: any[] = [];

  for (const ci of ciudades as any[]) {
    r.ciudades++;
    let token: string | undefined;
    for (let pag = 0; pag < maxPag; pag++) {
      const cuerpo: any = token
        ? { pageToken: token }
        : { textQuery: `${TERMINO[giro]} en ${ci.ciudad}, ${ci.estado_geo || 'México'}`, languageCode: 'es', regionCode: 'MX', maxResultCount: 20 };
      const res: any = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': CAMPOS },
        body: JSON.stringify(cuerpo),
      }).then((x) => x.json());
      r.paginas++;

      for (const p of res?.places || []) {
        r.vistos++;
        if (p.businessStatus === 'CLOSED_PERMANENTLY') { r.cerrados++; continue; }
        if (!(Number(p.rating) >= ESTRELLAS_MIN) || !(Number(p.userRatingCount) >= RESENAS_MIN)) { r.bajo_umbral++; continue; }

        const { data: ya } = await supabase.from('abm_cuentas').select('id').eq('place_id', p.id).maybeSingle();
        if (ya) { r.ya_estaban++; continue; }

        r.nuevas++;
        if (dry) { if (muestra.length < 12) muestra.push({ nombre: p.displayName?.text, ciudad: ci.ciudad, estrellas: p.rating, resenas: p.userRatingCount, sitio: p.websiteUri, tipo: p.primaryType }); continue; }

        const { data: nueva } = await supabase.from('abm_cuentas').insert({
          nombre: limpiar(p.displayName?.text || '', 160),
          giro, ciudad: ci.ciudad, estado_geo: ci.estado_geo, pais: 'MX',
          place_id: p.id, abierto: p.businessStatus || null, tipo_maps: p.primaryType || null,
          google_rating: p.rating || null, google_resenas: p.userRatingCount || null,
          sitio: p.websiteUri || null, maps_at: new Date().toISOString(),
        }).select('id').maybeSingle();
        if (!nueva) continue;

        await supabase.from('abm_fuentes').insert({
          cuenta_id: nueva.id, campo: 'alta', valor: `${p.displayName?.text} · ${p.rating}★ (${p.userRatingCount})`,
          metodo: 'google_maps', confianza: 'alta', agente: 'barrido-v2',
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
    if (!dry) {
      await supabase.from('abm_barrido').upsert(
        { giro, ciudad: ci.ciudad, barrido_at: new Date().toISOString() },
        { onConflict: 'giro,ciudad' },
      );
    }
  }

  return json({ ...r, dry, muestra: dry ? muestra : undefined });
};
