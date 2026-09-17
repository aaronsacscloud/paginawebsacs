// El sitemap de lo que publica el MOTOR DE DEMANDA.
//
// Va aparte del sitemap del sitio por una razón práctica: el del sitio lo
// genera el build, y este contenido no pasa por un build. Si compartieran
// archivo, cada publicación exigiría desplegar — que es justo lo que este
// diseño evita.
//
// Se declara en robots.txt junto al otro. Google acepta varios sitemaps sin
// problema y, de paso, separarlos deja ver de un vistazo cuánto publicó el
// motor frente a lo escrito a mano.
import type { APIRoute } from 'astro';
import { listaPublicada } from '../lib/demanda/publicar';
import { herramientas } from '../lib/demanda/herramientas';
import { SITIO } from '../data/entidad';

export const prerender = false;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
  const piezas = await listaPublicada();

  /* Las herramientas también viven aquí, no en el sitemap del build.
     No es una decisión estética: son rutas `prerender = false`, así que
     @astrojs/sitemap —que solo ve lo que el build escribe en disco— no las
     incluye. Estaban quedando fuera de LOS DOS sitemaps, o sea invisibles para
     el buscador, que es el peor resultado posible para las páginas que más
     queremos que se encuentren.

     Prioridad alta y `weekly` a propósito: la herramienta es de lo poco nuestro
     que no tiene equivalente en la competencia. */
  const hs = herramientas('web');
  const hoy = new Date().toISOString().slice(0, 10);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${esc(`${SITIO}/herramientas/`)}</loc>
    <lastmod>${hoy}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${esc(`${SITIO}/herramientas/mcp`)}</loc>
    <lastmod>${hoy}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
${hs.map(h => `  <url>
    <loc>${esc(`${SITIO}/herramientas/${h.slug}`)}</loc>
    <lastmod>${hoy}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`).join('\n')}
${piezas.map(p => `  <url>
    <loc>${esc(`${SITIO}/${p.seccion}/${p.slug}/`)}</loc>
    <lastmod>${new Date(p.actualizado_at).toISOString().slice(0, 10)}</lastmod>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Media hora: lo bastante fresco para que una publicación se vea pronto,
      // lo bastante cacheado para que un rastreador insistente no cueste.
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
    },
  });
};
