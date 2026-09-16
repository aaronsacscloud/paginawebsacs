/**
 * QA · el correo del aliado abre por su TIPO, y abre aunque la IA no esté.
 *
 * Regla del dueño (16-sep-2026): «los que venden talleres son unos y los que
 * venden insumos no les interesa nada de clases». Se comprueba con cuentas
 * reales de la base: el mismo arco (referidor) tiene que producir aperturas
 * DISTINTAS para un taller, un contador, uno de bordado y uno de insumos.
 *
 * Y se comprueba lo otro, que es lo que estuvo a punto de salir mal: sin IA el
 * texto base se rellena igual, porque la apertura es una variable y no una
 * instrucción. Ni un `{{hueco}}` ni un `[[marcador]]` en el resultado.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { variablesDe, rellenar } = await import('../src/lib/crm/abm.lib.ts');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

const TIPOS = ['taller', 'contador', 'bordado', 'insumos_tienda'];
const { data: plantillas } = await sb.from('abm_plantillas')
  .select('ruta, orden, asunto, cuerpo').eq('giro', 'aliados').order('ruta').order('orden');
paso('Están las 28 plantillas de los cuatro arcos', (plantillas || []).length === 28, `${(plantillas || []).length} plantillas`);

const aperturas = new Map();
for (const t of TIPOS) {
  const { data: cuentas } = await sb.from('abm_cuentas')
    .select('*').eq('giro', 'aliados').eq('subgiro', t).limit(1);
  const c = (cuentas || [])[0];
  if (!c) { paso(`Hay una cuenta de ${t} para probar`, false); continue; }
  const vars = variablesDe(c, null);
  const p1 = (plantillas || []).find(p => p.ruta === (c.ruta || 'referidor') && p.orden === 1);
  const p2 = (plantillas || []).find(p => p.ruta === (c.ruta || 'referidor') && p.orden === 2);
  const c1 = rellenar(p1.cuerpo, vars), c2 = rellenar(p2.cuerpo, vars);
  aperturas.set(t, c1.split('\n')[0]);
  paso(`${t}: sin IA el correo 1 sale completo`, !/\{\{|\[\[/.test(c1) && c1.length > 200,
    c1.split('\n')[0].slice(0, 96));
  paso(`${t}: el correo 2 nombra a SU gente y SU problema`, !/\{\{|\[\[/.test(c2) && c2.includes(vars.su_gente),
    c2.split('\n')[1]?.slice(0, 96) || '');
  paso(`${t}: no le habla de alumnas ni de clases`, !/alumna|clase|programa/i.test(c1 + c2),
    t === 'escuela_moda' ? '(la escuela sí puede)' : '');
}

const distintas = new Set([...aperturas.values()]);
paso('Las cuatro aperturas son distintas entre sí', distintas.size === aperturas.size,
  `${distintas.size} aperturas distintas de ${aperturas.size} tipos`);
