/**
 * QA · seleccionar varias con Cmd y cerrarlas de un golpe.
 *
 * El cierre NO se ejecuta: se intercepta la llamada y se cuenta cuántas iban a
 * cerrarse y con qué. Lo que se prueba es la parte que se toca — que Cmd sume,
 * que Shift tome el rango, que un clic normal abra y limpie, y que la barra
 * diga la verdad sobre cuántas hay.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4332';
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

// Nada se cierra de verdad: se anota qué se pidió.
const cerradas = [];
await p.route('**/api/crm/whatsapp/hilo', async r => {
  if (r.request().method() === 'PUT') {
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.estado_crm === 'resuelta') { cerradas.push(b); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }); }
  }
  return r.continue();
});

await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto(`${BASE}/admin/crm?tab=whatsapp`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(22000);

const filas = p.locator('[data-conv]');
paso('La lista cargó', (await filas.count()) > 6, `${await filas.count()} filas`);

// Cmd + clic: suma de una en una y NO abre la conversación.
await filas.nth(1).click({ modifiers: ['Meta'] });
await filas.nth(3).click({ modifiers: ['Meta'] });
await p.waitForTimeout(400);
const barra = () => p.locator('text=/\\d+ seleccionadas?/').first();
paso('Cmd + clic selecciona sin abrir', (await barra().count()) > 0 && /2 seleccionadas/.test(await barra().innerText()),
  (await barra().count()) ? await barra().innerText() : 'no salió la barra');

// Shift + clic: el rango desde la última tocada.
await filas.nth(6).click({ modifiers: ['Shift'] });
await p.waitForTimeout(400);
paso('Shift + clic toma el rango', /5 seleccionadas/.test(await barra().innerText()), await barra().innerText());

// Y el modal dice cuántas son.
await p.locator('button', { hasText: 'Marcar resueltas' }).first().click();
await p.waitForTimeout(700);
const t = await p.locator('body').innerText();
paso('El modal habla en plural y con el número', /Resolver 5 conversaciones/.test(t));

// Se elige categoría y se cierra: se comprueba QUÉ se pidió, no que se cerrara.
await p.locator('button', { hasText: 'Sin interés' }).first().click();
await p.locator('button', { hasText: /^Marcar 5 resueltas$/ }).click();
await p.waitForTimeout(3000);
paso('Se pidieron las 5, con su categoría', cerradas.length === 5 && cerradas.every(c => c.cierre_categoria === 'Sin interés'),
  `${cerradas.length} llamadas · ${[...new Set(cerradas.map(c => c.cierre_categoria))].join(', ')}`);
paso('Y con «forzar», que es lo que la selección a mano significa', cerradas.every(c => c.forzar === true));
paso('La selección se limpia al terminar', (await p.locator('text=/\\d+ seleccionadas?/').count()) === 0);

// Un clic normal sigue abriendo.
await filas.nth(2).click();
await p.waitForTimeout(2500);
paso('Un clic normal abre la conversación', (await p.locator('[data-hilo-scroll]').count()) > 0);
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
