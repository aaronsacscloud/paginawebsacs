/**
 * Los que se quedaron sin mensaje: manda la plantilla de UTILIDAD a los leads
 * cuyo mensaje de marketing Meta no entregó y que no recibieron nada después.
 *
 *   node scripts/respaldo-recuperar.mjs              # solo dice a quién (no manda)
 *   node scripts/respaldo-recuperar.mjs --enviar     # manda de verdad
 *   node scripts/respaldo-recuperar.mjs --dias 3
 *
 * Es la red PARA LO YA PASADO. De aquí en adelante lo cubre solo la cadencia
 * (`leads-cadencia.ts` manda por `mandarPlantilla` con respaldo) y el webhook
 * de fallo (`respaldoPorFallo`).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const dias = Number(arg('dias', 2)) || 2;
const enviar = process.argv.includes('--enviar');
const PLANTILLA = 'pendiente_retomar', TEMA = 'tu solicitud con Sacs';

const desde = new Date(Date.now() - dias * 86400e3).toISOString();
const { data: fallidos } = await sb.from('wa_mensajes')
  .select('id, conversation_id, created_at, error, metadata, wa_conversaciones(telefono, contact_id, contacts(nombre))')
  .eq('status', 'failed').eq('direccion', 'saliente').gte('created_at', desde).order('created_at');

/* SOLO los fallos que una plantilla de utilidad SÍ arregla. El 131049 y el
   130472 son «Meta no le pasa marketing a este número»: por utilidad sí pasa.
   El 131026 («número no alcanzable») es otra cosa —ese número no existe en
   WhatsApp— y mandarle la utility es gastar un envío en el vacío. */
const RECUPERABLES = /13(1049|0472)/;
const pendientes = []; const vistos = new Set();
for (const m of fallidos || []) {
  const c = m.wa_conversaciones;
  if (!c?.telefono) continue;
  if (!RECUPERABLES.test(String(m.error || ''))) continue;
  // Un lead, un mensaje: el mismo número falló dos y tres veces en la misma noche.
  const clave = String(c.telefono).replace(/\D/g, '');
  if (vistos.has(clave)) continue; vistos.add(clave);
  // ¿Salió algo DESPUÉS? Entonces ya no está sin mensaje y no se le insiste.
  const { count } = await sb.from('wa_mensajes').select('id', { count: 'exact', head: true })
    .eq('conversation_id', m.conversation_id).eq('direccion', 'saliente')
    .gt('created_at', m.created_at).neq('status', 'failed');
  if (count) continue;
  pendientes.push({ id: m.id, tel: c.telefono, nombre: c.contacts?.nombre || null, cuando: m.created_at, err: String(m.error || '').slice(0, 50) });
}

console.log(`${pendientes.length} lead(s) sin mensaje tras un fallo recuperable en los últimos ${dias} día(s):`);
for (const p of pendientes) console.log(`  · ${p.nombre || 's/n'} ${p.tel} — ${p.cuando.slice(0, 16).replace('T', ' ')} · ${p.err}`);
if (!enviar) { console.log(`\n(nada enviado; corre con --enviar para mandarles «${PLANTILLA}»)`); process.exit(0); }

const { enviarPlantilla } = await import('../src/lib/whatsapp/kapso-api.ts').catch(() => ({}));
if (!enviarPlantilla) { console.log('No se pudo cargar el cliente de WhatsApp desde un script: mándalo desde el CRM o con el endpoint.'); process.exit(1); }
for (const p of pendientes) {
  const primer = String(p.nombre || '').trim().split(/\s+/)[0] || '👋';
  try {
    await enviarPlantilla(p.tel, PLANTILLA, 'es_MX', [primer, TEMA]);
    console.log(`  ✓ ${p.tel}`);
  } catch (e) { console.log(`  ✗ ${p.tel}: ${String(e?.message || e).slice(0, 80)}`); }
}
