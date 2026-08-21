// Arranca Vite en modo SSR para poder importar el módulo TS con import.meta.env
import { createServer } from 'vite';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(Boolean).map(l => {
  const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)];
}));
Object.assign(process.env, env);

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  envFile: false,
  define: Object.fromEntries(Object.entries(env).map(([k,v]) => [`import.meta.env.${k}`, JSON.stringify(v)])),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
const mod = await server.ssrLoadModule('/src/lib/crm/cobro-cotizacion.ts');
const quoteId = process.argv[2];
const dry = process.argv[3] !== 'apply';
const r = await mod.aplicarCobroDeCotizacion(quoteId, { dryRun: dry, actor: 'qa-local' });
console.log(JSON.stringify(r, null, 2));
await server.close();
process.exit(0);
