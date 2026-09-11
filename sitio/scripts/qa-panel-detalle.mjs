/**
 * QA del panel del cliente: jerarquía de las secciones colapsables y que la
 * información del encabezado no se repita.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 1360, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

await p.goto('http://localhost:4321/admin/login', { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto('http://localhost:4321/admin/crm?tab=whatsapp&wa_search=524775067154', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(9000);
await p.locator('.wa-fila-hover').first().click();
await p.waitForTimeout(11000);

const sec = await p.evaluate(() => [...document.querySelectorAll('button[aria-expanded]')].map(b => {
  const sp = [...b.querySelectorAll('span')].find(x => (x.textContent || '').trim().length > 2);
  if (!sp) return null;
  const cs = getComputedStyle(sp);
  return { t: sp.textContent.trim(), abierta: b.getAttribute('aria-expanded') === 'true', peso: cs.fontWeight, px: cs.fontSize };
  // Las del menú de marketing del sitio miden 17px: se descartan por tamaño.
}).filter(x => x && parseFloat(x.px) < 15));
console.log(`  secciones: ${sec.length}`);
sec.forEach(x => console.log(`     ${x.abierta ? 'ABIERTA ' : 'cerrada '} ${x.px}/${x.peso}  ${x.t}`));
paso('Títulos legibles (13px, negritas)', sec.length > 0 && sec.every(x => Number(x.peso) >= 700 && parseFloat(x.px) >= 12.5));
paso('Solo una nace abierta', sec.filter(x => x.abierta).length <= 1, sec.filter(x => x.abierta).map(x => x.t).join(', ') || 'ninguna');
const t = await p.locator('body').innerText();
paso('No se repite la etapa del ciclo de vida', !/CLIENTE\s+·?\s*Cliente/i.test(t.replace(/\s+/g, ' ')));
paso('El composer enseña una sola línea', (await p.locator('button[title*="Toca para cambiar de línea"]').count()) === 1);
await p.screenshot({ path: '/tmp/qa-panel.png', clip: { x: 965, y: 100, width: 395, height: 880 } });
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
