#!/usr/bin/env node
/**
 * MOTOR DE DEMANDA · el operador.
 *
 * Existe por una razón muy concreta: una sesión de trabajo puede terminarse a
 * media etapa —se acaban los créditos, se cae la conexión— y la siguiente tiene
 * que poder retomar sin adivinar. Este script es la primera cosa que se corre
 * al empezar: dice dónde quedó el motor, qué falló y qué trabajo de código
 * está esperando a alguien.
 *
 *   node scripts/de-operador.mjs --estado         qué está pasando
 *   node scripts/de-operador.mjs --pendientes     trabajo de repo esperando
 *   node scripts/de-operador.mjs --tomar <id>     lo marca como en curso
 *   node scripts/de-operador.mjs --cerrar <id> --commit <sha>
 *   node scripts/de-operador.mjs --encolar <tipo> --clave <k> [--payload '{}']
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const PROY = 'wtzhogdyicekxcnclmyu';

function token() {
  const f = path.join(RAIZ, '.supabase-token');
  if (!fs.existsSync(f)) {
    console.error('No encuentro .supabase-token en la raíz del repo. Sin él no puedo leer el estado.');
    process.exit(1);
  }
  return fs.readFileSync(f, 'utf8').trim();
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROY}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${t.slice(0, 300)}`);
  try { return JSON.parse(t); } catch { return []; }
}

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const tiene = (n) => process.argv.includes(n);
const esc = (s) => String(s).replace(/'/g, "''");

async function estado() {
  const [cfg] = await sql('select * from de_config where id = 1');
  const cola = await sql("select estado, count(*) n from de_acciones group by 1 order by 2 desc");
  const ciclos = await sql("select tipo, estado, inicio, fin, acciones_ok, acciones_fallidas, costo_usd from de_ciclos order by inicio desc limit 3");
  const muertas = await sql("select tipo, error->>'mensaje' mensaje, intentos from de_acciones where estado = 'muerta' order by updated_at desc limit 8");
  const espera = await sql("select tipo, motivo, created_at from de_acciones where estado = 'necesita_aprobacion' order by created_at limit 8");
  const operador = await sql("select id, tipo, payload from de_acciones where estado = 'para_operador' order by prioridad desc, created_at limit 10");
  const conectores = await sql("select id, nombre, activo, disponible, falta, fallos_seguidos from de_conectores order by orden");
  const [salud] = await sql('select fecha, score, incidencias from de_salud order by fecha desc limit 1');

  console.log('\n═══ MOTOR DE DEMANDA · estado ═══\n');
  if (cfg) {
    console.log(`Autonomía: ${cfg.autonomia_global}/4 · modo ${cfg.modo}${cfg.kill_switch ? ' · APAGADO (kill switch)' : ''}`);
    console.log(`Presupuesto: $${Number(cfg.gasto_mes_usd || 0).toFixed(2)} de $${cfg.presupuesto_mensual_usd} (${cfg.mes_en_curso || 'mes sin abrir'})`);
  }
  if (salud) console.log(`Salud ${salud.score}/100 (${salud.fecha})${(salud.incidencias || []).length ? ' · ' + salud.incidencias.map(i => i.que).join(' · ') : ''}`);

  console.log('\nCola:', cola.length ? cola.map(c => `${c.estado} ${c.n}`).join(' · ') : 'vacía');

  console.log('\nÚltimos ciclos:');
  if (!ciclos.length) console.log('  (ninguno todavía)');
  for (const c of ciclos) console.log(`  ${c.tipo} ${c.estado} · ${c.inicio?.slice(0, 16)} · ${c.acciones_ok} ok, ${c.acciones_fallidas} mal · $${Number(c.costo_usd || 0).toFixed(4)}`);

  if (muertas.length) {
    console.log('\n⚠ Se rindieron:');
    for (const m of muertas) console.log(`  ${m.tipo} (${m.intentos} intentos): ${m.mensaje}`);
  }
  if (espera.length) {
    console.log('\n⏸ Esperan al dueño:');
    for (const a of espera) console.log(`  ${a.tipo}: ${a.motivo || ''}`);
  }
  if (operador.length) {
    console.log('\n🔧 Trabajo de repositorio pendiente:');
    for (const a of operador) console.log(`  ${a.id.slice(0, 8)} ${a.tipo} · ${JSON.stringify(a.payload).slice(0, 110)}`);
  }

  const sinConectar = conectores.filter(k => !k.activo || !k.disponible);
  if (sinConectar.length) {
    console.log('\n🔌 Fuentes sin conectar:');
    for (const k of sinConectar) console.log(`  ${k.nombre}: ${!k.disponible ? (k.falta || 'falta credencial') : 'apagada en Ajustes'}`);
  }

  const estadoMd = path.join(RAIZ, 'sitio', 'ESTADO-DEMAND-ENGINE.md');
  if (fs.existsSync(estadoMd)) {
    const linea = fs.readFileSync(estadoMd, 'utf8').split('\n').find(l => l.startsWith('**Dónde vamos:**'));
    if (linea) console.log(`\n${linea}`);
  }
  console.log('\nSiguiente: lee sitio/ESTADO-DEMAND-ENGINE.md y sigue la etapa que marque.\n');
}

async function pendientes() {
  const filas = await sql("select id, tipo, prioridad, payload, motivo, created_at from de_acciones where estado = 'para_operador' order by prioridad desc, created_at");
  if (!filas.length) return console.log('No hay trabajo de repositorio pendiente.');
  for (const f of filas) {
    console.log(`\n── ${f.id}\n   tipo: ${f.tipo} · prioridad ${f.prioridad} · ${f.created_at?.slice(0, 16)}`);
    console.log(`   ${JSON.stringify(f.payload, null, 2).split('\n').join('\n   ')}`);
  }
}

async function tomar(id) {
  await sql(`update de_acciones set estado = 'corriendo', iniciada_at = now(), lease_hasta = now() + interval '4 hours' where id = '${esc(id)}' and estado = 'para_operador'`);
  console.log(`Tomada ${id}. Al terminar: --cerrar ${id} --commit <sha>`);
}

async function cerrar(id, commit) {
  const res = JSON.stringify({ commit: commit || null, cerrada_por: 'operador', at: new Date().toISOString() });
  await sql(`update de_acciones set estado = 'terminada', terminada_at = now(), lease_hasta = null, resultado = '${esc(res)}'::jsonb where id = '${esc(id)}'`);
  console.log(`Cerrada ${id}${commit ? ` con ${commit}` : ''}.`);
}

async function encolar(tipo, clave, payload) {
  const p = esc(payload || '{}');
  await sql(`insert into de_acciones (clave_idem, tipo, payload, creada_por) values ('${esc(clave)}', '${esc(tipo)}', '${p}'::jsonb, 'operador') on conflict (clave_idem) do nothing`);
  console.log(`Encolada ${tipo} (${clave}).`);
}

try {
  if (tiene('--pendientes')) await pendientes();
  else if (tiene('--tomar')) await tomar(arg('--tomar'));
  else if (tiene('--cerrar')) await cerrar(arg('--cerrar'), arg('--commit'));
  else if (tiene('--encolar')) await encolar(arg('--encolar'), arg('--clave'), arg('--payload'));
  else await estado();
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
