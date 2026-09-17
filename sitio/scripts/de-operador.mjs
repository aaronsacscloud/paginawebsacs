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

/* De una URL del sitio al archivo que hay que abrir.
 *
 * Esto vive AQUÍ y no en el motor por una razón que no es de estilo: el motor
 * corre en Vercel, donde el código fuente no existe, así que solo podría
 * adivinar. Este script corre dentro del repo y puede COMPROBAR que el archivo
 * está. Una orden de trabajo que apunta a un archivo inexistente no cuesta
 * cero: cuesta el rato de quien la lee antes de darse cuenta.
 */
const SITIO_SRC = path.join(RAIZ, 'sitio', 'src', 'pages');

function archivoDe(url) {
  let ruta;
  try { ruta = new URL(url).pathname; } catch { ruta = url; }
  ruta = ruta.replace(/\/+$/, '') || '/';

  const candidatos = ruta === '/'
    ? ['index.astro']
    : [
        `${ruta.slice(1)}.astro`,          // /producto/x  → producto/x.astro
        `${ruta.slice(1)}/index.astro`,    // /producto    → producto/index.astro
      ];

  for (const c of candidatos) {
    const f = path.join(SITIO_SRC, c);
    if (fs.existsSync(f)) return { archivo: `sitio/src/pages/${c}`, existe: true };
  }

  /* No se encontró. Casi siempre significa que la página la genera una ruta
     dinámica —`[slug].astro`— y entonces el arreglo NO es editar un archivo:
     es cambiar los datos o la plantilla. Decirlo es más útil que devolver una
     ruta inventada. */
  const partes = ruta.slice(1).split('/');
  for (let i = partes.length - 1; i >= 0; i--) {
    const dir = partes.slice(0, i).join('/');
    for (const din of ['[slug].astro', '[...slug].astro', '[id].astro']) {
      const f = path.join(SITIO_SRC, dir, din);
      if (fs.existsSync(f)) {
        return { archivo: `sitio/src/pages/${dir ? dir + '/' : ''}${din}`, existe: true, dinamica: true };
      }
    }
  }
  return { archivo: null, existe: false };
}

async function pendientes() {
  const filas = await sql("select id, tipo, prioridad, payload, motivo, created_at from de_acciones where estado = 'para_operador' order by prioridad desc, created_at");
  if (!filas.length) return console.log('No hay trabajo de repositorio pendiente.');

  for (const f of filas) {
    const p = f.payload || {};
    console.log(`\n${'─'.repeat(72)}`);
    console.log(`${p.titulo || f.tipo}`);
    console.log(`  ${f.id} · prioridad ${f.prioridad} · ${p.severidad || '?'} · ${f.created_at?.slice(0, 10)}`);

    if (p.por_que) console.log(`\n  POR QUÉ IMPORTA\n  ${envolver(p.por_que, 68)}`);
    if (p.hecho_cuando) console.log(`\n  HECHO CUANDO\n  ${envolver(p.hecho_cuando, 68)}`);

    if (Array.isArray(p.urls) && p.urls.length) {
      // Se agrupan por ARCHIVO: varias URLs pueden salir de la misma plantilla
      // dinámica, y abrirla siete veces es siete veces el mismo trabajo.
      const porArchivo = new Map();
      const sinArchivo = [];
      for (const u of p.urls) {
        const a = archivoDe(u);
        if (!a.existe) { sinArchivo.push(u); continue; }
        const k = a.archivo + (a.dinamica ? '  (plantilla dinámica)' : '');
        if (!porArchivo.has(k)) porArchivo.set(k, []);
        porArchivo.get(k).push(new URL(u).pathname);
      }

      console.log(`\n  DÓNDE (${p.urls.length} página(s) en ${porArchivo.size} archivo(s))`);
      for (const [archivo, urls] of [...porArchivo].sort((a, b) => b[1].length - a[1].length)) {
        const detalle = urls.length === 1 ? urls[0] : `${urls.length} páginas: ${urls.slice(0, 3).join(', ')}${urls.length > 3 ? '…' : ''}`;
        console.log(`    ${archivo}`);
        console.log(`      ${detalle}`);
      }
      /* Las que probablemente no son contenido van APARTE y arriba del resto.
         Si se mezclan con las demás, alguien acaba escribiéndole seiscientas
         palabras al inbox de la aplicación porque la regla dijo «faltan
         palabras». Ya estuvo a punto de pasar. */
      const noIndexar = p.quiza_noindex || {};
      const cuantas = Object.keys(noIndexar).length;
      if (cuantas) {
        console.log(`\n  ⚠️  ${cuantas} de estas probablemente NO son páginas de contenido.`);
        console.log(`      Ahí el arreglo es \`noindex\`, no escribir más:`);
        for (const [u, porque] of Object.entries(noIndexar)) {
          console.log(`      ${new URL(u).pathname.padEnd(28)} ${porque}`);
        }
      }

      if (sinArchivo.length) {
        console.log(`\n    ⚠️  ${sinArchivo.length} URL(s) sin archivo en el repo — o son del motor, o la ruta cambió:`);
        for (const u of sinArchivo.slice(0, 5)) console.log(`      ${u}`);
      }
    }

    console.log(`\n  Para tomarlo:  node scripts/de-operador.mjs --tomar ${f.id}`);
  }
  console.log(`\n${'─'.repeat(72)}`);
}

/** Envuelve texto a N columnas sin partir palabras. */
function envolver(t, n) {
  const out = [];
  let linea = '';
  for (const p of String(t).split(/\s+/)) {
    if ((linea + ' ' + p).trim().length > n) { out.push(linea.trim()); linea = p; }
    else linea += ' ' + p;
  }
  if (linea.trim()) out.push(linea.trim());
  return out.join('\n  ');
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
