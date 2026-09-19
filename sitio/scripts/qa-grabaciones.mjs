/* La pantalla de grabaciones: que abra, que traiga audio de verdad y que
   ofrezca separar las pistas (lo que necesita ElevenLabs). */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const raiz = '/opt/sacs/paginawebsacs';
const login = Object.fromEntries(readFileSync(`${raiz}/.crm-login`, 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const MOVIL = process.argv.includes('--movil');
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: MOVIL ? { width: 390, height: 844 } : { width: 1280, height: 950 }, ...(MOVIL ? { isMobile: true, hasTouch: true } : {}) });
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
  await p.getByRole('button', { name: 'Grabaciones' }).first().click({ timeout: 25000 });
  await p.waitForTimeout(6000);
  const txt = (await p.locator('body').innerText()).replace(/\n+/g, ' · ');
  paso('Abre la pantalla', /Grabaciones de tus llamadas/.test(txt), '');
  const cuantas = /(\d+) grabacion/.exec(txt);
  paso('Trae grabaciones de verdad', !!cuantas && Number(cuantas[1]) > 0, cuantas ? `${cuantas[1]} encontradas` : txt.slice(0, 120));
  const oir = p.getByRole('button', { name: 'Oírla' }).first();
  if (await oir.count()) {
    await oir.click();
    await p.waitForTimeout(12000);
    const t2 = (await p.locator('body').innerText()).replace(/\n+/g, ' · ');
    paso('Ofrece separar las pistas', /habla el \d+%|una sola pista/.test(t2), /Preparando/.test(t2) ? 'seguía preparando' : t2.slice(0, 150));
    paso('Hay reproductor', await p.locator('audio').count() > 0, '');
  }
  await p.screenshot({ path: `/tmp/qa-grabaciones${MOVIL ? '-movil' : ''}.png`, fullPage: true });
  paso('Sin errores de JS propios', errores.filter(e => !/async_hooks/.test(e)).length === 0, errores.slice(0, 2).join(' | '));
} finally { await nav.close(); }
process.exit(fallas ? 1 : 0);
