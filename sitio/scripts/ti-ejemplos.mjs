// TRABAJO INTELIGENTE · LOS EJEMPLOS QUE «TE IMITAN».
//
// Pedido del dueño (2026-09-02): de las conversaciones reales que SÍ
// convirtieron (agendaron, pagaron, se volvieron clientes), sacar las
// respuestas humanas que hicieron empatía con el prospecto, entendieron su
// negocio y lo acercaron a la reunión. Quedan como candidatas en ia_ejemplos
// (estado «propuesta») para que el dueño apruebe; las aprobadas entran al
// prompt del agente como ejemplos de su estado.
//
//   node --experimental-strip-types scripts/ti-ejemplos.mjs            # (Node 22)
//   node --experimental-strip-types scripts/ti-ejemplos.mjs --convs 40
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
const MAX_CONVS = Number(arg('convs', 40));
const PRECIO = { in: 15 / 1e6, out: 75 / 1e6 };
const { GUION_AGENTE, ESTADOS_AGENTE } = await import('../src/lib/crm/ti/agente-guion.ts');
const { detectarGiro } = await import('../src/lib/crm/ti/conocimiento/giros.ts');

/* ── 1) Los que convirtieron: cliente con suscripción o cotización pagada,
       o lead que llegó a una reunión (asistió). Sus conversaciones de WA. ── */
const [{ data: pagaron }, { data: asistieron }, { data: subs }] = await Promise.all([
  supabase.from('quotes').select('contact_id, pagado_fecha, aceptado_fecha').not('contact_id', 'is', null).or('pagado_fecha.not.is.null,aceptado_fecha.not.is.null').limit(300),
  supabase.from('bookings').select('contact_id, fecha').eq('estado', 'asistio').not('contact_id', 'is', null).limit(300),
  supabase.from('subscriptions').select('contact_id, created_at').not('contact_id', 'is', null).limit(300),
]);
const hito = {}; // contact_id → fecha del hito (para recortar la charla ANTES de convertir)
for (const q of pagaron || []) hito[q.contact_id] = hito[q.contact_id] || q.aceptado_fecha || q.pagado_fecha;
for (const b of asistieron || []) hito[b.contact_id] = hito[b.contact_id] || (b.fecha + 'T23:59:59Z');
for (const s of subs || []) hito[s.contact_id] = hito[s.contact_id] || s.created_at;
const ids = Object.keys(hito);
const { data: convs } = await supabase.from('wa_conversaciones').select('id, contact_id, ultimo_mensaje_at, contacts!inner(id, nombre, giro, sucursales_interes, lifecycle_stage)')
  .in('contact_id', ids).neq('interna', true).order('ultimo_mensaje_at', { ascending: false }).limit(300);
console.log(`Contactos que convirtieron: ${ids.length} · con conversación de WhatsApp: ${(convs || []).length}`);

/* ── 2) Por conversación: los pares lead→humano ANTES del hito ── */
const candidatas = []; let descartadas = 0;
// Reanudable: las conversaciones que ya dejaron ejemplos no se vuelven a analizar.
const { data: yaHechas } = await supabase.from('ia_ejemplos').select('conversation_id').limit(2000);
const hechas = new Set((yaHechas || []).map(x => x.conversation_id));
for (const c of (convs || []).filter(c => !hechas.has(c.id)).slice(0, MAX_CONVS)) {
  const corte = hito[c.contact_id];
  const { data: msjs } = await supabase.from('wa_mensajes').select('direccion, cuerpo, tipo, transcript, created_at, autor')
    .eq('conversation_id', c.id).is('borrado_at', null).lte('created_at', corte).order('created_at', { ascending: true }).limit(150);
  const lista = (msjs || []).filter(m => m.direccion === 'entrante' || m.direccion === 'saliente');
  const entrantes = lista.filter(m => m.direccion === 'entrante').length;
  const salientes = lista.filter(m => m.direccion === 'saliente' && m.autor !== 'Agenda').length;
  if (entrantes < 2 || salientes < 2) continue;
  const texto = lista.map(m => `${m.direccion === 'entrante' ? 'LEAD' : 'NOSOTROS'}: ${m.tipo === 'audio' ? (m.transcript ? '[audio] ' + m.transcript : '[audio]') : String(m.cuerpo || `[${m.tipo}]`)}`.slice(0, 500)).join('\n');
  // SOLO negocios de moda (ropa, calzado, joyería, consignación…): pedido del dueño 2026-09-02.
  const giro = detectarGiro(`${c.contacts?.giro || ''} ${texto}`);
  if (!giro) { descartadas++; continue; }
  candidatas.push({ conv: c, texto: texto.slice(-9000), n: lista.length, giro: giro.id });
}
console.log(`Conversaciones con diálogo real antes de convertir: ${candidatas.length} (descartadas por no ser de moda: ${descartadas})`);

/* ── 3) El evaluador: qué respuestas humanas hicieron empatía y avanzaron ── */
const ESTADOS = Object.entries(ESTADOS_AGENTE).map(([k, v]) => `${k}: ${v}`).join('\n');
let total = 0, costo = 0;
for (const k of candidatas) {
  const c = k.conv.contacts;
  const r = await anthropic.messages.create({
    model: MODELO, max_tokens: 2500,
    system: `Eres el analista comercial de Sacscloud. Lees conversaciones de WhatsApp que SÍ terminaron en reunión o venta y extraes las respuestas del HUMANO que mejor hicieron su trabajo, para que el agente de IA las imite.

Este es el guion que el agente debe seguir (lo que se considera «bien»):
${GUION_AGENTE}

Los estados de una conversación:
${ESTADOS}`,
    messages: [{ role: 'user', content: `Lead: «${c.nombre || '?'}», giro ${c.giro || 'desconocido'}, sucursales ${c.sucursales_interes ?? '?'}. Esta conversación terminó en reunión o venta.

CONVERSACIÓN:
${k.texto}

Extrae de 0 a 4 respuestas de NOSOTROS que valgan como ejemplo: hicieron empatía real, reflejaron lo que el lead dijo, preguntaron lo correcto para entender el negocio, u ofrecieron el siguiente paso (llamada/demo) en el momento correcto. NO elijas respuestas que solo mandan un link de precios, que son genéricas, que prometen descuentos, o que hablan de producto sin haber entendido el negocio.

Responde SOLO un JSON:
{"ejemplos":[{"estado":"uno de los estados","situacion":"qué dijo/pidió el lead justo antes, en una línea","mensaje_lead":"cita textual corta del lead","respuesta":"la respuesta humana tal cual (puedes recortar lo irrelevante)","por_que":"qué hace bien esta respuesta, en una línea","pulida":"la misma respuesta pulida para reusar: tú cercano mexicano, 2-4 oraciones, sin nombres propios de personas de Sacs"}],"lo_humano":"en una línea, qué tuvo de humano esta conversación que el agente debe conservar"}` }],
  });
  const t = r.content.find(b => b.type === 'text')?.text || '{}';
  costo += (r.usage.input_tokens || 0) * PRECIO.in + (r.usage.output_tokens || 0) * PRECIO.out;
  let out = {};
  try { out = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { console.log('\n  JSON inválido en', c.nombre); continue; }
  for (const e of out.ejemplos || []) {
    await supabase.from('ia_ejemplos').insert({
      estado: e.estado, situacion: e.situacion, mensaje_lead: e.mensaje_lead, respuesta: e.respuesta, pulida: e.pulida, por_que: e.por_que,
      lo_humano: out.lo_humano || null, contact_id: k.conv.contact_id, conversation_id: k.conv.id, giro: k.giro, fuente: 'convirtio', modelo: MODELO,
    });
    total++;
  }
  process.stdout.write(`\r  conversaciones analizadas · ejemplos: ${total} · $${costo.toFixed(2)}   `);
}
console.log(`\nListo: ${total} ejemplos propuestos en ia_ejemplos · costo $${costo.toFixed(2)} USD`);
