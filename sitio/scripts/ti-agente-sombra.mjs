// TRABAJO INTELIGENTE · MODO SOMBRA del agente SDR.
//
// Toma conversaciones REALES de WhatsApp, corta en el momento en que el lead
// escribió y el humano estaba por contestar, y le pide al agente (con el
// GUION + la wiki + los límites + las jugadas aprobadas) que decida: estado,
// objetivo, mensaje, datos extraídos, si escala y cuándo volvería a tocar.
// NO envía nada. Guarda cada caso en ti_sombra junto a lo que el humano
// contestó de verdad, para que el dueño califique.
//
//   node --experimental-strip-types scripts/ti-agente-sombra.mjs   # (Node 22) corre un lote (40 casos)
//   node scripts/ti-agente-sombra.mjs --casos 60
//   node scripts/ti-agente-sombra.mjs --lote 2026-09-02b
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
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MAX_CASOS = Number(arg('casos', 40));
const LOTE = arg('lote', new Date().toISOString().slice(0, 10));
const PRECIO = { in: 15 / 1e6, out: 75 / 1e6 }; // USD por token (Opus)
const REINTENTAR = process.argv.includes('--reintentar'); // solo los casos del lote cuya salida falló

const src = (f) => readFileSync(new URL('../src/lib/crm/ti/' + f, import.meta.url), 'utf8');
const tpl = (txt, nombre) => txt.match(new RegExp('export const ' + nombre + ' = `([\\s\\S]*?)`;'))[1];
const GUION = tpl(src('agente-guion.ts'), 'GUION_AGENTE');
const SALIDA = tpl(src('agente-guion.ts'), 'SALIDA_AGENTE');
const WIKI = tpl(src('wiki-comercial.ts'), 'WIKI_COMERCIAL');
const LIMITES = tpl(src('wiki-comercial.ts'), 'LIMITES_COPILOTO');
const { contextoParaLead, detectarGiro } = await import('../src/lib/crm/ti/conocimiento/index.ts');
const { data: ejAprob } = await supabase.from('ia_ejemplos').select('estado, situacion, pulida').eq('estado_rev', 'aprobado').limit(60);
const EJEMPLOS = (ejAprob || []).length ? '\n\nEJEMPLOS APROBADOS POR EL DUEÑO (así se contesta, por estado):\n' + ejAprob.map(e => `[${e.estado}] Lead: ${e.situacion}\nNosotros: ${e.pulida}`).join('\n---\n') : '';
const { data: jug } = await supabase.from('ia_jugadas').select('pregunta, respuesta').eq('estado', 'aprobada').limit(40);
const JUGADAS = (jug || []).length ? '\n\nJUGADAS APROBADAS (respuestas que ya funcionaron):\n' + jug.map(j => `P: ${j.pregunta}\nR: ${j.respuesta}`).join('\n---\n') : '';

if (REINTENTAR) {
  const { data: rows } = await supabase.from('ti_sombra').select('id, caso, contact_id, contexto, salida').eq('lote', LOTE).order('caso');
  const malos = (rows || []).filter(r => r.salida?.error);
  console.log(`Reintentando ${malos.length} casos del lote ${LOTE}`);
  const { data: cs } = await supabase.from('contacts').select('id, nombre, lifecycle_stage, giro, sucursales_interes, fuente').in('id', malos.map(r => r.contact_id));
  const por = {}; for (const c of cs || []) por[c.id] = c;
  let costoR = 0;
  for (const r of malos) {
    const { salida, costo } = await decidir({ conv: { contacts: por[r.contact_id] || {} }, contexto: r.contexto });
    costoR += costo;
    await supabase.from('ti_sombra').update({ salida, costo_usd: costo }).eq('id', r.id);
    process.stdout.write(`\r  caso ${r.caso} ${salida.error ? 'FALLÓ otra vez' : 'ok'} · $${costoR.toFixed(2)}   `);
  }
  console.log('\nListo.');
  process.exit(0);
}

/* ── 1) Conversaciones candidatas: leads primero, luego oportunidades y
       clientes (sus primeras charlas también fueron de lead). Sin demos ni
       internas. ── */
const desde = new Date(Date.now() - 120 * 86400e3).toISOString();
const { data: convs } = await supabase.from('wa_conversaciones')
  .select('id, contact_id, ultimo_mensaje_at, contacts!inner(id, nombre, lifecycle_stage, giro, sucursales_interes, fuente, propiedades)')
  .not('contact_id', 'is', null).gt('ultimo_mensaje_at', desde).neq('interna', true)
  .order('ultimo_mensaje_at', { ascending: false }).limit(200);
const orden = { lead: 0, oportunidad: 1, cliente: 2 };
const cands = (convs || [])
  .filter(c => !(c.contacts?.propiedades || {}).demo_ti)
  .sort((a, b) => (orden[a.contacts.lifecycle_stage] ?? 3) - (orden[b.contacts.lifecycle_stage] ?? 3));

/* ── 2) Puntos de decisión: cada mensaje del lead al que siguió una respuesta
       humana (para poder comparar). Máximo 3 por conversación, repartidos. ── */
const casos = []; let descartadas = 0;
for (const c of cands) {
  if (casos.length >= MAX_CASOS) break;
  const { data: msjs } = await supabase.from('wa_mensajes')
    .select('direccion, cuerpo, tipo, transcript, created_at, autor')
    .eq('conversation_id', c.id).is('borrado_at', null).order('created_at', { ascending: true }).limit(120);
  const lista = (msjs || []).filter(m => m.direccion === 'entrante' || m.direccion === 'saliente');
  const puntos = [];
  for (let i = 0; i < lista.length - 1; i++) {
    if (lista[i].direccion !== 'entrante' || lista[i + 1].direccion !== 'saliente') continue;
    if (i + 1 < lista.length && lista[i + 1].direccion === 'entrante') continue;
    // el bloque entrante puede ser varios mensajes seguidos: corta en el último
    if (lista[i + 1].autor === 'Agenda') continue; // respuestas automáticas no son referencia humana
    puntos.push(i);
  }
  if (!puntos.length) continue;
  // SOLO negocios de moda (pedido del dueño 2026-09-02): si ni el CRM ni la charla lo delatan, fuera.
  if (!detectarGiro(`${c.contacts?.giro || ''} ${lista.map(m => m.cuerpo || '').join(' ')}`)) { descartadas++; continue; }
  const elegidos = puntos.length <= 3 ? puntos : [puntos[0], puntos[Math.floor(puntos.length / 2)], puntos[puntos.length - 1]];
  for (const i of elegidos) {
    if (casos.length >= MAX_CASOS) break;
    const contexto = lista.slice(Math.max(0, i - 24), i + 1).map(m => ({
      quien: m.direccion === 'entrante' ? 'lead' : 'nosotros',
      texto: m.tipo === 'audio' ? (m.transcript ? `[audio] ${m.transcript}` : '[audio sin transcripción]') : (m.tipo !== 'text' && !m.cuerpo ? `[${m.tipo}]` : String(m.cuerpo || '')).slice(0, 500),
      cuando: m.created_at,
    }));
    // la respuesta humana real: el bloque saliente que siguió
    let j = i + 1, humano = [];
    while (j < lista.length && lista[j].direccion === 'saliente') { humano.push(String(lista[j].cuerpo || `[${lista[j].tipo}]`).slice(0, 500)); j++; }
    casos.push({ conv: c, corte_at: lista[i].created_at, contexto, humano: humano.join('\n') });
  }
}
console.log(`Conversaciones candidatas: ${cands.length} · descartadas por no ser de moda: ${descartadas} · casos a decidir: ${casos.length} · lote ${LOTE}`);

/* ── 3) El agente decide ── */
async function decidir(k) {
  const c = k.conv.contacts;
  const perfil = `Lo que el CRM ya sabe del lead: nombre «${c.nombre || '?'}», etapa ${c.lifecycle_stage}, giro ${c.giro || 'desconocido'}, sucursales ${c.sucursales_interes ?? 'desconocido'}, fuente ${c.fuente || 'desconocida'}.`;
  const charla = k.contexto.map(m => `${m.quien === 'lead' ? 'LEAD' : 'NOSOTROS'} (${m.cuando.slice(0, 16).replace('T', ' ')}): ${m.texto}`).join('\n');
  const ctx = contextoParaLead({ giroCrm: c.giro || null, conversacion: charla, ultimoMensaje: k.contexto.at(-1)?.texto || '' });
  const r = await anthropic.messages.create({
    model: MODELO, max_tokens: 1800,
    system: `${GUION}\n\nLO QUE SABES (general):\n${WIKI}\n\nLO QUE SABES DE ESTE LEAD Y SU GIRO:\n${ctx.texto}\n\nLÍMITES:\n${LIMITES}${JUGADAS}${EJEMPLOS}`,
    messages: [{ role: 'user', content: `${perfil}\n\nCONVERSACIÓN (lo más reciente al final; el último mensaje es del lead y te toca decidir):\n\n${charla}\n\n${SALIDA}` }],
  });
  const t = r.content.find(b => b.type === 'text')?.text || '{}';
  let salida = {};
  try { salida = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { salida = { error: 'JSON inválido', bruto: t.slice(0, 500) }; }
  const costo = (r.usage.input_tokens || 0) * PRECIO.in + (r.usage.output_tokens || 0) * PRECIO.out;
  return { salida, costo };
}

let n = 0, costoTotal = 0;
const cola = casos.map((k, idx) => ({ k, idx }));
async function worker() {
  while (cola.length) {
    const { k, idx } = cola.shift();
    try {
      const { salida, costo } = await decidir(k);
      costoTotal += costo;
      await supabase.from('ti_sombra').insert({
        lote: LOTE, caso: idx + 1, conversation_id: k.conv.id, contact_id: k.conv.contact_id, corte_at: k.corte_at,
        contexto: k.contexto, salida, humano_respuesta: k.humano || null, modelo: MODELO, costo_usd: costo,
      });
      n++;
      process.stdout.write(`\r  decididos ${n}/${casos.length} · $${costoTotal.toFixed(2)}`);
    } catch (e) { console.error(`\n  caso ${idx + 1}: ${e?.message || e}`); }
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
console.log(`\nListo: ${n} casos en ti_sombra (lote ${LOTE}) · costo $${costoTotal.toFixed(2)} USD`);
