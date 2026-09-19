/* El repaso del final de la jornada: el embudo y «qué quedó suelto». */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const raiz = '/opt/sacs/paginawebsacs';
const login = Object.fromEntries(readFileSync(`${raiz}/.crm-login`, 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
const errores = []; p.on('pageerror', e => errores.push(e.message));
let fallas = 0;
const paso = (n, ok, d = '') => { if (!ok) fallas++; console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };
try {
  await p.goto('http://localhost:4321/admin/login', { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', login.CRM_EMAIL);
  await p.fill('input[type="password"]', login.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout: 40000 }).catch(() => {});
  await p.goto('http://localhost:4321/admin/crm?tab=llamadas', { waitUntil: 'networkidle' });
  await p.waitForTimeout(9000);
  // la jornada grande de ayer (36 contestaron): es donde el embudo dice algo
  const fila = p.locator('div').filter({ hasText: /^Vista Rezagado · segunda vuelta/ }).last();
  await fila.getByRole('button', { name: 'Ver' }).click({ timeout: 25000 }).catch(async () => {
    await p.getByRole('button', { name: 'Ver' }).nth(1).click({ timeout: 25000 });
  });
  await p.waitForTimeout(3000);
  await p.getByText(/Contestaron/i).first().waitFor({ timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(6000);
  const txt = (await p.locator('body').innerText()).replace(/\n+/g, ' · ');
  paso('Abre una jornada terminada', /Contestaron|Sin marcar/.test(txt), txt.slice(0, 100));
  paso('Enseña el embudo', /dónde se te fue la gente/i.test(txt), '');
  paso('Los escalones del embudo', /Hablaron de verdad/.test(txt) && /Quedó algo/.test(txt), '');
  const suelto = /qué quedó suelto/i.test(txt);
  paso('«Qué quedó suelto» aparece', suelto, /volver a leer/i.test(txt) ? 'con su botón de releer' : 'sin botón');
  // Sólo la cabecera: la lista de 113 llamadas hace ilegible el pantallazo.
  await p.screenshot({ path: '/tmp/qa-repaso.png', clip: { x: 220, y: 0, width: 1060, height: 780 } });
  paso('Sin errores de JS propios', errores.filter(e => !/async_hooks/.test(e)).length === 0, errores.slice(0, 2).join(' | '));
} finally { await nav.close(); }
process.exit(fallas ? 1 : 0);
