/**
 * QA · «Si la de marketing falla, SIEMPRE sale una de utilidad».
 *
 * Recorre los pasos de WhatsApp de todas las secuencias activas y dice, para
 * cada uno, con qué respaldo se queda: el suyo, o el genérico. Falla si alguno
 * puede quedarse sin nada — que es lo que dejó sin mensaje a tres leads el 14
 * de septiembre.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const GENERICA = 'pendiente_retomar';

const { data: pls } = await sb.from('wa_plantillas').select('nombre, categoria, status, variables');
const porNombre = new Map((pls || []).map(p => [p.nombre, p]));
const { data: secs } = await sb.from('crm_secuencias').select('id, nombre, activa').eq('activa', true);
const { data: pasos } = await sb.from('crm_secuencia_pasos')
  .select('secuencia_id, orden, dia, canal, activo, wa_plantilla, wa_plantilla_utility, wa_plantilla_generica, wa_plantilla_generica_utility')
  .eq('canal', 'wa').eq('activo', true);

const gen = porNombre.get(GENERICA);
console.log(`  respaldo genérico «${GENERICA}»: ${gen ? `${gen.categoria} · ${gen.status} · ${gen.variables} variable(s)` : 'NO EXISTE'}`);
let malos = 0, revisados = 0;
for (const s of secs || []) {
  const mios = (pasos || []).filter(p => p.secuencia_id === s.id);
  if (!mios.length) continue;
  console.log(`\n  ${s.nombre}`);
  for (const p of mios) {
    for (const [cual, plan, util] of [['específica', p.wa_plantilla, p.wa_plantilla_utility], ['general', p.wa_plantilla_generica, p.wa_plantilla_generica_utility]]) {
      if (!plan) continue;
      revisados++;
      const pl = porNombre.get(plan);
      const u = util ? porNombre.get(util) : null;
      const efectivo = u?.status === 'APPROVED' ? util : GENERICA;
      const ok = efectivo === GENERICA ? gen?.status === 'APPROVED' : true;
      if (!ok) malos++;
      console.log(`    ${ok ? '✓' : '✗'} paso ${p.orden} (${cual}) · ${plan} [${pl?.categoria || '?'}/${pl?.status || 'no está en la base'}]`
        + ` → respaldo: ${efectivo}${efectivo === GENERICA ? ' (genérico)' : ''}`);
    }
  }
}
console.log(`\n  ${revisados} plantillas de secuencia revisadas · ${malos} sin respaldo posible`);
console.log(malos === 0 ? '  ✓ ninguna puede quedarse sin mensaje de respaldo' : '  ✗ hay pasos que pueden dejar al lead sin nada');
process.exit(malos === 0 ? 0 : 1);
