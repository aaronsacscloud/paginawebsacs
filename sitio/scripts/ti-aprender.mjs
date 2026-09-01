// TRABAJO INTELIGENTE · F6 — EL CICLO DE APRENDIZAJE DE 24 H.
//
// «Cada 24 horas te retroalimentas de las conversaciones para mejorar cómo
// respondes lo que antes respondía el humano.» Aquí está, y el dataset son
// las conversaciones que YA viven en el Supabase del CRM — no se sube nada
// a ningún lado.
//
// El ciclo: RECOLECTA (24 h) → DESTILA → PROPONE (ia_jugadas + huecos de la
// wiki + patrones de omisión) → el dueño APRUEBA → MIDE.
// Corre LOCAL (lee mucho y llama al modelo varias veces).
//
//   node scripts/ti-aprender.mjs             # analiza y propone
//   node scripts/ti-aprender.mjs --aprobar   # aprueba TODAS las propuestas
//   node scripts/ti-aprender.mjs --ver       # solo muestra lo propuesto
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
if (!process.env.ANTHROPIC_API_KEY) {
  try { const m = readFileSync('/opt/sacs/sacs_api/.env', 'utf8').match(/^ANTHROPIC_API_KEY=(.+)$/m); if (m) process.env.ANTHROPIC_API_KEY = m[1].trim(); } catch {}
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODELO = 'claude-opus-5';
const aprobar = process.argv.includes('--aprobar');
const soloVer = process.argv.includes('--ver');
const desde = new Date(Date.now() - 24 * 3600e3).toISOString();

async function ver() {
  const { data: j } = await supabase.from('ia_jugadas').select('*').order('created_at', { ascending: false }).limit(40);
  const props = (j || []).filter(x => x.estado === 'propuesta');
  const aps = (j || []).filter(x => x.estado === 'aprobada');
  console.log(`\n══ PLAYBOOK · ${aps.length} aprobadas · ${props.length} propuestas ══`);
  for (const x of props) console.log(`\n[propuesta] P: ${x.pregunta}\n            R: ${x.respuesta}\n            (de: ${x.fuente || 's/f'})`);
  for (const x of aps.slice(0, 10)) console.log(`\n[aprobada]  P: ${x.pregunta}`);
}
if (soloVer) { await ver(); process.exit(0); }
if (aprobar) {
  const { data } = await supabase.from('ia_jugadas').update({ estado: 'aprobada' }).eq('estado', 'propuesta').select('id');
  console.log(`aprobadas: ${(data || []).length} jugadas — desde ahora el copiloto las usa.`);
  process.exit(0);
}

/* ── 1) RECOLECTA ── */
// a) Lo que respondió el HUMANO en las últimas 24 h: ESAS son las lecciones
//    (lo que la IA no supo o no tenía permitido).
const { data: convs } = await supabase.from('wa_conversaciones').select('id, contact_id').limit(400);
const idsConv = (convs || []).map(c => c.id);
let msjs = [];
for (let i = 0; i < idsConv.length; i += 100) {
  const { data } = await supabase.from('wa_mensajes')
    .select('conversation_id, direccion, cuerpo, created_at, autor')
    .in('conversation_id', idsConv.slice(i, i + 100)).gt('created_at', desde)
    .order('created_at', { ascending: true }).limit(500);
  msjs = msjs.concat(data || []);
}
// pares pregunta(lead) → respuesta(humano)
const porConv = {};
for (const m of msjs) (porConv[m.conversation_id] = porConv[m.conversation_id] || []).push(m);
const pares = [];
for (const lista of Object.values(porConv)) {
  for (let i = 0; i < lista.length - 1; i++) {
    if (lista[i].direccion === 'entrante' && lista[i + 1].direccion === 'saliente') {
      const p = String(lista[i].cuerpo || '').trim(), r = String(lista[i + 1].cuerpo || '').trim();
      if (p.length > 8 && r.length > 20) pares.push({ p, r });
    }
  }
}
// b) Lo que la IA no pudo, y las omisiones del consultor
const [{ data: noPudo }, { data: omis }] = await Promise.all([
  supabase.from('ia_log').select('razon, detalle').eq('accion', 'no_pudo').gt('created_at', desde).limit(50),
  supabase.from('ti_omisiones').select('motivo, texto, contexto').gt('created_at', desde).limit(100),
]);
console.log(`Recolectado (24 h): ${pares.length} pares humanos · ${(noPudo || []).length} veces que la IA no pudo · ${(omis || []).length} omisiones`);
if (!pares.length && !(omis || []).length) { console.log('Nada que aprender hoy.'); process.exit(0); }

/* ── 2+3) DESTILA y PROPONE ── */
const wiki = readFileSync(new URL('../src/lib/crm/ti/wiki-comercial.ts', import.meta.url), 'utf8')
  .match(/export const WIKI_COMERCIAL = `([\s\S]*?)`;/)[1];
const { data: yaJugadas } = await supabase.from('ia_jugadas').select('pregunta').limit(100);

const r = await anthropic.messages.create({
  model: MODELO, max_tokens: 6000,
  messages: [{ role: 'user', content: `Eres el analista de aprendizaje del copiloto comercial de Sacscloud. Cada 24 h lees lo que pasó y propones cómo mejorar.

LA WIKI ACTUAL DEL COPILOTO (lo que ya sabe):
${wiki}

JUGADAS QUE YA EXISTEN (no repitas estas preguntas):
${(yaJugadas || []).map(j => '- ' + j.pregunta).join('\n') || '(ninguna)'}

PARES REALES DE LAS ÚLTIMAS 24 H (lo que preguntó el lead → lo que contestó el HUMANO):
${pares.slice(0, 60).map((x, i) => `${i + 1}. LEAD: ${x.p.slice(0, 300)}\n   HUMANO: ${x.r.slice(0, 500)}`).join('\n\n')}

VECES QUE LA IA NO PUDO RESPONDER:
${(noPudo || []).map(x => '- ' + x.razon).join('\n') || '(ninguna)'}

OMISIONES DEL CONSULTOR:
${(omis || []).map(x => `- ${x.motivo}${x.texto ? ': ' + x.texto : ''} (${x.contexto?.tipo || ''} ${x.contexto?.paso || ''})`).join('\n') || '(ninguna)'}

Responde SOLO un JSON:
{
 "jugadas": [{"pregunta":"la pregunta del lead, generalizada","respuesta":"la respuesta que funcionó, pulida y lista para reusar","fuente":"de dónde salió"}],
 "huecos_wiki": ["cosas que preguntaron y la wiki NO cubre — redactadas como el párrafo que habría que agregar"],
 "patrones": ["patrones de omisión o de proceso que valga la pena cambiar, con su evidencia"]
}

Criterios: máximo 6 jugadas, solo las que se repiten o son claramente reusables; NADA que viole los límites (descuentos, quejas, promesas); las respuestas en tú cercano mexicano, cortas. Si no hay nada valioso, devuelve listas vacías.` }],
});
const t = r.content.find(b => b.type === 'text').text;
let out = {};
try { out = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); }
catch {
  console.log('La IA no devolvió JSON válido. stop_reason:', r.stop_reason, '· salida:', t.length, 'chars');
  console.log(t.slice(-400));
  process.exit(1);
}

for (const j of out.jugadas || []) {
  await supabase.from('ia_jugadas').insert({ pregunta: j.pregunta, respuesta: j.respuesta, fuente: j.fuente || 'ciclo 24h' });
}
console.log(`\n══ PROPUESTAS ══`);
console.log(`\nJUGADAS NUEVAS (${(out.jugadas || []).length}) — quedan en estado «propuesta»:`);
for (const j of out.jugadas || []) console.log(`\n P: ${j.pregunta}\n R: ${j.respuesta}`);
if ((out.huecos_wiki || []).length) {
  console.log(`\nHUECOS DE LA WIKI (${out.huecos_wiki.length}) — hay que meterlos a wiki-comercial.ts:`);
  for (const h of out.huecos_wiki) console.log(` · ${h}`);
}
if ((out.patrones || []).length) {
  console.log(`\nPATRONES DEL PROCESO (${out.patrones.length}):`);
  for (const p of out.patrones) console.log(` · ${p}`);
}
console.log(`\nPara activarlas: node scripts/ti-aprender.mjs --aprobar`);
