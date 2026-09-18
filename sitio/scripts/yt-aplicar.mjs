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
 *   1. console.cloud.google.com → el proyecto donde vive GOOGLE_API_KEY_YT
 *   2. APIs y servicios → Biblioteca → habilitar «YouTube Data API v3»
 *   3. Credenciales → Crear credenciales → ID de cliente de OAuth
 *      Tipo de aplicación: **Aplicación de escritorio**
 *   4. Copiar el ID y el secreto a `sitio/.env` (que NO se commitea):
 *        YT_OAUTH_CLIENT_ID=...apps.googleusercontent.com
 *        YT_OAUTH_CLIENT_SECRET=...
 *   5. Correr:  node scripts/yt-aplicar.mjs --login
 *      Imprime un enlace, se abre en el navegador con la cuenta DUEÑA del
 *      canal, se autoriza y se pega el código de vuelta. El refresh token
 *      queda en `.yt-token.json` (gitignored) y ya no hay que repetirlo.
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
import { createInterface } from 'node:readline/promises';
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
const ID = E.YT_OAUTH_CLIENT_ID, SECRET = E.YT_OAUTH_CLIENT_SECRET;
const SCOPE = 'https://www.googleapis.com/auth/youtube';

const arg = (n) => process.argv.includes(n);
const valor = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };

// ── login ───────────────────────────────────────────────────────────────────
async function login() {
  if (!ID || !SECRET) {
    console.error('\nFaltan YT_OAUTH_CLIENT_ID y YT_OAUTH_CLIENT_SECRET en sitio/.env');
    console.error('Lee el encabezado de este archivo: son cinco pasos en Google Cloud Console.\n');
    process.exit(1);
  }
  /* `urn:ietf:wg:oauth:2.0:oob` está retirado. Para una app de escritorio sin
     servidor, el flujo vigente es redirigir a localhost — pero aquí no hay
     navegador, así que se usa el modo manual de Google: se autoriza en TU
     máquina y se pega el código. `redirect_uri` tiene que coincidir con el que
     el cliente de escritorio acepta. */
  const redirect = 'http://localhost';
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', ID);
  u.searchParams.set('redirect_uri', redirect);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', SCOPE);
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');

  console.log('\n1. Abre este enlace en el navegador donde tengas la sesión DUEÑA del canal:\n');
  console.log(u.toString());
  console.log('\n2. Autoriza. El navegador se irá a una página de «no se puede acceder» en localhost.');
  console.log('   Eso es normal. Copia de la barra de direcciones el valor de `code=`.\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question('3. Pega aquí el código: ')).trim();
  rl.close();

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: ID, client_secret: SECRET, redirect_uri: redirect, grant_type: 'authorization_code' }),
  });
  const j = await r.json();
  if (!j.refresh_token) {
    console.error('\nGoogle no devolvió refresh_token:', JSON.stringify(j).slice(0, 300));
    process.exit(1);
  }
  writeFileSync(TOKEN, JSON.stringify(j, null, 2), { mode: 0o600 });
  console.log(`\nListo. Token guardado en ${TOKEN} (permisos 600, ignorado por git).`);
  console.log('Ahora corre:  node scripts/yt-aplicar.mjs --dry\n');
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

if (arg('--login')) await login(); else await aplicar();
