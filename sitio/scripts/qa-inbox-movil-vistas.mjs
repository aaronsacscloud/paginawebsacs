/**
 * QA · El botón de las tres rayas del inbox móvil abre la hoja de vistas.
 *
 * Lo que falló en el iPhone del dueño: la hoja se escribía DENTRO del carril de
 * pestañas, que hace scroll horizontal; en iOS eso recorta a sus hijos
 * `position:fixed` y la hoja salía encogida a esa franja — un borrón sobre los
 * chips y nada más. Chromium no recorta igual, así que la prueba mira la causa:
 * de quién cuelga la hoja y dónde queda en pantalla.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4326';
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto(`${BASE}/admin/crm?tab=whatsapp`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(20000);

const rayas = p.locator('button[aria-label="Todas las vistas"]');
// Se espera a que la pantalla termine de montar: el botón aparece con la lista.
await rayas.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
paso('El botón de las tres rayas está', (await rayas.count()) === 1);
await rayas.click();
await p.waitForTimeout(900);

const hoja = p.locator('.ash');
paso('La hoja abre', (await hoja.count()) === 1);
const info = await p.evaluate(() => {
  const el = document.querySelector('.ash'); if (!el) return null;
  const r = el.getBoundingClientRect();
  const dentroDeChips = !!el.closest('.m-chips');
  const padres = [];
  for (let n = el.parentElement; n && padres.length < 6; n = n.parentElement) padres.push(n.className || n.tagName);
  return { alto: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), dentroDeChips, padres, vh: window.innerHeight,
    items: document.querySelectorAll('.ash-i').length, velo: !!document.querySelector('.ash-velo') };
});
paso('NO cuelga del carril de pestañas', info && !info.dentroDeChips, info ? info.padres.slice(0, 2).join(' ‹ ') : '');
paso('Llega hasta abajo de la pantalla', info && Math.abs(info.bottom - info.vh) <= 2, info ? `abajo ${info.bottom} de ${info.vh}` : '');
paso('Es una hoja de verdad, no una franja', info && info.alto > 200, info ? `${info.alto} px de alto` : '');
paso('Trae las vistas dentro', (info?.items || 0) >= 6, `${info?.items} renglones`);
const t = await p.locator('.ash').innerText();
paso('Están las bandejas y el ciclo de vida', /No contestadas/.test(t) && /Por ciclo de vida/i.test(t));
await p.screenshot({ path: '/tmp/qa-vistas-movil.png' });

// Y que sirva: elegir una bandeja cambia la lista y cierra la hoja.
await p.locator('.ash-i', { hasText: 'Abiertas' }).first().click();
await p.waitForTimeout(1200);
paso('Al elegir una vista la hoja se cierra', (await p.locator('.ash').count()) === 0);
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
