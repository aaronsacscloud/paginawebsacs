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
// `websiteUri` y el teléfono son tier Enterprise. `reviews`, que el
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
import { paisDe } from '../../../lib/crm/abm-paises';
import { supabase } from '../../../lib/supabase';
import { apuntar, quien, quienPuedeCorrerCrons, limpiar } from '../../../lib/crm/abm.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const env = (n: string) => String((import.meta.env as any)[n] || (process.env as any)[n] || '').trim();

const CAMPOS = [
  'places.id', 'places.displayName', 'places.rating', 'places.userRatingCount',
  'places.websiteUri', 'places.internationalPhoneNumber', 'places.businessStatus',
  'places.formattedAddress', 'places.reviews', 'places.primaryType', 'places.types',
].join(',');

/* ── ¿Esto es moda? ───────────────────────────────────────────────────────────
   Google dice el TIPO de cada negocio y no lo estábamos pidiendo. Por eso
   sobrevivían en la base cosas que nunca debieron entrar: "El Globo" estaba
   clasificado como `boutiques` y es una PASTELERÍA (primaryType pastry_shop),
   y 44 de las 100 "relojerías" son ÓPTICAS —el barrido buscó relojerías y
   Google agrupa «óptica y relojería» en la misma categoría—.
   El barrido clasifica por el TÉRMINO QUE SE BUSCÓ, no por lo que el negocio
   es. Preguntarle el tipo a Google es la única forma de corregirlo, y viene en
   la misma respuesta que ya pagamos. */
const TIPOS_MODA = new Set([
  'clothing_store', 'shoe_store', 'jewelry_store', 'store', 'department_store',
  'shopping_mall', 'wholesaler', 'tailor', 'boutique', 'bridal_shop',
  'sporting_goods_store', 'home_goods_store', 'market', 'clothing_wholesaler',
]);
/* Estos no son moda por más que el barrido los haya metido. Se marcan para que
   una persona decida, NO se borran: un falso positivo aquí tira una cuenta
   buena y nadie se entera. */
const TIPOS_FUERA = new Set([
  'pastry_shop', 'bakery', 'cafe', 'coffee_shop', 'restaurant', 'dessert_shop',
  'bar', 'hotel', 'lodging', 'pharmacy', 'drugstore', 'hospital', 'doctor',
  'dentist', 'veterinary_care', 'gym', 'beauty_salon', 'hair_salon', 'spa',
  'bank', 'car_repair', 'car_dealer', 'gas_station', 'supermarket',
  'grocery_store', 'convenience_store', 'furniture_store', 'hardware_store',
  'book_store', 'florist', 'liquor_store', 'real_estate_agency', 'travel_agency',
  'school', 'church', 'optician', 'eye_care',
]);

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
    const yo = await quienPuedeCorrerCrons(request);
    if (!yo) return json({ error: 'no autorizado' }, 401);
  }

  const key = env('GOOGLE_PLACES_API_KEY');
  if (!key) return json({ error: 'falta GOOGLE_PLACES_API_KEY' }, 409);

  const dry = url.searchParams.get('dry') === '1';

  const cuantas = Math.min(300, Number(url.searchParams.get('cuantas') || 60));
  const top = Math.min(300, Number(url.searchParams.get('top') || 100));
  const giro = url.searchParams.get('giro') || '';

  /* MODO TIPOS: revisa el giro de cuentas YA consultadas, usando su place_id.
     Preguntar por place_id pidiendo solo el tipo es un tier barato —nada de
     reseñas—, así que revalidar dos mil cuentas cuesta una fracción de lo que
     costó traerlas. Existe porque la validación de giro se agregó DESPUÉS de
     la primera corrida: sin esto habría que reconsultarlo todo al precio alto. */
  if (url.searchParams.get('modo') === 'tipos') {
    const { data: ctas } = await supabase.from('abm_cuentas')
      .select('id, nombre, place_id, giro')
      .not('place_id', 'is', null).is('tipo_maps', null)
      .neq('etapa', 'no_contactar').limit(Math.min(400, cuantas));
    let rev = 0, fuera = 0;
    for (const c of (ctas || []) as any[]) {
      try {
        const p: any = await fetch(`https://places.googleapis.com/v1/places/${c.place_id}?languageCode=es`, {
          headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,primaryType,types,displayName' },
        }).then((x) => x.json());
        const tipos: string[] = [p?.primaryType, ...(p?.types || [])].filter(Boolean);
        if (!tipos.length) continue;
        rev++;
        const mal = tipos.find((t) => TIPOS_FUERA.has(t));
        const bien = tipos.some((t) => TIPOS_MODA.has(t));
        await supabase.from('abm_cuentas').update({ tipo_maps: p.primaryType || tipos[0] }).eq('id', c.id);
        if (mal && !bien) {
          fuera++;
          if (!dry) {
            await supabase.from('abm_cuentas').update({ etapa: 'no_contactar' }).eq('id', c.id);
            await apuntar(c.id, 'sistema', 'nota', { texto: `Google lo clasifica como «${mal}», no es un negocio de moda. Sale de la cola. Si está mal, quitar la etapa no_contactar.` });
          }
        }
      } catch { /* una ficha que no responde no detiene el lote */ }
    }
    return json({ modo: 'tipos', revisadas: rev, fuera_de_moda: fuera, dry });
  }

  // El top de cada giro que todavía no hemos consultado. Primero las que no
  // tienen ninguna vía: son las que no se pueden trabajar de ninguna forma.
  const { data: cuentas, error } = await supabase.rpc('abm_top_sin_maps', {
    p_top: top, p_giro: giro || null, p_limite: cuantas,
  });
  if (error) return json({ error: error.message, pista: 'falta la función abm_top_sin_maps' }, 500);
  if (!cuentas?.length) return json({ revisadas: 0, nota: 'no quedan cuentas del top sin consultar' });

  const r = { revisadas: 0, con_sitio: 0, con_telefono: 0, cerrados: 0, no_encontradas: 0, otro_negocio: 0, duplicadas: 0, no_es_moda: 0, quejas: 0 };
  const muestra: any[] = [];

  for (const c of cuentas as any[]) {
    r.revisadas++;
    try {
      /* El país es el DE LA CUENTA (16-sep-2026). Esto decía «México» y
         regionCode MX a secas, de cuando la base era solo mexicana; con las
         cuentas de once países —que además encabezan el top por reseñas—
         buscaba «ARTENOVIA Huelva México» y lo que encontrara se le pegaba a
         la ficha equivocada. */
      const pp = paisDe(c.pais);
      const q = [c.nombre, c.ciudad, pp.nombre].filter(Boolean).join(' ');
      const res: any = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': CAMPOS },
        body: JSON.stringify({ textQuery: q, languageCode: 'es', regionCode: pp.gl, maxResultCount: 1 }),
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

      const tipos: string[] = [p.primaryType, ...(p.types || [])].filter(Boolean);
      const fuera = tipos.find((t) => TIPOS_FUERA.has(t));
      const dentro = tipos.some((t) => TIPOS_MODA.has(t));   // ver el comentario de abajo: esto solo anota

      const cambios: any = { maps_at: new Date().toISOString(), place_id: p.id || null, abierto: p.businessStatus || null, tipo_maps: p.primaryType || tipos[0] || null };
      if (p.websiteUri && !c.sitio) { cambios.sitio = p.websiteUri; r.con_sitio++; }
      if (p.rating) cambios.google_rating = p.rating;
      if (p.userRatingCount) cambios.google_resenas = p.userRatingCount;

      if (dry) { muestra.push({ cuenta: c.nombre, google: p.displayName?.text, sitio: p.websiteUri, tel: p.internationalPhoneNumber, abierto: p.businessStatus }); continue; }

      /* Si otra cuenta nuestra ya tiene ese place_id, las DOS son el mismo
         negocio: "Fantasías Miguel" y "Fantasias Miguel" en Monterrey, con y
         sin acento. El índice único rechazaba la actualización ENTERA —no solo
         el place_id— así que maps_at nunca se sellaba y la cuenta volvía a
         consultarse en cada corrida: 31 cuentas atoradas en bucle, pagando la
         consulta cada vez.
         Ahora se guarda todo lo demás, se deja el place_id en la dueña y el
         duplicado se marca para revisarlo. Un duplicado no es un error del
         enriquecimiento: es un hallazgo, y además significa que ese negocio
         recibiría el mismo correo dos veces. */
      let dup: string | null = null;
      if (cambios.place_id) {
        const { data: otra } = await supabase.from('abm_cuentas')
          .select('id, nombre').eq('place_id', cambios.place_id).neq('id', c.id).maybeSingle();
        if (otra) { dup = otra.nombre; delete cambios.place_id; }
      }
      await supabase.from('abm_cuentas').update(cambios).eq('id', c.id);
      if (dup) {
        await supabase.from('abm_cuentas').update({ etapa: 'no_contactar' }).eq('id', c.id);
        await apuntar(c.id, 'sistema', 'nota', {
          texto: `DUPLICADA: es el mismo negocio de Google que «${dup}». Se saca de la cola para no escribirle dos veces al mismo lugar.`,
        });
        r.duplicadas++;
        continue;
      }
      /* EL TIPO DE GOOGLE SIRVE PARA SOSPECHAR, NO PARA DECIDIR.
         Probé a sacar de la cola todo lo que Google no clasificara como moda y
         habría sido un desastre: clasifica genérico y los nombres lo prueban —
           home_goods_store  → EUROTEXTIL, Telas Junco        (telas, buenas)
           service           → Sivuplé, Trajes Nancy          (renta, buenas)
           child_care_agency → La Bodega del Bebé             (tallas, buenas)
           corporate_office  → Intermoda, Marel de México     (canal, buenas)
         Cortar por tipo habría tirado decenas de cuentas buenas sin que nadie
         se enterara. Así que solo se ANOTA la sospecha, y una persona decide.
         El corte de verdad se hace con nombre y apellido, en migración. */
      if (fuera && !dentro) {
        r.no_es_moda++;
        await apuntar(c.id, 'sistema', 'nota', {
          texto: `⚠️ Google lo clasifica como «${fuera}»: revisar si de verdad es un negocio de moda.`,
        });
      }
      if (p.businessStatus === 'CLOSED_PERMANENTLY') {
        r.cerrados++;
        await supabase.from('abm_cuentas').update({ etapa: 'no_contactar' }).eq('id', c.id);
        await apuntar(c.id, 'sistema', 'nota', { texto: 'Google Maps lo reporta CERRADO PERMANENTEMENTE: no se contacta.' });
        continue;
      }
      if (cambios.sitio) {
        await supabase.from('abm_fuentes').insert({ cuenta_id: c.id, campo: 'sitio', valor: cambios.sitio, metodo: 'google_maps', confianza: 'alta', agente: 'places-api' });
      }
      /* El teléfono entra como canal, NO como WhatsApp: que tenga teléfono no
         dice nada de si tiene WhatsApp (§6 bis).

         Se pide `internationalPhoneNumber`, que viene con lada de país, y NO
         el nacional. Con el nacional, "Gran Plaza Outlets" devolvía
         "(760) 768-9002" —California— y el código le pegaba un 52 al frente,
         convirtiendo un número estadounidense en un celular mexicano
         inventado. Diez dígitos no implican que sean mexicanos. */
      if (p.internationalPhoneNumber) {
        const crudo = String(p.internationalPhoneNumber).trim();
        const tel = crudo.replace(/\D/g, '');
        // La lada que vale es la del país de la cuenta, no siempre el 52.
        const e164 = crudo.startsWith('+' + pp.lada) ? tel : '';
        if (e164.length >= 10 && e164.length <= 15 && e164.startsWith(pp.lada)) {
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
