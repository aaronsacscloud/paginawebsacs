#!/usr/bin/env node
/** Corre «Hacerlo con IA» sobre los pendientes «motor» de una pieza (uno por corrida, como el ciclo).
 *   node --env-file=.env --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs scripts/ejecutar-pendientes.mjs <slug> [n] */
const { supabase } = await import('../src/lib/supabase.ts');
const { ejecutarPendiente } = await import('../src/lib/demanda/especialista.ts');
const slug = process.argv[2], n = Number(process.argv[3] || 2);
const { data: c } = await supabase.from('de_contenido').select('id').eq('slug', slug).single();
const { data: pend } = await supabase.from('de_contenido_pendientes').select('id, titulo, prioridad').eq('contenido_id', c.id).eq('estado', 'pendiente').eq('quien', 'motor').order('prioridad').order('created_at').limit(n);
let costo = 0;
for (const p of pend || []) {
  process.stdout.write(`  P${p.prioridad} ${p.titulo.slice(0, 70)}… `);
  const r = await ejecutarPendiente(p.id); costo += r.costo;
  console.log(`${r.resultado} · $${r.costo.toFixed(2)}`);
}
console.log(`  costo: $${costo.toFixed(2)}`);
process.exit(0);
