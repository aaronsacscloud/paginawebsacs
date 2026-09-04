// El vigilante: una vez por semana revisa los sitios de las cuentas objetivo y
// levanta señales VIVAS.
//
// Dejó de ser opcional cuando el dolor del puntaje pasó a leer `abm_senales`:
// sin esto, el dolor de 578 cuentas cuelga de filas congeladas del estudio.
// Un sitio que se cayó esta semana, o una tienda que abrió, es lo que hace que
// el correo llegue el día que importa — el que llega porque tocaba el día 11
// no se contesta.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { repuntuar } from '../../../lib/crm/abm.lib';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const UA = 'Mozilla/5.0 (compatible; SacsBot/1.0; +https://www.sacscloud.com)';
const ECOM = /cdn\.shopify\.com|myshopify|vtexassets|woocommerce|tiendanube|nuvemshop|wix\.com|squarespace|magento/i;
const CARRITO = /agregar al carrito|añadir al carrito|add to cart|\/cart|carrito/i;

async function mirar(url: string): Promise<{ http: number; segundos: number; html: string }> {
  const t0 = Date.now();
  try {
    const c = new AbortController();
    const reloj = setTimeout(() => c.abort(), 15000);
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: c.signal });
    clearTimeout(reloj);
    const html = (await r.text()).slice(0, 400000);
    return { http: r.status, segundos: (Date.now() - t0) / 1000, html };
  } catch {
    return { http: 0, segundos: (Date.now() - t0) / 1000, html: '' };
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  const auth = request.headers.get('authorization') || '';
  const secret = (import.meta.env.CRON_SECRET || process.env.CRON_SECRET || '').trim();
  if (secret && auth !== `Bearer ${secret}`) return json({ error: 'no autorizado' }, 401);

  // Por tandas: 60 cuentas por corrida, las que llevan más sin revisar. Las 810
  // completas se recorren en dos semanas sin castigar a nadie con 810 peticiones.
  // 594 cuentas tienen sitio. A 60 por semana tardaba diez semanas en dar la
  // vuelta, y las señales son justamente lo que tiene que estar fresco.
  const cuantas = Math.min(300, Number(url.searchParams.get('cuantas') || 200));
  const { data: cuentas } = await supabase.from('abm_cuentas')
    .select('id, nombre, sitio, sitio_http, sitio_carrito, plataforma_web, revisado_at')
    .not('sitio', 'is', null).neq('etapa', 'no_contactar')
    .order('revisado_at', { ascending: true, nullsFirst: true }).limit(cuantas);
  if (!cuentas?.length) return json({ revisadas: 0 });

  let nuevas = 0, cambios = 0;
  const ahora = new Date().toISOString();
  const hoy = ahora.slice(0, 10);

  // De ocho en ocho: 200 peticiones seguidas de 15 segundos no caben en el
  // tiempo de una función.
  const tandas: any[][] = [];
  for (let i = 0; i < cuentas.length; i += 8) tandas.push(cuentas.slice(i, i + 8));
  for (const tanda of tandas) await Promise.all(tanda.map(async (c: any) => {
    const r = await mirar(String(c.sitio));
    const caido = r.http === 0 || r.http >= 400;
    const carrito = r.html ? CARRITO.test(r.html) : null;
    const plat = r.html ? (r.html.match(ECOM)?.[0] || null) : null;

    const patch: any = { revisado_at: ahora, sitio_http: r.http, sitio_seg: Number(r.segundos.toFixed(2)) };
    if (carrito !== null) patch.sitio_carrito = carrito;
    await supabase.from('abm_cuentas').update(patch).eq('id', c.id);

    // Una señal nueva SOLO cuando algo cambió de verdad. Repetir la misma cada
    // semana infla el dolor y ensucia la bitácora.
    if (caido && !(c.sitio_http === 0 || Number(c.sitio_http) >= 400)) {
      const { data: ya } = await supabase.from('abm_senales').select('id')
        .eq('cuenta_id', c.id).eq('tipo', 'sitio_caido').gte('fecha', hoy).maybeSingle();
      if (!ya) {
        await supabase.from('abm_senales').insert({
          cuenta_id: c.id, tipo: 'sitio_caido', origen: 'vigilante', peso: 8,
          detalle: `Su sitio dejó de responder (código ${r.http})`, fecha: hoy,
          caduca_at: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10),
        });
        nuevas++;
      }
    }
    // Si el sitio SANÓ, la señal vieja deja de valer. Insertar una nueva sumaba
    // dolor por una buena noticia.
    if (!caido && (c.sitio_http === 0 || Number(c.sitio_http) >= 400)) {
      await supabase.from('abm_senales').update({ vigente: false })
        .eq('cuenta_id', c.id).eq('tipo', 'sitio_caido');
      cambios++;
    }
    if (c.sitio_carrito === false && carrito === true) {
      await supabase.from('abm_senales').insert({
        cuenta_id: c.id, tipo: 'expansion', origen: 'vigilante', peso: 10,
        detalle: 'Abrieron tienda en línea: su sitio ya tiene carrito', fecha: hoy,
        caduca_at: new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 10),
      });
      nuevas++; cambios++;
    }
    await repuntuar(c.id);
  }));
  return json({ revisadas: cuentas.length, senales_nuevas: nuevas, cambios });
};
