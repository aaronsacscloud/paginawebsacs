// Enriquecimiento por API. Cada fuente se enciende sola cuando aparece su
// llave; sin llave no falla, dice qué falta.
//
//   · Google Places  → calificación, número de reseñas y EL TEXTO de las peores.
//     Lo último es lo que más vale: una reseña que dice "no tenían mi talla" o
//     "no me pudieron facturar" es el dolor que vendemos, dicho por su propio
//     cliente y con fecha. Se guarda como señal y sube el puntaje.
//   · DENUE (INEGI)  → el censo de establecimientos: empleados y teléfono de
//     negocios que ni siquiera tienen sitio. Token gratuito.
//
// GET /api/cron/abm-enriquecer?fuente=places|denue&cuantas=
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { apuntar, repuntuar, limpiar } from '../../../lib/crm/abm.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const llave = (n: string) => String((import.meta.env as any)[n] || '').trim();

/** Lo que una reseña mala nos dice del negocio, en categorías que sí usamos. */
function queDuele(texto: string): { tipo: string; peso: number } | null {
  const t = texto.toLowerCase();
  if (/no ten[íi]an? (mi )?talla|sin talla|se (les )?acab|no hab[íi]a (el |la )?(modelo|talla|n[úu]mero)|agotad/.test(t))
    return { tipo: 'resena_mala', peso: 12 };          // faltante: es literalmente lo que resolvemos
  if (/no (me )?(pudieron |quisieron )?factur|sin factura|el sistema (se cay|no serv|estaba)|no serv[íi]a la (caja|terminal)/.test(t))
    return { tipo: 'resena_mala', peso: 10 };          // el sistema les falló enfrente del cliente
  if (/me cobraron (de m[áa]s|dos veces)|cobro dupl|no me devolv/.test(t))
    return { tipo: 'resena_mala', peso: 8 };
  if (/apartado|no me guardaron|perdieron mi/.test(t))
    return { tipo: 'resena_mala', peso: 8 };
  return null;
}

export const GET: APIRoute = async ({ request, url }) => {
  const auth = request.headers.get('authorization') || '';
  const secret = (import.meta.env.CRON_SECRET || process.env.CRON_SECRET || '').trim();
  if (secret && auth !== `Bearer ${secret}`) return json({ error: 'no autorizado' }, 401);

  const fuente = url.searchParams.get('fuente') || 'places';
  const cuantas = Math.min(200, Number(url.searchParams.get('cuantas') || 40));

  if (fuente === 'places') {
    const key = llave('GOOGLE_PLACES_API_KEY');
    if (!key) return json({ error: 'falta GOOGLE_PLACES_API_KEY', que_hace: 'calificación, número de reseñas y el texto de las peores' }, 409);

    // Primero las que no tienen calificación: joyería y cadenas están casi en cero.
    const { data: cuentas } = await supabase.from('abm_cuentas')
      .select('id, nombre, ciudad, google_rating, sitio')
      .neq('etapa', 'no_contactar').is('ya_es_cliente', null)
      .order('google_rating', { ascending: true, nullsFirst: true })
      .order('puntaje', { ascending: false }).limit(cuantas);

    let medidas = 0, quejas = 0;
    for (const c of cuentas || []) {
      try {
        const q = encodeURIComponent(`${c.nombre} ${c.ciudad || 'México'}`);
        const busca = await fetch(
          `https://places.googleapis.com/v1/places:searchText`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.reviews' },
            body: JSON.stringify({ textQuery: decodeURIComponent(q), languageCode: 'es', regionCode: 'MX', maxResultCount: 1 }) },
        ).then(r => r.json());
        const p = (busca?.places || [])[0];
        if (!p?.rating) continue;

        await supabase.from('abm_cuentas').update({
          google_rating: p.rating, google_resenas: p.userRatingCount || null, updated_at: new Date().toISOString(),
        }).eq('id', c.id);
        await supabase.from('abm_fuentes').insert({
          cuenta_id: c.id, campo: 'google_rating', valor: String(p.rating),
          metodo: 'google_maps', confianza: 'alta', agente: 'places-api',
        });
        medidas++;

        // El oro: lo que dicen las malas.
        for (const r of (p.reviews || []).slice(0, 5)) {
          if (Number(r.rating) > 3) continue;
          const texto = limpiar(r?.text?.text || r?.originalText?.text || '', 600);
          const d = queDuele(texto);
          if (!d) continue;
          const { data: ya } = await supabase.from('abm_senales').select('id')
            .eq('cuenta_id', c.id).eq('tipo', 'resena_mala').eq('detalle', texto.slice(0, 400)).maybeSingle();
          if (ya) continue;
          await supabase.from('abm_senales').insert({
            cuenta_id: c.id, tipo: d.tipo, peso: d.peso, origen: 'places',
            detalle: texto.slice(0, 400), fecha: (r.publishTime || '').slice(0, 10) || null,
            caduca_at: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
          });
          quejas++;
        }
        await repuntuar(c.id);
      } catch (e) { console.warn('[abm-enriquecer] places', c.nombre, e); }
    }
    return json({ fuente: 'places', medidas, quejas_encontradas: quejas });
  }

  if (fuente === 'denue') {
    const token = llave('INEGI_DENUE_TOKEN');
    if (!token) return json({ error: 'falta INEGI_DENUE_TOKEN', que_hace: 'el censo de establecimientos del INEGI: empleados y teléfono, gratis' }, 409);
    // El DENUE se consulta por nombre y entidad; sirve para llenar teléfono y
    // rango de empleados de las que no tienen sitio.
    const { data: cuentas } = await supabase.from('abm_cuentas')
      .select('id, nombre, ciudad').eq('canales_n', 0).neq('etapa', 'no_contactar').limit(cuantas);
    let con = 0;
    for (const c of cuentas || []) {
      try {
        const r = await fetch(`https://www.inegi.org.mx/app/api/denue/v1/consulta/BuscarEntidad/${encodeURIComponent(c.nombre)}/00/1/10/${token}`)
          .then(x => x.json());
        const e = Array.isArray(r) ? r[0] : null;
        if (!e?.Telefono) continue;
        await supabase.from('abm_canales').insert({
          cuenta_id: c.id, tipo: 'telefono', valor: String(e.Telefono).trim(),
          confianza: 'media', es_de_la_tienda: true, estado: 'sin_probar',
        });
        await supabase.from('abm_fuentes').insert({
          cuenta_id: c.id, campo: 'telefono', valor: String(e.Telefono),
          metodo: 'directorio', confianza: 'media', agente: 'denue',
        });
        await apuntar(c.id, 'sistema', 'nota', { texto: `El DENUE dio teléfono (${e.Estrato_Personal_Ocupado || 'sin rango de personal'})` });
        con++;
      } catch (e) { console.warn('[abm-enriquecer] denue', c.nombre, e); }
    }
    return json({ fuente: 'denue', con_telefono_nuevo: con, revisadas: (cuentas || []).length });
  }

  return json({ error: 'fuente desconocida', fuentes: ['places', 'denue'] }, 400);
};
