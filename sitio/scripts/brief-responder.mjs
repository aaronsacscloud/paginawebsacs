#!/usr/bin/env node
// Manda la revisión de una etapa. El JSON puede ir como ARGUMENTO o por stdin:
//
//   node scripts/brief-responder.mjs '{"token":"…","clave":"…","notas":[…]}'
//   echo '{…}' | node scripts/brief-responder.mjs
//
// El argumento existe porque la rutina desatendida corre con una lista blanca
// de comandos: no puede escribir un archivo temporal ni encadenar un heredoc,
// así que sin esta puerta el script era inalcanzable justo cuando la revisión
// era larga. Pasó en una ronda de prueba: decidió bien y no pudo entregar.
//
//   { "token": "...", "clave": "identidad",
//     "notas": [ { "campo": "colores", "texto": "...", "pregunta": true } ],
//     "cierre": "un párrafo para ellos" }
//
// Se autentica con las credenciales de .crm-login, las mismas del CRM: no hay
// un secreto nuevo que rotar ni una puerta pública que cuidar. El endpoint
// decide solo si la etapa se aprueba o vuelve al cliente — depende de si
// quedó alguna pregunta abierta.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BRIEF_BASE || 'https://www.sacscloud.com';

const cred = Object.fromEntries(
  readFileSync(join(raiz, '.crm-login'), 'utf8')
    .split('\n').filter(Boolean)
    .map((l) => l.split('=').map((x) => x.trim().replace(/^["']|["']$/g, ''))),
);

const crudo = process.argv[2] && process.argv[2].trim().startsWith('{')
  ? process.argv[2]
  : readFileSync(0, 'utf8');
let cuerpo;
try {
  cuerpo = JSON.parse(crudo);
} catch (e) {
  console.error('El cuerpo no es JSON válido:', e.message);
  process.exit(1);
}
if (!cuerpo?.token || !cuerpo?.clave) {
  console.error('Falta token o clave'); process.exit(1);
}

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: cred.CRM_EMAIL, password: cred.CRM_PASSWORD }),
});
if (!login.ok) { console.error('Login falló:', login.status); process.exit(1); }
const cookie = (login.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');

const res = await fetch(`${BASE}/api/proyecto/responder`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie },
  body: JSON.stringify(cuerpo),
});
const d = await res.json().catch(() => ({}));
console.log(JSON.stringify({ status: res.status, ...d }, null, 1));
if (!res.ok) process.exit(1);
