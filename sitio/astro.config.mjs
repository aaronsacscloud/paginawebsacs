// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.sacscloud.com',
  output: 'static',
  adapter: vercel(),
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en', 'fr', 'it', 'pt'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'es',
        locales: {
          es: 'es-MX',
          en: 'en-US',
          fr: 'fr-FR',
          it: 'it-IT',
          pt: 'pt-BR',
        },
      },
    }),
  ],
  image: {
    domains: [],
  },
  vite: {
    css: {
      preprocessorOptions: {},
    },
  },
});
