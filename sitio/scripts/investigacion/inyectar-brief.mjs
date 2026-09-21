#!/usr/bin/env node
/**
 * Mete al brief de una pieza lo que trajeron los tres agentes de investigación
 * (fuentes, lectura completa de competencia, glosario/lenguaje del ramo).
 *
 *   node --env-file=.env --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
 *     scripts/investigacion/inyectar-brief.mjs <slug> <todo.json>
 *
 * `todo.json` = {"fuentes":{...},"comp":{...},"glos":{...}} con la salida de
 * los tres prompts de scripts/investigacion/*.md. Lo que ya existía en el
 * brief se conserva; solo se agregan/actualizan estos campos.
 */
import { readFileSync } from 'node:fs';
const { supabase } = await import('../../src/lib/supabase.ts');
const [slug, archivo] = process.argv.slice(2);
if (!slug || !archivo) { console.log('uso: inyectar-brief.mjs <slug> <todo.json>'); process.exit(1); }
const inv = JSON.parse(readFileSync(archivo, 'utf8'));
const { data: c } = await supabase.from('de_contenido').select('id, brief').eq('slug', slug).single();
if (!c) { console.log('no existe'); process.exit(1); }
const b = c.brief || {};

const fuentes = (inv.fuentes?.fuentes || []).filter(f => f.verificado !== false && /^https?:\/\//.test(f.url || '')).map(f => ({
  tema: f.tema, dato: f.dato, cita_textual: f.cita_textual, fuente: f.fuente, url: f.url, fecha: f.fecha_fuente || f.fecha || '', como_usarlo: f.como_usarlo || '',
}));
const glosario = (inv.glos?.glosario || []).map(g => ({ termino: g.termino, definicion: g.definicion, tambien_llamado: g.tambien_llamado || [] }));
const evitar = [...new Set((inv.glos?.glosario || []).flatMap(g => g.evitar || []).map(e => String(e).replace(/\s*\(.*\)\s*$/, '').trim()).filter(e => e.length > 2 && e.length < 30 && !/como palabra|a secas|cuidar/.test(e)))];

const nuevo = {
  ...b,
  fuentes: fuentes.length ? fuentes : b.fuentes,
  para_ganar: inv.comp?.para_ganar || b.para_ganar,
  preguntas_sin_contestar: inv.comp?.preguntas_sin_contestar || b.preguntas_sin_contestar,
  glosario: glosario.length ? glosario : b.glosario,
  evitar: evitar.length ? evitar : b.evitar,
  frases_del_mostrador: inv.glos?.frases_del_mostrador || b.frases_del_mostrador,
  politicas_comunes: inv.glos?.politicas_comunes || b.politicas_comunes,
  palabras_que_rankean: inv.glos?.palabras_que_rankean || b.palabras_que_rankean,
  preguntas_reales: (inv.glos?.preguntas_reales || b.preguntas_reales || []).map(x => String(x).replace(/\s*—\s*https?:\/\/\S+$/, '')),
  investigada_at: new Date().toISOString(),
};
const { error } = await supabase.from('de_contenido').update({ brief: nuevo }).eq('id', c.id);
console.log(error ? `FALLÓ: ${error.message}` : `ok: ${fuentes.length} fuentes · ${glosario.length} términos · ${evitar.length} a evitar · ${(nuevo.para_ganar || []).length} para ganar · ${(nuevo.preguntas_sin_contestar || []).length} preguntas sin contestar`);

// La lectura completa de la competencia también va a de_paginas_similares.
for (const p of inv.comp?.paginas || []) {
  if (!p.url || !p.palabras_aprox) continue;
  await supabase.from('de_paginas_similares').upsert({
    contenido_id: c.id, url: p.url, titulo: (p.h2_h3 || [])[0] || p.url, tipo: /proveedor/.test(p.tipo) ? 'proveedor' : /foro/.test(p.tipo) ? 'foro' : 'guia_independiente',
    palabras_aprox: p.palabras_aprox, h2: (p.h2_h3 || []).slice(0, 10), tiene_faq: !!p.faq, tiene_tabla_o_pasos: !!(p.tabla || p.pasos_numerados),
    menciona_precios: /precio|\$|€|₺/i.test(JSON.stringify(p)), cubre_bien: [p.mejor_que_nadie].filter(Boolean), le_falta: [p.le_falta].filter(Boolean),
    por_que_rankea: p.mejor_que_nadie || '', analizada_at: new Date().toISOString(), fecha_visible: p.fecha_visible || null,
  }, { onConflict: 'contenido_id,url' });
}
console.log(`  ${(inv.comp?.paginas || []).length} páginas competidoras guardadas`);
process.exit(0);
