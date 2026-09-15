#!/usr/bin/env node
/**
 * MOTOR DE DEMANDA · banco de pruebas local.
 *
 * Corre el motor de verdad —los mismos módulos que usa el cron— contra la base
 * real, desde la terminal y sin levantar el sitio. Existe porque el servidor de
 * desarrollo de Astro se muere por falta de memoria en esta máquina, y probar
 * un motor autónomo solo en producción es como estrenar frenos en la carretera.
 *
 *   node scripts/de-probar.mjs ingerir      # trae la demanda del propio CRM
 *   node scripts/de-probar.mjs normalizar   # la convierte en problemas canónicos
 *   node scripts/de-probar.mjs cola         # prueba de vida de la cola
 *   node scripts/de-probar.mjs worker       # una vuelta del worker
 *   node scripts/de-probar.mjs ciclo        # arma un ciclo entero
 *   node scripts/de-probar.mjs inventario  # rastrea el sitio y arma el grafo de enlaces
 *   node scripts/de-probar.mjs tecnico     # aplica las reglas técnicas sobre lo rastreado
 *   node scripts/de-probar.mjs agrupar     # funde los problemas que son el mismo
 *   node scripts/de-probar.mjs calibrar    # mide el umbral de parecido del modelo
 *   node scripts/de-probar.mjs resumen      # qué sabe el motor hasta ahora
 *
 * Node 22: PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH node --experimental-strip-types …
 */
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const que = process.argv[2] || 'resumen';
const { supabase } = await import('../src/lib/supabase.ts');

if (que === 'ingerir') {
  const { ingerirCrm } = await import('../src/lib/demanda/fuentes/crm.ts');
  console.log(await ingerirCrm());
} else if (que === 'normalizar') {
  const { normalizarPendientes } = await import('../src/lib/demanda/normalizar.ts');
  const { leerConfig } = await import('../src/lib/demanda/config.ts');
  const cfg = await leerConfig(true);
  const vueltas = Number(process.argv[3]) || 1;
  for (let i = 0; i < vueltas; i++) {
    const r = await normalizarPendientes(60, cfg);
    console.log(`vuelta ${i + 1}:`, r);
    if (!r.leidas) break;
  }
} else if (que === 'cola') {
  await import('../src/lib/demanda/registro.ts');
  const { encolarVarias, resumenCola } = await import('../src/lib/demanda/cola.ts');
  const sello = Date.now();
  console.log(await encolarVarias([
    { tipo: 'sistema.noop', clave_idem: `local:ok:${sello}`, payload: { eco: 'vivo' } },
    { tipo: 'sistema.noop', clave_idem: `local:falla:${sello}`, payload: { fallar: true } },
    { tipo: 'contenido.publicar', clave_idem: `local:alto:${sello}`, payload: {} },  // debe pedir aprobación
    { tipo: 'precio.cambiar', clave_idem: `local:critico:${sello}`, payload: {} },   // nunca autónomo
  ]));
  console.log('cola:', await resumenCola());
} else if (que === 'worker') {
  await import('../src/lib/demanda/registro.ts');
  const { correrWorker } = await import('../src/lib/demanda/worker.ts');
  console.log(await correrWorker(Number(process.argv[3]) || 60_000, 6));
} else if (que === 'ciclo') {
  await import('../src/lib/demanda/registro.ts');
  const { abrirCiclo, armarCadena } = await import('../src/lib/demanda/ciclo.ts');
  const { leerConfig } = await import('../src/lib/demanda/config.ts');
  const cfg = await leerConfig(true);
  const { id, nuevo } = await abrirCiclo('manual', 'prueba local');
  console.log({ id, nuevo }, await armarCadena(id, 'manual', cfg));
} else if (que === 'tecnico') {
  const { auditar } = await import('../src/lib/demanda/tecnico.ts');
  console.log(await auditar());
} else if (que === 'evaluar') {
  const { evaluarClusters } = await import("../src/lib/demanda/evaluar.ts");
  const vueltas = Number(process.argv[3]) || 1;
  for (let i = 0; i < vueltas; i++) { const r = await evaluarClusters(20); console.log(`vuelta ${i+1}:`, r); if (!r.evaluados) break; }
} else if (que === 'puntuar') {
  const { puntuarClusters } = await import('../src/lib/demanda/score.ts');
  const { crearOportunidades } = await import('../src/lib/demanda/oportunidades.ts');
  console.log(await puntuarClusters());
  console.log(await crearOportunidades(200));
} else if (que === 'inventario') {
  const { inventariar } = await import('../src/lib/demanda/paginas.ts');
  console.log(await inventariar(Number(process.argv[3]) || 60));
} else if (que === 'calibrar') {
  // Mide, no adivina: ¿a partir de qué parecido dos problemas son el mismo?
  // Se corre cuando se cambia de modelo de embeddings.
  const { data } = await supabase.rpc('de_calibrar_umbral');
  console.table(data);
  console.log('\nRevisa a mano los pares de cada franja antes de mover el umbral.');
} else if (que === 'agrupar') {
  await import('../src/lib/demanda/registro.ts');
  const { handlerDe } = await import('../src/lib/demanda/handlers.ts');
  const { leerConfig } = await import('../src/lib/demanda/config.ts');
  const cfg = await leerConfig(true);
  console.log(await handlerDe('agrupar')({ payload: {} }, { limite: Date.now() + 60000, cfg, ciclo_id: null }));
} else {
  const n = async (t, w) => (await supabase.from(t).select('id', { count: 'exact', head: true }).or(w || 'id.not.is.null')).count;
  const [senales, sinProcesar, queries, clusters] = await Promise.all([
    n('de_senales'), (await supabase.from('de_senales').select('id', { count: 'exact', head: true }).eq('procesada', false)).count,
    n('de_queries'), n('de_clusters'),
  ]);
  console.log(`Señales ${senales} (${sinProcesar} sin procesar) · consultas ${queries} · problemas ${clusters}`);
  const { data: top } = await supabase.from('de_clusters')
    .select('problema_canonico, categoria, senales_n, queries_n, icp')
    .order('senales_n', { ascending: false }).limit(15);
  console.log('\nLo que más pide el ramo (por señales):');
  for (const c of top || []) console.log(`  ${String(c.senales_n).padStart(3)} · ${c.problema_canonico}${c.categoria ? `  [${c.categoria}]` : ''}`);
}
