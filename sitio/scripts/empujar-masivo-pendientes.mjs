// EMPUJAR LOS PENDIENTES DE UN MASIVO · cuando Kapso se queda a medias.
//
// Un broadcast «sending» que deja de avanzar no se puede cancelar (Kapso solo cancela los
// programados), así que los que faltan se mandan uno por uno con el mismo mensaje y la misma
// plantilla. Relee los destinatarios ANTES de cada envío para no duplicar si Kapso despertó.
//
//   KAPSO_API_KEY=… node scripts/empujar-masivo-pendientes.mjs --broadcast=<id> --linea=<phone_number_id> [--dry] [--max=N]
const arg = (n, d = null) => { const m = process.argv.slice(2).find(a => a.startsWith(`--${n}`)); return m ? (m.includes('=') ? m.split('=').slice(1).join('=') : '1') : d; };
const BC = arg('broadcast'), LINEA = arg('linea'), DRY = !!arg('dry'), MAX = Number(arg('max') || 500);
const KEY = process.env.KAPSO_API_KEY;
if (!BC || !LINEA || !KEY) { console.error('Faltan --broadcast, --linea o KAPSO_API_KEY'); process.exit(1); }
const PLAT = 'https://api.kapso.ai/platform/v1', META = 'https://api.kapso.ai/meta/whatsapp/v24.0';
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const api = async (url, init) => {
  const r = await fetch(url, { ...init, headers: { 'X-API-Key': KEY, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
  return j?.data !== undefined ? j.data : j;
};

const b = await api(`${PLAT}/whatsapp/broadcasts/${BC}`);
const plantilla = b.whatsapp_template;
console.log(`masivo «${b.name}» · ${b.status} · ${b.sent_count}/${b.total_recipients} enviados · plantilla ${plantilla?.name}`);

const pendientes = [];
for (let page = 1; page < 40; page++) {
  const r = await api(`${PLAT}/whatsapp/broadcasts/${BC}/recipients?page=${page}&per_page=100`);
  const items = Array.isArray(r) ? r : (r?.recipients || []);
  if (!items.length) break;
  for (const x of items) if (x.status === 'pending') pendientes.push(x);
}
console.log(`${pendientes.length} pendientes${DRY ? ' · SIMULACIÓN' : ''}`);

let ok = 0, mal = 0;
for (const p of pendientes.slice(0, MAX)) {
  const nombre = p.template_components?.[0]?.parameters?.[0]?.text || 'Hola';
  if (DRY) { console.log('  (simulado)', p.phone_number, '·', nombre); ok++; continue; }
  try {
    await api(`${META}/${LINEA}/messages`, { method: 'POST', body: JSON.stringify({
      messaging_product: 'whatsapp', to: p.phone_number, type: 'template',
      template: { name: plantilla.name, language: { code: plantilla.language || 'es_MX' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: nombre }] }] },
    }) });
    ok++; process.stdout.write('.');
  } catch (e) { mal++; console.log('\n  ✗', p.phone_number, String(e.message).slice(0, 110)); }
  await dormir(1200);   // ritmo humano: Meta castiga las ráfagas de plantillas en un número nuevo
}
console.log(`\nmandados ${ok} · fallidos ${mal}`);
