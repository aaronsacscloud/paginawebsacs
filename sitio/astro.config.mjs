// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import { enSitemap } from './src/data/no-indexables.ts';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.sacscloud.com',
  // La protección CSRF de Astro rechaza TODO POST con cuerpo de formulario que
  // no traiga un `Origin` del mismo sitio. Eso incluye los webhooks entrantes
  // de SendGrid (Inbound Parse manda multipart/form-data y, como es
  // servidor-a-servidor, no manda `Origin`): con esto encendido, la bandeja de
  // respuestas jamás recibiría un correo — y en silencio, con un 403 que nadie
  // ve. Se apaga aquí y el mismo candado se reimplementa en `src/middleware.ts`
  // con una lista de rutas de webhook exentas, para no perder la protección en
  // el resto del sitio.
  security: { checkOrigin: false },
  output: 'static',
  // /enterprise es la URL canónica del track de marcas/fabricantes; estas dos
  // son las formas en que la gente lo escribe o lo linkeamos por modelo.
  redirects: {
    // Formas en las que alguien escribe «entrar» buscando la app: todas
    // llegan a /entrar, la página del dominio principal que las resuelve.
    /* /manifiesto se retiró el 19-sep-2026: era una página vacía (un comentario
       en el código y nada más) que respondía 200. Va a /nosotros, que es donde
       ahora sí está quién está detrás de Sacs. */
    '/manifiesto': '/nosotros',
    '/login': '/entrar',
    '/acceso': '/entrar',
    '/iniciar-sesion': '/entrar',
    '/marcas': '/enterprise',
    '/soluciones/marca': '/enterprise',
    /* Giros que NO son moda, retirados el 18-sep-2026 por decisión del dueño:
       el sitio es Fashion Commerce y estas eran páginas «próximamente» de 200
       palabras —ferreterías, farmacias, supermercados— indexadas como si fueran
       contenido. `electronica` era la más vista de TODOS los giros (405
       impresiones) y no dio un solo clic: atraía a quien nunca iba a comprar.

       Van a /giros/ y no a 404 a propósito: Google ya las tiene indexadas y un
       301 mueve lo poco que valgan al índice de moda, que es lo que sí
       queremos que encuentre. */
    '/giros/belleza-y-cosmetica': '/giros/',
    '/giros/bicicletas': '/giros/',
    '/giros/comestibles': '/giros/',
    '/giros/electronica': '/giros/',
    '/giros/farmacias': '/giros/',
    '/giros/ferreterias': '/giros/',
    '/giros/florerias': '/giros/',
    '/giros/franquicias': '/giros/',
    '/giros/fundas-celulares': '/giros/',
    '/giros/jugueterias': '/giros/',
    '/giros/mascotas': '/giros/',
    '/giros/minisupers': '/giros/',
    '/giros/novedades': '/giros/',
    '/giros/parques-y-atracciones': '/giros/',
    '/giros/retail-entretenimiento': '/giros/',
    '/giros/supermercado': '/giros/',
    '/giros/vinos-y-licores': '/giros/',
  },
  // maxDuration en el ADAPTADOR, no en el bloque `functions` de vercel.json:
  // ese patrón apunta a rutas del código fuente y en Astro las funciones las
  // genera el adaptador, así que Vercel no lo encuentra y falla el build.
  // Sin esto rige el default de 60 s y el motor de campañas —que se presupuesta
  // 240 s— muere a media corrida dejando destinatarios sin enviar.
  adapter: vercel({ maxDuration: 300 }),
  /* El sitemap solo lista lo que de verdad queremos que se indexe. Antes
     excluía únicamente /admin/, así que publicaba nueve páginas marcadas
     `noindex` y dos transaccionales que responden 400 sin token: el sitemap
     decía «mírame» y la etiqueta «ignórame». La lista vive en un solo sitio
     (src/data/no-indexables.ts) y el rastreo del motor de demanda avisa si
     alguna se queda fuera de ella. */
  integrations: [sitemap({ filter: enSitemap }), react()],
  image: {
    domains: [],
  },
  vite: {
    css: {
      preprocessorOptions: {},
    },
    ssr: {
      noExternal: [],
      external: ['recharts'],
    },
  },
});
