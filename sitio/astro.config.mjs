// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://sacs.com.mx',
  output: 'static',
  adapter: vercel(),
  integrations: [sitemap()],
  image: {
    domains: [],
  },
  vite: {
    css: {
      preprocessorOptions: {},
    },
  },
});
