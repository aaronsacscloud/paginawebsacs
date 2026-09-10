#!/usr/bin/env node
/**
 * Deja la telefonía del CRM lista de una sola corrida.
 *
 *   node scripts/twilio-provision.mjs <ACCOUNT_SID> <CREDENCIAL> <NUMERO_E164>
 *
 * `CREDENCIAL` puede ser una de dos cosas:
 *
 *   · El **Auth Token** de la cuenta (32 hex). Con él se crea una API Key nueva
 *     para firmar el token de voz, y se llenan las SEIS variables.
 *   · Una **API Key ya creada**, como `SKxxxx:elsecreto`. Se reutiliza tal cual
 *     —no se crea otra— pero entonces **falta `TWILIO_AUTH_TOKEN`**, y sin esa
 *     variable los tres webhooks rechazan todo: Twilio firma sus llamadas con
 *     el Auth Token de la CUENTA, no con una API Key, y `firmaValida()` no
 *     tiene con qué comprobarlas. El script lo escribe todo menos esa y avisa.
 *
 * Lo que hace en cualquiera de los dos casos:
 *
 *   1. La API Key (crea o reutiliza): el token de voz del navegador se firma
 *      con ella, NO con el auth token, para que el secreto de la cuenta nunca
 *      salga del servidor.
 *   2. Crea la TwiML App y le apunta el webhook de voz a nuestro endpoint.
 *   3. Le pone a NUESTRO número ese mismo webhook para las entrantes.
 *   4. Escribe las variables en Vercel (production, preview y development).
 *
 * Es idempotente: si ya existe la TwiML App con el mismo nombre, la reutiliza
 * en vez de llenar la cuenta de duplicados.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const [SID, CRED, NUMERO_CRUDO] = process.argv.slice(2);
const SOLO_MOSTRAR = process.argv.includes('--dry-run');

if (!SID || !CRED || !NUMERO_CRUDO) {
  console.error('Uso: node scripts/twilio-provision.mjs <ACCOUNT_SID> <AUTH_TOKEN|SKxxx:secreto> <NUMERO_E164> [--dry-run]');
  process.exit(1);
}

// ¿Nos dieron el Auth Token o una API Key ya hecha?
const mKey = /^(SK[0-9a-f]{32}):(.+)$/i.exec(CRED.trim());
const TOKEN = mKey ? '' : CRED.trim();
let keySid = mKey ? mKey[1] : '';
let keySecret = mKey ? mKey[2] : '';
const USUARIO_REST = mKey ? keySid : SID;
const CLAVE_REST = mKey ? keySecret : TOKEN;
if (!/^AC[0-9a-f]{32}$/i.test(SID)) {
  console.error(`El Account SID no tiene forma de SID (debe empezar con AC y traer 34 caracteres). Llegó: ${SID.slice(0, 6)}…`);
  process.exit(1);
}
const NUMERO = String(NUMERO_CRUDO).replace(/[^\d+]/g, '');
if (!/^\+\d{8,15}$/.test(NUMERO)) {
  console.error(`El número tiene que ir en E.164, con el +: p. ej. +5215536634392. Llegó: ${NUMERO_CRUDO}`);
  process.exit(1);
}

const BASE = 'https://www.sacscloud.com';
const NOMBRE_APP = 'CRM Sacs · Voz';
const NOMBRE_KEY = 'CRM Sacs · voice-sdk';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// El REST acepta lo mismo una API Key que el par cuenta/auth-token.
const auth = 'Basic ' + Buffer.from(`${USUARIO_REST}:${CLAVE_REST}`).toString('base64');
async function tw(ruta, form, metodo) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}${ruta}`, {
    method: metodo || (form ? 'POST' : 'GET'),
    headers: { Authorization: auth, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Twilio ${r.status} en ${ruta}: ${j?.message || JSON.stringify(j).slice(0, 240)}`);
  return j;
}

// ── 0. Que las credenciales sirvan, antes de crear nada ──────────────
const cuenta = await tw('.json');
console.log(`Cuenta: ${cuenta.friendly_name} · estado ${cuenta.status}`);
if (cuenta.status !== 'active') {
  console.error('La cuenta no está activa. Revisa en la consola de Twilio antes de seguir.');
  process.exit(1);
}

// ── 1. El número tiene que ser de esta cuenta ────────────────────────
const nums = await tw(`/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(NUMERO)}`);
const mio = (nums.incoming_phone_numbers || [])[0];
if (!mio) {
  const todos = await tw('/IncomingPhoneNumbers.json?PageSize=20');
  const lista = (todos.incoming_phone_numbers || []).map(n => n.phone_number).join(', ') || '(ninguno)';
  console.error(`El número ${NUMERO} no está en esta cuenta de Twilio.\nLos que sí están: ${lista}`);
  process.exit(1);
}
console.log(`Número: ${mio.phone_number} · voz ${mio.capabilities?.voice ? 'sí' : 'NO'} · SMS ${mio.capabilities?.sms ? 'sí' : 'no'}`);
if (!mio.capabilities?.voice) {
  console.error('Ese número no tiene capacidad de VOZ. Hay que comprar uno que sí la tenga.');
  process.exit(1);
}

// ── 2. API Key ───────────────────────────────────────────────────────
if (mKey) {
  console.log(`API Key: ${keySid} (la que ya existía, se reutiliza)`);
} else if (SOLO_MOSTRAR) {
  console.log('[dry-run] crearía la API Key');
} else {
  const key = await tw('/Keys.json', { FriendlyName: NOMBRE_KEY });
  keySid = key.sid; keySecret = key.secret;
  // El secreto solo se ve AQUÍ, en la respuesta de creación. Si se pierde, no
  // se recupera: se crea otra llave y se borra la vieja.
  console.log(`API Key: ${keySid} (secreto recibido, ${keySecret.length} caracteres)`);
}

// ── 3. TwiML App, reutilizando la que ya exista con ese nombre ───────
const apps = await tw(`/Applications.json?FriendlyName=${encodeURIComponent(NOMBRE_APP)}`);
let app = (apps.applications || [])[0];
const VOZ = `${BASE}/api/telefonia/voz`;
if (SOLO_MOSTRAR) {
  console.log(`[dry-run] ${app ? 'actualizaría' : 'crearía'} la TwiML App → ${VOZ}`);
} else if (app) {
  app = await tw(`/Applications/${app.sid}.json`, { VoiceUrl: VOZ, VoiceMethod: 'POST' });
  console.log(`TwiML App reutilizada: ${app.sid}`);
} else {
  app = await tw('/Applications.json', { FriendlyName: NOMBRE_APP, VoiceUrl: VOZ, VoiceMethod: 'POST' });
  console.log(`TwiML App creada: ${app.sid}`);
}

// ── 4. El webhook de las ENTRANTES, en el propio número ──────────────
if (SOLO_MOSTRAR) {
  console.log(`[dry-run] apuntaría las entrantes de ${NUMERO} a ${VOZ}`);
} else {
  await tw(`/IncomingPhoneNumbers/${mio.sid}.json`, {
    VoiceUrl: VOZ, VoiceMethod: 'POST',
    StatusCallback: `${BASE}/api/telefonia/estado`, StatusCallbackMethod: 'POST',
  });
  console.log(`Entrantes de ${NUMERO} → ${VOZ}`);
}

// ── 5. Las seis variables, en Vercel ─────────────────────────────────
const VARS = {
  TWILIO_ACCOUNT_SID: SID,
  TWILIO_AUTH_TOKEN: TOKEN,
  TWILIO_API_KEY_SID: keySid,
  TWILIO_API_KEY_SECRET: keySecret,
  TWILIO_TWIML_APP_SID: app?.sid || '',
  TWILIO_NUMERO: NUMERO,
};

if (SOLO_MOSTRAR) {
  console.log('\n[dry-run] no se escribió nada en Vercel ni en Twilio.');
  process.exit(0);
}

const vtok = readFileSync(join(raiz, '.vercel-token'), 'utf8').trim();
const PROY = process.env.VERCEL_PROJECT_ID || 'prj_YknbNODDtDpknGYan5AnWIn4UW5B';   // proyecto `sitio` = www.sacscloud.com

async function vercel(ruta, opts = {}) {
  const r = await fetch(`https://api.vercel.com${ruta}`, {
    ...opts,
    headers: { Authorization: `Bearer ${vtok}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Vercel ${r.status} en ${ruta}: ${j?.error?.message || JSON.stringify(j).slice(0, 240)}`);
  return j;
}

const existentes = await vercel(`/v9/projects/${PROY}/env?decrypt=false`);
const porNombre = new Map((existentes.envs || []).map(e => [e.key, e]));

for (const [key, value] of Object.entries(VARS)) {
  if (!value) { console.log(`  ${key}: vacío, se salta`); continue; }
  const viejo = porNombre.get(key);
  if (viejo) {
    await vercel(`/v9/projects/${PROY}/env/${viejo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ value, target: ['production', 'preview', 'development'], type: 'encrypted' }),
    });
    console.log(`  ${key}: actualizada`);
  } else {
    await vercel(`/v10/projects/${PROY}/env`, {
      method: 'POST',
      body: JSON.stringify({ key, value, type: 'encrypted', target: ['production', 'preview', 'development'] }),
    });
    console.log(`  ${key}: creada`);
  }
}

if (!TOKEN) {
  console.log(`
⚠ FALTA TWILIO_AUTH_TOKEN y sin ella NO entra ni sale ninguna llamada.
Twilio firma cada webhook con el Auth Token de la CUENTA; los tres endpoints
(voz, estado, grabación) comprueban esa firma y fallan CERRADO. Una API Key no
sirve para eso — no es con lo que Twilio firma.
Está en console.twilio.com → Account Info → Auth Token → «Show».`);
}

console.log(`
Falta UN paso que no hago yo: un despliegue nuevo, porque Vercel solo
inyecta las variables al construir. Con un push cualquiera basta, o desde el
panel: Deployments → el último → Redeploy.

Después, para comprobarlo de verdad:
  curl -b cookie.jar https://www.sacscloud.com/api/crm/telefonia/setup
Debe decir "configurada": true, con saldo y "webhook_ok": true.`);
