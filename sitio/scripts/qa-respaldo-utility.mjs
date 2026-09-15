/**
 * QA · «Si la de marketing falla, sale una de utilidad — Y DEL MISMO TEMA».
 *
 * La primera versión de esta prueba solo miraba que hubiera respaldo. No basta:
 * a Jakob le salió uno que no venía a cuento, y cinco plantillas nuestras que se
 * llaman «…_utility_v1» en Meta son MARKETING, así que como respaldo chocarían
 * con el mismo freno. Aquí se comprueban las tres cosas: que exista, que sea
 * UTILITY de verdad, y que la pareja esté declarada por alguien (no inventada).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

const { data: pls } = await sb.from('wa_plantillas').select('nombre, categoria, status, variables, respaldo_utility, respaldo_params');
const porNombre = new Map((pls || []).map(p => [p.nombre, p]));
const esUtilityReal = n => { const p = porNombre.get(n); return !!p && p.status === 'APPROVED' && String(p.categoria).toUpperCase() === 'UTILITY'; };

// 1 · Ninguna pareja declarada puede apuntar a algo que no sirva.
const declaradas = (pls || []).filter(p => p.respaldo_utility);
const rotas = declaradas.filter(p => !esUtilityReal(p.respaldo_utility));
paso('Todas las gemelas declaradas son UTILITY aprobada', rotas.length === 0,
  rotas.map(p => `${p.nombre} → ${p.respaldo_utility} (${porNombre.get(p.respaldo_utility)?.categoria || 'no existe'})`).join(', ') || `${declaradas.length} parejas`);

// 2 · Y con los parámetros completos: un {{2}} vacío deja la frase a medias.
const sinParams = declaradas.filter(p => {
  const g = porNombre.get(p.respaldo_utility);
  const n = Number(g?.variables || 0);
  // Solo hacen falta declarados cuando la gemela pide MÁS variables que la
  // principal: lo que sobra no se puede sacar del mensaje original.
  if (n <= Number(p.variables || 0)) return false;
  const d = Array.isArray(p.respaldo_params) ? p.respaldo_params : null;
  return !d || d.length < n;
});
paso('Las gemelas que piden más datos traen su texto', sinParams.length === 0,
  sinParams.map(p => `${p.nombre} → ${p.respaldo_utility}`).join(', ') || 'todas completas');

// 3 · Las que NO tienen gemela: no es un fallo, es una decisión — pero hay que
//     saber cuáles son, porque si Meta las frena no sale nada.
const marketing = (pls || []).filter(p => p.status === 'APPROVED' && String(p.categoria).toUpperCase() === 'MARKETING');
const huerfanas = marketing.filter(p => !p.respaldo_utility);
paso('Se sabe cuáles se quedarían mudas', true, `${marketing.length - huerfanas.length} con gemela · ${huerfanas.length} sin ella`);
const familias = {};
for (const p of huerfanas) { const f = p.nombre.split('_')[0]; familias[f] = (familias[f] || 0) + 1; }
console.log('     sin gemela, por familia: ' + Object.entries(familias).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} (${n})`).join(', '));

// 4 · Y en las secuencias activas, qué pasa hoy con cada paso de WhatsApp.
const { data: secs } = await sb.from('crm_secuencias').select('id, nombre').eq('activa', true);
const { data: pasos } = await sb.from('crm_secuencia_pasos')
  .select('secuencia_id, orden, wa_plantilla, wa_plantilla_utility').eq('canal', 'wa').eq('activo', true);
/* Las dos familias que HOY no tienen gemela y se sabe por qué: a un cliente que
   se fue no se le puede decir «quedamos pendientes de tu solicitud» —no hubo
   solicitud— y hasta que existan sus plantillas de utilidad en Meta, esos pasos
   callan si el marketing se frena. Está dicho y decidido; lo que esta prueba
   vigila es que no aparezca una TERCERA familia sin que nadie se entere. */
const SIN_GEMELA_CONOCIDAS = ['anosincosto', 'crecimiento'];
let mudos = 0, cubiertos = 0; const mudosNuevos = [];
for (const s of secs || []) {
  for (const p of (pasos || []).filter(x => x.secuencia_id === s.id && x.wa_plantilla)) {
    // Una plantilla que YA es utility no necesita respaldo: Meta no la frena.
    if (esUtilityReal(p.wa_plantilla)) { cubiertos++; continue; }
    const propio = p.wa_plantilla_utility && esUtilityReal(p.wa_plantilla_utility);
    const gemela = porNombre.get(p.wa_plantilla)?.respaldo_utility;
    if (propio || (gemela && esUtilityReal(gemela))) cubiertos++;
    else {
      mudos++;
      console.log(`     · «${s.nombre}» paso ${p.orden} (${p.wa_plantilla}) se quedaría sin respaldo`);
      if (!SIN_GEMELA_CONOCIDAS.includes(p.wa_plantilla.split('_')[0])) mudosNuevos.push(`${s.nombre}/${p.wa_plantilla}`);
    }
  }
}
paso('Ninguna familia NUEVA se quedó sin respaldo', mudosNuevos.length === 0,
  mudosNuevos.join(', ') || `${cubiertos} pasos cubiertos · ${mudos} sin gemela, los ya sabidos (winback y crecimiento)`);
