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

const { alVeredicto, itemsVivos, lineasDe, procesarEstado } = await import('../src/lib/telefonia/marcador.ts');

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

/* 🔴 El bug que se comía contactos en silencio: Twilio avisa un segundo
   después de que ESA llamada terminó, y quien recibía el aviso cerraba el item
   como «no contestó» — al que le colgamos NOSOTROS. Quedaba fuera de la lista
   y nadie le volvía a marcar. */
console.log('\n── Y el aviso tardío de Twilio de la que colgamos ────────');
await procesarEstado(B.id, { CallStatus: 'completed', CallSid: B.call_sid });
const { data: b2 } = await db.from('tel_sesion_items').select('estado, resultado').eq('id', B.id).maybeSingle();
es(b2.estado, 'pendiente', 'el aviso tardío NO la cierra: sigue en la lista');
es(b2.resultado, null, 'y no queda marcada como «no contestó»');

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

/* ══ QUE NO QUEDE EN PING-PONG ══════════════════════════════════════════════
   Al mismo contacto le puede tocar ser el cortado varias veces. Se comprueba
   que la espera CREZCA, que a la tercera el intento sí cuente y que deje de
   colarse al principio de la fila — si no, le suena el teléfono todo el día
   sin que nadie le hable nunca. */
console.log('\n── Y si a uno le toca ser el cortado tres veces ──────────');
// Se empieza de cero: B ya lleva cortes de las pruebas de arriba.
await db.from('tel_sesion_items').update({ cortes: 0 }).eq('id', B.id);
const esperas = [];
for (let vuelta = 1; vuelta <= 3; vuelta++) {
  await db.from('tel_sesiones').update({ item_actual: null }).eq('id', ses.id);
  await db.from('tel_sesion_items').update({ estado: 'timbrando', call_sid: `CA${'7'.repeat(30)}${vuelta}${vuelta}`, volver_at: null, intentos: 1 }).eq('id', B.id);
  await db.from('tel_sesion_items').update({ estado: 'escuchando', veredicto: null, contestado_at: new Date().toISOString() }).eq('id', A.id);
  const { data: A2 } = await db.from('tel_sesion_items').select('*').eq('id', A.id).maybeSingle();
  await alVeredicto(A2, 'persona', 'reglas', `vuelta ${vuelta}`);
  const { data: b } = await db.from('tel_sesion_items').select('cortes, intentos, volver_at, prioridad').eq('id', B.id).maybeSingle();
  esperas.push(Math.round((new Date(b.volver_at) - Date.now()) / 60000));
  if (vuelta === 3) {
    es(b.cortes, 3, 'se cuentan los tres cortes');
    es(b.intentos, 1, 'a la tercera el intento SÍ cuenta');
    es(b.prioridad, 0, 'y deja de colarse al principio de la fila');
  }
}
es(esperas[0] < esperas[1] && esperas[1] < esperas[2], true, `la espera crece: ${esperas.join(' → ')} min`);

await limpiar();
if (fallas.length) { console.error(`\n❌ ${fallas.length} fallas de ${ok + fallas.length}:\n\n${fallas.join('\n\n')}\n`); process.exit(1); }
console.log(`\n✅ ${ok} pruebas de la marcación en paralelo · base limpia`);
