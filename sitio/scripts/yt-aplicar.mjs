#!/usr/bin/env node
/**
 * Aplica títulos y descripciones nuevos a los videos del canal de YouTube.
 *
 * POR QUÉ ESTE SCRIPT EXISTE
 * La API de YouTube deja LEER con una llave simple (`GOOGLE_API_KEY_YT`), y de
 * ahí salió el catálogo. Pero `videos.update` exige OAuth con la cuenta que es
 * DUEÑA del canal: ni una llave de API ni una cuenta de servicio sirven. Google
 * lo rechaza con `youtubeSignupRequired` aunque la cuenta de servicio tenga
 * todos los permisos del proyecto. No es una restricción que se pueda rodear.
 *
 * QUÉ HACE FALTA, UNA SOLA VEZ
 *   1. Habilitar «YouTube Data API v3» en el proyecto sacs3-da4a6
 *   2. Credenciales → ID de cliente de OAuth → tipo **Aplicación web**
 *      URI de redirección autorizada:
 *        https://www.sacscloud.com/api/yt/oauth
 *   3. Copiar ID y secreto a `sitio/.env` (que NO se commitea):
 *        YT_OAUTH_CLIENT_ID=...apps.googleusercontent.com
 *        YT_OAUTH_CLIENT_SECRET=...
 *   4. node scripts/yt-aplicar.mjs --enlace   → imprime la URL a abrir
 *   5. Abrirla, ELEGIR EL CANAL @sacscloud, autorizar
 *   6. node scripts/yt-aplicar.mjs --canjear  → guarda el refresh token
 *
 * POR QUÉ APLICACIÓN WEB Y NO ESCRITORIO NI DISPOSITIVO
 * @sacscloud es una CUENTA DE MARCA, y a una cuenta de marca solo se llega por
 * el selector de canal de la pantalla de consentimiento web.
 *   · El flujo de dispositivo (google.com/device) NO tiene selector: autoriza
 *     con la cuenta personal de quien teclea el código. Se probó y el token
 *     salía válido, leía bien, y al escribir devolvía `forbidden`.
 *   · El de escritorio tampoco: Google retiró el pegado manual de códigos (OOB)
 *     y ahora exige escuchar en `127.0.0.1:PUERTO`, que sería el localhost de
 *     quien autoriza y no el del servidor.
 *
 * El sitio recibe el regreso en `/api/yt/oauth` y guarda SOLO el código de
 * autorización —minutos de vida, un solo uso, inútil sin el secreto—. El canje
 * por el refresh token se hace aquí, donde vive el secreto.
 *
 * CÓMO SE USA DESPUÉS
 *   node scripts/yt-aplicar.mjs --dry      ← enseña qué cambiaría, no toca nada
 *   node scripts/yt-aplicar.mjs            ← aplica
 *   node scripts/yt-aplicar.mjs --solo A   ← solo el grupo A
 *
 * SIEMPRE EN SECO PRIMERO. Un título es lo que la gente ya conoce del video, y
 * la API no guarda historial: si se pisa mal, no hay «deshacer». Por eso el
 * script escribe `scripts/yt-respaldo-<fecha>.json` con el estado ANTERIOR de
 * cada video que toca, antes de tocarlo.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const TOKEN = join(RAIZ, '.yt-token.json');
const CAMBIOS = join(AQUI, 'yt-cambios.json');

// ── .env sin dependencias ───────────────────────────────────────────────────
function env() {
  const f = join(RAIZ, '.env');
  const e = { ...process.env };
  if (existsSync(f)) {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  return e;
}
const E = env();
/* Lo leído se vuelca a `process.env` y no solo a `E`: este script importa el
   cliente de Supabase del repo, que lee del entorno. Sin esto había que
   acordarse de correrlo con `--env-file=.env`, y olvidarlo daba un error que no
   menciona ni el .env ni la bandera («supabaseUrl is required»). */
for (const [k, v] of Object.entries(E)) if (process.env[k] === undefined) process.env[k] = v;

const ID = E.YT_OAUTH_CLIENT_ID, SECRET = E.YT_OAUTH_CLIENT_SECRET;
const SCOPE = 'https://www.googleapis.com/auth/youtube';
const REDIR = 'https://www.sacscloud.com/api/yt/oauth';

const arg = (n) => process.argv.includes(n);
const valor = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };

// ── login: enlace y canje ───────────────────────────────────────────────────
function exigeCredenciales() {
  if (ID && SECRET) return;
  console.error('\nFaltan YT_OAUTH_CLIENT_ID y YT_OAUTH_CLIENT_SECRET en sitio/.env');
  console.error('Lee el encabezado de este archivo: son tres pasos en Google Cloud Console.\n');
  process.exit(1);
}

async function enlace() {
  exigeCredenciales();
  const { supabase } = await import('../src/lib/supabase.ts');

  /* El `state` es lo que ata esta petición a la respuesta que reciba el sitio.
     Sin él, la ruta pública aceptaría el código de cualquiera. */
  const state = randomBytes(24).toString('base64url');
  const { data } = await supabase.from('de_config').select('umbrales').eq('id', 1).maybeSingle();
  const u = { ...(data?.umbrales || {}) };
  u.yt_oauth = { state, hasta: new Date(Date.now() + 20 * 60 * 1000).toISOString() };
  const { error } = await supabase.from('de_config').update({ umbrales: u }).eq('id', 1);
  if (error) { console.error(`\nNo se pudo dejar la autorización pendiente: ${error.message}\n`); process.exit(1); }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', ID);
  url.searchParams.set('redirect_uri', REDIR);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('access_type', 'offline');
  /* `prompt=consent` obliga a Google a devolver refresh_token. Sin esto, una
     segunda autorización de la misma cuenta devuelve solo un access_token de
     una hora y el script se queda sin con qué renovar. */
  url.searchParams.set('prompt', 'consent select_account');

  console.log('\nAbre este enlace y ELIGE EL CANAL @sacscloud (no la cuenta personal):\n');
  console.log(url.toString());
  console.log('\nTienes 20 minutos. Al terminar corre:  node scripts/yt-aplicar.mjs --canjear\n');
}

async function canjear() {
  exigeCredenciales();
  const { supabase } = await import('../src/lib/supabase.ts');
  const { data } = await supabase.from('de_config').select('umbrales').eq('id', 1).maybeSingle();
  const pend = (data?.umbrales || {}).yt_oauth;

  if (!pend?.code) {
    console.error('\nNo hay ningún código esperando. ¿Ya abriste el enlace de --enlace y autorizaste?\n');
    process.exit(1);
  }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: pend.code, client_id: ID, client_secret: SECRET,
      redirect_uri: REDIR, grant_type: 'authorization_code',
    }),
  });
  const j = await r.json();

  /* El código se borra pase lo que pase: es de un solo uso, así que después de
     intentarlo ya no vale ni en caso de error. Dejarlo ahí solo haría creer que
     se puede reintentar. */
  const u = { ...(data?.umbrales || {}) };
  delete u.yt_oauth;
  await supabase.from('de_config').update({ umbrales: u }).eq('id', 1);

  if (!j.refresh_token) {
    console.error(`\nGoogle no dio refresh_token: ${JSON.stringify(j).slice(0, 300)}`);
    if (j.error === 'invalid_grant') console.error('El código ya se usó o venció. Vuelve a correr --enlace.');
    process.exit(1);
  }

  writeFileSync(TOKEN, JSON.stringify(j, null, 2), { mode: 0o600 });
  console.log(`\nToken guardado en ${TOKEN} (permisos 600, ignorado por git).`);

  // Comprobar CUÁL canal quedó autorizado: es el error que acabamos de cometer.
  const c = await (await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${j.access_token}` } })).json();
  const ch = c.items?.[0];
  if (!ch) {
    console.error('\nOJO: el token no administra NINGÚN canal. Se autorizó con la cuenta equivocada.');
    console.error('Vuelve a correr --enlace y elige @sacscloud en el selector de canal.\n');
    process.exit(1);
  }
  console.log(`Canal autorizado: ${ch.snippet.title} · ${ch.statistics.videoCount} videos`);
  console.log('\nAhora corre:  node scripts/yt-aplicar.mjs --dry\n');
}

async function accessToken() {
  if (!existsSync(TOKEN)) { console.error('\nNo hay sesión. Corre primero: node scripts/yt-aplicar.mjs --login\n'); process.exit(1); }
  const t = JSON.parse(readFileSync(TOKEN, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: t.refresh_token, client_id: ID, client_secret: SECRET, grant_type: 'refresh_token' }),
  });
  const j = await r.json();
  if (!j.access_token) { console.error('No se pudo refrescar el token:', JSON.stringify(j).slice(0, 300)); process.exit(1); }
  return j.access_token;
}

// ── aplicar ─────────────────────────────────────────────────────────────────
async function aplicar() {
  const seco = arg('--dry');
  const grupo = valor('--solo');
  let lista = JSON.parse(readFileSync(CAMBIOS, 'utf8'));
  if (grupo) lista = lista.filter(c => c.grupo === grupo);
  if (!lista.length) { console.log('No hay cambios que aplicar.'); return; }

  const tok = await accessToken();

  /* `videos.update` REEMPLAZA el `snippet` completo: si mandas solo el título,
     borras la descripción, las etiquetas y la categoría. Por eso hay que LEER
     cada video antes y reenviar el snippet entero con los campos cambiados.
     Es el error que convierte una mejora de títulos en una pérdida de datos. */
  const ids = lista.map(c => c.id);
  const actuales = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.slice(i, i + 50).join(',')}`,
      { headers: { Authorization: `Bearer ${tok}` } });
    const j = await r.json();
    if (j.error) { console.error('Error al leer:', j.error.message); process.exit(1); }
    for (const v of j.items || []) actuales.set(v.id, v.snippet);
  }

  const respaldo = [], hechos = [], fallos = [];
  for (const c of lista) {
    const s = actuales.get(c.id);
    if (!s) { fallos.push({ id: c.id, por: 'el video no existe o no es de este canal' }); continue; }
    respaldo.push({ id: c.id, title: s.title, description: s.description, tags: s.tags || [] });

    const nuevo = {
      ...s,
      title: (c.titulo || s.title).slice(0, 100),   // YouTube corta en 100
      description: (c.descripcion ?? s.description).slice(0, 4999),
      tags: c.etiquetas || s.tags || [],
    };

    if (seco) {
      console.log(`\n── ${c.id}  [${c.grupo}]`);
      if (c.titulo && c.titulo !== s.title) console.log(`   título   ANTES: ${s.title}\n            AHORA: ${c.titulo}`);
      if (c.descripcion) console.log(`   desc     ${s.description.trim().length} → ${c.descripcion.length} caracteres`);
      continue;
    }

    const r = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
      method: 'PUT', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, snippet: nuevo }),
    });
    const j = await r.json();
    if (j.error) fallos.push({ id: c.id, por: j.error.message });
    else { hechos.push(c.id); process.stdout.write('.'); }
    await new Promise(r => setTimeout(r, 250)); // la cuota es por unidad, no por segundo, pero no hay prisa
  }

  if (seco) { console.log(`\n\n${lista.length} videos cambiarían. Nada se tocó.`); return; }

  const f = join(AQUI, `yt-respaldo-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(f, JSON.stringify(respaldo, null, 2));
  console.log(`\n\n${hechos.length} actualizados · ${fallos.length} con error`);
  console.log(`Respaldo del estado anterior: ${f}`);
  for (const x of fallos) console.log(`  FALLÓ ${x.id}: ${x.por}`);
}

if (arg('--enlace')) await enlace();
else if (arg('--canjear')) await canjear();
else await aplicar();
