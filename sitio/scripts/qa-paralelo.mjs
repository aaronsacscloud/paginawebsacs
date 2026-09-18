/**
 * QA de la MARCACIÓN EN PARALELO, sin marcarle a nadie.
 *
 * Fabrica una sesión de dos líneas con dos llamadas timbrando y prueba lo que
 * de verdad importa, que es quién se lleva al vendedor:
 *   1. contesta la primera  → se la queda el vendedor y la otra vuelve a la
 *      lista sin gastarle el intento;
 *   2. contesta la segunda cuando ya hay alguien → NO se le cuelga mudo: se le
 *      reagenda a quince minutos y se cuenta como abandonada.
 * Las órdenes a Twilio (mover a la sala, colgar) fallan solas con SIDs
 * inventados y están envueltas en `catch`: lo que se comprueba es el estado,
 * que es lo que decide qué le pasa a cada contacto.
 *
 *   node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs scripts/qa-paralelo.mjs
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const USER = '60be8bd8-995a-45ca-926f-1bcb159d3c1e';

let ok = 0; const fallas = [];
const es = (a, e, q) => { if (JSON.stringify(a) === JSON.stringify(e)) { ok++; return; } fallas.push(`${q}\n    esperaba ${JSON.stringify(e)}\n    obtuvo   ${JSON.stringify(a)}`); };

const limpiar = async () => {
  const { data: ses } = await db.from('tel_sesiones').select('id').eq('nombre', 'QA paralelo');
  for (const s of ses || []) {
    await db.from('tel_sesion_items').delete().eq('sesion_id', s.id);
    await db.from('tel_sesiones').delete().eq('id', s.id);
  }
};
await limpiar();

const { data: ses } = await db.from('tel_sesiones').insert({
  owner_id: USER, nombre: 'QA paralelo', estado: 'activa', modo: 'manual', total: 4, agente_en_sala: true,
  presentacion_nombre: 'Andy de Sacscloud', iniciada_at: new Date().toISOString(),
  config: { lineas: 2, auto_continuar: true, wrapup_seg: 8 },
}).select('id').maybeSingle();

const nuevoItem = async (n, orden) => (await db.from('tel_sesion_items').insert({
  sesion_id: ses.id, telefono: `+52551000000${orden}`, nombre: n, orden, estado: 'escuchando', intentos: 1,
  call_sid: `CA${'0'.repeat(30)}${orden}${orden}`, marcado_at: new Date(Date.now() - 12000).toISOString(),
  contestado_at: new Date(Date.now() - 2000).toISOString(), oido: [],
}).select('*').maybeSingle()).data;

const A = await nuevoItem('Primero en contestar', 1);
const B = await nuevoItem('Contestó tarde', 2);

const { alVeredicto, itemsVivos, lineasDe } = await import('../src/lib/telefonia/marcador.ts');

console.log('\n── Dos líneas vivas ──────────────────────────────────────');
es((await itemsVivos(ses.id)).length, 2, 'hay dos llamadas vivas');
es(lineasDe({ config: { lineas: 2 } }), 2, 'la sesión es de dos líneas');

console.log('\n── Contesta la primera ───────────────────────────────────');
await alVeredicto(A, 'persona', 'reglas', 'dijo «bueno»');
const { data: s1 } = await db.from('tel_sesiones').select('item_actual').eq('id', ses.id).maybeSingle();
es(s1.item_actual, A.id, 'el vendedor se queda con la que contestó');
const { data: b1 } = await db.from('tel_sesion_items').select('estado, intentos, volver_at, call_sid').eq('id', B.id).maybeSingle();
es(b1.estado, 'pendiente', 'a la otra se le cuelga y vuelve a la lista');
es(b1.intentos, 0, 'no se le gasta el intento (nadie levantó el teléfono)');
es(!!b1.volver_at && new Date(b1.volver_at) > new Date(), true, 'vuelve con hora, no al final de la fila');

console.log('\n── Y si contesta la segunda cuando ya hay alguien ────────');
// Se revive a B como si hubiera contestado justo en ese instante.
await db.from('tel_sesion_items').update({ estado: 'escuchando', call_sid: B.call_sid, contestado_at: new Date().toISOString(), volver_at: null }).eq('id', B.id);
const { data: B2 } = await db.from('tel_sesion_items').select('*').eq('id', B.id).maybeSingle();
const gano = await alVeredicto(B2, 'persona', 'reglas', 'dijo «bueno» tarde');
es(gano, false, 'no se le pasa al vendedor: ya está ocupado');
const { data: b3 } = await db.from('tel_sesion_items').select('estado, nota, volver_at').eq('id', B.id).maybeSingle();
es(b3.estado, 'pendiente', 'vuelve a la lista');
es(/marca de nuevo/i.test(b3.nota || ''), true, 'queda dicho por qué volvió');
const min = b3.volver_at ? Math.round((new Date(b3.volver_at) - Date.now()) / 60000) : null;
es(min >= 13 && min <= 16, true, `se le vuelve a marcar en ~15 min (quedó en ${min})`);
const { data: s2 } = await db.from('tel_sesiones').select('config, item_actual').eq('id', ses.id).maybeSingle();
es(s2.config?.abandonadas, 1, 'se cuenta como abandonada, para poder vigilarla');
es(s2.item_actual, A.id, 'el que ya estaba con el vendedor no se movió');

await limpiar();
if (fallas.length) { console.error(`\n❌ ${fallas.length} fallas de ${ok + fallas.length}:\n\n${fallas.join('\n\n')}\n`); process.exit(1); }
console.log(`\n✅ ${ok} pruebas de la marcación en paralelo · base limpia`);
