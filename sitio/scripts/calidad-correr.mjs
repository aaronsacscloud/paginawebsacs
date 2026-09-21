#!/usr/bin/env node
/**
 * Pasa UNA pieza por el gate de calidad completo, a mano y con bitácora:
 *   competencia → referee → (reescritura con correcciones, hasta 2) → portada
 *
 *   node --env-file=.env --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *     scripts/calidad-correr.mjs <slug|id> [--giro novias-y-fiesta] [--sin-imagen]
 *
 * Es el mismo camino que sigue el ciclo diario (contenido.competencia,
 * contenido.borrador, contenido.referee, contenido.imagen), solo que sobre una
 * pieza y enseñando el veredicto en cada ronda. Sirve para ver POR QUÉ una
 * página no pasa antes de que el ciclo la deje atascada.
 */
const { supabase } = await import('../src/lib/supabase.ts');
const { analizarCompetencia, buscarFuentes, juzgar, generarPortada, generarIntermedias, generarDiagramas, CRITERIOS } = await import('../src/lib/demanda/calidad.ts');
const { escribirBorrador } = await import('../src/lib/demanda/contenido.ts');

const args = process.argv.slice(2);
const ref = args.find(a => !a.startsWith('--'));
const giro = args.includes('--giro') ? args[args.indexOf('--giro') + 1] : null;
const sinImagen = args.includes('--sin-imagen');
const reescribir = args.includes('--reescribir');   // escribe un borrador nuevo ANTES de juzgar
const MAX = 3;
if (!ref) { console.log('uso: calidad-correr.mjs <slug|id> [--giro slug] [--sin-imagen]'); process.exit(1); }

let q = supabase.from('de_contenido').select('id, slug, estado, brief, titulo');
q = /^[0-9a-f-]{36}$/.test(ref) ? q.eq('id', ref) : q.eq('slug', ref);
const { data: c } = await q.maybeSingle();
if (!c) { console.log('no existe'); process.exit(1); }
let brief = c.brief || {};
console.log(`\n■ ${c.slug} · estado ${c.estado} · «${c.titulo}»`);

if (giro && brief.giro !== giro) {
  brief = { ...brief, giro };
  await supabase.from('de_contenido').update({ brief }).eq('id', c.id);
  console.log(`  giro fijado: ${giro}`);
}

let costo = 0;

// 1) competencia
if (!brief.competencia?.paginas?.length) {
  process.stdout.write('  leyendo a la competencia (gpt-5 web_search)… ');
  const r = await analizarCompetencia(brief.pregunta, brief.quien);
  costo += r.costo;
  if (!r.ok) { console.log('FALLÓ:', r.error); }
  else {
    brief = { ...brief, competencia: r.datos };
    await supabase.from('de_contenido').update({ brief }).eq('id', c.id);
    console.log(`$${r.costo.toFixed(2)}`);
    for (const p of r.datos.paginas) console.log(`    · [${p.tipo}] ${p.titulo} — le falta: ${p.le_falta.slice(0, 2).join('; ')}`);
    console.log(`    HUECO: ${r.datos.hueco_comun}`);
  }
} else console.log(`  competencia ya analizada (${brief.competencia.paginas.length} páginas)`);

if (!brief.fuentes?.length) {
  process.stdout.write('  buscando fuentes citables… ');
  const f = await buscarFuentes(brief.pregunta, brief.giro);
  costo += f.costo;
  if (f.ok) { brief = { ...brief, fuentes: f.fuentes }; await supabase.from('de_contenido').update({ brief }).eq('id', c.id); console.log(`${f.fuentes.length} · $${f.costo.toFixed(2)}`); }
  else console.log('FALLÓ:', f.error);
} else console.log(`  fuentes: ${brief.fuentes.length} verificadas`);

if (reescribir) {
  brief = { ...brief, correcciones: undefined, reescrituras: 0, atascada: undefined };
  await supabase.from('de_contenido').update({ brief, estado: 'brief' }).eq('id', c.id);
  process.stdout.write('  escribiendo borrador nuevo con la investigación… ');
  const w = await escribirBorrador(c.id);
  costo += w.costo;
  console.log(w.ok ? `${w.palabras} palabras · $${w.costo.toFixed(2)}` : `FALLÓ: ${w.error}`);
  if (!w.ok) process.exit(1);
  const { data: f2 } = await supabase.from('de_contenido').select('brief').eq('id', c.id).single();
  brief = f2.brief;
}

// 2) referee, con hasta 2 reescrituras
for (let ronda = 0; ronda <= MAX; ronda++) {
  process.stdout.write(`  referee ronda ${ronda}… `);
  const r = await juzgar(c.id);
  costo += r.costo;
  if (!r.ok) { console.log('FALLÓ:', r.error); break; }
  const v = r.veredicto;
  const prom = Object.values(v.puntajes).reduce((a, b) => a + b, 0) / Object.keys(v.puntajes).length;
  console.log(`${v.pasa ? 'PASA' : 'NO PASA'} · promedio ${prom.toFixed(1)} · ${Object.entries(v.puntajes).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  console.log(`    ${v.por_que}`);
  console.log(`    probabilidad de cita ${v.probabilidad_cita}% · primera corrección: ${v.primera_correccion}`);
  const noOk = (v.criterios || []).filter(k => !k.ok);
  console.log(`    criterios: ${(v.criterios || []).length - noOk.length}/${(v.criterios || []).length} ok${noOk.length ? ' · fallan: ' + noOk.map(k => k.clave).join(', ') : ''}`);
  if (v.video_sugerido) console.log(`    video: ${v.video_sugerido}`);
  if (v.necesita_del_dueno?.length) console.log(`    necesita del dueño: ${v.necesita_del_dueno.join(' | ')}`);
  if (r.duras.length) console.log(`    duras: ${r.duras.join(' | ')}`);
  if (v.pasa) {
    await supabase.from('de_contenido').update({
      estado: 'aprobado',
      brief: { ...brief, atascada: undefined, correcciones: undefined },
      auditorias: { referee: { ...v, duras: r.duras, ronda, cuando: new Date().toISOString() }, automatica: { score: 10, nota: 'Pasó el referee.' } },
      actualizado_at: new Date().toISOString(),
    }).eq('id', c.id);
    console.log('  → aprobado: ya está en la bandeja');
    break;
  }
  for (const f of v.fallos) console.log(`    ✗ ${f}`);
  if (ronda === MAX) {
    await supabase.from('de_contenido').update({ brief: { ...brief, atascada: true }, auditorias: { referee: { ...v, duras: r.duras, ronda } } }).eq('id', c.id);
    console.log(`  → atascada tras ${MAX} reescrituras; la ve el dueño con el veredicto al lado`);
    break;
  }
  // reescribir
  const { data: fresh } = await supabase.from('de_contenido').select('brief').eq('id', c.id).single();
  brief = { ...fresh.brief, correcciones: v.fallos, reescrituras: ronda + 1, veredicto_anterior: v.puntajes, elementos_propuestos: (v.elementos || []).filter(e => e.veredicto === 'cambiar') };
  await supabase.from('de_contenido').update({ brief, estado: 'brief', auditorias: { referee: { ...v, duras: r.duras, ronda } } }).eq('id', c.id);
  process.stdout.write(`  reescribiendo con ${v.fallos.length} correcciones… `);
  const w = await escribirBorrador(c.id);
  costo += w.costo;
  console.log(w.ok ? `${w.palabras} palabras · $${w.costo.toFixed(2)}` : `FALLÓ: ${w.error}`);
  if (!w.ok) break;
  const { data: f2 } = await supabase.from('de_contenido').select('brief').eq('id', c.id).single();
  brief = f2.brief;
}

// 3) portada, solo si pasó
const { data: fin } = await supabase.from('de_contenido').select('estado, brief').eq('id', c.id).single();
if (fin.estado === 'aprobado' && !sinImagen) {
  process.stdout.write('  diagrama… ');
  const d = await generarDiagramas(c.id);
  console.log(d.ok ? `${d.hechos} generado(s)` : `FALLÓ: ${d.error}`);
  process.stdout.write('  portada… ');
  const r = await generarPortada(c.id);
  costo += r.costo;
  console.log(r.ok ? `${r.url}\n    alt: ${r.alt}` : `FALLÓ: ${r.error}`);
  process.stdout.write('  fotos intermedias… ');
  const m = await generarIntermedias(c.id);
  costo += m.costo;
  console.log(m.ok ? `${m.hechas} generada(s) · $${m.costo.toFixed(2)}` : `FALLÓ: ${m.error}`);
}
console.log(`\n  costo total: $${costo.toFixed(2)}\n`);
process.exit(0);
