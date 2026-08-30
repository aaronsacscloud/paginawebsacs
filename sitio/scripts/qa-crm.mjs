/**
 * QA del CRM con navegador de verdad.
 *
 * Existe porque las pantallas de /admin/crm piden sesión: sin login el ciclo era
 * compilar, desplegar y descubrir el error en producción. Con esto se ve la
 * pantalla ANTES de subirla.
 *
 * Uso:
 *   node scripts/qa-crm.mjs                      # tablero, contra el dev local
 *   node scripts/qa-crm.mjs secuencias           # una pestaña
 *   node scripts/qa-crm.mjs leads --puerto 4321
 *   node scripts/qa-crm.mjs inbox --completa     # captura de página entera
 *
 * Deja la imagen en /tmp y avisa de cualquier error de JavaScript de la página,
 * que es justo lo que no se ve compilando.
 *
 * Las credenciales viven en `.crm-login` en la raíz del repo (fuera de git).
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const RUTA_LOGIN = resolve(aqui, '../../.crm-login');

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const tab = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
const puerto = arg('puerto', '4321');
const base = arg('base', `http://localhost:${puerto}`);
const completa = process.argv.includes('--completa');
const salida = arg('salida', `/tmp/qa-crm-${tab || 'tablero'}.png`);

if (!existsSync(RUTA_LOGIN)) {
  console.error(`Falta ${RUTA_LOGIN}. Debe tener CRM_EMAIL y CRM_PASSWORD (perms 600, fuera de git).`);
  process.exit(1);
}
const env = Object.fromEntries(readFileSync(RUTA_LOGIN, 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

const navegador = await chromium.launch({ args: ['--no-sandbox'] });
const pagina = await navegador.newPage({ viewport: { width: 1360, height: 1100 } });

// Lo que de verdad importa capturar: un componente puede compilar y reventar al
// montarse. Eso solo se ve aquí.
const errores = [];
pagina.on('pageerror', e => errores.push(e.message));
pagina.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

try {
  await pagina.goto(`${base}/admin/login`, { waitUntil: 'networkidle' });
  await pagina.fill('input[type="email"]', env.CRM_EMAIL);
  await pagina.fill('input[type="password"]', env.CRM_PASSWORD);
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});

  // Por query, no navegando el menú: Secuencias vive dentro de Automatización y
  // hacer clic en el texto de una tarjeta NO abre su editor (es el botón Editar).
  if (tab) await pagina.goto(`${base}/admin/crm?tab=${tab}`, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(6000);   // el tablero carga sus datos después del render

  await pagina.screenshot({ path: salida, fullPage: completa });
  console.log(`  captura: ${salida}`);
  console.log(`  url:     ${pagina.url()}`);
  const texto = (await pagina.locator('body').innerText()).trim();
  console.log(`  visible: ${texto.slice(0, 140).replace(/\n+/g, ' · ') || '(pantalla vacía)'}`);
  console.log(errores.length ? `  ⚠ ${errores.length} error(es) de JS:\n     ${errores.slice(0, 3).join('\n     ')}` : '  ✓ sin errores de JS');
} finally {
  await navegador.close();
}
