import { createServer } from 'vite';
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(Boolean).map(l => { const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]; }));
Object.assign(process.env, env);
const server = await createServer({ configFile:false, root:process.cwd(), envFile:false,
  define: Object.fromEntries(Object.entries(env).map(([k,v]) => [`import.meta.env.${k}`, JSON.stringify(v)])),
  server:{ middlewareMode:true, hmr:false }, appType:'custom' });
const { supabase } = await server.ssrLoadModule('/src/lib/supabase.ts');
const mod = await server.ssrLoadModule('/src/lib/crm/cobro-cotizacion.ts');
const { data } = await supabase.from('quotes').select('id, numero, empresa').eq('estado','paid').order('created_at',{ascending:false}).limit(500);
const apply = process.argv[2] === 'apply';
const only = process.argv[3] || null;
for (const q of data||[]) {
  if (only && q.id !== only) continue;
  const r = await mod.aplicarCobroDeCotizacion(q.id, { dryRun: !apply, actor:'qa-local' });
  const linea = r.aplicado
    ? r.subs.map(s=>`${s.nombre_plan}(${s.ciclo}) ${s.estado_antes}→${s.estado} $${s.asignado} · ${s.proxima_factura_antes||'—'}→${s.proxima_factura||'—'}`).join(' ; ')
    : `— ${r.motivo}`;
  console.log(`${q.numero}\t${(q.empresa||'').slice(0,26).padEnd(26)}\t$${r.dinero}\t${linea}${r.avisos.length?'  ['+r.avisos.join(' | ')+']':''}`);
}
await server.close(); process.exit(0);
