/**
 * QA del tablero «Cómo van tus llamadas», en la compu y en el teléfono.
 * No fabrica nada: mira los números de verdad y comprueba que la pantalla los
 * pinte y no se rompa en 390 píxeles.
 *
 *   node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs scripts/qa-informe-llamadas.mjs [--puerto 4321]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const raiz = '/opt/sacs/paginawebsacs';
const login = Object.fromEntries(readFileSync(`${raiz}/.crm-login`, 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const base = `http://localhost:${process.argv.includes('--puerto') ? process.argv[process.argv.indexOf('--puerto') + 1] : '4321'}`;

let fallas = 0;
const paso = (n, ok, d = '') => { if (!ok) fallas++; console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };

for (const movil of [false, true]) {
  const nav = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await nav.newContext({
    viewport: movil ? { width: 390, height: 844 } : { width: 1360, height: 1000 },
    ...(movil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  try {
    console.log(`\n── ${movil ? 'Teléfono' : 'Compu'} ──────────────────────────────`);
    await p.goto(`${base}/admin/login`, { waitUntil: 'networkidle' });
    await p.fill('input[type="email"]', login.CRM_EMAIL);
    await p.fill('input[type="password"]', login.CRM_PASSWORD);
    await p.click('button[type="submit"]');
    await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
    await p.goto(`${base}/admin/crm?tab=llamadas`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => /Cómo van tus llamadas/i.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
    const txt = (await p.locator('body').innerText()).replace(/\n+/g, ' · ');
    paso('Sale el tablero', /Cómo van tus llamadas/i.test(txt), '');
    paso('Con conversaciones y contactabilidad', /conversaciones/i.test(txt) && /% contesta/.test(txt), '');
    paso('Con las promesas vencidas', /promesas vencidas/i.test(txt), '');
    paso('Y a qué hora contestan', /le contestan más de/i.test(txt), '');
    // Que nada se salga de la pantalla: en 390 px es donde se rompe.
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    paso('No se desborda a lo ancho', ancho, movil ? '390 px' : '1360 px');
    paso('Sin errores de JS', errores.length === 0, errores.slice(0, 2).join(' | '));
    await p.screenshot({ path: `/tmp/qa-informe-${movil ? 'movil' : 'compu'}.png`, fullPage: false });
  } finally { await nav.close(); }
}
process.exit(fallas ? 1 : 0);
