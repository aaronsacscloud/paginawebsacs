// ══ CRON · Google Maps, el paso 1 de la cascada ══════════════════════════════
//
// Le pregunta a Google por las cuentas del TOP de cada giro y guarda lo que la
// ficha sí da: sitio web, teléfono, calificación, reseñas, si sigue abierto, y
// el place_id para no tener que volver a buscar por nombre nunca más.
//
// POR QUÉ ES EL PRIMER PASO (manual §0)
// Maps es lo único que valida que el negocio EXISTE, opera y que la gente lo
// califica. El censo no dice nada de eso. Y el sitio que devuelve aquí es lo
// que alimenta el paso 2 —raspar su web— que es de donde sale el correo.
//
// LO QUE NO DA, Y NO HAY QUE PROMETERLO
// El CORREO no es un campo de Google My Business. Ni Places ni la API de
// Business Profile lo devuelven: cuando se ve un correo en una ficha, está
// escrito dentro de la descripción, no es un dato. El correo sale del sitio.
//
// LO QUE VENÍA SALIENDO GRATIS Y SE TIRABA
// `websiteUri` y `nationalPhoneNumber` son tier Enterprise. `reviews`, que el
// enriquecedor viejo ya pedía, es Enterprise + Atmosphere — más caro. Google
// cobra al tier MÁS ALTO del request, así que pedir sitio y teléfono no suma un
// peso. Se estuvo pagando el caro y desechando los otros dos.
//
// A QUIÉN CONSULTA
// Solo al top de cada giro con calificación de 3.7 para arriba, y primero a las
// que no tienen NINGUNA vía de contacto: son el 64% del objetivo y las únicas
// que no se pueden trabajar de ninguna forma hoy.
//
// GET /api/cron/abm-maps?cuantas=&giro=&top=100&dry=1
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { apuntar, quien, limpiar } from '../../../lib/crm/abm.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const env = (n: string) => String((import.meta.env as any)[n] || (process.env as any)[n] || '').trim();

const CAMPOS = [
  'places.id', 'places.displayName', 'places.rating', 'places.userRatingCount',
  'places.websiteUri', 'places.nationalPhoneNumber', 'places.businessStatus',
  'places.formattedAddress', 'places.reviews',
].join(',');

/** Lo que una reseña mala dice del negocio, en categorías que sí usamos.
 *  Es el dato más valioso de la ficha: el dolor que vendemos, dicho por su
 *  propio cliente y con fecha. */
function queDuele(t: string): { peso: number } | null {
  const s = t.toLowerCase();
  if (/no ten[íi]an? (mi )?talla|sin talla|se (les )?acab|no hab[íi]a (el |la )?(modelo|talla|n[úu]mero)|agotad/.test(s)) return { peso: 12 };
  if (/no (me )?(pudieron |quisieron )?factur|sin factura|el sistema (se cay|no serv|estaba)|no serv[íi]a la (caja|terminal)/.test(s)) return { peso: 10 };
  if (/me cobraron (de m[áa]s|dos veces)|cobro dupl|no me devolv/.test(s)) return { peso: 8 };
  if (/apartado|no me guardaron|perdieron mi/.test(s)) return { peso: 8 };
  return null;
}

/** ¿La ficha que devolvió Google es de ESTE negocio? Una búsqueda por nombre
 *  puede traer el de junto, y pegarle el sitio de otro a una cuenta es peor que
 *  dejarla vacía: nadie lo notaría y saldría un correo al negocio equivocado. */
function esLaMisma(buscado: string, devuelto: string): boolean {
  const pelar = (x: string) => x.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const a = pelar(buscado), b = pelar(devuelto);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  // Dos palabras significativas en común bastan: "Casa Novias Morelia" vs
  // "Casa Novias" empata; "Novias Karla" vs "Novias Lupita" no.
  const pa = new Set(a.split(' ').filter((w) => w.length > 3));
  const pb = a === b ? pa : new Set(b.split(' ').filter((w) => w.length > 3));
  let n = 0;
  for (const w of pa) if (pb.has(w)) n++;
  return n >= 2;
}

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
  const cuantas = Math.min(300, Number(url.searchParams.get('cuantas') || 60));
  const top = Math.min(300, Number(url.searchParams.get('top') || 100));
  const giro = url.searchParams.get('giro') || '';

  // El top de cada giro que todavía no hemos consultado. Primero las que no
  // tienen ninguna vía: son las que no se pueden trabajar de ninguna forma.
  const { data: cuentas, error } = await supabase.rpc('abm_top_sin_maps', {
    p_top: top, p_giro: giro || null, p_limite: cuantas,
  });
  if (error) return json({ error: error.message, pista: 'falta la función abm_top_sin_maps' }, 500);
  if (!cuentas?.length) return json({ revisadas: 0, nota: 'no quedan cuentas del top sin consultar' });

  const r = { revisadas: 0, con_sitio: 0, con_telefono: 0, cerrados: 0, no_encontradas: 0, otro_negocio: 0, quejas: 0 };
  const muestra: any[] = [];

  for (const c of cuentas as any[]) {
    r.revisadas++;
    try {
      const q = [c.nombre, c.ciudad, 'México'].filter(Boolean).join(' ');
      const res: any = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': CAMPOS },
        body: JSON.stringify({ textQuery: q, languageCode: 'es', regionCode: 'MX', maxResultCount: 1 }),
      }).then((x) => x.json());

      const p = (res?.places || [])[0];
      if (!p) { r.no_encontradas++; if (!dry) await supabase.from('abm_cuentas').update({ maps_at: new Date().toISOString() }).eq('id', c.id); continue; }

      if (!esLaMisma(c.nombre, p.displayName?.text || '')) {
        r.otro_negocio++;
        // Se sella la fecha igual: sin esto la misma cuenta se reconsulta cada
        // corrida y se paga otra vez por el mismo "no es".
        if (!dry) await supabase.from('abm_cuentas').update({ maps_at: new Date().toISOString() }).eq('id', c.id);
        continue;
      }

      const cambios: any = { maps_at: new Date().toISOString(), place_id: p.id || null, abierto: p.businessStatus || null };
      if (p.websiteUri && !c.sitio) { cambios.sitio = p.websiteUri; r.con_sitio++; }
      if (p.rating) cambios.google_rating = p.rating;
      if (p.userRatingCount) cambios.google_resenas = p.userRatingCount;

      if (dry) { muestra.push({ cuenta: c.nombre, google: p.displayName?.text, sitio: p.websiteUri, tel: p.nationalPhoneNumber, abierto: p.businessStatus }); continue; }

      await supabase.from('abm_cuentas').update(cambios).eq('id', c.id);
      if (p.businessStatus === 'CLOSED_PERMANENTLY') {
        r.cerrados++;
        await supabase.from('abm_cuentas').update({ etapa: 'no_contactar' }).eq('id', c.id);
        await apuntar(c.id, 'sistema', 'nota', { texto: 'Google Maps lo reporta CERRADO PERMANENTEMENTE: no se contacta.' });
        continue;
      }
      if (cambios.sitio) {
        await supabase.from('abm_fuentes').insert({ cuenta_id: c.id, campo: 'sitio', valor: cambios.sitio, metodo: 'google_maps', confianza: 'alta', agente: 'places-api' });
      }
      // El teléfono entra como canal, NO como WhatsApp: que tenga teléfono no
      // dice nada de si tiene WhatsApp (§6 bis).
      if (p.nationalPhoneNumber) {
        const tel = String(p.nationalPhoneNumber).replace(/\D/g, '');
        const e164 = tel.length === 10 ? `52${tel}` : tel;
        if (e164.length === 12) {
          const { error: e } = await supabase.from('abm_canales').insert({
            cuenta_id: c.id, tipo: 'telefono', valor: e164, confianza: 'alta',
            es_de_la_tienda: true, estado: 'sin_probar',
          });
          if (!e) r.con_telefono++;
        }
      }
      for (const rev of (p.reviews || []).slice(0, 5)) {
        if (Number(rev.rating) > 3) continue;
        const texto = limpiar(rev?.text?.text || rev?.originalText?.text || '', 600);
        const d = queDuele(texto);
        if (!d) continue;
        const { data: ya } = await supabase.from('abm_senales').select('id')
          .eq('cuenta_id', c.id).eq('tipo', 'resena_mala').eq('detalle', texto.slice(0, 400)).maybeSingle();
        if (ya) continue;
        await supabase.from('abm_senales').insert({
          cuenta_id: c.id, tipo: 'resena_mala', peso: d.peso, origen: 'places',
          detalle: texto.slice(0, 400), fecha: (rev.publishTime || '').slice(0, 10) || null,
          caduca_at: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
        });
        r.quejas++;
      }
    } catch (e) {
      console.warn('[abm-maps]', c.nombre, String((e as any)?.message || e).slice(0, 140));
    }
  }

  return json({ ...r, dry, muestra: dry ? muestra.slice(0, 10) : undefined });
};
