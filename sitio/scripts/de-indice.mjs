// Calcula el Índice Sacs de Retail de Moda y lo guarda SIN publicar.
//
//   node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
//     scripts/de-indice.mjs [--guardar]
//
// Sin `--guardar` solo imprime: es la forma de mirar una edición antes de
// meterla a la base. Publicarla es otra cosa y no se hace desde aquí.
// El .env se carga antes de importar nada del CRM: `supabase.ts` crea el
// cliente en cuanto se importa y revienta sin las llaves. Mismo preámbulo que
// scripts/de-probar.mjs.
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { calcular, guardar, MIN_EMPRESAS } = await import('../src/lib/demanda/indice.ts');

const e = await calcular();

console.log(`\nÍNDICE SACS DE RETAIL DE MODA · edición ${e.edicion} (corte ${e.corte})`);
console.log(`${e.n_empresas} tiendas operando · mínimo para publicar una cifra: ${MIN_EMPRESAS}\n`);

if (!e.metricas.generales.length) {
  console.log(`⚠️  Menos de ${MIN_EMPRESAS} empresas operando: no se publica ninguna cifra general.`);
} else {
  for (const m of e.metricas.generales) {
    const u = m.unidad === 'pesos' ? v => `$${Number(v).toLocaleString('es-MX')}`
            : m.unidad === 'pct'   ? v => `${v}%`
            : m.unidad === 'dias'  ? v => `${v} d`
            : v => `${v}`;
    const rango = (m.p25 != null || m.p75 != null)
      ? `   (p25 ${m.p25 != null ? u(m.p25) : '—'} · p75 ${m.p75 != null ? u(m.p75) : '—'})` : '';
    console.log(`  ${m.titulo.padEnd(40)}${String(u(m.valor)).padStart(9)}${rango}`);
  }
}

console.log(`\nADOPCIÓN POR MÓDULO (${e.metricas.adopcion.length} módulos con muestra suficiente)\n`);
for (const a of e.metricas.adopcion) {
  const barra = '█'.repeat(Math.round(a.pct / 4)).padEnd(25);
  console.log(`  ${String(a.pct).padStart(3)}% ${barra} ${a.modulo}  ·  ${a.familia}  (n=${a.n})`);
}

if (process.argv.includes('--guardar')) {
  await guardar(e);
  console.log(`\n✓ Guardada como «${e.edicion}». publicado = false (se prende a mano).`);
} else {
  console.log('\n(no se guardó — agrega --guardar)');
}
