/**
 * ¿Ya aprobó Meta las plantillas que están en revisión?
 *
 * POR QUÉ NO CONSULTA LA BASE DIRECTO
 * `wa_plantillas.status` es un ESPEJO: solo cambia cuando algo lo sincroniza
 * desde Meta. Mirar la tabla sin más diría PENDING para siempre aunque Meta ya
 * hubiera aprobado — una espera infinita por consultar el lugar equivocado.
 * Por eso se llama al GET del CRM, que sincroniza antes de responder.
 *
 * Solo habla cuando algo CAMBIÓ. Una rutina que cada media hora repite «siguen
 * pendientes» se deja de leer a la tercera vez, y entonces no sirve para la
 * cuarta, que es la que traía la novedad.
 *
 *   node scripts/estado-plantillas-wa.mjs          # contra producción
 *   node scripts/estado-plantillas-wa.mjs --todas  # lista todas, no solo las que cambiaron
 *
 * Salida: una línea por cambio, y al final una de estado. Si ya no queda
 * ninguna en revisión, lo dice explícito para poder apagar la rutina.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE = process.env.CRM_BASE || 'https://www.sacscloud.com';
const RUTA_LOGIN = '/opt/sacs/paginawebsacs/.crm-login';
const SNAPSHOT = '/tmp/claude-1000/-opt-sacs/estado-plantillas-wa.json';

/* Las que estamos esperando. Se nombran explícitas y no «todas las PENDING»
   porque una plantilla que alguien más dé de alta mañana no es asunto de esta
   espera, y colarla haría que la rutina no terminara nunca. */
const ESPERANDO = [
  'rezagado_curva', 'rezagado_novedad', 'rezagado_temporada', 'rezagado_puerta',
  'cadencia_equipo', 'cadencia_equipo_moda',
  'prueba_academia', 'prueba_productos', 'prueba_inventario',
  'prueba_sesion_consultor', 'prueba_sesion_repaso', 'prueba_cierre_sesion',
  'renovacion_sesion', 'renovacion_descuento',
];

const env = Object.fromEntries(readFileSync(RUTA_LOGIN, 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.CRM_EMAIL, password: env.CRM_PASSWORD }),
});
if (!login.ok) { console.log(`  ✗ no se pudo entrar al CRM (HTTP ${login.status})`); process.exit(1); }
const cookie = (login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');

// Este GET sincroniza con Meta antes de responder: ahí está la gracia.
const r = await fetch(`${BASE}/api/crm/whatsapp/plantillas`, { headers: { Cookie: cookie } });
const j = await r.json().catch(() => null);
if (!j?.plantillas) { console.log(`  ✗ no se pudo leer el catálogo (HTTP ${r.status})`); process.exit(1); }
if (j.sync_error) console.log(`  ⚠ Meta no contestó: ${String(j.sync_error).slice(0, 120)} — lo de abajo es el espejo, puede estar viejo`);

const ahora = {};
for (const n of ESPERANDO) {
  const p = j.plantillas.find(x => x.nombre === n);
  ahora[n] = p ? p.status : 'NO_EXISTE';
}
const antes = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, 'utf8')) : {};
writeFileSync(SNAPSHOT, JSON.stringify(ahora, null, 2));

const cambios = ESPERANDO.filter(n => antes[n] && antes[n] !== ahora[n]);
const pendientes = ESPERANDO.filter(n => ahora[n] === 'PENDING' || ahora[n] === 'IN_APPEAL');
const rechazadas = ESPERANDO.filter(n => ahora[n] === 'REJECTED');
const aprobadas = ESPERANDO.filter(n => ahora[n] === 'APPROVED');

const todas = process.argv.includes('--todas');
if (todas || cambios.length) {
  for (const n of (todas ? ESPERANDO : cambios)) {
    const de = antes[n] && antes[n] !== ahora[n] ? `${antes[n]} → ` : '';
    const marca = ahora[n] === 'APPROVED' ? '✓' : ahora[n] === 'REJECTED' ? '✗' : '·';
    console.log(`  ${marca} ${n.padEnd(22)} ${de}${ahora[n]}`);
  }
}

/* El motivo del rechazo importa más que el rechazo: Meta lo explica, y sin eso
   la corrección es adivinar. */
for (const n of rechazadas) {
  const p = j.plantillas.find(x => x.nombre === n);
  if (p?.rechazo_motivo) console.log(`     motivo: ${p.rechazo_motivo}`);
}

console.log(`\n  ${aprobadas.length}/${ESPERANDO.length} aprobadas · ${pendientes.length} en revisión${rechazadas.length ? ` · ${rechazadas.length} RECHAZADAS` : ''}`);
if (!pendientes.length) {
  console.log(rechazadas.length
    ? '  TERMINÓ LA ESPERA con rechazos: hay que reescribir y volver a mandar.'
    : '  TODAS APROBADAS. Se puede apagar la rutina.');
}
