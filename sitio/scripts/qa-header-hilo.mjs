/* El encabezado del hilo: que los cuatro controles quepan SIEMPRE, con el
   panel de la derecha abierto y en ventanas estrechas. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const raiz = '/opt/sacs/paginawebsacs';
const login = Object.fromEntries(readFileSync(`${raiz}/.crm-login`, 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const nav = await chromium.launch({ args: ['--no-sandbox'] });
let fallas = 0;
const paso = (n, ok, d = '') => { if (!ok) fallas++; console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };
const ctx = await nav.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();
try {
  await p.goto('http://127.0.0.1:4321/admin/login', { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', login.CRM_EMAIL);
  await p.fill('input[type="password"]', login.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout: 40000 }).catch(() => {});
  await p.goto('http://127.0.0.1:4321/admin/crm?tab=whatsapp', { waitUntil: 'networkidle' });
  await p.waitForTimeout(10000);
  // abrir la primera conversación
  await p.locator('[role="button"], li, div').filter({ hasText: /Estefany|JO-el|Mario/ }).first().click({ timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(6000);

  for (const w of [1440, 1280, 1100]) {
    await p.setViewportSize({ width: w, height: 950 });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const sels = [...document.querySelectorAll('select')].filter(s => s.offsetParent);
      const malos = sels.filter(s => {
        const b = s.getBoundingClientRect();
        const pa = s.parentElement?.getBoundingClientRect();
        return !pa || b.right > pa.right + 1 || b.left < pa.left - 1;
      }).map(s => `${s.options[s.selectedIndex]?.text || '?'}`);
      return { total: sels.length, malos, doc: document.documentElement.scrollWidth, win: window.innerWidth };
    });
    paso(`A ${w} px: ningún control se sale de su carril`, r.malos.length === 0, r.malos.join(' · '));
    paso(`A ${w} px: la página no scrollea de lado`, r.doc <= r.win + 1, `${r.doc} vs ${r.win}`);
  }
  await p.setViewportSize({ width: 1280, height: 950 });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: '/tmp/qa-header-hilo.png', clip: { x: 330, y: 0, width: 950, height: 210 } });
} finally { await nav.close(); }
process.exit(fallas ? 1 : 0);
