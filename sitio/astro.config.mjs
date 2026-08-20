// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
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
  // maxDuration en el ADAPTADOR, no en el bloque `functions` de vercel.json:
  // ese patrón apunta a rutas del código fuente y en Astro las funciones las
  // genera el adaptador, así que Vercel no lo encuentra y falla el build.
  // Sin esto rige el default de 60 s y el motor de campañas —que se presupuesta
  // 240 s— muere a media corrida dejando destinatarios sin enviar.
  adapter: vercel({ maxDuration: 300 }),
  integrations: [sitemap({ filter: (page) => !page.includes('/admin/') }), react()],
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
