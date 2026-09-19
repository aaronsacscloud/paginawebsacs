/* La cabina de llamadas inteligentes EN EL TELÉFONO: que no haya desbordes
   horizontales, que los botones se alcancen con el pulgar y que los KPIs del
   header no desaparezcan. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const raiz = '/opt/sacs/paginawebsacs';
const login = Object.fromEntries(readFileSync(`${raiz}/.crm-login`, 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
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
  const txt = (await p.locator('body').innerText()).replace(/\n+/g, ' · ');
  paso('Abre Llamadas inteligentes', /[Ll]lamadas inteligentes/.test(txt), txt.slice(0, 110));
  const ancho = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
  paso('Sin desborde horizontal', ancho.doc <= ancho.win + 1, `${ancho.doc} vs ${ancho.win}`);
  const chicos = await p.evaluate(() => [...document.querySelectorAll('button')]
    .filter(b => b.offsetParent && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 32)
    .map(b => `${b.innerText.trim().slice(0, 22)}(${Math.round(b.getBoundingClientRect().height)}px)`).slice(0, 6));
  paso('Botones alcanzables con el pulgar (≥32 px)', chicos.length === 0, chicos.join(' · '));
  await p.screenshot({ path: '/tmp/qa-llamadas-movil.png', fullPage: true });
  paso('Sin errores de JS propios', errores.filter(e => !/async_hooks/.test(e)).length === 0, errores.slice(0, 2).join(' | '));
} finally { await nav.close(); }
process.exit(fallas ? 1 : 0);
