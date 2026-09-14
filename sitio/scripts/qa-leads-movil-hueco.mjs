/**
 * QA · el hueco negro de la pantalla de Leads en el teléfono.
 *
 * Entre las pestañas («Todos 195 · Nuevos 0 · …») y el primer lead había 140 px
 * de vacío: el aire que se reserva para que el último renglón no quede debajo
 * de la barra de abajo, cobrado también a la cabecera. Se mide la distancia de
 * verdad entre lo último de la cabecera y la primera fila.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4330';

const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto(`${BASE}/admin/crm`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(14000);
/* Se entra por la barra de abajo, como una persona: el CRM recuerda la última
   pantalla y el `?tab=` no siempre gana. */
await p.locator('nav button, [role="button"]').filter({ hasText: /^Leads$/ }).first().click().catch(async () => {
  await p.locator('text=Leads').first().click();
});
await p.waitForTimeout(14000);

const medida = await p.evaluate(() => {
  const chips = document.querySelector('.m-chips');
  const cab = document.querySelector('.m-bleed');
  if (!chips) return null;
  const abajoDeLasPestanas = chips.getBoundingClientRect().bottom;
  // La primera fila de la lista: el primer elemento con texto debajo de las pestañas.
  const filas = [...document.querySelectorAll('div,button,a')].filter(e => {
    const r = e.getBoundingClientRect();
    // `>= -2` y no `> +2`: si el arreglo funciona, la primera fila arranca
    // JUSTO donde terminan las pestañas, y con el margen estricto se colaba la
    // segunda fila y el hueco medido salía siendo el alto de la primera.
    return r.top >= abajoDeLasPestanas - 2 && r.height > 40 && r.width > 300 && (e.textContent || '').trim().length > 3;
  }).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const primera = filas[0];
  return {
    hueco: primera ? Math.round(primera.getBoundingClientRect().top - abajoDeLasPestanas) : null,
    texto: primera ? (primera.textContent || '').trim().slice(0, 30) : null,
    padCabecera: cab ? getComputedStyle(cab).paddingBottom : null,
  };
});

paso('Se encontró la pantalla de Leads en modo teléfono', !!medida, JSON.stringify(medida));
paso('La cabecera ya no paga el aire de la barra de abajo', medida?.padCabecera === '0px', `padding-bottom: ${medida?.padCabecera}`);
paso('Entre las pestañas y el primer lead no hay un hueco', (medida?.hueco ?? 999) < 40, `${medida?.hueco} px hasta «${medida?.texto}»`);
await p.screenshot({ path: '/tmp/qa-leads-movil.png' });
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
