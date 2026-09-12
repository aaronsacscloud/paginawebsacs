// CLONAR LAS PLANTILLAS A OTRA WABA (12-sep-2026, mudanza al +52 55 9302 7234).
//
// Las plantillas viven en la cuenta de WhatsApp (WABA), no en el número: al cambiar de
// WABA no se heredan, hay que volver a crearlas y que Meta las apruebe. Este script las
// lee de `wa_plantillas` (nuestro espejo) y las crea en la WABA destino por el passthrough
// de Kapso, respetando header, cuerpo, pie, botones y ejemplos.
//
// Por omisión clona solo LAS QUE IMPORTAN —las que se han usado alguna vez y las que el
// sistema nombra en su configuración—, porque mandarle a Meta 89 plantillas de golpe es
// ruido y arriesga la calidad de una WABA recién nacida. Con `--todas` van todas.
//
//   KAPSO_API_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_KEY=… \
//     node scripts/clonar-plantillas-waba.mjs --waba=1378915814450489 [--todas] [--solo=nombre1,nombre2] [--dry]
const arg = (n, d = null) => { const m = process.argv.slice(2).find(a => a.startsWith(`--${n}`)); return m ? (m.includes('=') ? m.split('=').slice(1).join('=') : '1') : d; };
const WABA = arg('waba');
const TODAS = !!arg('todas');
const DRY = !!arg('dry');
const SOLO = (arg('solo') || '').split(',').map(s => s.trim()).filter(Boolean);
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, KAPSO_API_KEY } = process.env;
if (!WABA || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !KAPSO_API_KEY) {
  console.error('Faltan --waba, SUPABASE_URL, SUPABASE_SERVICE_KEY o KAPSO_API_KEY');
  process.exit(1);
}
const META = 'https://api.kapso.ai/meta/whatsapp/v24.0';
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

const sb = async (ruta) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } });
  if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

/** Los componentes como los quiere Meta. Los ejemplos son obligatorios si hay variables. */
function componentes(p) {
  const c = [];
  if (p.header) c.push({ type: 'HEADER', format: p.header_tipo || 'TEXT', text: p.header });
  else if (p.header_tipo && p.header_tipo !== 'TEXT') {
    /* Un encabezado de archivo (documento, imagen, video) exige un EJEMPLO: Meta quiere ver el
       tipo de archivo que va a viajar. El `header_handle` que tenemos es de la WABA vieja —los
       handles no cruzan de cuenta—, así que si no hay uno nuevo se avisa y se salta. */
    const h = p.header_handle_nuevo || p.header_handle;
    c.push(h ? { type: 'HEADER', format: p.header_tipo, example: { header_handle: [h] } } : { type: 'HEADER', format: p.header_tipo });
  }
  const cuerpo = { type: 'BODY', text: p.cuerpo };
  const ej = Array.isArray(p.ejemplos) ? p.ejemplos.filter(Boolean) : [];
  const vars = Number(p.variables || 0);
  if (vars > 0) cuerpo.example = { body_text: [Array.from({ length: vars }, (_, i) => String(ej[i] ?? 'Ejemplo'))] };
  c.push(cuerpo);
  if (p.footer) c.push({ type: 'FOOTER', text: p.footer });
  const botones = Array.isArray(p.botones) ? p.botones : [];
  if (botones.length) {
    c.push({
      type: 'BUTTONS',
      buttons: botones.map(b => b.tipo === 'URL' ? { type: 'URL', text: b.texto, url: b.url }
        : b.tipo === 'PHONE_NUMBER' ? { type: 'PHONE_NUMBER', text: b.texto, phone_number: b.telefono }
        : { type: 'QUICK_REPLY', text: b.texto }),
    });
  }
  return c;
}

const main = async () => {
  const [plantillas, config] = await Promise.all([
    sb('wa_plantillas?select=nombre,idioma,categoria,cuerpo,header,header_tipo,header_handle,header_media_url,footer,botones,ejemplos,variables,usos,ultimo_uso_at&order=usos.desc.nullslast'),
    sb('wa_config?select=*&id=eq.1').then(r => r[0] || {}),
  ]);
  // Las que el sistema nombra en su configuración tienen que existir aunque nunca se hayan usado.
  const nombradas = new Set(['reunion_confirmar', config.bienvenida_tiktok_plantilla, config.migracion_plantilla,
    config.llamadas_regla_plantilla, config.minuta_envio_plantilla_doc, config.minuta_envio_plantilla_aviso].filter(Boolean));
  const elegidas = plantillas.filter(p => SOLO.length ? SOLO.includes(p.nombre) : TODAS || Number(p.usos || 0) > 0 || nombradas.has(p.nombre));

  const yaEstan = new Set();
  try {
    const r = await fetch(`${META}/${WABA}/message_templates?limit=200`, { headers: { 'X-API-Key': KAPSO_API_KEY } });
    for (const t of (await r.json())?.data || []) yaEstan.add(`${t.name}|${t.language}`);
  } catch { /* si no se puede listar, se intenta crear y Meta dirá si ya existe */ }

  console.log(`${plantillas.length} en el espejo · ${elegidas.length} a clonar · ${yaEstan.size} ya existen en la WABA destino${DRY ? ' · SIMULACIÓN' : ''}`);
  const salida = { creadas: [], saltadas: [], fallidas: [] };
  for (const p of elegidas) {
    const clave = `${p.nombre}|${p.idioma}`;
    if (yaEstan.has(clave)) { salida.saltadas.push(p.nombre); continue; }
    const cuerpo = { name: p.nombre, language: p.idioma || 'es_MX', category: p.categoria || 'MARKETING', components: componentes(p) };
    if (DRY) { console.log('  (simulado)', p.nombre, JSON.stringify(cuerpo).length, 'bytes'); salida.creadas.push(p.nombre); continue; }
    try {
      const r = await fetch(`${META}/${WABA}/message_templates`, {
        method: 'POST', headers: { 'X-API-Key': KAPSO_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) { salida.fallidas.push([p.nombre, j?.error?.error_user_msg || j?.error?.message || `HTTP ${r.status}`]); }
      else { salida.creadas.push(p.nombre); console.log('  ✓', p.nombre, '→', j?.status || 'PENDING'); }
    } catch (e) { salida.fallidas.push([p.nombre, e.message]); }
    await dormir(700);   // Meta limita la creación: sin pausa devuelve 429 y marca la WABA
  }
  console.log(`\ncreadas ${salida.creadas.length} · ya estaban ${salida.saltadas.length} · fallidas ${salida.fallidas.length}`);
  for (const [n, e] of salida.fallidas) console.log('  ✗', n, '·', String(e).slice(0, 120));
};
main().catch(e => { console.error(e.message); process.exit(1); });
