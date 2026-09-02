// TRABAJO INTELIGENTE · CURACIÓN AUTOMÁTICA de ia_ejemplos.
//
// El dueño no debe leer 267 candidatos: el analista los califica contra el
// GUION y contra los ejemplos que el dueño YA aprobó a mano (sus 13 elecciones
// son el estándar). Los que pasan claro se aprueban; los que fallan claro se
// rechazan; los dudosos quedan para el dueño. Todo con su razón.
//
//   node --experimental-strip-types scripts/ti-curar-ejemplos.mjs           # (Node 22)
//   node --experimental-strip-types scripts/ti-curar-ejemplos.mjs --ver     # solo el resumen
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
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 6 }); // 529/overloaded: reintenta con espera
const MODELO = 'claude-opus-5';
const PRECIO = { in: 15 / 1e6, out: 75 / 1e6 };
const { GUION_AGENTE } = await import('../src/lib/crm/ti/agente-guion.ts');

if (process.argv.includes('--ver')) {
  const { data } = await supabase.from('ia_ejemplos').select('estado_rev, fuente');
  const c = {}; for (const r of data || []) { const k = `${r.fuente}/${r.estado_rev}`; c[k] = (c[k] || 0) + 1; }
  console.log(c); process.exit(0);
}

const [{ data: aprobados }, { data: pendientes }] = await Promise.all([
  supabase.from('ia_ejemplos').select('estado, situacion, pulida').eq('estado_rev', 'aprobado').eq('fuente', 'correccion_dueno'),
  supabase.from('ia_ejemplos').select('id, estado, giro, situacion, mensaje_lead, respuesta, pulida, por_que').eq('estado_rev', 'propuesta').eq('fuente', 'convirtio').order('created_at'),
]);
console.log(`Estándar del dueño: ${(aprobados || []).length} ejemplos · por curar: ${(pendientes || []).length}`);
const ESTANDAR = (aprobados || []).map(e => `[${e.estado}] Lead: ${e.situacion}\nRespuesta aprobada: ${e.pulida}`).join('\n---\n');

let ok = 0, no = 0, duda = 0, costo = 0;
for (let i = 0; i < (pendientes || []).length; i += 12) {
  const lote = pendientes.slice(i, i + 12);
  let r; for (let intento = 0; ; intento++) { try { r = await anthropic.messages.create({
    model: MODELO, max_tokens: 3000,
    system: `Eres el curador del playbook del agente SDR de Sacscloud. Decides qué respuestas humanas entran como ejemplos del agente.

EL GUION (lo que se considera correcto):
${GUION_AGENTE}

EL ESTÁNDAR DEL DUEÑO (ejemplos que él eligió a mano; imita su criterio):
${ESTANDAR}

Criterios para APROBAR: sigue el arco (entender antes de vender), refleja lo que dijo el lead, usa el lenguaje del giro, es corta y cálida, no da precios sin conocer giro/tiendas, no menciona descuentos concretos ni promete features, no manda solo un link, no suena a departamento de ventas. Si además la versión "pulida" mejora sin cambiar el sentido, apruébala con la pulida.
RECHAZAR: genérica, lista de módulos, solo link, promesas, precios antes de tiempo, tono corporativo, o que corresponde a soporte de cliente activo.
DUDOSO: sirve pero con reservas que el dueño debe decidir.`,
    messages: [{ role: 'user', content: `Califica cada candidato. Responde SOLO un JSON: {"veredictos":[{"id":"…","veredicto":"aprobar|rechazar|dudoso","razon":"una línea"}]}\n\nCANDIDATOS:\n${lote.map(e => `ID ${e.id}\nEstado: ${e.estado} · Giro: ${e.giro}\nSituación: ${e.situacion}\nLead: ${e.mensaje_lead || ''}\nRespuesta humana: ${e.respuesta}\nPulida: ${e.pulida}\nPor qué (analista): ${e.por_que}`).join('\n\n')}` }],
  }); break; } catch (e) { if (intento >= 5) throw e; const espera = 15000 * (intento + 1); console.log(`\n  API saturada (${e?.status || e?.message}); reintento en ${espera / 1000}s`); await new Promise(res => setTimeout(res, espera)); } }
  costo += (r.usage.input_tokens || 0) * PRECIO.in + (r.usage.output_tokens || 0) * PRECIO.out;
  const t = r.content.find(b => b.type === 'text')?.text || '{}';
  let out = {}; try { out = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { console.log('\n JSON inválido en lote', i); continue; }
  for (const v of out.veredictos || []) {
    const estado_rev = v.veredicto === 'aprobar' ? 'aprobado' : v.veredicto === 'rechazar' ? 'rechazado' : 'dudoso';
    await supabase.from('ia_ejemplos').update({ estado_rev, revisado_at: new Date().toISOString(), por_que: (lote.find(e => e.id === v.id)?.por_que || '') + ` · Curador: ${v.razon}` }).eq('id', v.id);
    if (estado_rev === 'aprobado') ok++; else if (estado_rev === 'rechazado') no++; else duda++;
  }
  process.stdout.write(`\r  curados ${Math.min(i + 12, pendientes.length)}/${pendientes.length} · aprobados ${ok} · rechazados ${no} · dudosos ${duda} · $${costo.toFixed(2)}   `);
}
console.log(`\nListo · aprobados ${ok} · rechazados ${no} · dudosos ${duda} (los ve el dueño) · costo $${costo.toFixed(2)} USD`);
