/**
 * Arma «Descalificados · top of mind» a partir de «Rezagados · top of mind».
 *
 * Los MISMOS correos, otro ritmo: los rezagados reciben tres por semana (lunes,
 * miércoles y viernes); los descalificados, uno por semana. Así se puede ver
 * qué rinde más sin escribir contenido nuevo.
 *
 * Va por los MISMOS endpoints que usa la pantalla —duplicar y guardar—, no por
 * SQL: si esto funciona, una persona puede repetirlo con dos clics. Nace
 * APAGADA a propósito.
 *
 *   node scripts/crear-cadencia-descalificados.mjs            # dice qué haría
 *   node scripts/crear-cadencia-descalificados.mjs --crear    # la crea
 */
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4333';
const NOMBRE = 'Descalificados · top of mind';
const crear = process.argv.includes('--crear');

const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.CRM_EMAIL, password: env.CRM_PASSWORD }) });
const cookie = (login.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
if (!cookie) { console.log('No se pudo entrar al CRM'); process.exit(1); }

const { secuencias } = await fetch(`${BASE}/api/crm/secuencias`, { headers: { cookie } }).then(r => r.json());
const origen = (secuencias || []).find(s => s.nombre === 'Rezagados · top of mind');
if (!origen) { console.log('No encuentro «Rezagados · top of mind»'); process.exit(1); }
const ya = (secuencias || []).find(s => s.nombre === NOMBRE);

const correos = (origen.pasos || []).filter(p => p.canal === 'correo' && p.activo !== false);
const was = (origen.pasos || []).filter(p => p.canal === 'wa');
console.log(`Origen: «${origen.nombre}» · ${origen.pasos.length} pasos (${correos.length} correos, ${was.length} WhatsApp)`);
console.log(`  ritmo de origen: cada ${origen.entrada?.cada_dias ?? '?'} día(s), carriles ${[...new Set(correos.map(p => p.dia_semana))].sort().join(', ')}`);
console.log(`Destino: «${NOMBRE}» · etapa descalificado · UN correo por semana (martes)`);
if (ya && !process.argv.includes('--ajustar')) { console.log(`\nYa existe (${ya.id}). Corre con --ajustar para volver a aplicarle la receta.`); process.exit(0); }
if (!crear) { console.log('\n(nada creado; corre con --crear)'); process.exit(0); }

// 1 · Duplicar por el endpoint de la pantalla (o reusar la que ya está).
const dup = ya ? { id: ya.id, pasos: (ya.pasos || []).length } : await fetch(`${BASE}/api/crm/secuencias`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', cookie },
  body: JSON.stringify({ duplicar_de: origen.id, nombre: NOMBRE }),
}).then(r => r.json());
if (dup.error) { console.log('No se pudo duplicar:', dup.error); process.exit(1); }
console.log(`\n✓ Duplicada con sus ${dup.pasos} pasos (apagada)`);

// 2 · Ajustar quién entra, el ritmo y los pasos: un solo carril y sin WhatsApp.
const { secuencias: s2 } = await fetch(`${BASE}/api/crm/secuencias`, { headers: { cookie } }).then(r => r.json());
const nueva = (s2 || []).find(s => s.id === dup.id);
const pasos = (nueva.pasos || [])
  // Solo correo: al descalificado no se le abre otra vez el WhatsApp. El correo
  // se puede dar de baja con un clic y no gasta ventana de 24 h.
  .filter(p => p.canal === 'correo')
  // Un único carril (martes): ESE es el cambio de ritmo que se quiere medir.
  .map((p, i) => ({ ...p, dia_semana: 2, orden: (i + 1) * 10 }));

const guardado = await fetch(`${BASE}/api/crm/secuencias`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
  body: JSON.stringify({
    ...nueva,
    descripcion: 'Los mismos correos que Rezagados, pero uno por semana (martes). Para quien ya se descartó: no se le vende, se le mantiene cerca por si su momento vuelve. Si responde, sale y vuelve a la cadencia de seguimiento como lead reciclado.',
    objetivo: 'respondio',
    dias_envio: [2],
    /* `descartado` en la entrada Y en `ignorar_salidas`: un descalificado ya
       está marcado como descartado, así que sin las dos cosas la secuencia lo
       enrola y lo expulsa en la misma corrida. Y el corte largo, porque un
       goteo de top of mind no tiene final: con el de 14 días, quien lleva un
       mes descartado saldría antes de recibir el primero. */
    corte_dias: 3650,
    entrada: {
      ...(nueva.entrada || {}),
      lifecycle: ['descalificado'],
      estatus: [...new Set([...(nueva.entrada?.estatus || []), 'descartado'])],
      ignorar_salidas: ['descartado'],
      cada_dias: 7,
    },
    pasos,
    activa: false,
  }),
}).then(r => r.json());
if (guardado.error) { console.log('No se pudo ajustar:', guardado.error); process.exit(1); }
console.log(`✓ Ajustada: etapa descalificado · 1 correo cada 7 días · martes · ${pasos.length} correos`);
console.log('\nQueda APAGADA. Se prende desde Secuencias cuando el dueño lo decida.');
