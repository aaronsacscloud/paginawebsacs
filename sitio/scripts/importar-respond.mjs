/**
 * IMPORTAR EL HISTORIAL DE RESPOND.IO AL INBOX.
 *
 * Se corre con los CSV que da respond.io en Workspace Settings → Data Export:
 *   node scripts/importar-respond.mjs --mensajes <csv> --contactos <csv> [--aplicar]
 *
 * Sin `--aplicar` no escribe nada: solo dice qué haría. Es la forma de mirar
 * antes de tocar 35 000 mensajes de clientes reales.
 *
 * ── POR QUÉ ESTE GUION Y NO UN INSERT A MANO ──────────────────────────────
 *
 * 1. DEDUP REAL. Cada mensaje entra con `kapso_message_id = respondio:<id>` y
 *    esa columna tiene restricción de unicidad. Así que correrlo dos veces, o
 *    con un export que se solape con lo ya importado, es inofensivo: lo que ya
 *    está se salta. Medido antes de empezar: 0 duplicados en la tabla.
 *
 * 2. LOS ADJUNTOS SE RESCATAN. En el CSV los archivos son URLs del CDN de
 *    respond.io (cdn.chatapi.net). Hoy responden; el día que se cancele la
 *    cuenta, mueren — y con ellos los comprobantes de pago, las fotos de
 *    producto y las notas de voz de los clientes. Cada archivo se BAJA y se
 *    guarda en nuestro bucket, y el mensaje apunta a nuestra copia. Es la
 *    parte que no se puede repetir después.
 *
 * 3. EL TELÉFONO NO VIENE EN EL CSV DE MENSAJES. Solo el `Contact ID`, así que
 *    hay que cruzarlo con el CSV de contactos. Sin ese cruce, un mensaje no se
 *    puede colgar de ninguna conversación.
 *
 * 4. ENTRA COMO HISTORIA, NO COMO NOVEDAD. Ni no-leídos, ni campana, ni
 *    automatizaciones, ni ventana de 24 h: importar 1 000 mensajes viejos no
 *    puede disparar mil avisos ni despertar al agente.
 */
import fs from 'node:fs';
import path from 'node:path';

// ── Configuración ─────────────────────────────────────────────────────────
const RAIZ = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(RAIZ, '.env'), 'utf8')
  .split('\n').filter(l => /^\w+=/.test(l))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }));
const SB = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) { console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en sitio/.env'); process.exit(1); }
const BUCKET = 'wa-media';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
const APLICAR = process.argv.includes('--aplicar');
const RUTA_MSJ = arg('mensajes');
const RUTA_CON = arg('contactos');
if (!RUTA_MSJ || !RUTA_CON) {
  console.error('Uso: node scripts/importar-respond.mjs --mensajes <csv> --contactos <csv> [--aplicar]');
  process.exit(1);
}

// ── Supabase por REST ─────────────────────────────────────────────────────
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sel = (tabla, query) => fetch(`${SB}/rest/v1/${tabla}?${query}`, { headers: H }).then(r => r.json());
const ins = async (tabla, filas, opts = '') => {
  const r = await fetch(`${SB}/rest/v1/${tabla}${opts}`, {
    method: 'POST', headers: { ...H, Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify(filas),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${tabla}: ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : [];
};
const upd = async (tabla, query, cambios) => {
  const r = await fetch(`${SB}/rest/v1/${tabla}?${query}`, { method: 'PATCH', headers: H, body: JSON.stringify(cambios) });
  if (!r.ok) throw new Error(`${tabla} patch: ${r.status} ${(await r.text()).slice(0, 200)}`);
};

/* CSV con comillas: el campo Content trae saltos de línea DENTRO, así que
   partir por '\n' parte las filas a la mitad. */
function leerCSV(ruta) {
  const t = fs.readFileSync(ruta, 'utf8');
  const filas = []; let campo = '', fila = [], enComillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enComillas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else enComillas = false; }
      else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); if (fila.some(x => x !== '')) filas.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || fila.length) { fila.push(campo); if (fila.some(x => x !== '')) filas.push(fila); }
  const cab = filas.shift();
  return filas.map(f => Object.fromEntries(cab.map((k, i) => [k, f[i] ?? ''])));
}

const norm = (t) => String(t || '').replace(/\D/g, '');
const diez = (t) => norm(t).slice(-10);
const e164 = (t) => { const d = norm(t); return d ? `+${d}` : null; };

/** El `Content` de respond.io es JSON: se traduce a nuestro modelo. */
function traducir(m) {
  let c = {};
  try { c = JSON.parse(m.Content || '{}'); } catch { c = { type: 'text', text: m.Content || '' }; }
  const tipoRes = String(m['Content Type'] || c.type || 'text');

  if (tipoRes === 'attachment' && c.attachment) {
    const a = c.attachment;
    const clase = String(a.type || '').toLowerCase();
    return {
      tipo: clase === 'audio' ? 'audio' : clase === 'image' ? 'image' : clase === 'video' ? 'video' : 'document',
      cuerpo: a.caption || null,
      url: a.url || null,
      mime: (a.mimeType || '').split(';')[0] || null,
      filename: a.fileName || null,
    };
  }
  if (tipoRes === 'whatsapp_template') {
    // La plantilla se guarda como texto: es lo que el cliente vio.
    return { tipo: 'template', cuerpo: c.text || c.body || m['Sub Type'] || '[plantilla]', url: null, mime: null, filename: null };
  }
  if (tipoRes === 'sticker') return { tipo: 'sticker', cuerpo: null, url: c.attachment?.url || null, mime: null, filename: null };
  if (tipoRes === 'contact') return { tipo: 'text', cuerpo: `[contacto compartido] ${c.text || ''}`.trim(), url: null, mime: null, filename: null };
  if (tipoRes === 'unsupported') return { tipo: 'text', cuerpo: '[mensaje no soportado por WhatsApp]', url: null, mime: null, filename: null };
  return { tipo: 'text', cuerpo: c.text ?? c.body ?? '', url: null, mime: null, filename: null };
}

/** Baja el archivo del CDN de respond.io y lo guarda en nuestro bucket. */
async function rescatarArchivo(url, nombre) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`CDN ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const mime = (r.headers.get('content-type') || 'application/octet-stream').split(';')[0];
  const limpio = String(nombre || url.split('/').pop() || 'archivo').replace(/[^\w.\-]+/g, '_').slice(-70);
  const ruta = `respond/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${limpio}`;
  const up = await fetch(`${SB}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': mime, 'x-upsert': 'true' }, body: buf,
  });
  if (!up.ok) throw new Error(`storage ${up.status}`);
  return { url: `${SB}/storage/v1/object/public/${BUCKET}/${ruta}`, mime, bytes: buf.length };
}

// ══ Aquí empieza el trabajo ════════════════════════════════════════════════
const msjs = leerCSV(RUTA_MSJ);
const conts = leerCSV(RUTA_CON);
console.log(`CSV: ${msjs.length} mensajes · ${conts.length} contactos`);
console.log(APLICAR ? '⚠ MODO APLICAR: se va a escribir en la base.\n' : 'Modo revisión (sin escribir). Agrega --aplicar para hacerlo.\n');

// Contact ID → teléfono y nombre
const porId = new Map();
for (const c of conts) if (diez(c.PhoneNumber).length === 10) porId.set(String(c.ContactID), c);

// Qué mensajes ya están
const ids = [...new Set(msjs.map(m => m['Message ID']).filter(Boolean))];
const yaEstan = new Set();
for (let i = 0; i < ids.length; i += 300) {
  const lista = ids.slice(i, i + 300).map(x => `respondio:${x}`).join(',');
  const r = await sel('wa_mensajes', `kapso_message_id=in.(${encodeURIComponent(lista)})&select=kapso_message_id`);
  (Array.isArray(r) ? r : []).forEach(x => yaEstan.add(String(x.kapso_message_id).replace('respondio:', '')));
}

const pendientes = msjs
  .filter(m => m['Message ID'] && !yaEstan.has(m['Message ID']))
  .sort((a, b) => String(a['Date & Time']).localeCompare(String(b['Date & Time'])));

const sinTelefono = pendientes.filter(m => !porId.has(String(m['Contact ID'])));
const listos = pendientes.filter(m => porId.has(String(m['Contact ID'])));
console.log(`Ya en el inbox: ${msjs.length - pendientes.length}`);
console.log(`Por importar:   ${listos.length}`);
if (sinTelefono.length) console.log(`Sin teléfono en el CSV de contactos (se saltan): ${sinTelefono.length}`);
const conArchivo = listos.filter(m => traducir(m).url).length;
console.log(`De esos, con archivo que hay que rescatar del CDN: ${conArchivo}`);
const tels = new Set(listos.map(m => diez(porId.get(String(m['Contact ID'])).PhoneNumber)));
console.log(`Conversaciones que toca: ${tels.size}\n`);

if (!APLICAR) {
  console.log('Ejemplos de lo que entraría:');
  listos.slice(-6).forEach(m => {
    const c = porId.get(String(m['Contact ID'])); const t = traducir(m);
    console.log(`  ${m['Date & Time']} ${m['Message Type'] === 'incoming' ? '←' : '→'} ${(c.FirstName + ' ' + c.LastName).trim().slice(0, 20).padEnd(20)} [${t.tipo}] ${String(t.cuerpo || t.filename || '').replace(/\n/g, ' ').slice(0, 58)}`);
  });
  process.exit(0);
}

// ── Conversaciones: se buscan por teléfono, y si no hay se crean ──────────
const convPorTel = new Map();
for (const tel of tels) {
  const r = await sel('wa_conversaciones', `telefono=like.*${tel}&select=id,telefono&limit=1`);
  if (Array.isArray(r) && r[0]) { convPorTel.set(tel, r[0].id); continue; }
  const c = [...porId.values()].find(x => diez(x.PhoneNumber) === tel);
  // Contacto primero (si no existe), para que la conversación quede ligada.
  let contactId = null;
  const ex = await sel('contacts', `whatsapp=like.*${tel}&select=id&limit=1`);
  if (Array.isArray(ex) && ex[0]) contactId = ex[0].id;
  else {
    const nuevo = await ins('contacts', [{
      nombre: (c?.FirstName || '').trim() || e164(c?.PhoneNumber) || 'Sin nombre',
      apellido: (c?.LastName || '').trim() || null,
      whatsapp: e164(c?.PhoneNumber), email: (c?.Email || '').trim() || null,
      fuente: 'respond.io', propiedades: { respond_io: { contact_id: c?.ContactID, tags: c?.Tags || null, lifecycle: c?.Lifecycle || null } },
    }]);
    contactId = nuevo?.[0]?.id || null;
  }
  /* El estado sale de los DATOS, no de una suposición. Marcar todo como
     «resuelta» escondería del inbox conversaciones que de verdad esperan
     respuesta: en este export hay gente que escribió HOY y nadie lo ha visto
     porque su mensaje se quedó en respond.io. Si lo último que hay es del
     cliente, la conversación está abierta. */
  const ultimoDelCliente = listos
    .filter(x => diez(porId.get(String(x['Contact ID']))?.PhoneNumber) === tel)
    .sort((a, b) => String(a['Date & Time']).localeCompare(String(b['Date & Time'])))
    .at(-1)?.['Message Type'] === 'incoming';
  const cv = await ins('wa_conversaciones', [{
    telefono: e164(c?.PhoneNumber), contact_id: contactId, estado: 'active',
    estado_crm: ultimoDelCliente ? 'abierta' : 'resuelta',
  }]);
  if (cv?.[0]?.id) convPorTel.set(tel, cv[0].id);
}

// ── Los mensajes, en tandas ───────────────────────────────────────────────
let puestos = 0, archivos = 0, fallos = 0;
for (const m of listos) {
  const c = porId.get(String(m['Contact ID']));
  const tel = diez(c.PhoneNumber);
  const convId = convPorTel.get(tel);
  if (!convId) { fallos++; continue; }
  const t = traducir(m);
  let mediaUrl = null;
  if (t.url) {
    try { const g = await rescatarArchivo(t.url, t.filename); mediaUrl = g.url; archivos++; }
    catch (e) { mediaUrl = null; console.warn(`  archivo perdido (${m['Message ID']}): ${e.message}`); }
  }
  const entrante = m['Message Type'] === 'incoming';
  try {
    await ins('wa_mensajes', [{
      conversation_id: convId,
      kapso_message_id: `respondio:${m['Message ID']}`,
      direccion: entrante ? 'entrante' : 'saliente',
      tipo: t.tipo, cuerpo: t.cuerpo || null,
      media_url: mediaUrl, mime: t.mime, filename: t.filename,
      status: entrante ? 'received' : 'delivered',
      autor: entrante ? null : 'Equipo (respond.io)',
      enviado_at: new Date(m['Date & Time'].replace(' ', 'T') + 'Z').toISOString(),
      created_at: new Date(m['Date & Time'].replace(' ', 'T') + 'Z').toISOString(),
      metadata: { origen: 'respond.io', canal: m['Channel ID'] || null, tipo_original: m['Content Type'] || null, plantilla: m['Sub Type'] || null, importado: new Date().toISOString() },
    }]);
    puestos++;
    if (puestos % 100 === 0) console.log(`  ${puestos}/${listos.length}…`);
  } catch (e) { fallos++; console.warn(`  no entró ${m['Message ID']}: ${e.message.slice(0, 120)}`); }
}

// ── El «último mensaje» de cada conversación se recalcula desde los datos ──
for (const [, convId] of convPorTel) {
  const u = await sel('wa_mensajes', `conversation_id=eq.${convId}&tipo=neq.reaction&select=cuerpo,transcript,tipo,direccion,enviado_at,created_at&order=enviado_at.desc.nullslast&limit=1`);
  const x = Array.isArray(u) ? u[0] : null;
  if (x) await upd('wa_conversaciones', `id=eq.${convId}`, {
    ultimo_mensaje_at: x.enviado_at || x.created_at,
    ultimo_mensaje_texto: String(x.cuerpo || x.transcript || `[${x.tipo}]`).slice(0, 200),
    ultima_direccion: x.direccion,
  });
}

console.log(`\nListo: ${puestos} mensajes · ${archivos} archivos rescatados del CDN · ${fallos} fallos`);
