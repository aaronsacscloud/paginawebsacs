/**
 * QA · «Al enviar, la lista no se me mueve».
 *
 * Nada sale a WhatsApp: se intercepta el envío. Y para provocar el salto que
 * molesta —la fila contestada subiendo al primer lugar— se intercepta también
 * la lista y se devuelve reordenada, como haría el servidor.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4327';
const CONV = 'c8970a60-9580-42f3-81d6-185599657f40';   // Dolores, con ventana abierta
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

// Ningún mensaje sale de verdad.
await p.route('**/api/crm/whatsapp/enviar', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, wamid: 'wamid.QA' }) }));
// La lista, reordenada a partir del envío: la conversación contestada al frente.
let reordenar = false;
await p.route('**/api/crm/whatsapp/inbox**', async r => {
  const res = await r.fetch();
  const j = await res.json();
  if (reordenar && Array.isArray(j.conversaciones)) {
    const i = j.conversaciones.findIndex(c => c.id === CONV);
    if (i > 0) j.conversaciones = [j.conversaciones[i], ...j.conversaciones.filter((_, k) => k !== i)];
  }
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
});

await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto(`${BASE}/admin/crm?tab=whatsapp&wa_conv=${CONV}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(22000);

/* Solo el NOMBRE de cada fila: el resto del renglón trae la hora relativa
   («15 min»), que cambia sola entre una foto y la otra y haría fallar la
   comparación sin que nada se haya movido. */
const orden = () => p.evaluate(() => [...document.querySelectorAll('.wa-fila-hover')].slice(0, 8)
  .map(e => (e.querySelector('b')?.textContent || '').trim()));
const antes = await orden();
paso('La lista cargó', antes.length >= 4, `${antes.length} filas visibles`);

// Se escribe y se manda desde el compositor, como lo haría una persona.
reordenar = true;
const caja = p.locator('textarea, [contenteditable="true"]').last();
await caja.click();
await caja.type('QA orden fijo');
await p.keyboard.press('Enter');
await p.waitForTimeout(9000);

const despues = await orden();
paso('La lista NO se reordenó debajo del envío', JSON.stringify(antes) === JSON.stringify(despues),
  JSON.stringify(antes) === JSON.stringify(despues) ? 'mismo orden' : `antes ${antes[0]} · ahora ${despues[0]}`);
paso('Se avisa que el orden está fijo', (await p.locator('text=Orden fijo mientras contestas').count()) > 0);
await p.screenshot({ path: '/tmp/qa-orden-fijo.png' });

// Y al pedirlo, se reordena.
await p.locator('button', { hasText: 'Reordenar' }).first().click();
await p.waitForTimeout(6000);
const final = await orden();
paso('«Reordenar» sí reordena', final[0] !== antes[0], `ahora primero: ${final[0]}`);
paso('El aviso se va al soltar', (await p.locator('text=Orden fijo mientras contestas').count()) === 0);
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
