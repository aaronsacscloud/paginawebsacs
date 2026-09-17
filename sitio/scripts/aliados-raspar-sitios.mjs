/**
 * Saca del SITIO PROPIO de cada aliado su correo y su WhatsApp.
 *
 * Es la cascada del manual (§4.2) aplicada a los aliados: Maps dio quién es y
 * el sitio; el sitio da cómo llegarle. Y el WhatsApp entra con la regla §6 bis
 * puesta desde el principio: se guarda como `whatsapp_tienda` en estado
 * `declarado` SOLO porque el negocio lo publicó ÉL en su página. Un número que
 * nadie declaró no se puede trabajar por WhatsApp, y hay un trigger que lo
 * impide aunque alguien se equivoque.
 *
 *   node scripts/aliados-raspar-sitios.mjs            # dice a cuántos les falta
 *   node scripts/aliados-raspar-sitios.mjs --correr   # raspa y guarda
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const correr = process.argv.includes('--correr');
const TOPE = Number(process.env.TOPE || 400);

const { data: cuentas } = await sb.from('abm_cuentas')
  .select('id, nombre, sitio, subgiro').eq('giro', 'aliados').not('sitio', 'is', null).limit(1000);
const { data: yaCanales } = await sb.from('abm_canales')
  .select('cuenta_id, tipo').in('cuenta_id', (cuentas || []).map(c => c.id));
const conCorreo = new Set((yaCanales || []).filter(c => c.tipo.startsWith('email')).map(c => c.cuenta_id));
const conWa = new Set((yaCanales || []).filter(c => c.tipo.startsWith('whatsapp')).map(c => c.cuenta_id));
const faltan = (cuentas || []).filter(c => !conCorreo.has(c.id) || !conWa.has(c.id)).slice(0, TOPE);

console.log(`Aliados con sitio: ${(cuentas || []).length} · ya con correo: ${conCorreo.size} · ya con WhatsApp: ${conWa.size}`);
console.log(`Por raspar ahora: ${faltan.length}`);
if (!correr) { console.log('\n(nada raspado; corre con --correr)'); process.exit(0); }

writeFileSync('/tmp/aliados-entrada.json', JSON.stringify(faltan.map(c => ({ id: c.id, nombre: c.nombre, sitio: c.sitio }))));
execFileSync('python3', [new URL('./abm-raspar-sitios.py', import.meta.url).pathname,
  '/tmp/aliados-entrada.json', '/tmp/aliados-salida.json'], { stdio: 'inherit' });

const res = JSON.parse(readFileSync('/tmp/aliados-salida.json', 'utf8'));
let nCorreo = 0, nWa = 0, nCaido = 0;
for (const r of res) {
  if (r.sitio_vivo === false) nCaido++;
  if (r.correo && !conCorreo.has(r.id)) {
    const propio = String(r.correo).split('@')[1] && String(r.sitio || '').includes(String(r.correo).split('@')[1]);
    const { error } = await sb.from('abm_canales').insert({
      cuenta_id: r.id, tipo: propio ? 'email_direccion' : 'email_generico', valor: r.correo,
      confianza: propio ? 'alta' : 'media', es_de_la_tienda: true, estado: 'sin_probar',
    });
    if (!error) nCorreo++;
  }
  /* §6 bis: `declarado` porque salió de SU PROPIO SITIO. Es la única puerta
     que abre el WhatsApp en frío; un número de Maps o del censo no la abre. */
  if (r.whatsapp && !conWa.has(r.id)) {
    const { error } = await sb.from('abm_canales').insert({
      cuenta_id: r.id, tipo: 'whatsapp_tienda', valor: String(r.whatsapp).replace(/\D/g, ''),
      confianza: 'alta', es_de_la_tienda: true, estado: 'declarado',
    });
    if (!error) nWa++;
  }
}
console.log(`\nGuardado: ${nCorreo} correos · ${nWa} WhatsApp declarados · ${nCaido} sitios caídos`);
