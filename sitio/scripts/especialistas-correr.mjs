#!/usr/bin/env node
/**
 * Corre los especialistas (SEO + IA/agentes), la autoridad (si está publicada)
 * y los ángulos sobre UNA pieza, enseñando lo que dejan en pendientes.
 *   node --env-file=.env --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *     scripts/especialistas-correr.mjs <slug> [--angulos]
 */
const { supabase } = await import('../src/lib/supabase.ts');
const { revisarEspecialistas, revisarAutoridad, proponerAngulos } = await import('../src/lib/demanda/especialista.ts');
const slug = process.argv[2]; const conAngulos = process.argv.includes('--angulos');
const { data: c } = await supabase.from('de_contenido').select('id, estado, titulo').eq('slug', slug).single();
if (!c) { console.log('no existe'); process.exit(1); }
console.log(`\n■ ${slug} · ${c.estado} · «${c.titulo}»`);
let costo = 0;
process.stdout.write('  especialistas SEO + IA/agentes… ');
const e = await revisarEspecialistas(c.id); costo += e.costo;
if (!e.ok) console.log('FALLÓ:', e.error);
else {
  console.log(`$${e.costo.toFixed(2)} · ${e.nuevos} pendientes nuevos`);
  console.log(`    SEO ${e.seo.score}%: ${e.seo.resumen}`);
  for (const p of e.seo.pendientes) console.log(`      P${p.prioridad} [${p.quien}] ${p.titulo} — ${p.detalle.slice(0, 160)}`);
  console.log(`    IA/agentes ${e.geo.score}%: ${e.geo.resumen}`);
  for (const p of e.geo.pendientes) console.log(`      P${p.prioridad} [${p.quien}] ${p.titulo} — ${p.detalle.slice(0, 160)}`);
}
if (c.estado === 'publicado') {
  process.stdout.write('  autoridad… ');
  const a = await revisarAutoridad(c.id); costo += a.costo;
  console.log(a.ok ? `${a.datos.score}%: ${a.datos.resumen}` : `FALLÓ: ${a.error}`);
  if (a.ok) for (const p of a.datos.pendientes) console.log(`      P${p.prioridad} [${p.quien}] ${p.titulo} — ${p.detalle.slice(0, 160)}`);
}
if (conAngulos) {
  process.stdout.write('  ángulos… ');
  const g = await proponerAngulos(c.id); costo += g.costo;
  console.log(g.ok ? `${g.angulos.length} propuestos · ${g.creados} oportunidades nuevas` : `FALLÓ: ${g.error}`);
  if (g.ok) for (const x of g.angulos) console.log(`      [${x.tipo}] ${x.titulo} → /${x.seccion}/${x.slug}/ — ${x.por_que}`);
}
console.log(`\n  costo: $${costo.toFixed(2)}\n`);
process.exit(0);
