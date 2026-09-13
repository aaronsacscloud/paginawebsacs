// Verifica el MX de los correos `sin_probar` de un giro y marca el canal.
//
//   node scripts/abm-verificar-mx.mjs mayoristas          # marca valido / invalido
//   node scripts/abm-verificar-mx.mjs mayoristas --ver    # solo enseña, no toca la base
//
// Regla 5.1 del manual: MX obligatorio y NUNCA se corrige una dirección a
// mano. `gmail.con` no se convierte en `gmail.com`: se marca inválido y, si
// hace falta, se busca la dirección buena en otra fuente. Sin MX pero con
// registro A todavía puede recibir (RFC 5321), así que ese caso pasa.
import { promises as dns } from 'node:dns';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const giro = process.argv[2]; const soloVer = process.argv.includes('--ver');
if (!giro) { console.error('uso: node scripts/abm-verificar-mx.mjs <giro> [--ver]'); process.exit(1); }

const { data: cuentas } = await sb.from('abm_cuentas').select('id').eq('giro', giro).limit(5000);
const ids = (cuentas || []).map(c => c.id);
// Por tandas: con 634 cuentas (calzado) el `in(...)` completo pasa el largo de
// URL que acepta PostgREST y regresa vacío sin error, y el script decía
// «0 sin probar» con 636 correos sin verificar.
const canales = [];
for (let i = 0; i < ids.length; i += 150) {
  const { data, error } = await sb.from('abm_canales').select('id, cuenta_id, valor').in('cuenta_id', ids.slice(i, i + 150)).like('tipo', 'email%').eq('estado', 'sin_probar');
  if (error) { console.error('abm_canales:', error.message); process.exit(1); }
  canales.push(...(data || []));
}
const cache = new Map();
async function tieneMx(dom) {
  if (cache.has(dom)) return cache.get(dom);
  let ok = false;
  try { ok = (await dns.resolveMx(dom)).length > 0; }
  catch (e) { if (e?.code === 'ENODATA') { try { ok = (await dns.resolve4(dom)).length > 0; } catch { ok = false; } } }
  cache.set(dom, ok); return ok;
}
let validos = 0, invalidos = 0; const malos = [];
for (const k of canales || []) {
  const dom = String(k.valor || '').split('@')[1]?.toLowerCase();
  const forma = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(k.valor || ''));
  const ok = forma && dom && await tieneMx(dom);
  if (ok) validos++; else { invalidos++; malos.push(k.valor); }
  if (!soloVer) await sb.from('abm_canales').update({ estado: ok ? 'valido' : 'invalido', verificado_at: new Date().toISOString() }).eq('id', k.id);
}
console.log(`${giro}: ${(canales || []).length} sin probar → ${validos} válidos, ${invalidos} inválidos${soloVer ? ' (solo vista)' : ''}`);
if (malos.length) console.log('inválidos:', malos.join(', '));
