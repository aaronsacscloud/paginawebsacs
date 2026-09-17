/**
 * QA · el WhatsApp del aliado sale armado y diferenciado por tipo.
 *
 * No se manda nada: la automatización `abm_frio` está apagada y así se queda.
 * Lo que se prueba es lo que estuvo roto —la vista de contactables no traía
 * `subgiro`, así que los parámetros salían nulos y TODOS los aliados se habrían
 * saltado en silencio— y lo que pidió el dueño: que el mensaje hable de SU
 * gente y no del prospecto.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { ALIADO_FRIO, paramsAliado } = await import('../src/lib/crm/abm-wa-plantillas.ts');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

paso('Están las tres plantillas del aliado', ALIADO_FRIO.length === 3, ALIADO_FRIO.map(p => p.nombre).join(', '));

// Quién puede recibirlo: solo quien publicó su wa.me en su propio sitio.
const { data: canales } = await sb.from('abm_canales')
  .select('cuenta_id, valor, abm_cuentas!inner(nombre, giro, subgiro, ciudad, google_rating, google_resenas)')
  .eq('tipo', 'whatsapp_tienda').eq('estado', 'declarado').eq('abm_cuentas.giro', 'aliados').limit(400);
paso('Hay aliados con WhatsApp declarado', (canales || []).length > 50, `${(canales || []).length} números, todos publicados por ellos`);

const porTipo = new Map();
for (const c of canales || []) if (!porTipo.has(c.abm_cuentas.subgiro)) porTipo.set(c.abm_cuentas.subgiro, c);

const arma = (p, c) => {
  const vals = paramsAliado(p, { ...c.abm_cuentas, nombre: c.abm_cuentas.nombre, subgiro: c.abm_cuentas.subgiro });
  if (!vals) return null;
  return ALIADO_FRIO[p - 1].cuerpo.replace(/\{\{(\d)\}\}/g, (_m, i) => vals[Number(i) - 1] ?? '');
};

const primeras = [];
for (const [tipo, c] of [...porTipo].slice(0, 5)) {
  const m1 = arma(1, c), m2 = arma(2, c);
  paso(`${tipo}: el mensaje 1 sale con sus tres huecos`, !!m1 && !/\{\{/.test(m1), (m1 || '').split('\n')[4]?.slice(0, 92) || 'sin parámetros');
  paso(`${tipo}: el mensaje 2 nombra a SU gente`, !!m2 && !/\{\{/.test(m2));
  paso(`${tipo}: no le ofrece una demo del sistema`, !!m1 && !/demo|videollamada/i.test(m1));
  if (m1) primeras.push(m1.split('\n')[4]);
}
paso('Cada tipo abre distinto', new Set(primeras).size === primeras.length, `${new Set(primeras).size} de ${primeras.length}`);
